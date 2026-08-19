-- Staff role narrows to CHECKOUT ONLY (owner's decision, Aug 2026): an
-- invited worker can award and redeem points at the window and nothing
-- else. Going live, ending sessions, and editing schedules become
-- owner/manager actions, at the database layer, not just in the app.
-- Selects stay member-wide (reading is harmless and keeps the dashboard
-- working if a staff member ever loads it); the app additionally routes
-- staff straight to /vendor/checkout.

-- A) Live location sessions: writes require owner or manager.
drop policy if exists "vendor_location_sessions_insert_member"
  on public.vendor_location_sessions;
create policy "vendor_location_sessions_insert_member"
  on public.vendor_location_sessions for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.has_org_role(organization_id, array['owner','manager']::public.organization_role[])
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
  using (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]))
  with check (
    public.has_org_role(organization_id, array['owner','manager']::public.organization_role[])
    and exists (
      select 1 from public.vendor_units vu
      where vu.id = vendor_unit_id
        and vu.organization_id = vendor_location_sessions.organization_id
    )
  );

-- B) Recurring locations: writes require owner or manager.
drop policy if exists "vendor_recurring_write_member"
  on public.vendor_recurring_locations;
create policy "vendor_recurring_write_member"
  on public.vendor_recurring_locations for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['owner','manager']::public.organization_role[])
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.vendor_units u
       where u.id = vendor_unit_id and u.organization_id = organization_id
    )
  );

drop policy if exists "vendor_recurring_update_member"
  on public.vendor_recurring_locations;
create policy "vendor_recurring_update_member"
  on public.vendor_recurring_locations for update to authenticated
  using (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));

-- C) Scheduled occurrences: writes require owner or manager.
drop policy if exists "vendor_scheduled_insert_member"
  on public.vendor_scheduled_occurrences;
create policy "vendor_scheduled_insert_member"
  on public.vendor_scheduled_occurrences for insert to authenticated
  with check (
    organization_id is not null
    and public.has_org_role(organization_id, array['owner','manager']::public.organization_role[])
    and created_by = (select auth.uid())
    and (
      vendor_unit_id is null
      or exists (
        select 1 from public.vendor_units u
         where u.id = vendor_unit_id and u.organization_id = organization_id
      )
    )
  );

drop policy if exists "vendor_scheduled_update_member"
  on public.vendor_scheduled_occurrences;
create policy "vendor_scheduled_update_member"
  on public.vendor_scheduled_occurrences for update to authenticated
  using (
    organization_id is not null
    and public.has_org_role(organization_id, array['owner','manager']::public.organization_role[])
  )
  with check (
    organization_id is not null
    and public.has_org_role(organization_id, array['owner','manager']::public.organization_role[])
  );
