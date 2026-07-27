-- Allow owners and managers to delete a vendor unit outright.
--
-- Deleting a cart is a real, requested operation — a vendor retiring a unit
-- should not need support. The referential rules were already shaped for it:
--   * vendor_location_sessions / vendor_recurring_locations  → ON DELETE CASCADE
--     (location claims belong to the unit; they go with it)
--   * loyalty_claim_codes / vendor_scheduled_occurrences /
--     location_reports                                       → ON DELETE SET NULL
--     (audit history and community reports survive, just unlinked)
-- The loyalty ledger is per-organization and never references the unit, so
-- balances and history are untouched.

grant delete on public.vendor_units to authenticated;

drop policy if exists vendor_units_delete_owner_manager on public.vendor_units;
create policy vendor_units_delete_owner_manager
  on public.vendor_units
  for delete
  using (
    public.has_org_role(
      organization_id,
      array['owner', 'manager']::public.organization_role[]
    )
  );

comment on policy vendor_units_delete_owner_manager on public.vendor_units is
  'Owners and managers may delete their own organization''s units. Staff may '
  'not: removing a cart removes its public page and location history, which '
  'is a management decision, not a counter operation.';
