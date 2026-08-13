-- Owners can close their business — one guarded delete removes the whole
-- organization. Every child table already cascades on organizations
-- (memberships, units, loyalty ledger, locations, invitations), so the only
-- two pieces missing were:
--
--   1. A DELETE policy on organizations. Owner-only, and MFA-verified like
--      every other sensitive organization write (mirrors the existing
--      organizations_update_owner + organizations_update_requires_mfa pair).
--
--   2. An escape in protect_membership_delete. That trigger stops the last
--      active owner from being removed so an organization can never be
--      orphaned — but during a full teardown the cascade must delete the
--      final owner row too. The escape is precise: the owner row may go
--      only when its organization row is already gone, which within a
--      single cascading DELETE statement is exactly the teardown case and
--      never the orphaning case.

-- RLS decides WHICH rows; the base grant decides IF the verb exists at all.
-- DELETE was never granted to authenticated before this feature.
grant delete on table public.organizations to authenticated;

create policy organizations_delete_owner
  on public.organizations
  for delete using (
    public.has_org_role(id, array['owner'::public.organization_role])
  );

create policy organizations_delete_requires_mfa
  on public.organizations
  as restrictive
  for delete using (public.mfa_assurance_ok());

create or replace function public.protect_membership_delete()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if coalesce(current_setting('role', true), 'none')
     in ('anon', 'authenticated') then
    if old.role = 'owner' and old.status = 'active' then
      -- Full-teardown escape: when the organization row itself is already
      -- deleted (we are inside its ON DELETE CASCADE), removing the final
      -- owner is the point, not an orphaning hazard.
      if exists (
        select 1
        from public.organizations o
        where o.id = old.organization_id
      ) then
        if not exists (
          select 1
          from public.organization_members m
          where m.organization_id = old.organization_id
            and m.role = 'owner'
            and m.status = 'active'
            and m.id <> old.id
        ) then
          raise exception 'cannot remove the final owner; transfer ownership first'
            using errcode = '42501';
        end if;
      end if;
    end if;
  end if;
  return old;
end;
$$;
