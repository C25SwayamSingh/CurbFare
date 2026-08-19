-- pgTAP tests for the vendor application flow under founding auto-approval:
-- creation lands ACTIVE-but-unreviewed, the duplicate-license automated
-- filter still bites, review is admin-only, verification stamps the
-- reviewer, and a failed retro-check can take an active listing down.
--
-- Covers: 20260803000000_vendor_applications.sql,
-- 20260819090000_founding_auto_approval.sql, 20260819100000_retro_verification.sql
begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

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

-- Fixtures: a platform admin and two applicants.
select test_as_service();

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'appadmin@test.local', 'x', now(), '{"provider":"email"}', '{"display_name":"Admin"}'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'applicant1@test.local', 'x', now(), '{"provider":"email"}', '{"display_name":"Applicant One"}'),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'applicant2@test.local', 'x', now(), '{"provider":"email"}', '{"display_name":"Applicant Two"}');

insert into public.platform_admins (user_id, note)
values ('00000000-0000-0000-0000-000000000011', 'pgTAP fixture');

-- ----------------------------------------------------------------------------
-- Application creation: pending by default, owner attached, filter enforced
-- ----------------------------------------------------------------------------
select test_as_user('00000000-0000-0000-0000-000000000012');

select lives_ok(
  $$ select public.create_organization_with_owner(
       'PGTAP Cart One LLC', 'PGTAP Cart One', 'pgtap-cart-one',
       'MFV-PGTAP-001', 'PC-PGTAP-001', 'weekday cart fixture') $$,
  'an authenticated user can submit a vendor application'
);

select test_as_service();
select is(
  (select status::text || '|' || coalesce(reviewed_at::text, 'unreviewed')
     from public.organizations where slug = 'pgtap-cart-one'),
  'active|unreviewed',
  'a new application lands ACTIVE and unreviewed (founding auto-approval)'
);
select is(
  (select count(*)::int from public.organization_members om
    join public.organizations o on o.id = om.organization_id
   where o.slug = 'pgtap-cart-one'
     and om.user_id = '00000000-0000-0000-0000-000000000012'
     and om.role = 'owner' and om.status = 'active'),
  1,
  'the applicant becomes the owner in the same transaction'
);

select test_as_user('00000000-0000-0000-0000-000000000013');
select throws_ok(
  $$ select public.create_organization_with_owner(
       'Copycat LLC', 'Copycat Cart', 'pgtap-copycat',
       'MFV-PGTAP-001', 'PC-OTHER-001', null) $$,
  'P0001', null,
  'the automated filter blocks a duplicate license number'
);
select throws_ok(
  $$ select public.create_organization_with_owner(
       'Bad LLC', 'Bad Cart', 'pgtap-bad', '!!', 'PC-1', null) $$,
  'P0001', null,
  'a malformed license number never reaches the table'
);

-- An auto-approved business is publicly visible the moment it has a unit.
select test_as_service();
insert into public.vendor_units (id, organization_id, name, unit_type, city, slug, created_by)
select '20000000-0000-0000-0000-000000000021', o.id,
       'PGTAP Cart One Unit', 'food_cart', 'Jersey City', 'pgtap-cart-one',
       '00000000-0000-0000-0000-000000000012'
  from public.organizations o where o.slug = 'pgtap-cart-one';

select test_as_anon();
select is(
  (select count(*)::int from public.vendor_unit_previews
    where slug = 'pgtap-cart-one'),
  1,
  'an auto-approved organization''s units are publicly visible immediately'
);

-- ----------------------------------------------------------------------------
-- Review authorization and transitions
-- ----------------------------------------------------------------------------
select test_as_user('00000000-0000-0000-0000-000000000012', 'aal2'); -- owner, not admin
select throws_ok(
  $$ select public.vendor_application_approve(
       (select id from public.organizations where slug = 'pgtap-cart-one')) $$,
  '42501', null,
  'an applicant cannot approve their own application'
);

select test_as_user('00000000-0000-0000-0000-000000000011', 'aal2'); -- platform admin
select lives_ok(
  $$ select public.vendor_application_approve(
       (select id from public.organizations where slug = 'pgtap-cart-one')) $$,
  'a platform admin can stamp verification on an active business'
);

select test_as_service();
select is(
  (select status from public.organizations where slug = 'pgtap-cart-one'),
  'active'::public.organization_status,
  'approval activates the organization'
);
select is(
  (select reviewed_by from public.organizations where slug = 'pgtap-cart-one'),
  '00000000-0000-0000-0000-000000000011'::uuid,
  'approval records the reviewer'
);

select test_as_anon();
select is(
  (select count(*)::int from public.vendor_unit_previews
    where slug = 'pgtap-cart-one'),
  1,
  'the business stays publicly visible after verification'
);

select test_as_user('00000000-0000-0000-0000-000000000011', 'aal2');
select lives_ok(
  $$ select public.vendor_application_approve(
       (select id from public.organizations where slug = 'pgtap-cart-one')) $$,
  're-verifying an active business is allowed (idempotent retro-check)'
);

-- Rejection stores the private note and frees the license for reuse.
select test_as_user('00000000-0000-0000-0000-000000000013');
select lives_ok(
  $$ select public.create_organization_with_owner(
       'PGTAP Cart Two LLC', 'PGTAP Cart Two', 'pgtap-cart-two',
       'MFV-PGTAP-002', 'PC-PGTAP-002', null) $$,
  'a second applicant with a distinct license can apply'
);

select test_as_user('00000000-0000-0000-0000-000000000011', 'aal2');
select lives_ok(
  $$ select public.vendor_application_reject(
       (select id from public.organizations where slug = 'pgtap-cart-two'),
       'pgtap: license not found in records') $$,
  'a platform admin can take down an active business with a private note'
);

select test_as_service();
select is(
  (select status::text || '|' || coalesce(review_note, '')
     from public.organizations where slug = 'pgtap-cart-two'),
  'rejected|pgtap: license not found in records',
  'rejection stores the status and the admin-only note'
);

select * from finish();

rollback;
