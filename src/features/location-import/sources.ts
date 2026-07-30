import type { AdapterKind } from "@/features/location-import/adapters";
import type { ExternalSourceType } from "@/features/location-import/normalized";

/**
 * Launch source configuration. Each entry pairs a transport adapter with a
 * per-source mapping from one raw row to a candidate normalized record
 * (validated later — mapping never throws, it returns null to skip a row).
 *
 * Trust rules, fixed here and enforced again downstream:
 *   Jersey City municipal zones → HOTSPOT, CONFIRMED, auto-publish (trusted)
 *   SF schedules with coords    → RECURRING, EXPECTED, staged for review
 *   SF/Cambridge permits        → VENDOR_LEAD, UNVERIFIED, hidden
 *   NYC Parks carts/trucks      → HOTSPOT, UNVERIFIED, published only on
 *                                 admin approval
 *   OSM street vendors          → RECURRING lead, UNVERIFIED, hidden
 * Nothing here can produce a live record: the normalized schema has no
 * vendor-voiced source type at all.
 */
export type ImportSourceConfig = {
  sourceName: string;
  adapter: AdapterKind;
  sourceType: ExternalSourceType;
  /** Socrata/ODS: portal base. ArcGIS: layer URL. Overpass: interpreter URL. */
  endpoint: string;
  dataset: string | null;
  license: string;
  attribution: string;
  /** Only Jersey City: staged HOTSPOTs publish without human review. */
  trustedHotspots: boolean;
  /** Disabled sources stay registered (and documented) but never fetch. */
  enabled: boolean;
  /** Socrata only: fetch just these columns (wide tables break size caps). */
  socrataSelect?: string[];
  overpassQuery?: string;
  normalizeRow: (row: Record<string, unknown>) => unknown | null;
};

/* ------------------------------------------------------------------ */
/* Tolerant field helpers — civic datasets rename columns without      */
/* notice, so mapping reads by candidate list and rejects downstream.  */
/* ------------------------------------------------------------------ */

function firstString(
  row: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

/** Free-text civic labels can run long; a label is not worth a rejection. */
function truncateLabel(value: string | null): string | null {
  if (value === null) return null;
  return value.length > 200 ? `${value.slice(0, 197)}…` : value;
}

function coord(value: unknown): number | null {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) return null;
  // 0,0 is the classic "no data" sentinel in permit exports, not a location.
  if (n === 0) return null;
  return n;
}

/** {lat, lon} objects, GeoJSON [lon, lat], or flat latitude/longitude pairs. */
function coordsFrom(row: Record<string, unknown>): {
  latitude: number | null;
  longitude: number | null;
} {
  const point = row["geo_point_2d"] ?? row["georeference"] ?? row["the_geom"];
  if (point && typeof point === "object") {
    const p = point as Record<string, unknown>;
    if ("lat" in p || "lon" in p) {
      return { latitude: coord(p.lat), longitude: coord(p.lon) };
    }
    if (Array.isArray(p.coordinates) && p.coordinates.length >= 2) {
      return {
        latitude: coord(p.coordinates[1]),
        longitude: coord(p.coordinates[0]),
      };
    }
  }
  return {
    latitude: coord(row["latitude"] ?? row["lat"]),
    longitude: coord(row["longitude"] ?? row["lng"] ?? row["lon"]),
  };
}

