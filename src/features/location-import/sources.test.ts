import { describe, expect, it } from "vitest";

import { validateNormalized } from "@/features/location-import/normalized";
import { LAUNCH_SOURCES } from "@/features/location-import/sources";

function source(name: string) {
  const found = LAUNCH_SOURCES.find((s) => s.sourceName === name);
  if (!found) throw new Error(`no source ${name}`);
  return found;
}

/** Map + validate one row the way the pipeline would. */
function normalize(name: string, row: Record<string, unknown>) {
  const cfg = source(name);
  const candidate = cfg.normalizeRow(row);
  if (candidate === null) return null;
  return validateNormalized(cfg.sourceName, candidate, null);
}

describe("source registry", () => {
  it("ships license and attribution for every source", () => {
    for (const s of LAUNCH_SOURCES) {
      expect(s.license.length).toBeGreaterThan(3);
      expect(s.attribution.length).toBeGreaterThan(3);
    }
  });

  it("marks only Jersey City as trusted for auto-publish", () => {
    const trusted = LAUNCH_SOURCES.filter((s) => s.trustedHotspots).map(
      (s) => s.sourceName,
    );
    expect(trusted).toEqual([
      "jerseycity-food-truck-location",
      "jerseycity-food-truck-parking-zone-1",
      "jerseycity-food-truck-parking-zone-2",
    ]);
  });

  it("keeps OpenStreetMap's ODbL obligations attached to the source", () => {
    const osm = source("osm-street-vendors-jc");
    expect(osm.license).toMatch(/ODbL/);
    expect(osm.attribution).toMatch(/OpenStreetMap contributors/);
  });

  it("keeps NYC Parks registered but disabled — its portal has no rows API", () => {
    // Verified live 2026-07-28: 8792-ebcp is an href asset; enabling it
    // would only generate failure noise. The mapper stays ready and tested.
    expect(source("nyc-parks-eateries").enabled).toBe(false);
    const enabled = LAUNCH_SOURCES.filter((s) => s.enabled);
    expect(enabled.length).toBe(LAUNCH_SOURCES.length - 1);
  });
});

describe("Jersey City mapping", () => {
  it("maps a zone to a CONFIRMED hotspot with no vendor identity", () => {
    const result = normalize("jerseycity-food-truck-location", {
      recordid: "abc123",
      location: "Grove St & Newark Ave",
      geo_point_2d: { lat: 40.7194, lon: -74.0428 },
    });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.record.scheduleType).toBe("HOTSPOT");
      expect(result.record.verificationStatus).toBe("CONFIRMED");
      expect(result.record.name).toBeNull();
      expect(result.record.vendorName).toBeNull();
      expect(result.record.sourceRecordId).toBe(
        "jerseycity-food-truck-location:abc123",
      );
    }
  });

  it("labels each permitted curb space distinctly — street plus spot number", () => {
    const result = normalize("jerseycity-food-truck-location", {
      name: "Columbus Drive",
      spacenumbe: "00015",
      limits: "229 feet east of Hudson Street extending 30 feet east",
      geo_point_2d: { lat: 40.71868, lon: -74.04056 },
    });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.record.publicLocationLabel).toBe(
        "Columbus Drive · Spot 15",
      );
    }
  });

  it("rejects a zone without coordinates instead of inventing a pin", () => {
    const result = normalize("jerseycity-food-truck-location", {
      recordid: "abc124",
      location: "Somewhere",
    });
    expect(result?.ok).toBe(false);
  });
});

describe("San Francisco permit mapping", () => {
  it("keeps only APPROVED permits, as hidden leads", () => {
    expect(
      source("sf-mobile-food-permits").normalizeRow({
        objectid: "1",
        status: "EXPIRED",
        applicant: "Old Cart",
      }),
    ).toBeNull();

    const result = normalize("sf-mobile-food-permits", {
      objectid: "735318",
      status: "APPROVED",
      applicant: "Synthetic Tacos LLC",
      locationdescription: "MARKET ST",
      latitude: "37.7749",
      longitude: "-122.4194",
    });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.record.scheduleType).toBe("VENDOR_LEAD");
      expect(result.record.verificationStatus).toBe("UNVERIFIED");
      expect(result.record.vendorName).toBe("Synthetic Tacos LLC");
    }
  });

  it("treats 0,0 coordinates as no coordinates — the permit-export sentinel", () => {
    const result = normalize("sf-mobile-food-permits", {
      objectid: "9",
      status: "APPROVED",
      applicant: "Zeroed Cart",
      latitude: "0",
      longitude: "0",
    });
    expect(result?.ok).toBe(true); // still a valid lead…
    if (result?.ok) {
      expect(result.record.latitude).toBeNull(); // …just not a mappable one
      expect(result.record.longitude).toBeNull();
    }
  });
});

