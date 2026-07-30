import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import {
  fetchArcGisFeatures,
  fetchOpendatasoftRows,
  fetchOverpassElements,
  fetchSocrataRows,
  type AdapterContext,
} from "@/features/location-import/adapters";
import {
  validateNormalized,
  type NormalizedExternalLocation,
  type RejectedRecord,
} from "@/features/location-import/normalized";
import type { ImportSourceConfig } from "@/features/location-import/sources";

/**
 * The import pipeline: fetch → validate → normalize → dedupe → stage →
 * publish-or-hold → mark missing records stale.
 *
 * Runs under the SERVICE ROLE only (the staging tables have no RLS write
 * path on purpose). It writes to exactly two places: the staging tables,
 * and — for trusted municipal zones — location_hotspots. It has no code
 * path to vendor tables or live sessions, which is the structural form of
 * "external data never becomes LIVE and never overwrites vendor truth".
 */

export type ImportRunResult = {
  sourceName: string;
  ok: boolean;
  error: string | null;
  received: number;
  created: number;
  updated: number;
  rejected: RejectedRecord[];
  published: number;
  markedStale: number;
};

type Db = SupabaseClient<Database>;

async function fetchRawRows(
  config: ImportSourceConfig,
  ctx: AdapterContext,
): Promise<Record<string, unknown>[]> {
  switch (config.adapter) {
    case "SOCRATA":
      if (!config.dataset) throw new Error("Socrata source needs a dataset");
      return fetchSocrataRows(
        config.endpoint,
        config.dataset,
        ctx,
        config.socrataSelect,
      );
    case "OPENDATASOFT":
      if (!config.dataset)
        throw new Error("Opendatasoft source needs a dataset");
      return fetchOpendatasoftRows(config.endpoint, config.dataset, ctx);
    case "ARCGIS":
      return fetchArcGisFeatures(config.endpoint, ctx);
    case "OVERPASS":
      if (!config.overpassQuery)
        throw new Error("Overpass source needs a query");
      return fetchOverpassElements(config.endpoint, config.overpassQuery, ctx);
  }
}

/** Upsert the source registry row and return its id. */
async function ensureSource(
  db: Db,
  config: ImportSourceConfig,
): Promise<string> {
  const { data, error } = await db
    .from("location_import_sources")
    .upsert(
      {
        source_name: config.sourceName,
        adapter: config.adapter,
        source_type: config.sourceType,
        endpoint: config.endpoint,
        dataset: config.dataset,
        license: config.license,
        attribution: config.attribution,
      },
      { onConflict: "source_name" },
    )
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`source upsert failed: ${error?.message ?? "no row"}`);
  }
  return data.id;
}

/**
 * Publish one staged record as a CONFIRMED hotspot (trusted-source path).
 * Mirrors location_import_approve_hotspot, which is the human-review twin.
 */
async function publishHotspot(
  db: Db,
  recordId: string,
  record: NormalizedExternalLocation,
): Promise<boolean> {
  if (record.latitude === null || record.longitude === null) return false;
  const { data: hotspot, error } = await db
    .from("location_hotspots")
    .upsert(
      // Cast: hotspots are DB-function/admin territory for app code, so the
      // generated types say `never` — the service-role pipeline is the one
      // sanctioned writer besides those functions.
      {
        latitude: record.latitude,
        longitude: record.longitude,
        public_name:
          record.publicLocationLabel ?? record.name ?? "Mobile food location",
        source_type: record.sourceType,
        source_url: record.sourceUrl,
        source_record_id: record.sourceRecordId,
        verification: "CONFIRMED",
        last_imported_at: new Date().toISOString(),
      } as never,
      { onConflict: "source_type,source_record_id" },
    )
    .select("id")
    .single();
  if (error || !hotspot) {
    console.error("hotspot publish failed", {
      record: record.sourceRecordId,
      code: error?.code ?? "no-row",
    });
    return false;
  }
  await db
    .from("location_import_records")
    .update({ status: "published", published_hotspot_id: hotspot.id })
    .eq("id", recordId);
  return true;
}

