-- Curated third-party lists (hand-collected watchlists of known cart
-- corners) need a home in the import registry. 'MANUAL' marks a source
-- whose records arrive through a reviewed local script instead of a
-- fetching adapter — same staging table, same admin-only review gates,
-- and nothing it stages can auto-publish or ever become "Live".
alter table public.location_import_sources
  drop constraint location_import_sources_adapter_check;

alter table public.location_import_sources
  add constraint location_import_sources_adapter_check
  check (adapter in ('SOCRATA', 'OPENDATASOFT', 'ARCGIS', 'OVERPASS', 'MANUAL'));
