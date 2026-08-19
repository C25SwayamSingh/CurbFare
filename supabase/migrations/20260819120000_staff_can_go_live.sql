-- Correction to 20260819110000 (owner's call, Aug 2026): going live IS a
-- worker's job. Whoever is actually standing at the cart should be able to
-- start and end a live session, so vendor_location_sessions returns to
-- any-active-member writes. Schedules stay leadership-only: a recurring
-- window or a posted occurrence is a business decision, not a shift task.
--
-- The cross-tenant re-checks against vendor_units are preserved verbatim:
-- organization_id is denormalized onto this table, so without re-deriving
-- it from vendor_unit_id a member of org A could attach a session to
-- org B's cart.

drop policy if exists "vendor_location_sessions_insert_member"
  on public.vendor_location_sessions;
create policy "vendor_location_sessions_insert_member"
  on public.vendor_location_sessions for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.is_org_member(organization_id)
    and exists (
      select 1 from public.vendor_units vu
      where vu.id = vendor_unit_id
        and vu.organization_id = vendor_location_sessions.organization_id
    )
  );

drop policy if exists "vendor_location_sessions_update_member"
  on public.vendor_location_sessions;
create policy "vendor_location_sessions_update_member"
  on public.vendor_location_sessions for update to authenticated
  using (public.is_org_member(organization_id))
  with check (
    public.is_org_member(organization_id)
    and exists (
      select 1 from public.vendor_units vu
      where vu.id = vendor_unit_id
        and vu.organization_id = vendor_location_sessions.organization_id
    )
  );
