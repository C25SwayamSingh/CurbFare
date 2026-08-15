import type {
  LocationState,
  NearbyVendorLocation,
} from "@/lib/supabase/database.types";

/**
 * Presentation rules for the four location states, in one place so the map pin
 * and the list card cannot describe the same result differently.
 *
 * The hard rule this module exists to enforce: **a hotspot is not a vendor**.
 * It has no vendor identity to show, it never uses "open" or "live" language,
 * and it sorts last. Everything else here is in service of keeping those four
 * states visibly distinct rather than four shades of pin.
 */

export type FilterId = "all" | "live" | "scheduled" | "recurring" | "hotspots";

export const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "Live now" },
  { id: "scheduled", label: "Scheduled" },
  { id: "recurring", label: "Usually here" },
  { id: "hotspots", label: "Hotspots" },
];

/**
 * Which states each filter admits. "All" deliberately omits hotspots: the
 * default view should be real vendors, not empty parking spots. Hotspots are
 * something a customer opts into, or a fallback when nothing is confirmed.
 */
const FILTER_STATES: Record<FilterId, LocationState[]> = {
  all: ["LIVE", "SCHEDULED_NOW", "RECURRING_NOW", "SCHEDULED_UPCOMING"],
  live: ["LIVE"],
  scheduled: ["SCHEDULED_NOW", "SCHEDULED_UPCOMING"],
  recurring: ["RECURRING_NOW"],
  hotspots: ["HOTSPOT"],
};

/** What to ask the server for. Only the hotspots filter turns them on. */
export function queryFlagsFor(filter: FilterId) {
  const states = FILTER_STATES[filter];
  return {
    live: states.includes("LIVE"),
    scheduled:
      states.includes("SCHEDULED_NOW") || states.includes("SCHEDULED_UPCOMING"),
    recurring: states.includes("RECURRING_NOW"),
    hotspots: states.includes("HOTSPOT"),
  };
}

export function matchesFilter(
  result: NearbyVendorLocation,
  filter: FilterId,
): boolean {
  return FILTER_STATES[filter].includes(result.state);
}

export type StateStyle = {
  /** Short badge text. Never "Open now" for anything but a live vendor. */
  badge: string;
  /** Semantic token class for the badge. */
  badgeClass: string;
  /** Map marker fill — a literal hex, since the Maps API cannot read CSS vars. */
  markerFill: string;
  markerStroke: string;
  /**
   * Marker outline shape. Colour is never the only channel: a customer with a
   * colour-vision difference, or looking at a phone in direct sun, still gets
   * the state from the silhouette and from the label text.
   */
  markerShape: "circle" | "square" | "diamond" | "hollow";
  /** True when this result stands for a real, identified vendor. */
  isVendor: boolean;
};

/**
 * Marker colours as literal hex.
 *
 * Google Maps symbols cannot resolve CSS custom properties, so these mirror the
 * urban-sunset tokens by hand: sunset orange for action/live, deep teal for
 * brand/recurring, walnut for scheduled, neutral gray for unconfirmed.
 */
export const STATE_STYLES: Record<LocationState, StateStyle> = {
  LIVE: {
    badge: "Live now",
    badgeClass: "bg-live/15 text-live",
    markerFill: "#F67E04",
    markerStroke: "#241505",
    markerShape: "circle",
    isVendor: true,
  },
  SCHEDULED_NOW: {
    badge: "Scheduled now",
    badgeClass: "bg-secondary/20 text-brand",
    markerFill: "#785F54",
    markerStroke: "#FAF5EC",
    markerShape: "square",
    isVendor: true,
  },
  SCHEDULED_UPCOMING: {
    badge: "Upcoming",
    badgeClass: "bg-muted text-muted-foreground",
    markerFill: "#785F54",
    markerStroke: "#FAF5EC",
    markerShape: "diamond",
    isVendor: true,
  },
  RECURRING_NOW: {
    badge: "Usually here",
    badgeClass: "bg-secondary/20 text-brand",
    markerFill: "#31737A",
    markerStroke: "#FAF5EC",
    markerShape: "circle",
    isVendor: true,
  },
  HOTSPOT: {
    badge: "Curbfare pick",
    badgeClass: "bg-secondary/15 text-brand",
    markerFill: "#8A8A85",
    markerStroke: "#FAF5EC",
    // Hollow: reads as "a place", not "someone is here".
    markerShape: "hollow",
    isVendor: false,
  },
};

/**
 * Cuisine tints for hotspot pins. The hollow shape still says "place, not
 * vendor"; the hue says what the corner is known for. Orange is deliberately
 * absent: orange is the live-vendor signal and nothing may dilute it.
 */
