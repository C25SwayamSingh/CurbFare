-- The hotspot idempotency index was partial (WHERE source_record_id IS NOT
-- NULL). Postgres allows any number of NULLs in a plain composite unique
-- index anyway, so the predicate bought nothing — and it broke PostgREST
-- upserts, whose ON CONFLICT inference cannot name a partial index. Replace
-- it with a plain unique index and align the approve function's ON CONFLICT.

drop index if exists location_hotspots_source_record_key;
create unique index location_hotspots_source_record_key
  on public.location_hotspots (source_type, source_record_id);

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
  on conflict (source_type, source_record_id)
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
