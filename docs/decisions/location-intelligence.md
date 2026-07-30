# Decision: CurbAgora Location Intelligence

Status: **Accepted** (vendor-truth scope) · Date: 2026-07-24
Vendor surface: unit dashboard → **Where you are** (`/vendor/unit/[id]/schedule`)
Customer surface: **Discover** (`/discover`)

## 1. The problem

Discovery originally answered one question — _which vendors are live right
now_. `nearby_live_vendors` reads only live sessions, so a customer opening the
app at 9 AM saw an empty map even on a corner where a cart parks every weekday at 11. Everything a vendor knows about their own week had nowhere to live.

This layer adds three more location states beside the live one and, critically,
keeps them **legibly different** rather than flattening them into identical pins.

## 2. Four states, never collapsed

| State                    | Meaning                                                                  | Trust source                      |
| ------------------------ | ------------------------------------------------------------------------ | --------------------------------- |
| **VENDOR LIVE**          | A vendor is sharing a current location _right now_                       | The vendor's own Go-Live session  |
| **SCHEDULED OCCURRENCE** | A confirmed specific date/time/place                                     | Vendor or event organizer         |
| **RECURRING LOCATION**   | A confirmed repeated pattern (e.g. weekdays 11–3)                        | The vendor                        |
| **LOCATION HOTSPOT**     | A dataset says vendors _commonly_ operate here — **nobody is confirmed** | Municipal / third-party open data |

**The governing rule: a hotspot is not a vendor and must never read as one.** A
permit record saying carts park somewhere is not evidence anyone is there.
Labelling it "Open now" would be a lie the customer walks to. The ranking RPC
emits `state` as one of six string literals
(`LIVE`, `SCHEDULED_NOW`, `SCHEDULED_UPCOMING`, `RECURRING_NOW`, `HOTSPOT`), and
the client pins them to a `LocationState` TypeScript union (`location-state.ts`)
so they can never be compared as loose strings at compile time. The customer card
renders a hotspot through a deliberately separate branch — no photo, no cuisine,
no invented business name, no vendor page link, and an explicit "vendor not
confirmed" line. Provenance itself (`source_type`, `verification`) _is_
enum-typed in the database (§3).

Equally: **recurring and scheduled data is never called "Live."** "Usually here"
and "Scheduled" are their own words. Only a live session earns "Live now."

## 3. Provenance vocabulary

Two enums fix the vocabulary for every non-live row (enums can't be dropped
cleanly, so naming them well now is a one-way door taken deliberately):

- `location_source_type`: `VENDOR_LIVE`, `VENDOR_RECURRING`, `VENDOR_SCHEDULED`,
  `EVENT_ORGANIZER`, `MUNICIPAL_OPEN_DATA`, `THIRD_PARTY_SCHEDULE`,
  `SOCIAL_MEDIA_LEAD`, `COMMUNITY_REPORT`.
- `location_verification`: `CONFIRMED`, `EXPECTED`, `UNVERIFIED`, `STALE`,
  `REJECTED`.

A **social-media lead or community report never auto-promotes** — it stays
`UNVERIFIED` and invisible to customers until a human reviews it. There is no
code path from `location_reports` to a customer-visible location.

## 4. Vendor truth wins (ranking)

`nearby_vendor_locations(p_latitude, p_longitude, p_radius_miles, …)` resolves
one row per location, ranked:

**live → active scheduled → matching recurring → upcoming scheduled → hotspot.**

Two rules do the real work:

- **Live overrides prediction.** A unit with a live session is emitted once, as
  live; its recurring/scheduled rows are suppressed via
  `distinct on (vendor_unit_id)` ordered by rank. The vendor _standing_
  somewhere beats any guess about where they'd be.
- **Proximity dedupe.** Rows within ~40 m carrying the same label collapse to
  the highest-ranked source, so a hotspot and the vendor parked on it are one
  pin, not two.

`reason_label` is composed **in SQL** ("Live — confirmed 4 minutes ago",
"Usually here weekdays", "Food-vendor hotspot — vendor not confirmed") so the map
marker and the list card can never drift apart — they read the same sentence.

## 5. Freshness — explicit rules, no score

| State                | Visible when                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live                 | existing rule: not ended, confirmed within **30 min** (`vendor_location_session_stale_after()`)                                                                   |
| Scheduled (now)      | `now()` between `starts_at`/`ends_at`, status `scheduled`                                                                                                         |
| Scheduled (upcoming) | starts within 24 h                                                                                                                                                |
| Recurring            | active, within effective dates, today matches `days_of_week` **in its own timezone**, `last_confirmed_at` within **60 days** (`location_recurring_stale_after()`) |
| Recurring (stale)    | past 60 days → dropped from primary results, never labelled open                                                                                                  |
| Hotspot              | `valid_until` unset or future, `verification = CONFIRMED`                                                                                                         |

Both thresholds live in SQL functions, mirrored so they are testable and there is
no second copy to drift.

## 6. Timezone correctness

The likeliest source of silent wrongness is a recurring window matching the
_server's_ day instead of the _vendor's_. Postgres ships 1,196 timezone names, so
recurring windows are evaluated natively with `AT TIME ZONE` —
`extract(dow from (now() at time zone r.timezone))` against `days_of_week`. No JS
date library. The timezone is validated by a trigger
(`vendor_recurring_validate_timezone`) that resolves the zone by using it — a
CHECK constraint can't hold the subquery this needs. Every recurring test asserts
across a timezone boundary.

