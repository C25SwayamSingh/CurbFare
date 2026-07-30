-- The import runner operates as the service role, and this project grants
-- privileges explicitly rather than relying on default-privilege inheritance.
--
-- DELETE is deliberately absent everywhere: the pipeline marks records stale,
-- it never removes them — and now it cannot, even as the service role.

grant select, insert, update on public.location_import_sources to service_role;
grant select, insert, update on public.location_import_records to service_role;

-- Trusted municipal zones publish directly to hotspots (the JC rule); the
-- human-review path goes through SECURITY DEFINER functions instead.
grant select, insert, update on public.location_hotspots to service_role;
