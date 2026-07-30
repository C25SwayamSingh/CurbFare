-- pgTAP tests for the external import pipeline: staging privacy, review
-- authorization, hotspot publication, idempotency, and the invariant that
-- staged data never leaks into customer-facing views.
--
-- Covers: supabase/migrations/20260723000000_location_import_pipeline.sql
begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

-- ----------------------------------------------------------------------------
-- Helpers (redefined per file; each test file rolls back independently)
-- ----------------------------------------------------------------------------
create or replace function test_as_user(uid uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
end;
$$;

create or replace function test_as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end;
$$;

create or replace function test_as_service() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ----------------------------------------------------------------------------
-- Fixtures: a platform admin, a regular vendor owner (not an admin), one
-- org+unit for association, one import source, and two staged records —
-- a municipal hotspot candidate and a coordinate-less permit lead.
-- ----------------------------------------------------------------------------
select test_as_service();

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local',  'x', now(), '{"provider":"email"}', '{"display_name":"Admin"}'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@test.local',  'x', now(), '{"provider":"email"}', '{"display_name":"Owner"}');

insert into public.platform_admins (user_id, note)
values ('00000000-0000-0000-0000-000000000001', 'pgTAP fixture');

insert into public.organizations (id, legal_name, display_name, slug, created_by)
values ('10000000-0000-0000-0000-000000000001', 'Taco Cart LLC', 'Taco Cart', 'taco-cart', '00000000-0000-0000-0000-000000000002');

insert into public.organization_members (organization_id, user_id, role, status)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'owner', 'active');

insert into public.vendor_units (id, organization_id, name, unit_type, city, slug, created_by)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        'Taco Cart', 'food_cart', 'Jersey City', 'taco-cart', '00000000-0000-0000-0000-000000000002');

insert into public.location_import_sources
  (id, source_name, adapter, source_type, endpoint, dataset, license, attribution)
values
  ('30000000-0000-0000-0000-000000000001', 'pgtap-import-fixture', 'OPENDATASOFT',
   'MUNICIPAL_OPEN_DATA', 'https://data.jerseycitynj.gov/api/explore/v2.1', 'food-truck-location',
   'Public domain', 'City of Jersey City Open Data');

insert into public.location_import_records
  (id, source_id, source_name, source_type, source_record_id, source_url,
   latitude, longitude, public_label, schedule_type, verification, raw_source)
values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   'pgtap-import-fixture', 'MUNICIPAL_OPEN_DATA',
   'pgtap:fixture:rec-1', 'https://data.jerseycitynj.gov/x',
   40.7178, -74.0431, 'PGTAP fixture vending zone', 'HOTSPOT', 'CONFIRMED',
   '{"fixture": true}'::jsonb),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001',
   'pgtap-import-fixture', 'MUNICIPAL_OPEN_DATA',
   'pgtap:fixture:permit-9', null,
   null, null, null, 'VENDOR_LEAD', 'UNVERIFIED',
   '{"fixture": true, "applicant": "Synthetic Cart Co"}'::jsonb);

-- ----------------------------------------------------------------------------
-- Staging privacy
-- ----------------------------------------------------------------------------
select test_as_anon();
select throws_ok(
  $$ select count(*) from public.location_import_sources $$,
  '42501', null,
  'anonymous users cannot read import sources at all'
);
select throws_ok(
  $$ select count(*) from public.location_import_records $$,
  '42501', null,
  'anonymous users cannot read staged import records at all'
);

select test_as_user('00000000-0000-0000-0000-000000000002', 'aal2'); -- vendor owner, not admin
select is(
  (select count(*)::int from public.location_import_sources), 0,
  'a signed-in non-admin sees zero import sources'
);
select is(
  (select count(*)::int from public.location_import_records), 0,
  'a signed-in non-admin sees zero staged records — raw payloads stay private'
);

select test_as_user('00000000-0000-0000-0000-000000000001', 'aal2'); -- platform admin
select is(
  (select count(*)::int from public.location_import_records
    where source_name = 'pgtap-import-fixture'), 2,
  'a platform admin can read the staging queue'
);

