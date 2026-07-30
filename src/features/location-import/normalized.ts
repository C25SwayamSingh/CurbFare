import { z } from "zod";

/**
 * The one internal shape every external adapter must produce.
 *
 * The source-type enum here is deliberately NARROWER than the database's
 * location_source_type: no VENDOR_* values and no COMMUNITY_REPORT. An
 * external feed describes places, permits, and directories — it can never
 * speak with a vendor's voice, so the type system refuses to let it.
 */
export const EXTERNAL_SOURCE_TYPES = [
  "MUNICIPAL_OPEN_DATA",
  "THIRD_PARTY_SCHEDULE",
  "THIRD_PARTY_DIRECTORY",
] as const;

export type ExternalSourceType = (typeof EXTERNAL_SOURCE_TYPES)[number];

export const EXTERNAL_SCHEDULE_TYPES = [
  "HOTSPOT",
  "RECURRING",
  "SCHEDULED",
  "VENDOR_LEAD",
] as const;

/** External data may be CONFIRMED (official), EXPECTED, or UNVERIFIED — never live. */
export const EXTERNAL_VERIFICATIONS = [
  "CONFIRMED",
  "EXPECTED",
  "UNVERIFIED",
] as const;

const isoTimestamp = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "not a parseable timestamp");

export const normalizedExternalLocationSchema = z
  .object({
    sourceType: z.enum(EXTERNAL_SOURCE_TYPES),
    /** Machine name of the configured source, e.g. 'sf-mobile-food-permits'. */
    sourceName: z.string().regex(/^[a-z0-9][a-z0-9-]{1,80}$/),
    /**
     * Namespaced id: '{source}:{dataset}:{record}'. Namespacing is what keeps
     * two cities on the same portal software from colliding under one
     * source_type in location_hotspots.
     */
    sourceRecordId: z.string().min(3).max(200),
    sourceUrl: z.url().nullable(),
    sourceUpdatedAt: isoTimestamp.nullable(),
    name: z.string().trim().min(1).max(200).nullable(),
    vendorName: z.string().trim().min(1).max(200).nullable(),
    latitude: z.number().gte(-90).lte(90).nullable(),
    longitude: z.number().gte(-180).lte(180).nullable(),
    publicLocationLabel: z.string().trim().min(1).max(200).nullable(),
    scheduleType: z.enum(EXTERNAL_SCHEDULE_TYPES),
    startAt: isoTimestamp.nullable(),
    endAt: isoTimestamp.nullable(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).nullable(),
    timezone: z.string().min(1).nullable(),
    verificationStatus: z.enum(EXTERNAL_VERIFICATIONS),
    /** The record exactly as received — audit trail, stored privately. */
    rawSourceData: z.record(z.string(), z.unknown()),
  })
  .superRefine((val, ctx) => {
    const hasLat = val.latitude !== null;
    const hasLng = val.longitude !== null;
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: "custom",
        message: "latitude and longitude must be provided together",
      });
    }
    // Only a vendor lead (a permit naming a business, not a place on a map)
    // may arrive without coordinates. Anything mappable needs a real point.
    if (val.scheduleType !== "VENDOR_LEAD" && (!hasLat || !hasLng)) {
      ctx.addIssue({
        code: "custom",
        message: `${val.scheduleType} records require coordinates`,
      });
    }
  });

export type NormalizedExternalLocation = z.infer<
  typeof normalizedExternalLocationSchema
>;

/** A record the pipeline refused, with enough context to debug the source. */
export type RejectedRecord = {
  sourceName: string;
  recordId: string | null;
  reason: string;
};

/**
 * Validate a candidate; malformed records become rejections, never throws —
 * one bad row must not stop an import run.
 */
export function validateNormalized(
  sourceName: string,
  candidate: unknown,
  recordId: string | null,
):
  | { ok: true; record: NormalizedExternalLocation }
  | { ok: false; rejected: RejectedRecord } {
  const parsed = normalizedExternalLocationSchema.safeParse(candidate);
  if (parsed.success) {
    return { ok: true, record: parsed.data };
  }
  const reason = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "record"}: ${issue.message}`)
    .join("; ");
  return { ok: false, rejected: { sourceName, recordId, reason } };
}