describe("San Francisco schedule mapping", () => {
  it("maps a located weekly slot to an EXPECTED recurring candidate", () => {
    const result = normalize("sf-mobile-food-schedule", {
      locationid: "1565165",
      dayorder: "1",
      applicant: "Synthetic Tacos LLC",
      locationdesc: "MISSION ST: 01ST ST",
      latitude: "37.79",
      longitude: "-122.39",
    });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.record.scheduleType).toBe("RECURRING");
      expect(result.record.verificationStatus).toBe("EXPECTED");
      expect(result.record.daysOfWeek).toEqual([1]);
      expect(result.record.timezone).toBe("America/Los_Angeles");
    }
  });

  it("downgrades a coordinate-less slot to a lead, never a map pin", () => {
    const result = normalize("sf-mobile-food-schedule", {
      locationid: "77",
      dayorder: "7",
      applicant: "Synthetic Tacos LLC",
      locationdesc: "SOMEWHERE",
    });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.record.scheduleType).toBe("VENDOR_LEAD");
      expect(result.record.daysOfWeek).toEqual([0]); // 7 folds to Sunday
    }
  });
});

describe("NYC Parks mapping", () => {
  it("imports carts and trucks only — never restaurants", () => {
    expect(
      source("nyc-parks-eateries").normalizeRow({
        type_name: "Restaurant",
        name: "Fancy Bistro",
        latitude: "40.78",
        longitude: "-73.96",
      }),
    ).toBeNull();

    const result = normalize("nyc-parks-eateries", {
      objectid: "312",
      type_name: "Mobile Food Truck",
      name: "Synthetic Snacks",
      park: "Central Park",
      latitude: "40.78",
      longitude: "-73.96",
    });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.record.scheduleType).toBe("HOTSPOT");
      // NYC stays UNVERIFIED: it publishes only through admin approval.
      expect(result.record.verificationStatus).toBe("UNVERIFIED");
      expect(result.record.publicLocationLabel).toMatch(
        /Listed mobile food location — Central Park/,
      );
    }
  });

  it("skips carts the source cannot place on a map", () => {
    expect(
      source("nyc-parks-eateries").normalizeRow({
        type_name: "Food Cart",
        name: "No Coords Cart",
      }),
    ).toBeNull();
  });
});

describe("OpenStreetMap mapping", () => {
  it("imports a street vendor as an unverified recurring lead", () => {
    const result = normalize("osm-street-vendors-jc", {
      type: "node",
      id: 123456,
      lat: 40.72,
      lon: -74.04,
      tags: { street_vendor: "yes", name: "Synthetic Halal Cart" },
    });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.record.sourceType).toBe("THIRD_PARTY_DIRECTORY");
      expect(result.record.scheduleType).toBe("RECURRING");
      expect(result.record.verificationStatus).toBe("UNVERIFIED");
      expect(result.record.sourceRecordId).toBe("osm:node/123456");
    }
  });

  it("refuses plain fast_food — no McDonald's flood, even if the query drifts", () => {
    expect(
      source("osm-street-vendors-jc").normalizeRow({
        type: "node",
        id: 999,
        lat: 40.72,
        lon: -74.04,
        tags: { amenity: "fast_food", name: "Big Chain" },
      }),
    ).toBeNull();
  });

  it("uses way centers when a vendor is mapped as an area", () => {
    const result = normalize("osm-street-vendors-jc", {
      type: "way",
      id: 777,
      center: { lat: 40.73, lon: -74.05 },
      tags: { fast_food: "van" },
    });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.record.latitude).toBeCloseTo(40.73);
      expect(result.record.sourceRecordId).toBe("osm:way/777");
    }
  });
});