-- ----------------------------------------------------------------------------
-- Idempotency identity
-- ----------------------------------------------------------------------------
select test_as_service();
select throws_ok(
  $$ insert into public.location_import_records
       (source_id, source_name, source_type, source_record_id,
        latitude, longitude, schedule_type, raw_source)
     values
       ('30000000-0000-0000-0000-000000000001', 'pgtap-import-fixture',
        'MUNICIPAL_OPEN_DATA', 'pgtap:fixture:rec-1',
        40.7, -74.0, 'HOTSPOT', '{}'::jsonb) $$,
  '23505', null,
  're-importing the same (source_name, source_record_id) is a conflict, not a duplicate'
);

-- ----------------------------------------------------------------------------
-- Review authorization
-- ----------------------------------------------------------------------------
select test_as_user('00000000-0000-0000-0000-000000000002', 'aal2'); -- non-admin
select throws_ok(
  $$ select public.location_import_approve_hotspot('40000000-0000-0000-0000-000000000001') $$,
  '42501', null,
  'a vendor owner cannot approve imported records'
);
select throws_ok(
  $$ select public.location_import_reject('40000000-0000-0000-0000-000000000001', 'nope') $$,
  '42501', null,
  'a vendor owner cannot reject imported records'
);

-- ----------------------------------------------------------------------------
-- Approval publishes a hotspot — a place, never a vendor, never live
-- ----------------------------------------------------------------------------
select test_as_user('00000000-0000-0000-0000-000000000001', 'aal2'); -- admin
select lives_ok(
  $$ select public.location_import_approve_hotspot('40000000-0000-0000-0000-000000000001') $$,
  'a platform admin can approve a staged municipal record as a hotspot'
);

select test_as_service();
select is(
  (select count(*)::int from public.location_hotspots
    where source_record_id = 'pgtap:fixture:rec-1'
      and verification = 'CONFIRMED'),
  1,
  'approval created exactly one CONFIRMED hotspot'
);
select is(
  (select count(*)::int from public.location_import_records
    where id = '40000000-0000-0000-0000-000000000001'
      and status = 'published'
      and published_hotspot_id is not null),
  1,
  'the staged record now points at its published hotspot'
);

select test_as_anon();
select is(
  (select count(*)::int from public.location_hotspot_previews
    where public_name = 'PGTAP fixture vending zone'),
  1,
  'the approved hotspot is publicly visible through the preview view'
);
select test_as_service();
select is(
  (select count(*)::int from public.location_hotspots
    where source_record_id like 'pgtap:%'),
  1,
  'nothing else from staging became a hotspot — the permit lead stays hidden'
);
select test_as_anon();

-- ----------------------------------------------------------------------------
-- Guard rails on the other transitions
-- ----------------------------------------------------------------------------
select test_as_user('00000000-0000-0000-0000-000000000001', 'aal2'); -- admin
select throws_ok(
  $$ select public.location_import_approve_hotspot('40000000-0000-0000-0000-000000000002') $$,
  'P0001', null,
  'a coordinate-less permit lead can never become a hotspot'
);
select throws_ok(
  $$ select public.location_import_associate(
       '40000000-0000-0000-0000-000000000002',
       '99999999-9999-4999-8999-999999999999') $$,
  'P0002', null,
  'associating a lead with a nonexistent vendor unit fails'
);
select lives_ok(
  $$ select public.location_import_associate(
       '40000000-0000-0000-0000-000000000002',
       '20000000-0000-0000-0000-000000000001',
       'same cart, confirmed by phone') $$,
  'an admin can associate a lead with an existing vendor unit'
);

select test_as_service();
select is(
  (select count(*)::int from public.location_import_records
    where id = '40000000-0000-0000-0000-000000000002'
      and status = 'associated'
      and associated_vendor_unit_id = '20000000-0000-0000-0000-000000000001'),
  1,
  'association links the lead without creating or transferring anything'
);

select * from finish();

rollback;
