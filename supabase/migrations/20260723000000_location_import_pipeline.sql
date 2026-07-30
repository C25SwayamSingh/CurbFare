-- External open-data import pipeline: staging, provenance, source health,
-- and admin review — the machinery behind the deferred importer described in
-- docs/decisions/location-intelligence.md §9.
--
-- Design rules this schema enforces:
--   * External data NEVER becomes a live location. There is no path from
--     these tables to vendor_location_sessions, and the only publication
--     target is location_hotspots — the one state that promises nobody.
--   * Raw source payloads are audit data: they live here, behind
--     platform-admin-only RLS, and never in a customer-facing table or view.
--   * Idempotency is (source_name, source_record_id). Adapter code namespaces
--     record ids (e.g. 'sfgov:rqzj-sfat:{row}') so two cities sharing a
--     source_type can never collide in location_hotspots either.
--   * Imported rows are marked stale when a source stops returning them —
--     never deleted, and never allowed to delete vendor-confirmed data.

-- OpenStreetMap is a directory of places, not a schedule or a social lead;
-- pretending otherwise would misfile its provenance. (Added here, used only
-- by later inserts — a value added in a transaction cannot be referenced in
-- the same transaction.)
alter type public.location_source_type add value if not exists 'THIRD_PARTY_DIRECTORY';