describe("NYC farmers markets mapping", () => {
  it("maps a market to a staged hotspot candidate with its operating day", () => {
    const result = normalize("nyc-farmers-markets", {
      marketname: "175th Street Greenmarket",
      streetaddress: "W. 175th St. bet. Wadsworth Ave. & Broadway",
      daysoperation: "Thursday",
      latitude: "40.845948",
      longitude: "-73.937811",
    });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.record.scheduleType).toBe("HOTSPOT");
      // Publishes only through admin approval, like every NYC record.
      expect(result.record.verificationStatus).toBe("UNVERIFIED");
      expect(result.record.daysOfWeek).toEqual([4]);
      expect(result.record.vendorName).toBeNull();
      expect(result.record.publicLocationLabel).toMatch(
        /175th Street Greenmarket — W\. 175th/,
      );
    }
  });

  it("skips a market the source cannot place on a map", () => {
    expect(
      source("nyc-farmers-markets").normalizeRow({
        marketname: "Mystery Market",
      }),
    ).toBeNull();
  });
});

describe("NYC Parks concessions mapping", () => {
  it("imports mobile cart concessions as coordinate-less vendor leads", () => {
    const result = normalize("nyc-parks-concession-carts", {
      contractcode: "m10-cart-7",
      unittype: "Cart-Gourmet/Ethnic Foods",
      addressline1: "SYNTHETIC HALAL CART",
      addressline2: "CENTRAL PARK",
    });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.record.scheduleType).toBe("VENDOR_LEAD");
      expect(result.record.latitude).toBeNull();
      expect(result.record.vendorName).toBe("SYNTHETIC HALAL CART");
    }
  });

  it("refuses restaurants, carousels, and everything not on wheels", () => {
    for (const unittype of ["Restaurant", "Carousel", "Golf Course"]) {
      expect(
        source("nyc-parks-concession-carts").normalizeRow({
          contractcode: "x",
          unittype,
          addressline1: "Fixed Thing",
        }),
      ).toBeNull();
    }
  });
});

describe("Boston food-truck schedule mapping", () => {
  it("maps a scheduled truck to an EXPECTED recurring candidate", () => {
    const result = normalize("boston-food-truck-schedule", {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-71.0751456, 42.3505305] },
      properties: {
        ObjectId: 1,
        Day: "Monday",
        Time: "Lunch",
        Truck: "Crepe Shop",
        Location: "Boylston and Clarendon Streets",
        Pinpoint: "Back Bay",
        Hours: "11am-3pm",
      },
    });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.record.scheduleType).toBe("RECURRING");
      expect(result.record.verificationStatus).toBe("EXPECTED");
      expect(result.record.vendorName).toBe("Crepe Shop");
      expect(result.record.daysOfWeek).toEqual([1]);
      expect(result.record.latitude).toBeCloseTo(42.3505305);
      expect(result.record.publicLocationLabel).toMatch(
        /Boylston and Clarendon Streets — Back Bay — 11am-3pm/,
      );
    }
  });

  it("skips features without point coordinates", () => {
    expect(
      source("boston-food-truck-schedule").normalizeRow({
        type: "Feature",
        geometry: null,
        properties: { ObjectId: 9, Truck: "Ghost Truck" },
      }),
    ).toBeNull();
  });
});

describe("OSM NYC source", () => {
  it("shares the JC mapper via the factory, with its own identity", () => {
    const nyc = source("osm-street-vendors-nyc");
    expect(nyc.overpassQuery).toContain("around:15000,40.73,-73.986");
    expect(nyc.license).toMatch(/ODbL/);
    const result = normalize("osm-street-vendors-nyc", {
      type: "node",
      id: 555,
      lat: 40.75,
      lon: -73.98,
      tags: { street_vendor: "yes", name: "Synthetic Dosa Cart" },
    });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.record.sourceName).toBe("osm-street-vendors-nyc");
      expect(result.record.sourceRecordId).toBe("osm:node/555");
    }
  });
});
