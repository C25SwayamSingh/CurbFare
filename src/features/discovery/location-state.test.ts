import { describe, expect, it } from "vitest";

import {
  FILTERS,
  HOTSPOT_EXPLANATION,
  STATE_STYLES,
  displayTitle,
  groupHotspotResults,
  hasNoConfirmedVendors,
  isHotspot,
  requiredAttribution,
  markerAccessibleName,
  matchesFilter,
  queryFlagsFor,
  sortResults,
  walkingDirectionsUrl,
  type FilterId,
} from "@/features/discovery/location-state";
import type {
  LocationState,
  NearbyVendorLocation,
} from "@/lib/supabase/database.types";

function result(
  state: LocationState,
  overrides: Partial<NearbyVendorLocation> = {},
): NearbyVendorLocation {
  const vendorish = state !== "HOTSPOT";
  return {
    result_id: `${state}:1`,
    state,
    rank: {
      LIVE: 1,
      SCHEDULED_NOW: 2,
      RECURRING_NOW: 3,
      SCHEDULED_UPCOMING: 4,
      HOTSPOT: 5,
    }[state],
    vendor_unit_id: vendorish ? "unit-1" : null,
    organization_slug: vendorish ? "org" : null,
    unit_slug: vendorish ? "unit" : null,
    name: vendorish ? "Test Cart" : null,
    unit_type: vendorish ? "food_cart" : null,
    cuisine_categories: vendorish ? ["tacos"] : null,
    primary_image_path: null,
    latitude: 40.7,
    longitude: -74,
    public_label: vendorish ? "Corner pitch" : "Permitted vending zone",
    reason_label: {
      LIVE: "Live — confirmed 4 minutes ago",
      SCHEDULED_NOW: "Scheduled now, until 2:00 PM",
      RECURRING_NOW: "Usually here weekdays, 11 AM–3 PM",
      SCHEDULED_UPCOMING: "Scheduled tomorrow, 5:00 PM–9:00 PM",
      HOTSPOT: "Food-vendor hotspot — vendor not confirmed",
    }[state],
    source_type: "VENDOR_LIVE",
    verification: "CONFIRMED",
    last_verified_at: new Date().toISOString(),
    starts_at: null,
    ends_at: null,
    distance_miles: 0.4,
    ...overrides,
  };
}

const ALL_STATES: LocationState[] = [
  "LIVE",
  "SCHEDULED_NOW",
  "RECURRING_NOW",
  "SCHEDULED_UPCOMING",
  "HOTSPOT",
];

describe("a hotspot is never a vendor", () => {
  it("carries no vendor identity to display", () => {
    const spot = result("HOTSPOT");
    expect(spot.vendor_unit_id).toBeNull();
    expect(spot.name).toBeNull();
    // The title falls back to the place name rather than inventing a business.
    expect(displayTitle(spot)).toBe("Permitted vending zone");
    expect(isHotspot(spot)).toBe(true);
    expect(STATE_STYLES.HOTSPOT.isVendor).toBe(false);
  });

  it("never uses open or live language", () => {
    const text = [
      STATE_STYLES.HOTSPOT.badge,
      result("HOTSPOT").reason_label,
      HOTSPOT_EXPLANATION,
    ].join(" ");
    expect(text).not.toMatch(/\bopen\b/i);
    expect(text).not.toMatch(/\blive\b/i);
  });

  it("says plainly that nobody is confirmed", () => {
    expect(HOTSPOT_EXPLANATION).toMatch(/none are confirmed/i);
    expect(result("HOTSPOT").reason_label).toMatch(/not confirmed/i);
  });

  it("is excluded from the default view", () => {
    expect(matchesFilter(result("HOTSPOT"), "all")).toBe(false);
    expect(queryFlagsFor("all").hotspots).toBe(false);
  });

  it("is offered only when a customer asks for it", () => {
    expect(matchesFilter(result("HOTSPOT"), "hotspots")).toBe(true);
    expect(queryFlagsFor("hotspots").hotspots).toBe(true);
  });
});

describe("only a live vendor may be called live", () => {
  it("reserves live wording for the live state", () => {
    for (const state of ALL_STATES) {
      if (state === "LIVE") continue;
      expect(STATE_STYLES[state].badge).not.toMatch(/\blive\b/i);
      expect(result(state).reason_label).not.toMatch(/^Live\b/);
    }
    expect(STATE_STYLES.LIVE.badge).toMatch(/live/i);
  });

  it("labels a recurring result as a habit, not a presence", () => {
    expect(STATE_STYLES.RECURRING_NOW.badge).toBe("Usually here");
    expect(result("RECURRING_NOW").reason_label).toMatch(/^Usually here/);
  });

  it("distinguishes scheduled-now from upcoming", () => {
    expect(STATE_STYLES.SCHEDULED_NOW.badge).not.toBe(
      STATE_STYLES.SCHEDULED_UPCOMING.badge,
    );
    expect(result("SCHEDULED_NOW").reason_label).toMatch(/now/i);
    expect(result("SCHEDULED_UPCOMING").reason_label).toMatch(/tomorrow/i);
  });
});

