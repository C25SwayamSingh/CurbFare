-- Program economics are the owner's alone.
--
-- Publishing (or replacing) a loyalty program sets points-per-dollar and
-- reward prices — financial commitments of the business. The business owner
-- decides these; managers and staff run the counter (checkout, awards,
-- redemptions) and may still pause operationally, but cannot change the
-- deal offered to customers. Enforced here, in the database, so no UI or
-- API path can widen it.

CREATE OR REPLACE FUNCTION public.loyalty_publish_program(p_organization_id uuid, p_points_per_dollar integer, p_catalog jsonb, p_advisor_snapshot jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_program_id uuid;
  v_next_version int;
  v_version_id uuid;
  v_item jsonb;
  v_cost int;
  v_kind text;
  v_value int;
  v_points int;
  v_spend int;
  v_count int := 0;
begin
  if not public.has_org_role(p_organization_id, array['owner']::public.organization_role[]) then
    raise exception 'only owners can publish loyalty programs'
      using errcode = '42501';
  end if;

  if p_points_per_dollar is null or p_points_per_dollar < 1 or p_points_per_dollar > 100 then
    raise exception 'points per dollar must be between 1 and 100' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_catalog) <> 'array' or jsonb_array_length(p_catalog) = 0 then
    raise exception 'the reward catalog must have at least one reward' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_catalog) > 6 then
    raise exception 'a catalog may have at most 6 rewards' using errcode = 'P0001';
  end if;

  -- Validate every tier before writing anything.
  for v_item in select * from jsonb_array_elements(p_catalog)
  loop
    v_kind := v_item->>'reward_kind';
    v_value := (v_item->>'reward_value_cents')::int;
    v_points := (v_item->>'points_cost')::int;
    if v_kind not in ('FREE_ITEM', 'FIXED_DISCOUNT') then
      raise exception 'unsupported reward kind: %', v_kind using errcode = 'P0001';
    end if;
    if v_points is null or v_points <= 0 then
      raise exception 'each reward needs a positive points cost' using errcode = 'P0001';
    end if;
    if v_value is null or v_value <= 0 then
      raise exception 'each reward needs a positive value' using errcode = 'P0001';
    end if;

    if v_kind = 'FIXED_DISCOUNT' then
      v_cost := v_value;
    else
      v_cost := coalesce((v_item->>'reward_est_cost_cents')::int, (v_value * 30) / 100);
    end if;

    -- Spend to earn this reward = points_cost / points_per_dollar dollars.
    v_spend := (v_points * 100) / p_points_per_dollar;
    if v_cost * 10 > v_spend then
      raise exception 'reward "%" costs more than 10%% of the spend needed to earn it; lower its cost or raise its points',
        coalesce(v_item->>'reward_name', 'reward') using errcode = 'P0001';
    end if;
  end loop;

  insert into public.loyalty_programs (organization_id, created_by)
  values (p_organization_id, auth.uid())
  on conflict (organization_id) do update set updated_at = now()
  returning id into v_program_id;

  update public.loyalty_program_versions
     set status = 'archived'
   where program_id = v_program_id and status = 'active';

  select coalesce(max(version_number), 0) + 1 into v_next_version
    from public.loyalty_program_versions where program_id = v_program_id;

  insert into public.loyalty_program_versions
    (program_id, organization_id, version_number, points_per_dollar,
     advisor_snapshot, created_by)
  values
    (v_program_id, p_organization_id, v_next_version, p_points_per_dollar,
     p_advisor_snapshot, auth.uid())
  returning id into v_version_id;

  for v_item in select * from jsonb_array_elements(p_catalog)
  loop
    v_kind := v_item->>'reward_kind';
    v_value := (v_item->>'reward_value_cents')::int;
    insert into public.loyalty_reward_catalog_items
      (program_version_id, organization_id, sort_index, points_cost,
       reward_kind, reward_name, reward_value_cents, reward_est_cost_cents)
    values
      (v_version_id, p_organization_id, v_count, (v_item->>'points_cost')::int,
       v_kind, v_item->>'reward_name', v_value,
       case when v_kind = 'FIXED_DISCOUNT' then v_value
            else (v_item->>'reward_est_cost_cents')::int end);
    v_count := v_count + 1;
  end loop;

  return v_version_id;
end;
$function$;