-- ---------------------------------------------------------------------------
-- Source registry + health. One row per configured feed.
-- ---------------------------------------------------------------------------
create table if not exists public.location_import_sources (
  id uuid primary key default gen_random_uuid(),
  -- Stable machine name, e.g. 'jerseycity-food-truck-location'.
  source_name text not null unique
    check (source_name ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  adapter text not null
    check (adapter in ('SOCRATA', 'OPENDATASOFT', 'ARCGIS', 'OVERPASS')),
  source_type public.location_source_type not null,
  endpoint text not null check (endpoint like 'https://%'),
  dataset text,
  -- Attribution is a licensing obligation (ODbL for OSM), not decoration.
  license text not null,
  attribution text not null,
  enabled boolean not null default true,
  -- Health: written by the import runner after every attempt.
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  consecutive_failures int not null default 0,
  records_received int not null default 0,
  records_created int not null default 0,
  records_updated int not null default 0,
  records_rejected int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.location_import_sources is
  'Configured external feeds and their import health. Admin/service only.';

create trigger location_import_sources_updated_at
  before update on public.location_import_sources
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Staged records. Everything an adapter fetches lands here first; nothing
-- reaches a customer until a rule (JC hotspots) or an admin publishes it.
-- ---------------------------------------------------------------------------
create table if not exists public.location_import_records (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null
    references public.location_import_sources(id) on delete cascade,
  source_name text not null,
  source_type public.location_source_type not null,
  -- Namespaced by the adapter: '{source}:{dataset}:{record}'.
  source_record_id text not null,
  source_url text,
  source_updated_at timestamptz,
  name text,
  vendor_name text,
  -- A permit lead may arrive without coordinates; anything that could ever
  -- appear on a map may not.
  latitude double precision
    check (latitude is null or (latitude >= -90 and latitude <= 90)),
  longitude double precision
    check (longitude is null or (longitude >= -180 and longitude <= 180)),
  public_label text,
  schedule_type text not null
    check (schedule_type in ('HOTSPOT', 'RECURRING', 'SCHEDULED', 'VENDOR_LEAD')),
  constraint location_import_coords_required
    check (schedule_type = 'VENDOR_LEAD'
           or (latitude is not null and longitude is not null)),
  starts_at timestamptz,
  ends_at timestamptz,
  days_of_week smallint[],
  timezone text,
  verification public.location_verification not null default 'UNVERIFIED',
  status text not null default 'staged'
    check (status in ('staged', 'published', 'rejected', 'stale', 'associated')),
  published_hotspot_id uuid
    references public.location_hotspots(id) on delete set null,
  associated_vendor_unit_id uuid
    references public.vendor_units(id) on delete set null,
  -- The record exactly as the source sent it — audit trail, never public.
  raw_source jsonb not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_name, source_record_id)
);

comment on table public.location_import_records is
  'Staged external location records with raw payloads. Admin/service only; '
  'publication flows through location_import_approve_hotspot or the '
  'JC-hotspot trusted rule, never directly to customers.';

create index if not exists location_import_records_status_idx
  on public.location_import_records (status, source_name);

create trigger location_import_records_updated_at
  before update on public.location_import_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: default deny. Platform admins may read; nobody writes through RLS —
-- the import runner uses the service role, and review goes through the
-- SECURITY DEFINER functions below.
-- ---------------------------------------------------------------------------
alter table public.location_import_sources enable row level security;
alter table public.location_import_records enable row level security;

grant select on public.location_import_sources to authenticated;
grant select on public.location_import_records to authenticated;

create policy location_import_sources_select_admin
  on public.location_import_sources
  for select using (public.is_platform_admin());

create policy location_import_records_select_admin
  on public.location_import_records
  for select using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Review actions. Each asserts platform admin (which itself requires aal2)
-- and moves a staged record through exactly one legal transition.
-- ---------------------------------------------------------------------------

create or replace function public.location_import_approve_hotspot(p_record_id uuid)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_rec public.location_import_records;
  v_hotspot_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'only platform admins can review imports' using errcode = '42501';
  end if;

  select * into v_rec from public.location_import_records where id = p_record_id;
  if v_rec.id is null then
    raise exception 'import record not found' using errcode = 'P0002';
  end if;
  if v_rec.status not in ('staged', 'stale') then
    raise exception 'record is % — only staged or stale records can be approved', v_rec.status
      using errcode = 'P0001';
  end if;
  if v_rec.latitude is null or v_rec.longitude is null then
    raise exception 'a record without coordinates cannot become a hotspot'
      using errcode = 'P0001';
  end if;

  -- A hotspot is a PLACE. Approval never creates a vendor, an organization,
  -- or anything labelled live.
  insert into public.location_hotspots
    (latitude, longitude, public_name, source_type, source_url,
     source_record_id, verification, last_imported_at)
  values
    (v_rec.latitude, v_rec.longitude,
     coalesce(v_rec.public_label, v_rec.name, 'Mobile food location'),
     v_rec.source_type, v_rec.source_url, v_rec.source_record_id,
     'CONFIRMED', now())
  on conflict (source_type, source_record_id) where source_record_id is not null
  do update set
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    public_name = excluded.public_name,
    source_url = excluded.source_url,
    verification = 'CONFIRMED',
    last_imported_at = now()
  returning id into v_hotspot_id;

  update public.location_import_records
     set status = 'published',
         published_hotspot_id = v_hotspot_id,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_record_id;

  return v_hotspot_id;
end;
$$;

create or replace function public.location_import_reject(
  p_record_id uuid,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'only platform admins can review imports' using errcode = '42501';
  end if;
  update public.location_import_records
     set status = 'rejected',
         review_notes = coalesce(p_note, review_notes),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_record_id;
  if not found then
    raise exception 'import record not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.location_import_mark_stale(p_record_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'only platform admins can review imports' using errcode = '42501';
  end if;
  update public.location_import_records
     set status = 'stale',
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_record_id;
  if not found then
    raise exception 'import record not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Associate a lead with an EXISTING vendor unit. A link for follow-up and
-- provenance — it never transfers ownership, never creates accounts, and
-- never publishes anything by itself.
create or replace function public.location_import_associate(
  p_record_id uuid,
  p_vendor_unit_id uuid,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'only platform admins can review imports' using errcode = '42501';
  end if;
  if not exists (select 1 from public.vendor_units where id = p_vendor_unit_id) then
    raise exception 'vendor unit not found' using errcode = 'P0002';
  end if;
  update public.location_import_records
     set status = 'associated',
         associated_vendor_unit_id = p_vendor_unit_id,
         review_notes = coalesce(p_note, review_notes),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_record_id;
  if not found then
    raise exception 'import record not found' using errcode = 'P0002';
  end if;
end;
$$;