## 7. Why PostGIS stays disabled

The nearby query is **haversine over `double precision` lat/lng**, not PostGIS —
a deliberate non-dependency carried over from `nearby_live_vendors`. Hotspots
therefore store a lat/lng **centroid** for ranking plus an optional GeoJSON
`boundary jsonb` kept purely as provenance/display; the boundary is never queried
spatially. Enabling PostGIS remains a documented future upgrade path, not
something this layer needs.

## 8. Schema reference

Migrations `20260719000000_location_intelligence.sql` (schema) and
`20260720000000_nearby_vendor_locations.sql` (ranking RPC + label helpers).

- **`vendor_recurring_locations`** — org, unit, lat/lng, `public_label`,
  `timezone`, `days_of_week smallint[]` (0=Sun…6=Sat), `start_time`/`end_time`,
  `effective_from`/`effective_to`, `is_active`, `last_confirmed_at`. Partial
  unique index blocks a unit stacking identical windows.
- **`vendor_scheduled_occurrences`** — optional unit/org, `organizer_name`,
  `event_name`, `starts_at`/`ends_at`, lat/lng, `status`, `source_type`,
  `source_url`, `source_record_id`, `confirmed_at`/`confirmed_by`. Unique
  `(source_type, source_record_id)` makes re-import idempotent.
- **`location_hotspots`** — centroid, `boundary jsonb`, `public_name`, source
  fields, `valid_from`/`valid_until`, `verification`, `review_notes` (**never**
  public). Unique `(source_type, source_record_id)`.
- **`location_reports`** — community reports, staged only. Reporter id stored,
  never exposed.

RLS mirrors the existing location tables: org members read/write their own
recurring and scheduled rows; hotspots and reports are platform-admin-only until
approved. Public reads go through three views —
`vendor_recurring_location_previews`, `vendor_scheduled_occurrence_previews`,
`location_hotspot_previews` — which expose **no reviewer notes and no reporter
identity**, never the base tables.

## 9. External open-data imports (implemented 2026-07-28)

The importer and review queue originally deferred here now exist, in
`src/features/location-import/` plus migration
`20260723000000_location_import_pipeline.sql`:

- **Four transport adapters** — Socrata, Opendatasoft, ArcGIS, Overpass —
  fetch raw rows; per-source mappers in `sources.ts` turn them into one
  normalized shape whose source-type enum **cannot express a vendor-voiced
  record**. External data is structurally unable to become "Live".
- **Launch sources**: Jersey City parking zones (×3, trusted → auto-publish
  as CONFIRMED hotspots), SF permits (hidden vendor leads), SF weekly
  schedules (EXPECTED recurring candidates; coordinate-less rows demote to
  leads, never invented pins), Cambridge permits (leads), NYC Parks
  carts/trucks (mapper ready, source **disabled**: verified 2026-07-28 that
  its dataset is an href asset with no rows API — enable when a tabular feed
  exists; once staged, it publishes only via admin approval), OSM street
  vendors
  (`street_vendor=yes` / `fast_food=van` only — never the whole fast-food
  layer; ODbL attribution stored on the source row).
- **Staging** (`location_import_records`): raw payloads for audit, unique
  `(source_name, source_record_id)` with adapter-namespaced ids
  (`sfgov:rqzj-sfat:{row}`), platform-admin-only RLS, statuses
  staged/published/rejected/stale/associated. Missing-on-refetch marks
  stale — never deletes; terminal human decisions are never resurrected.
- **Source health** (`location_import_sources`): per-feed counters, last
  success/error, consecutive failures — surfaced at `/admin/locations`.
- **Review** — SECURITY DEFINER functions (platform admin + aal2):
  approve-as-hotspot, reject, mark-stale, associate-with-unit (a link only;
  never account creation or ownership transfer). UI at `/admin/locations`.
- **Runners**: `npm run import:locations` (service role, server-only) and
  `npm run smoke:sources` (opt-in live endpoint check; the vitest suite
  never touches the network).

Still deferred: materializing SF weekly patterns into public occurrences
(they stay leads until a vendor claims them), CSV/GeoJSON file imports, and
duplicate-merge tooling beyond associate+reject.

## 10. Limitations

- Hotspot provenance (`source_url`) is stored but **not surfaced to customers**
  yet — the RPC returns `source_type` but not the URL, so the card shows no
  "where this came from" link. Publishing which dataset a row came from is a
  later, deliberate choice.
- No spatial boundary querying (see §7); ranking is centroid-distance only.
- Leads and reports are captured but have no review UI, so they remain invisible
  by design rather than by a missing feature.

## 11. Tests

- **pgTAP** (`008_location_intelligence.sql`): live outranks recurring; recurring
  matches the right day in its own timezone and not the neighbour's; expired
  scheduled vanishes; stale recurring is never "open"; a hotspot never appears as
  a vendor; a social lead stays hidden; re-import of the same `source_record_id`
  is idempotent; cross-org writes denied; public views leak no reviewer/reporter
  fields.
- **Vitest** (`location-state.test.ts`): ordering, label wording, "never say open
  for a hotspot", colour-independence, filter composition.
- **Component** (`discover-nearby.test.tsx`): all four states render
  distinguishably; a hotspot shows no vendor identity or page link; the empty
  view falls back to hotspots with honest wording; list works with Maps
  unavailable.
