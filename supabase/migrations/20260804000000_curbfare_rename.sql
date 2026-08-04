-- Brand rename: CurbAgora becomes Curbfare (curbfare.app registered
-- 2026-08-04). The only database surface that speaks the brand name to users
-- is the duplicate-license message in create_organization_with_owner, so this
-- migration recreates that function with the new name. Behavior is unchanged.

create or replace function public.create_organization_with_owner(
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
    raise exception 'That license number is already registered to a business on Curbfare. If it is yours, reply to your application email.'
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
