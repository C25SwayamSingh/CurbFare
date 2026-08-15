-- Hotspots become curated picks, not apologies.
--
-- Two changes, one story:
--
--   1. `cuisine_hint` on location_hotspots: our watchlists know what a corner
--      is famous for (halal, mexican), and the map can tint the pin for it.
--      A hint, not a menu; nullable, and never implies a specific vendor.
--
--   2. Reason labels flip from disclaimer to curation. "Food-vendor hotspot
--      — vendor not confirmed" read like the app wasn't finished. The new
--      voice: "Curbfare pick · street food often sets up here." Honesty is
--      unchanged where it matters: a hotspot still never says Live, never
--      says Open, and never names a vendor. The positive differentiator (the
--      checkmark) lives on the vendor-backed states in the UI.

alter table public.location_hotspots
  add column if not exists cuisine_hint text;

alter table public.location_hotspots
  add constraint location_hotspots_cuisine_hint_length
  check (cuisine_hint is null or char_length(cuisine_hint) between 2 and 40);

comment on column public.location_hotspots.cuisine_hint is
  'What this corner is known for (e.g. halal, mexican). Display hint only; '
  'never implies a specific vendor is present.';

-- Backfill the curated watchlists. Idempotent by construction.
update public.location_hotspots
  set cuisine_hint = 'halal'
  where source_record_id like 'halal-watchlist:%' and cuisine_hint is null;
update public.location_hotspots
  set cuisine_hint = 'mexican'
  where source_record_id like 'taco-watchlist:%' and cuisine_hint is null;

-- The public read path. CREATE OR REPLACE can only append columns, which is
-- exactly what this does.
create or replace view public.location_hotspot_previews as
  select id, latitude, longitude, public_name, source_type, source_url,
         valid_from, valid_until, last_imported_at, cuisine_hint
  from public.location_hotspots h
  where verification = 'CONFIRMED'::location_verification
    and (valid_from is null or valid_from <= current_date)
    and (valid_until is null or valid_until >= current_date);

-- Adding an OUT column changes the function's return type, which requires a
-- drop; the API route tolerates the extra column transparently.
drop function public.nearby_vendor_locations(double precision, double precision, double precision, boolean, boolean, boolean, boolean);

create function public.nearby_vendor_locations(p_latitude double precision, p_longitude double precision, p_radius_miles double precision, p_include_live boolean default true, p_include_scheduled boolean default true, p_include_recurring boolean default true, p_include_hotspots boolean default false)
 returns table(result_id text, state text, rank integer, vendor_unit_id uuid, organization_slug text, unit_slug text, name text, unit_type vendor_unit_type, cuisine_categories text[], primary_image_path text, latitude double precision, longitude double precision, public_label text, reason_label text, source_type location_source_type, verification location_verification, last_verified_at timestamp with time zone, starts_at timestamp with time zone, ends_at timestamp with time zone, distance_miles double precision, cuisine_hint text)
 language plpgsql
 stable