describe("marker meaning does not depend on colour", () => {
  it("gives each state a distinguishable silhouette", () => {
    // LIVE and RECURRING share a circle but differ by fill; every other pair
    // differs by shape. What matters is that no two states are identical in
    // BOTH channels.
    const seen = new Set(
      ALL_STATES.map(
        (s) => `${STATE_STYLES[s].markerShape}|${STATE_STYLES[s].markerFill}`,
      ),
    );
    expect(seen.size).toBe(ALL_STATES.length);
  });

  it("names every marker with the same sentence the card shows", () => {
    for (const state of ALL_STATES) {
      const r = result(state);
      const name = markerAccessibleName(r);
      expect(name).toContain(r.reason_label);
      expect(name).toContain(displayTitle(r));
    }
  });

  it("uses a hollow marker for the one state with nobody there", () => {
    expect(STATE_STYLES.HOTSPOT.markerShape).toBe("hollow");
  });
});

describe("filters", () => {
  it("offers all five", () => {
    expect(FILTERS.map((f) => f.id)).toEqual([
      "all",
      "live",
      "scheduled",
      "recurring",
      "hotspots",
    ]);
  });

  it("admits exactly the intended states", () => {
    const cases: [FilterId, LocationState[]][] = [
      ["live", ["LIVE"]],
      ["scheduled", ["SCHEDULED_NOW", "SCHEDULED_UPCOMING"]],
      ["recurring", ["RECURRING_NOW"]],
      ["hotspots", ["HOTSPOT"]],
    ];
    for (const [filter, allowed] of cases) {
      for (const state of ALL_STATES) {
        expect(matchesFilter(result(state), filter)).toBe(
          allowed.includes(state),
        );
      }
    }
  });

  it("asks the server only for what the filter needs", () => {
    expect(queryFlagsFor("live")).toEqual({
      live: true,
      scheduled: false,
      recurring: false,
      hotspots: false,
    });
    expect(queryFlagsFor("recurring").recurring).toBe(true);
    expect(queryFlagsFor("recurring").live).toBe(false);
  });
});

describe("ordering", () => {
  it("puts live first and hotspots last regardless of input order", () => {
    const shuffled = [
      result("HOTSPOT"),
      result("SCHEDULED_UPCOMING"),
      result("LIVE"),
      result("RECURRING_NOW"),
      result("SCHEDULED_NOW"),
    ];
    expect(sortResults(shuffled).map((r) => r.state)).toEqual([
      "LIVE",
      "SCHEDULED_NOW",
      "RECURRING_NOW",
      "SCHEDULED_UPCOMING",
      "HOTSPOT",
    ]);
  });

  it("breaks ties by distance", () => {
    const near = result("LIVE", { result_id: "near", distance_miles: 0.2 });
    const far = result("LIVE", { result_id: "far", distance_miles: 2 });
    expect(sortResults([far, near]).map((r) => r.result_id)).toEqual([
      "near",
      "far",
    ]);
  });
});

describe("hotspot fallback", () => {
  it("recognises when nothing confirmed is nearby", () => {
    expect(hasNoConfirmedVendors([result("HOTSPOT")])).toBe(true);
    expect(hasNoConfirmedVendors([])).toBe(true);
  });

  it("does not offer the fallback when a real vendor is present", () => {
    expect(hasNoConfirmedVendors([result("RECURRING_NOW")])).toBe(false);
    expect(hasNoConfirmedVendors([result("LIVE"), result("HOTSPOT")])).toBe(
      false,
    );
  });
});

describe("walking directions", () => {
  it("builds a keyless Google Maps walking deep link", () => {
    const url = walkingDirectionsUrl(40.7178, -74.0431);
    expect(url).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=40.7178,-74.0431&travelmode=walking",
    );
  });
});

describe("groupHotspotResults", () => {
  const spot = (
    id: string,
    label: string,
    miles: number,
  ): NearbyVendorLocation => ({
    ...result("HOTSPOT"),
    result_id: id,
    public_label: label,
    distance_miles: miles,
  });

  it("collapses per-space municipal rows into one card per street", () => {
    const { vendors, hotspotGroups } = groupHotspotResults([
      spot("h1", "Columbus Drive · Spot 1", 1.6),
      spot("h2", "Columbus Drive · Spot 15", 1.5),
      spot("h3", "Sussex Street · Spot 2", 1.8),
    ]);
    expect(vendors).toHaveLength(0);
    expect(hotspotGroups).toHaveLength(2);
    expect(hotspotGroups[0].label).toBe("Columbus Drive");
    expect(hotspotGroups[0].spots).toHaveLength(2);
    // Nearest spot leads the group, and groups order by nearest distance.
    expect(hotspotGroups[0].nearest.result_id).toBe("h2");
    expect(hotspotGroups[1].label).toBe("Sussex Street");
  });

  it("never groups vendors — each keeps an individual card", () => {
    const live = result("LIVE");
    const { vendors, hotspotGroups } = groupHotspotResults([
      live,
      spot("h1", "Columbus Drive · Spot 1", 1.6),
    ]);
    expect(vendors).toEqual([live]);
    expect(hotspotGroups).toHaveLength(1);
  });
});

describe("requiredAttribution", () => {
  it("requires the OSM credit only when OSM-derived data is on screen", () => {
    expect(requiredAttribution([result("LIVE")])).toBeNull();
    const osm = {
      ...result("HOTSPOT"),
      source_type: "THIRD_PARTY_DIRECTORY" as const,
    };
    expect(requiredAttribution([osm])).toMatch(/OpenStreetMap contributors/);
  });
});
