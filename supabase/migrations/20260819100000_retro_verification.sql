-- Retro-verification: with auto-approval, review happens on ACTIVE
-- organizations. Approve becomes "mark verified" (stamps reviewed_by/at,
-- clears any note, keeps active). Reject now also takes down an active
-- listing that failed the retro-check, not just a pending one.

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
  if v_status not in ('pending', 'active') then
    raise exception 'only pending or active businesses can be verified (this one is %)', v_status
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
  if v_status not in ('pending', 'active') then
    raise exception 'only pending or active businesses can be rejected (this one is %)', v_status
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