as $function$
begin
  if p_latitude is null or p_latitude < -90 or p_latitude > 90 then
    raise exception 'latitude out of range' using errcode = '22023';
  end if;
  if p_longitude is null or p_longitude < -180 or p_longitude > 180 then
    raise exception 'longitude out of range' using errcode = '22023';
  end if;
  if p_radius_miles is null or p_radius_miles <= 0 or p_radius_miles > 25 then
    raise exception 'radius out of range' using errcode = '22023';
  end if;

  return query
  with candidates as (
    -- 1. LIVE ------------------------------------------------------------
    select
      'live:' || s.id::text as result_id,
      'LIVE' as state,
      1 as rank,
      s.vendor_unit_id,
      s.organization_slug,
      s.unit_slug,
      s.latitude,
      s.longitude,
      s.public_label,
      -- Relative time rather than a clock reading: "4 minutes ago" answers
      -- "should I trust this", which is the actual question.
      'Live · confirmed ' || public.location_relative_minutes(s.started_at) as reason_label,
      'VENDOR_LIVE'::public.location_source_type as source_type,
      'CONFIRMED'::public.location_verification as verification,
      s.started_at as last_verified_at,
      -- Aliased: a UNION takes its column names from the first branch, and an
      -- unaliased `started_at` here would name the shared column wrongly for
      -- every later branch.
      s.started_at as starts_at,
      s.expected_end_at as ends_at,
      null::text as cuisine_hint
    from public.vendor_location_session_previews s
    where p_include_live

    union all

    -- 2. SCHEDULED, happening now ----------------------------------------
    select
      'sched:' || o.id::text,
      'SCHEDULED_NOW',
      2,
      o.vendor_unit_id,
      o.organization_slug,
      o.unit_slug,
      o.latitude,
      o.longitude,
      o.public_label,
      'Scheduled now, until ' || to_char(o.ends_at, 'FMHH12:MI AM'),
      o.source_type,
      o.verification,
      coalesce(o.confirmed_at, o.starts_at),
      o.starts_at,
      o.ends_at,
      null::text
    from public.vendor_scheduled_occurrence_previews o
    where p_include_scheduled
      and now() between o.starts_at and o.ends_at

    union all

    -- 3. RECURRING, matching right now in ITS OWN timezone ----------------
    -- The whole point of storing a timezone per row: "weekdays 11-3" means
    -- 11-3 where the cart is, not where the server is.
    select
      'recur:' || r.id::text,
      'RECURRING_NOW',
      3,
      r.vendor_unit_id,
      r.organization_slug,
      r.unit_slug,
      r.latitude,
      r.longitude,
      r.public_label,
      'Usually here ' || public.location_days_phrase(r.days_of_week)
        || ', ' || to_char(r.start_time, 'FMHH12 AM')
        || '–' || to_char(r.end_time, 'FMHH12 AM'),
      'VENDOR_RECURRING'::public.location_source_type,
      'EXPECTED'::public.location_verification,
      r.last_confirmed_at,
      null::timestamptz,
      null::timestamptz,
      null::text
    from public.vendor_recurring_location_previews r
    where p_include_recurring
      -- STALE patterns are excluded outright. A vendor who has not reconfirmed
      -- in 60 days is not a claim worth sending someone across town on.
      and r.is_current
      and extract(dow from (now() at time zone r.timezone))::smallint = any(r.days_of_week)
      and (now() at time zone r.timezone)::time between r.start_time and r.end_time

    union all

    -- 4. SCHEDULED, upcoming within 24h ----------------------------------
    select
      'soon:' || o.id::text,
      'SCHEDULED_UPCOMING',
      4,
      o.vendor_unit_id,
      o.organization_slug,
      o.unit_slug,
      o.latitude,
      o.longitude,
      o.public_label,
      'Scheduled ' || public.location_when_phrase(o.starts_at)
        || ', ' || to_char(o.starts_at, 'FMHH12:MI AM')
        || '–' || to_char(o.ends_at, 'FMHH12:MI AM'),
      o.source_type,
      o.verification,
      coalesce(o.confirmed_at, o.starts_at),
      o.starts_at,
      o.ends_at,
      null::text
    from public.vendor_scheduled_occurrence_previews o
    where p_include_scheduled
      and o.starts_at > now()
      and o.starts_at <= now() + interval '24 hours'

    union all

    -- 5. HOTSPOT ----------------------------------------------------------
    -- A place, never a vendor: no unit id, no "Live", no "Open". The label
    -- sells the curation instead of apologizing for the absence.
    select
      'spot:' || h.id::text,
      'HOTSPOT',
      5,
      null::uuid,
      null::text,
      null::text,
      h.latitude,
      h.longitude,
      h.public_name,
      case
        when h.public_name ilike '%market%'
          then 'Street market · a Curbfare pick'
        else 'Curbfare pick · street food often sets up here'
      end,
      h.source_type,
      'CONFIRMED'::public.location_verification,
      h.last_imported_at,
      null::timestamptz,
      null::timestamptz,
      h.cuisine_hint
    from public.location_hotspot_previews h
    where p_include_hotspots
  ),
  measured as (
    select
      c.*,
      d.miles
    from candidates c
    cross join lateral (
      select 2 * 3958.8 * asin(
        sqrt(
          power(sin(radians(c.latitude - p_latitude) / 2), 2)
          + cos(radians(p_latitude)) * cos(radians(c.latitude))
            * power(sin(radians(c.longitude - p_longitude) / 2), 2)
        )
      ) as miles
    ) d
    where d.miles <= p_radius_miles
  ),
  -- LIVE OVERRIDES: one row per vendor unit, keeping the best-ranked state.
  -- Hotspots have a null unit and must all survive, so they are partitioned
  -- by their own id instead.
  best_per_unit as (
    select distinct on (coalesce(m.vendor_unit_id::text, m.result_id))
      m.*
    from measured m
    order by coalesce(m.vendor_unit_id::text, m.result_id), m.rank asc, m.miles asc
  ),
  -- Proximity dedupe: a hotspot and the vendor parked on it are one place.
  -- Requires BOTH ~40m proximity and a matching label, so two genuinely
  -- different carts at one busy corner are not silently merged into one.
  deduped as (
    select distinct on (
      round(b.latitude::numeric, 4),
      round(b.longitude::numeric, 4),
      lower(trim(b.public_label))
    ) b.*
    from best_per_unit b
    order by
      round(b.latitude::numeric, 4),
      round(b.longitude::numeric, 4),
      lower(trim(b.public_label)),
      b.rank asc
  )
  select
    d.result_id,
    d.state,
    d.rank,
    d.vendor_unit_id,
    d.organization_slug,
    d.unit_slug,
    u.name,
    u.unit_type,
    u.cuisine_categories,
    u.primary_image_path,
    d.latitude,
    d.longitude,
    d.public_label,
    d.reason_label,
    d.source_type,
    d.verification,
    d.last_verified_at,
    d.starts_at,
    d.ends_at,
    d.miles as distance_miles,
    d.cuisine_hint
  from deduped d
  left join public.vendor_unit_previews u on u.id = d.vendor_unit_id
  order by d.rank asc, d.miles asc;
end;
$function$;