export const CUISINE_TINTS: Record<string, { fill: string; label: string }> = {
  halal: { fill: "#3E6B4F", label: "Halal picks" },
  mexican: { fill: "#D9A404", label: "Taco & Mexican picks" },
};

/** Marker fill for a result: vendors by state, hotspots by cuisine hint. */
export function markerFillFor(result: NearbyVendorLocation): string {
  const style = STATE_STYLES[result.state];
  if (result.state !== "HOTSPOT") return style.markerFill;
  const hint = result.cuisine_hint?.toLowerCase() ?? "";
  return CUISINE_TINTS[hint]?.fill ?? style.markerFill;
}

/**
 * The accessible name a screen reader hears for a marker.
 *
 * Carries the same status sentence the card shows, so the two surfaces cannot
 * drift and a non-visual user is not left guessing what a colour meant.
 */
export function markerAccessibleName(result: NearbyVendorLocation): string {
  const who = result.name ?? result.public_label;
  return `${who} — ${result.reason_label}`;
}

/** Hotspots have no vendor identity to invent, so they get the place name. */
export function displayTitle(result: NearbyVendorLocation): string {
  return result.name ?? result.public_label;
}

export function isHotspot(result: NearbyVendorLocation): boolean {
  return result.state === "HOTSPOT";
}

/**
 * True when the results contain no confirmed vendor. The caller uses this to
 * decide whether to offer hotspots as a fallback, with wording that says
 * plainly nobody is confirmed there.
 */
export function hasNoConfirmedVendors(
  results: NearbyVendorLocation[],
): boolean {
  return !results.some((r) => STATE_STYLES[r.state].isVendor);
}

export const HOTSPOT_EXPLANATION =
  "No Curbfare vendors are out in this area right now. These are Curbfare picks: corners we scouted where street food loves to set up.";

/**
 * Server ordering is already correct (rank, then distance). This re-sorts
 * client-side only after a filter change, so a re-render cannot reorder the
 * list away from what the map shows.
 */
export function sortResults(
  results: NearbyVendorLocation[],
): NearbyVendorLocation[] {
  return [...results].sort(
    (a, b) => a.rank - b.rank || a.distance_miles - b.distance_miles,
  );
}

/**
 * Google Maps walking directions to a point. A universal deep link — no API
 * key, no billing: it opens the Maps app on phones and maps.google.com on
 * desktop, with the route already computed.
 */
export function walkingDirectionsUrl(
  latitude: number,
  longitude: number,
): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=walking`;
}

export type HotspotGroup = {
  /** The street or zone the spots share, e.g. "Columbus Drive". */
  label: string;
  /** Every spot in the group, nearest first. */
  spots: NearbyVendorLocation[];
  nearest: NearbyVendorLocation;
};

/**
 * Municipal feeds publish one row per permitted curb space ("Columbus Drive
 * · Spot 15"). Customers think in streets, not space numbers — so hotspot
 * results collapse into one card per street while vendors always stay
 * individual. Groups are ordered by their nearest spot.
 */
export function groupHotspotResults(results: NearbyVendorLocation[]): {
  vendors: NearbyVendorLocation[];
  hotspotGroups: HotspotGroup[];
} {
  const vendors: NearbyVendorLocation[] = [];
  const byStreet = new Map<string, NearbyVendorLocation[]>();

  for (const result of results) {
    if (result.state !== "HOTSPOT") {
      vendors.push(result);
      continue;
    }
    const street = result.public_label.split(" · ")[0].trim();
    const list = byStreet.get(street) ?? [];
    list.push(result);
    byStreet.set(street, list);
  }

  const hotspotGroups = [...byStreet.entries()]
    .map(([label, spots]) => {
      const sorted = [...spots].sort(
        (a, b) => a.distance_miles - b.distance_miles,
      );
      return { label, spots: sorted, nearest: sorted[0] };
    })
    .sort((a, b) => a.nearest.distance_miles - b.nearest.distance_miles);

  return { vendors, hotspotGroups };
}

/**
 * ODbL obligation: any publicly displayed result derived from OpenStreetMap
 * must carry attribution. Hidden leads need nothing; the moment one is
 * approved and rendered, this returns the required credit line.
 */
export function requiredAttribution(
  results: NearbyVendorLocation[],
): string | null {
  return results.some((r) => r.source_type === "THIRD_PARTY_DIRECTORY")
    ? "Includes data © OpenStreetMap contributors (ODbL)"
    : null;
}
