-- pgTAP tests for organization deletion: owner-only, MFA-verified, cascades
-- clean up every child table, and the last-owner protection still holds for
-- membership deletes that are NOT part of a full teardown.
--
-- Covers: supabase/migrations/20260813120000_organization_owner_delete.sql
begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

create or replace function test_as_user(uid uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
end;
$$;

create or replace function test_as_service() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Fixtures: an owner, a manager, and an outsider sharing one organization.
select test_as_service();

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'delowner@test.local', 'x', now(), '{"provider":"email"}', '{"display_name":"Del Owner"}'),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'delmanager@test.local', 'x', now(), '{"provider":"email"}', '{"display_name":"Del Manager"}'),
  ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'deloutsider@test.local', 'x', now(), '{"provider":"email"}', '{"display_name":"Del Outsider"}');

insert into public.organizations (id, legal_name, display_name, slug, status, created_by)
values ('00000000-0000-0000-0000-00000000d001', 'PGTAP Teardown LLC', 'PGTAP Teardown', 'pgtap-teardown', 'active', '00000000-0000-0000-0000-000000000021');

insert into public.organization_members (organization_id, user_id, role, status)
values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-000000000021', 'owner', 'active'),
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-000000000022', 'manager', 'active');

insert into public.vendor_units (id, organization_id, name, slug, unit_type, description, cuisine_categories, city, created_by)
values ('00000000-0000-0000-0000-00000000d101', '00000000-0000-0000-0000-00000000d001', 'Teardown Cart', 'teardown-cart', 'food_cart', 'pgTAP fixture cart', array['halal'], 'New York', '00000000-0000-0000-0000-000000000021');

-- ----------------------------------------------------------------------------
-- Who may delete
-- ----------------------------------------------------------------------------

-- An outsider deletes nothing, silently (RLS filters the row away).
select test_as_user('00000000-0000-0000-0000-000000000023', 'aal2');
delete from public.organizations where id = '00000000-0000-0000-0000-00000000d001';
select test_as_service();
select is(
  (select count(*)::int from public.organizations where id = '00000000-0000-0000-0000-00000000d001'),
  1,
  'a non-member cannot delete the organization'
);

-- A manager is not enough: deletion is owner-only.
select test_as_user('00000000-0000-0000-0000-000000000022', 'aal2');
delete from public.organizations where id = '00000000-0000-0000-0000-00000000d001';
select test_as_service();
select is(
  (select count(*)::int from public.organizations where id = '00000000-0000-0000-0000-00000000d001'),
  1,
  'a manager cannot delete the organization'
);

-- The owner without an MFA-verified session is refused by the restrictive
-- policy, exactly like organization updates.
select test_as_user('00000000-0000-0000-0000-000000000021', 'aal1');
delete from public.organizations where id = '00000000-0000-0000-0000-00000000d001';
select test_as_service();
select is(
  (select count(*)::int from public.organizations where id = '00000000-0000-0000-0000-00000000d001'),
  1,
  'an aal1 owner session cannot delete the organization'
);

-- ----------------------------------------------------------------------------
-- Last-owner protection still holds outside a teardown
-- ----------------------------------------------------------------------------

select test_as_user('00000000-0000-0000-0000-000000000021', 'aal2');
select throws_ok(
  $$ delete from public.organization_members
     where organization_id = '00000000-0000-0000-0000-00000000d001'
       and user_id = '00000000-0000-0000-0000-000000000021' $$,
  '42501',
  'cannot remove the final owner; transfer ownership first',
  'deleting just the final owner membership is still refused'
);

-- ----------------------------------------------------------------------------
-- The owner, MFA-verified, deletes the whole business
-- ----------------------------------------------------------------------------

select test_as_user('00000000-0000-0000-0000-000000000021', 'aal2');
select lives_ok(
  $$ delete from public.organizations where id = '00000000-0000-0000-0000-00000000d001' $$,
  'an aal2 owner can delete their organization'
);

select test_as_service();
select is(
  (select count(*)::int from public.organizations where id = '00000000-0000-0000-0000-00000000d001'),
  0,
  'the organization row is gone'
);
select is(
  (select count(*)::int from public.organization_members where organization_id = '00000000-0000-0000-0000-00000000d001'),
  0,
  'memberships cascade away with the organization'
);
select is(
  (select count(*)::int from public.vendor_units where organization_id = '00000000-0000-0000-0000-00000000d001'),
  0,
  'vendor units cascade away with the organization'
);

-- Users themselves survive; only the business is gone.
select is(
  (select count(*)::int from auth.users where id = '00000000-0000-0000-0000-000000000021'),
  1,
  'the former owner account still exists'
);
select is(
  (select count(*)::int from auth.users where id = '00000000-0000-0000-0000-000000000022'),
  1,
  'the former manager account still exists'
);

select * from finish();
rollback;