function recordIdFrom(
  row: Record<string, unknown>,
  fallbackCoords: { latitude: number | null; longitude: number | null },
): string | null {
  const id = firstString(row, ["recordid", "record_id", "objectid", "id"]);
  if (id) return id;
  // Deterministic fallback for portals that publish no row id: a rounded
  // coordinate key is stable across re-imports of the same dataset.
  if (fallbackCoords.latitude !== null && fallbackCoords.longitude !== null) {
    return `pt-${fallbackCoords.latitude.toFixed(6)}-${fallbackCoords.longitude.toFixed(6)}`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Jersey City — Opendatasoft, three datasets of municipal zones       */
/* ------------------------------------------------------------------ */

function jerseyCitySource(dataset: string): ImportSourceConfig {
  const sourceName = `jerseycity-${dataset}`;
  return {
    sourceName,
    adapter: "OPENDATASOFT",
    sourceType: "MUNICIPAL_OPEN_DATA",
    endpoint: "https://data.jerseycitynj.gov/api/explore/v2.1",
    dataset,
    license: "Open municipal data (Jersey City Open Data portal)",
    attribution: "City of Jersey City Open Data",
    trustedHotspots: true,
    enabled: true,
    normalizeRow(row) {
      const coords = coordsFrom(row);
      const id = recordIdFrom(row, coords);
      if (!id) return null;
      // JC publishes individually permitted spaces: street name + space
      // number ("Columbus Drive · Spot 15"). Cross-checked against the raw
      // `limits` field ("229 feet east of Hudson Street…") — these are
      // genuinely distinct curb spaces, so each keeps its own record and the
      // UI groups them by street instead.
      const street = firstString(row, [
        "name",
        "location",
        "address",
        "site",
        "street_address",
        "description",
      ]);
      const spaceRaw = firstString(row, ["spacenumbe", "space_number", "spot"]);
      const spaceNumber = spaceRaw ? parseInt(spaceRaw, 10) : NaN;
      const label = truncateLabel(
        street
          ? Number.isFinite(spaceNumber)
            ? `${street} · Spot ${spaceNumber}`
            : street
          : "Food truck parking zone",
      );
      return {
        sourceType: "MUNICIPAL_OPEN_DATA",
        sourceName,
        sourceRecordId: `${sourceName}:${id}`,
        sourceUrl: `https://data.jerseycitynj.gov/explore/dataset/${dataset}/`,
        sourceUpdatedAt: null,
        name: null, // a zone is a place — it gets no business identity
        vendorName: null,
        latitude: coords.latitude,
        longitude: coords.longitude,
        publicLocationLabel: label,
        scheduleType: "HOTSPOT",
        startAt: null,
        endAt: null,
        daysOfWeek: null,
        timezone: "America/New_York",
        verificationStatus: "CONFIRMED",
        rawSourceData: row,
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/* San Francisco — Socrata permits + weekly schedules                  */
/* ------------------------------------------------------------------ */

const SF_PERMITS: ImportSourceConfig = {
  sourceName: "sf-mobile-food-permits",
  adapter: "SOCRATA",
  sourceType: "MUNICIPAL_OPEN_DATA",
  endpoint: "https://data.sfgov.org",
  dataset: "rqzj-sfat",
  license: "Public Domain Dedication (PDDL)",
  attribution: "San Francisco Public Works via DataSF",
  trustedHotspots: false,
  enabled: true,
  normalizeRow(row) {
    // Only active permits become leads; expired applications are noise.
    const status = firstString(row, ["status"])?.toUpperCase();
    if (status && status !== "APPROVED") return null;
    const coords = coordsFrom(row);
    const id = recordIdFrom(row, coords);
    if (!id) return null;
    return {
      sourceType: "MUNICIPAL_OPEN_DATA",
      sourceName: "sf-mobile-food-permits",
      sourceRecordId: `sfgov:rqzj-sfat:${id}`,
      sourceUrl:
        "https://data.sfgov.org/Economy-and-Community/Mobile-Food-Facility-Permit/rqzj-sfat",
      sourceUpdatedAt: null,
      name: null,
      vendorName: firstString(row, ["applicant"]),
      latitude: coords.latitude,
      longitude: coords.longitude,
      publicLocationLabel: truncateLabel(
        firstString(row, ["locationdescription", "address"]),
      ),
      scheduleType: "VENDOR_LEAD",
      startAt: null,
      endAt: null,
      daysOfWeek: null,
      timezone: "America/Los_Angeles",
      verificationStatus: "UNVERIFIED",
      rawSourceData: row,
    };
  },
};

const SF_SCHEDULES: ImportSourceConfig = {
  sourceName: "sf-mobile-food-schedule",
  adapter: "SOCRATA",
  sourceType: "THIRD_PARTY_SCHEDULE",
  endpoint: "https://data.sfgov.org",
  dataset: "jjew-r69b",
  license: "Public Domain Dedication (PDDL)",
  attribution: "San Francisco Public Works via DataSF",
  trustedHotspots: false,
  enabled: true,
  normalizeRow(row) {
    const coords = coordsFrom(row);
    const id =
      firstString(row, ["locationid", "permit"]) !== null
        ? `${firstString(row, ["locationid", "permit"])}-${firstString(row, ["dayorder"]) ?? "x"}`
        : recordIdFrom(row, coords);
    if (!id) return null;
    // dayorder in this dataset: 0=Sunday … 6=Saturday (7 folds to Sunday).
    const dayRaw = parseInt(firstString(row, ["dayorder"]) ?? "", 10);
    const day =
      Number.isInteger(dayRaw) && dayRaw >= 0 && dayRaw <= 7
        ? dayRaw === 7
          ? 0
          : dayRaw
        : null;
    const hasCoords = coords.latitude !== null && coords.longitude !== null;
    return {
      sourceType: "THIRD_PARTY_SCHEDULE",
      sourceName: "sf-mobile-food-schedule",
      sourceRecordId: `sfgov:jjew-r69b:${id}`,
      sourceUrl:
        "https://data.sfgov.org/Economy-and-Community/Mobile-Food-Schedule/jjew-r69b",
      sourceUpdatedAt: null,
      name: null,
      vendorName: firstString(row, ["applicant"]),
      latitude: coords.latitude,
      longitude: coords.longitude,
      publicLocationLabel: truncateLabel(
        firstString(row, ["locationdesc", "location"]),
      ),
      // A weekly pattern with a place is a recurring candidate; without
      // coordinates it is still a useful lead — never an invented map pin.
      scheduleType: hasCoords ? "RECURRING" : "VENDOR_LEAD",
      startAt: null,
      endAt: null,
      daysOfWeek: day === null ? null : [day],
      timezone: "America/Los_Angeles",
      verificationStatus: hasCoords ? "EXPECTED" : "UNVERIFIED",
      rawSourceData: row,
    };
  },
};

/* ------------------------------------------------------------------ */
/* Cambridge — Socrata permits (vendor acquisition, no map pins)       */
/* ------------------------------------------------------------------ */

const CAMBRIDGE_PERMITS: ImportSourceConfig = {
  sourceName: "cambridge-food-truck-permits",
  adapter: "SOCRATA",
  sourceType: "MUNICIPAL_OPEN_DATA",
  endpoint: "https://data.cambridgema.gov",
  dataset: "qweb-m8r8",
  license: "Public Domain Dedication (PDDL)",
  attribution: "City of Cambridge Open Data",
  trustedHotspots: false,
  enabled: true,
  normalizeRow(row) {
    const coords = coordsFrom(row);
    const vendorName = firstString(row, [
      "dba_name",
      "dba",
      "truck_name",
      "business_name",
      "name",
      "applicant",
    ]);
    const id =
      recordIdFrom(row, coords) ??
      (vendorName
        ? `name-${vendorName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
        : null);
    if (!id) return null;
    return {
      sourceType: "MUNICIPAL_OPEN_DATA",
      sourceName: "cambridge-food-truck-permits",
      sourceRecordId: `cambridgema:qweb-m8r8:${id}`,
      sourceUrl:
        "https://data.cambridgema.gov/Inspectional-Services/Mobile-Food-Truck-Permits/qweb-m8r8",
      sourceUpdatedAt: null,
      name: null,
      vendorName,
      latitude: coords.latitude,
      longitude: coords.longitude,
      publicLocationLabel: truncateLabel(
        firstString(row, ["location", "address"]),
      ),
      scheduleType: "VENDOR_LEAD",
      startAt: null,
      endAt: null,
      daysOfWeek: null,
      timezone: "America/New_York",
      verificationStatus: "UNVERIFIED",
      rawSourceData: row,
    };
  },
};

/* ------------------------------------------------------------------ */
/* NYC Parks — Socrata eateries directory (carts/trucks only)          */
/* ------------------------------------------------------------------ */

const NYC_PARKS_EATERIES: ImportSourceConfig = {
  sourceName: "nyc-parks-eateries",
  adapter: "SOCRATA",
  sourceType: "MUNICIPAL_OPEN_DATA",
  endpoint: "https://data.ny.gov",
  dataset: "8792-ebcp",
  license: "NYS Open Data terms",
  attribution: "NYC Parks via data.ny.gov",
  trustedHotspots: false, // publishes only through admin approval
  // DISABLED 2026-07-28: verified live that 8792-ebcp is an href asset on
  // data.cityofnewyork.us — there is no rows API for it (403 "no row or
  // column access to non-tabular tables"). The mapper and the admin
  // approval flow are ready; flip this on when a tabular feed exists.
  enabled: false,
  normalizeRow(row) {
    // The directory also lists restaurants and snack bars; only mobile food
    // belongs on CurbAgora's map.
    const type = (
      firstString(row, ["type_name", "type", "category"]) ?? ""
    ).toLowerCase();
    if (!type.includes("cart") && !type.includes("truck")) return null;
    const coords = coordsFrom(row);
    if (coords.latitude === null || coords.longitude === null) return null;
    const id = recordIdFrom(row, coords);
    if (!id) return null;
    const park = firstString(row, ["park", "propname", "park_name"]);
    const name = firstString(row, ["name", "eatery_name"]);
    return {
      sourceType: "MUNICIPAL_OPEN_DATA",
      sourceName: "nyc-parks-eateries",
      sourceRecordId: `datany:8792-ebcp:${id}`,
      sourceUrl:
        "https://data.ny.gov/Recreation/Directory-of-Eateries/8792-ebcp",
      sourceUpdatedAt: null,
      name: null,
      vendorName: name,
      latitude: coords.latitude,
      longitude: coords.longitude,
      publicLocationLabel: park
        ? `Listed mobile food location — ${park}`
        : "Listed mobile food location",
      scheduleType: "HOTSPOT",
      startAt: null,
      endAt: null,
      daysOfWeek: null,
      timezone: "America/New_York",
      verificationStatus: "UNVERIFIED",
      rawSourceData: row,
    };
  },
};

/* ------------------------------------------------------------------ */
/* NYC — Socrata: farmers markets (places) and Parks concession carts  */
/* (leads). Both verified live 2026-07-29 as real tabular datasets —   */
/* unlike the disabled eateries directory.                             */
/* ------------------------------------------------------------------ */

const DAY_NAMES: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/** "Wednesday & Saturday" → [3, 6]; unmatchable text → null, never a guess. */
function daysFromText(text: string | null): number[] | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  const days = new Set<number>();
  for (const [name, n] of Object.entries(DAY_NAMES)) {
    if (lower.includes(name)) days.add(n);
  }
  return days.size > 0 ? [...days].sort((a, b) => a - b) : null;
}

const NYC_FARMERS_MARKETS: ImportSourceConfig = {
  sourceName: "nyc-farmers-markets",
  adapter: "SOCRATA",
  sourceType: "MUNICIPAL_OPEN_DATA",
  endpoint: "https://data.cityofnewyork.us",
  dataset: "8vwk-6iz2",
  license: "NYC Open Data terms",
  attribution: "NYC Open Data — NYC Farmers Markets",
  trustedHotspots: false, // publishes only through admin approval
  enabled: true,
  normalizeRow(row) {
    const coords = coordsFrom(row);
    if (coords.latitude === null || coords.longitude === null) return null;
    const id = recordIdFrom(row, coords);
    if (!id) return null;
    const market = firstString(row, ["marketname", "facilityname", "name"]);
    const address = firstString(row, ["streetaddress", "address", "location"]);
    return {
      sourceType: "MUNICIPAL_OPEN_DATA",
      sourceName: "nyc-farmers-markets",
      sourceRecordId: `datanyc:8vwk-6iz2:${id}`,
      sourceUrl:
        "https://data.cityofnewyork.us/dataset/NYC-Farmers-Markets/8vwk-6iz2",
      sourceUpdatedAt: null,
      name: null, // a market is a place, not a vendor
      vendorName: null,
      latitude: coords.latitude,
      longitude: coords.longitude,
      publicLocationLabel: truncateLabel(
        market && address
          ? `${market} — ${address}`
          : (market ?? address ?? "Farmers market"),
      ),
      scheduleType: "HOTSPOT",
      startAt: null,
      endAt: null,
      daysOfWeek: daysFromText(firstString(row, ["daysoperation", "days"])),
      timezone: "America/New_York",
      verificationStatus: "UNVERIFIED",
      rawSourceData: row,
    };
  },
};

const NYC_PARKS_CONCESSIONS: ImportSourceConfig = {
  sourceName: "nyc-parks-concession-carts",
  adapter: "SOCRATA",
  sourceType: "MUNICIPAL_OPEN_DATA",
  endpoint: "https://data.cityofnewyork.us",
  dataset: "53m8-jdtg",
  license: "NYC Open Data terms",
  attribution: "NYC Open Data — Parks Concessions",
  trustedHotspots: false,
  enabled: true,
  socrataSelect: [
    "contractcode",
    "unitid",
    "unittype",
    "addressline1",
    "addressline2",
    "concessioncity",
    "operatorlastname",
    "permitorlicensestartdate",
  ],
  normalizeRow(row) {
    // Only mobile food concessions: Breakfast Cart, Pushcart, Nut Cart,
    // Cart-Gourmet/Ethnic Foods, Mobile Truck. Restaurants, carousels, and
    // batting cages stay out of a food-cart platform.
    const unitType = (firstString(row, ["unittype"]) ?? "").toLowerCase();
    if (!/cart|mobile truck/.test(unitType)) return null;
    const id = firstString(row, ["contractcode", "unitid"]);
    if (!id) return null;
    return {
      sourceType: "MUNICIPAL_OPEN_DATA",
      sourceName: "nyc-parks-concession-carts",
      sourceRecordId: `datanyc:53m8-jdtg:${id}`,
      sourceUrl:
        "https://data.cityofnewyork.us/dataset/Parks-Concessions/53m8-jdtg",
      sourceUpdatedAt: null,
      name: null,
      vendorName: firstString(row, ["addressline1", "operatorlastname"]),
      // The dataset publishes no coordinates — these are permit LEADS for
      // vendor outreach, never map pins.
      latitude: null,
      longitude: null,
      publicLocationLabel: truncateLabel(
        firstString(row, ["addressline2", "concessioncity"]),
      ),
      scheduleType: "VENDOR_LEAD",
      startAt: null,
      endAt: null,
      daysOfWeek: null,
      timezone: "America/New_York",
      verificationStatus: "UNVERIFIED",
      rawSourceData: row,
    };
  },
};

/* ------------------------------------------------------------------ */
/* Boston — ArcGIS: the city's own food-truck schedule, with truck     */
/* names, days, and hours. Verified live 2026-07-29.                   */
/* ------------------------------------------------------------------ */

const BOSTON_FOOD_TRUCKS: ImportSourceConfig = {
  sourceName: "boston-food-truck-schedule",
  adapter: "ARCGIS",
  sourceType: "MUNICIPAL_OPEN_DATA",
  endpoint:
    "https://services.arcgis.com/sFnw0xNflSi8J0uh/arcgis/rest/services/food_truck_schedule/FeatureServer/0",
  dataset: null,
  license: "Open Data Commons / City of Boston open data",
  attribution: "City of Boston — BostonMaps Open Data",
  trustedHotspots: false,
  enabled: true,
  normalizeRow(row) {
    // ArcGIS returns GeoJSON features: geometry + properties.
    const props = (row.properties ?? {}) as Record<string, unknown>;
    const geometry = (row.geometry ?? {}) as Record<string, unknown>;
    const coordsArr = Array.isArray(geometry.coordinates)
      ? geometry.coordinates
      : [];
    const longitude = coord(coordsArr[0]);
    const latitude = coord(coordsArr[1]);
    if (latitude === null || longitude === null) return null;
    const id = firstString(props, ["ObjectId", "OBJECTID", "objectid"]);
    if (!id) return null;
    const truck = firstString(props, ["Truck", "truck"]);
    const location = firstString(props, ["Location", "location"]);
    const area = firstString(props, ["Pinpoint", "pinpoint"]);
    const hours = firstString(props, ["Hours", "hours"]);
    return {
      sourceType: "MUNICIPAL_OPEN_DATA",
      sourceName: "boston-food-truck-schedule",
      sourceRecordId: `boston:food-truck-schedule:${id}`,
      sourceUrl:
        "https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::food-truck-schedule/about",
      sourceUpdatedAt: null,
      name: null,
      vendorName: truck,
      latitude,
      longitude,
      publicLocationLabel: truncateLabel(
        [location ?? "Boston food truck site", area, hours]
          .filter(Boolean)
          .join(" — "),
      ),
      // A named truck on a weekly day at a fixed spot: a recurring candidate
      // straight from the city — EXPECTED, staged until claimed or reviewed.
      scheduleType: "RECURRING",
      startAt: null,
      endAt: null,
      daysOfWeek: daysFromText(firstString(props, ["Day", "day"])),
      timezone: "America/New_York",
      verificationStatus: "EXPECTED",
      rawSourceData: row,
    };
  },
};

/* ------------------------------------------------------------------ */
/* OpenStreetMap — Overpass, stable street vendors only                */
/* ------------------------------------------------------------------ */

function osmSource(
  sourceName: string,
  center: { lat: number; lng: number; radiusMeters: number },
): ImportSourceConfig {
  const around = `around:${center.radiusMeters},${center.lat},${center.lng}`;
  return {
    sourceName,
    adapter: "OVERPASS",
    sourceType: "THIRD_PARTY_DIRECTORY",
    endpoint: "https://overpass-api.de/api/interpreter",
    dataset: null,
    license: "ODbL 1.0 — share-alike applies to derived databases",
    attribution: "© OpenStreetMap contributors",
    trustedHotspots: false,
    enabled: true,
    overpassQuery: `[out:json][timeout:25];
(
  nwr["street_vendor"="yes"](${around});
  nwr["fast_food"="van"](${around});
);
out center tags;`,
    normalizeRow(row) {
      const tags = (row.tags ?? {}) as Record<string, unknown>;
      // Defense in depth: even if the query widens, never import the whole
      // fast-food layer (that would be every McDonald's in the radius).
      const isVendor =
        tags["street_vendor"] === "yes" || tags["fast_food"] === "van";
      if (!isVendor) return null;
      const center2 = (row.center ?? {}) as Record<string, unknown>;
      const latitude = coord(row.lat ?? center2.lat);
      const longitude = coord(row.lon ?? center2.lon);
      if (latitude === null || longitude === null) return null;
      const osmType = typeof row.type === "string" ? row.type : "node";
      const osmId = typeof row.id === "number" ? row.id : null;
      if (osmId === null) return null;
      const name = typeof tags.name === "string" ? tags.name : null;
      return {
        sourceType: "THIRD_PARTY_DIRECTORY",
        sourceName,
        sourceRecordId: `osm:${osmType}/${osmId}`,
        sourceUrl: `https://www.openstreetmap.org/${osmType}/${osmId}`,
        sourceUpdatedAt: null,
        name: null,
        vendorName: name,
        latitude,
        longitude,
        publicLocationLabel: name ?? "Street vendor location",
        scheduleType: "RECURRING",
        startAt: null,
        endAt: null,
        daysOfWeek: null,
        timezone: "America/New_York",
        verificationStatus: "UNVERIFIED",
        rawSourceData: row,
      };
    },
  };
}

const OSM_JERSEY_CITY = osmSource("osm-street-vendors-jc", {
  lat: 40.7178,
  lng: -74.0431,
  radiusMeters: 12000,
});

// Manhattan-centered, wide enough to reach Brooklyn and Queens cart country.
const OSM_NYC = osmSource("osm-street-vendors-nyc", {
  lat: 40.73,
  lng: -73.986,
  radiusMeters: 15000,
});

export const LAUNCH_SOURCES: ImportSourceConfig[] = [
  jerseyCitySource("food-truck-location"),
  jerseyCitySource("food-truck-parking-zone-1"),
  jerseyCitySource("food-truck-parking-zone-2"),
  SF_PERMITS,
  SF_SCHEDULES,
  CAMBRIDGE_PERMITS,
  NYC_PARKS_EATERIES,
  NYC_FARMERS_MARKETS,
  NYC_PARKS_CONCESSIONS,
  BOSTON_FOOD_TRUCKS,
  OSM_JERSEY_CITY,
  OSM_NYC,
];