export async function runImport(
  db: Db,
  config: ImportSourceConfig,
  ctx: AdapterContext = {},
): Promise<ImportRunResult> {
  const runStartedAt = new Date().toISOString();
  const result: ImportRunResult = {
    sourceName: config.sourceName,
    ok: false,
    error: null,
    received: 0,
    created: 0,
    updated: 0,
    rejected: [],
    published: 0,
    markedStale: 0,
  };

  let sourceId: string;
  try {
    sourceId = await ensureSource(db, config);
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }

  try {
    const rows = await fetchRawRows(config, ctx);
    result.received = rows.length;

    // Normalize + validate; one bad row never stops the run.
    const seen = new Set<string>();
    const valid: NormalizedExternalLocation[] = [];
    for (const row of rows) {
      let candidate: unknown;
      try {
        candidate = config.normalizeRow(row);
      } catch (error) {
        result.rejected.push({
          sourceName: config.sourceName,
          recordId: null,
          reason: `mapper threw: ${error instanceof Error ? error.message : String(error)}`,
        });
        continue;
      }
      if (candidate === null) continue; // deliberate skip (filters)
      const recordId =
        typeof (candidate as { sourceRecordId?: unknown }).sourceRecordId ===
        "string"
          ? ((candidate as { sourceRecordId: string }).sourceRecordId ?? null)
          : null;
      const outcome = validateNormalized(
        config.sourceName,
        candidate,
        recordId,
      );
      if (!outcome.ok) {
        result.rejected.push(outcome.rejected);
        continue;
      }
      // In-run dedupe: portals repeat rows across pages occasionally.
      if (seen.has(outcome.record.sourceRecordId)) continue;
      seen.add(outcome.record.sourceRecordId);
      valid.push(outcome.record);
    }

    // Stage: insert new, refresh existing. Terminal review decisions
    // (rejected/published/associated) are never resurrected by a re-import.
    for (const record of valid) {
      const { data: existing } = await db
        .from("location_import_records")
        .select("id, status")
        .eq("source_name", record.sourceName)
        .eq("source_record_id", record.sourceRecordId)
        .maybeSingle();

      if (!existing) {
        const { error } = await db.from("location_import_records").insert({
          source_id: sourceId,
          source_name: record.sourceName,
          source_type: record.sourceType,
          source_record_id: record.sourceRecordId,
          source_url: record.sourceUrl,
          source_updated_at: record.sourceUpdatedAt,
          name: record.name,
          vendor_name: record.vendorName,
          latitude: record.latitude,
          longitude: record.longitude,
          public_label: record.publicLocationLabel,
          schedule_type: record.scheduleType,
          starts_at: record.startAt,
          ends_at: record.endAt,
          days_of_week: record.daysOfWeek,
          timezone: record.timezone,
          verification: record.verificationStatus,
          raw_source: record.rawSourceData as never,
        });
        if (error) {
          result.rejected.push({
            sourceName: config.sourceName,
            recordId: record.sourceRecordId,
            reason: `insert failed: ${error.code}`,
          });
          continue;
        }
        result.created += 1;
      } else {
        const { error } = await db
          .from("location_import_records")
          .update({
            source_url: record.sourceUrl,
            source_updated_at: record.sourceUpdatedAt,
            name: record.name,
            vendor_name: record.vendorName,
            latitude: record.latitude,
            longitude: record.longitude,
            public_label: record.publicLocationLabel,
            schedule_type: record.scheduleType,
            starts_at: record.startAt,
            ends_at: record.endAt,
            days_of_week: record.daysOfWeek,
            timezone: record.timezone,
            verification: record.verificationStatus,
            raw_source: record.rawSourceData as never,
            last_seen_at: new Date().toISOString(),
            // A stale record that reappears goes back to the queue; human
            // decisions stay decided.
            ...(existing.status === "stale"
              ? { status: "staged" as const }
              : {}),
          })
          .eq("id", existing.id);
        if (error) {
          result.rejected.push({
            sourceName: config.sourceName,
            recordId: record.sourceRecordId,
            reason: `update failed: ${error.code}`,
          });
          continue;
        }
        result.updated += 1;
      }
    }

    // Trusted municipal zones: publish staged hotspots without review, and
    // refresh already-published ones so label/coordinate corrections in the
    // source (or in our mappers) propagate on re-import.
    if (config.trustedHotspots) {
      const { data: staged } = await db
        .from("location_import_records")
        .select("id, source_record_id")
        .eq("source_name", config.sourceName)
        .eq("schedule_type", "HOTSPOT")
        .in("status", ["staged", "published"]);
      for (const row of staged ?? []) {
        const record = valid.find(
          (r) => r.sourceRecordId === row.source_record_id,
        );
        if (record && (await publishHotspot(db, row.id, record))) {
          result.published += 1;
        }
      }
    }

    // Records this source stopped returning: stale, never deleted — and
    // never touching anything a vendor confirmed.
    const { data: missing } = await db
      .from("location_import_records")
      .select("id")
      .eq("source_name", config.sourceName)
      .eq("status", "staged")
      .lt("last_seen_at", runStartedAt);
    for (const row of missing ?? []) {
      const { error } = await db
        .from("location_import_records")
        .update({ status: "stale" })
        .eq("id", row.id);
      if (!error) result.markedStale += 1;
    }

    result.ok = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  // Source health, success or failure.
  const { data: sourceRow } = await db
    .from("location_import_sources")
    .select("consecutive_failures")
    .eq("id", sourceId)
    .single();
  await db
    .from("location_import_sources")
    .update({
      last_attempt_at: new Date().toISOString(),
      ...(result.ok
        ? {
            last_success_at: new Date().toISOString(),
            last_error: null,
            consecutive_failures: 0,
          }
        : {
            last_error: result.error,
            consecutive_failures: (sourceRow?.consecutive_failures ?? 0) + 1,
          }),
      records_received: result.received,
      records_created: result.created,
      records_updated: result.updated,
      records_rejected: result.rejected.length,
    })
    .eq("id", sourceId);

  return result;
}
