import { describe, expect, it } from "vitest";

import {
  EXTERNAL_SOURCE_TYPES,
  validateNormalized,
} from "@/features/location-import/normalized";

const base = {
  sourceType: "MUNICIPAL_OPEN_DATA",
  sourceName: "jerseycity-food-truck-location",
  sourceRecordId: "jerseycity:food-truck-location:1",
  sourceUrl: "https://data.jerseycitynj.gov/x",
  sourceUpdatedAt: null,
  name: null,
  vendorName: null,
  latitude: 40.7178,
  longitude: -74.0431,
  publicLocationLabel: "Grove St",
  scheduleType: "HOTSPOT",
  startAt: null,
  endAt: null,
  daysOfWeek: null,
  timezone: "America/New_York",
  verificationStatus: "CONFIRMED",
  rawSourceData: { any: "thing" },
};

describe("normalized external location schema", () => {
  it("accepts a complete municipal hotspot record", () => {
    const result = validateNormalized("jc", base, base.sourceRecordId);
    expect(result.ok).toBe(true);
  });

  it("has no vendor-voiced source type at all", () => {
    // The type-level guarantee behind "external data never becomes LIVE":
    // the enum cannot even express a vendor-originated record.
    expect(EXTERNAL_SOURCE_TYPES).not.toContain("VENDOR_LIVE");
    expect(EXTERNAL_SOURCE_TYPES).not.toContain("VENDOR_RECURRING");
    expect(EXTERNAL_SOURCE_TYPES).not.toContain("VENDOR_SCHEDULED");
    const result = validateNormalized(
      "jc",
      { ...base, sourceType: "VENDOR_LIVE" },
      base.sourceRecordId,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a mappable record without coordinates", () => {
    const result = validateNormalized(
      "jc",
      { ...base, latitude: null, longitude: null },
      base.sourceRecordId,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejected.reason).toMatch(/require coordinates/i);
    }
  });

  it("allows a vendor lead without coordinates", () => {
    const result = validateNormalized(
      "sf",
      {
        ...base,
        scheduleType: "VENDOR_LEAD",
        latitude: null,
        longitude: null,
        verificationStatus: "UNVERIFIED",
      },
      base.sourceRecordId,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects out-of-range and half-missing coordinates", () => {
    expect(validateNormalized("jc", { ...base, latitude: 91 }, null).ok).toBe(
      false,
    );
    expect(
      validateNormalized("jc", { ...base, longitude: -181 }, null).ok,
    ).toBe(false);
    expect(
      validateNormalized("jc", { ...base, longitude: null }, null).ok,
    ).toBe(false);
  });

  it("collects a readable reason instead of throwing", () => {
    const result = validateNormalized("jc", { junk: true }, "rec-9");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejected.recordId).toBe("rec-9");
      expect(result.rejected.reason.length).toBeGreaterThan(0);
    }
  });
});
