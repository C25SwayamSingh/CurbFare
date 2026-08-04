-- Becoming a vendor is an APPLICATION, not a signup.
--
-- New organizations start as 'pending' with the applicant's claimed DOHMH
-- license and cart-permit numbers attached. Every public surface already
-- filters on status = 'active' (vendor_unit_previews, the loyalty and
-- location previews), so a pending business is publicly inert from the
-- moment it exists: no map presence, no rewards, no page. A platform admin
-- reviews behind the scenes and approves or rejects; nothing auto-promotes.
--
-- The license/permit numbers are applicant-claimed facts for the reviewer,
-- not verified credentials — NYC does not publish the license roster, so
-- human review is the design, not a stopgap. review_note is admin-only and
-- must never reach a customer- or vendor-facing view.
--
-- Enum note: the new values are only ever evaluated at runtime (function
-- bodies, later DML); nothing in this transaction stores them, so the
-- ALTER TYPE ADD VALUE same-transaction restriction is not tripped.

alter type public.organization_status add value if not exists 'pending';
alter type public.organization_status add value if not exists 'rejected';

alter table public.organizations
  add column if not exists license_number text,
  add column if not exists permit_number text,
  add column if not exists application_note text,
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists applied_at timestamptz not null default now();

comment on column public.organizations.license_number is
  'Applicant-claimed DOHMH mobile food vending license (badge) number. '
  'Reviewed by a human; never displayed publicly.';
comment on column public.organizations.permit_number is
  'Applicant-claimed mobile food vending unit permit (decal) number. '
  'Reviewed by a human; never displayed publicly.';
comment on column public.organizations.review_note is
  'Admin-only review reasoning. Never expose through any public view.';

-- Platform admins may read every organization to run the review queue.
create policy organizations_select_admin
  on public.organizations
  for select using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Creation: same transactional org+owner insert, now landing in 'pending'
-- with application facts. The automated filter lives here: shape checks and
-- a duplicate-license rejection run before anything is written.
-- ---------------------------------------------------------------------------

drop function if exists public.create_organization_with_owner(text, text, text);

create function public.create_organization_with_owner(
  p_legal_name text,
  p_display_name text,
  p_slug text,
  p_license_number text,
  p_permit_number text,
  p_application_note text default null
)
returns public.organizations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_org public.organizations;
begin
  if v_user is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  if p_slug is null or p_slug !~ '^[a-z0-9](?:[a-z0-9-]{0,46})[a-z0-9]$' then
    raise exception 'invalid organization slug'
      using errcode = '23514';
  end if;
  if p_legal_name is null or char_length(trim(p_legal_name)) not between 2 and 200 then
    raise exception 'invalid legal name'
      using errcode = '23514';
  end if;
  if p_display_name is null or char_length(trim(p_display_name)) not between 2 and 120 then
    raise exception 'invalid display name'
      using errcode = '23514';
  end if;
  if p_license_number is null
     or trim(p_license_number) !~ '^[A-Za-z0-9][A-Za-z0-9 -]{2,30}[A-Za-z0-9]$' then
    raise exception 'Enter your mobile food vending license number as it appears on your badge.'
      using errcode = 'P0001';
  end if;
  if p_permit_number is null
     or trim(p_permit_number) !~ '^[A-Za-z0-9][A-Za-z0-9 -]{2,30}[A-Za-z0-9]$' then
    raise exception 'Enter your cart permit number as it appears on the decal.'
      using errcode = 'P0001';
  end if;
  if p_application_note is not null and char_length(p_application_note) > 1000 then
    raise exception 'Keep your note under 1,000 characters.'
      using errcode = 'P0001';
  end if;

  -- Automated filter: one license, one business. Rejected applications
  -- free their number; pending and active ones hold it.
  if exists (
    select 1 from public.organizations o
     where upper(trim(o.license_number)) = upper(trim(p_license_number))
       and o.status in ('pending', 'active')
  ) then
    raise exception 'That license number is already registered to a business on CurbAgora. If it is yours, reply to your application email.'
      using errcode = 'P0001';
  end if;

  insert into public.organizations
    (legal_name, display_name, slug, created_by, status,
     license_number, permit_number, application_note, applied_at)
  values
    (trim(p_legal_name), trim(p_display_name), p_slug, v_user, 'pending',
     trim(p_license_number), trim(p_permit_number),
     nullif(trim(coalesce(p_application_note, '')), ''), now())
  returning * into v_org;

  insert into public.organization_members (organization_id, user_id, role, status, invited_by)
  values (v_org.id, v_user, 'owner', 'active', null);

  return v_org;
end;
$$;

comment on function public.create_organization_with_owner(text, text, text, text, text, text) is
  'Vendor application: creates a PENDING organization with its owner and '
  'the applicant-claimed license/permit numbers in one transaction. Public '
  'surfaces ignore pending orgs; a platform admin approves or rejects.';

-- ---------------------------------------------------------------------------
-- Review: platform-admin-only transitions, mirroring the location-import
-- review functions. Approval is the ONLY path from pending to active.
-- ---------------------------------------------------------------------------

create or replace function public.vendor_application_approve(p_organization_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_status public.organization_status;
begin
  if not public.is_platform_admin() then
    raise exception 'only platform admins can review applications' using errcode = '42501';
  end if;
  select status into v_status from public.organizations where id = p_organization_id;
  if v_status is null then
    raise exception 'application not found' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'only pending applications can be approved (this one is %)', v_status
      using errcode = 'P0001';
  end if;
  update public.organizations
     set status = 'active',
         review_note = null,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_organization_id;
end;
$$;

create or replace function public.vendor_application_reject(
  p_organization_id uuid,
  p_note text default null
)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_status public.organization_status;
begin
  if not public.is_platform_admin() then
    raise exception 'only platform admins can review applications' using errcode = '42501';
  end if;
  select status into v_status from public.organizations where id = p_organization_id;
  if v_status is null then
    raise exception 'application not found' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'only pending applications can be rejected (this one is %)', v_status
      using errcode = 'P0001';
  end if;
  update public.organizations
     set status = 'rejected',
         review_note = p_note,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_organization_id;
end;
$$;
