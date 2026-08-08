import type { Metadata } from "next";

import { AppShell } from "@/components/app/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { createServerClient } from "@/lib/supabase/server";
import type {
  ImportRecordStatus,
  ImportScheduleType,
  LocationVerification,
} from "@/lib/supabase/database.types";
import { LAUNCH_SOURCES } from "@/features/location-import/sources";
import {
  ReviewQueue,
  type ReviewRecord,
} from "@/features/location-import/components/review-queue";

export const metadata: Metadata = { title: "Imported locations — Curbfare" };

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** City/region grouping derived from source names — a review convenience. */
function regionOf(sourceName: string): string {
  if (
    sourceName.startsWith("jerseycity") ||
    sourceName === "osm-street-vendors-jc"
  )
    return "Jersey City";
  if (sourceName.startsWith("nyc") || sourceName === "osm-street-vendors-nyc")
    return "NYC";
  if (sourceName.startsWith("sf")) return "San Francisco";
  if (sourceName.startsWith("cambridge") || sourceName.startsWith("boston"))
    return "Boston area";
  return "Other";
}

function hoursFromRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const props = (r.properties ?? {}) as Record<string, unknown>;
  for (const value of [r.hoursoperations, r.hours, props.Hours, props.hours]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Review queue for externally imported location records, with filters for
 * region, source, type, verification, coordinates, and free text. Everything
 * here is invisible to customers until approved; approval can only produce
 * a hotspot — a place, never a vendor, never "Live".
 */
export default async function AdminLocationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePlatformAdmin("/admin/locations");
  const params = await searchParams;
  const filters = {
    region: params.region ?? "",
    source: params.source ?? "",
    type: params.type ?? "",
    verification: params.verification ?? "",
    status: params.status ?? "",
    coords: params.coords ?? "",
    q: (params.q ?? "").trim(),
  };

  // Narrow free-form query params to the real unions; junk becomes "no
  // filter" rather than a query error.
  const statusFilter: ImportRecordStatus[] =
    filters.status === "staged" || filters.status === "stale"
      ? [filters.status]
      : ["staged", "stale"];
  const typeFilter: ImportScheduleType | null =
    filters.type === "HOTSPOT" ||
    filters.type === "RECURRING" ||
    filters.type === "SCHEDULED" ||
    filters.type === "VENDOR_LEAD"
      ? filters.type
      : null;
  const verificationFilter: LocationVerification | null =
    filters.verification === "CONFIRMED" ||
    filters.verification === "EXPECTED" ||
    filters.verification === "UNVERIFIED"
      ? filters.verification
      : null;

  const supabase = await createServerClient();
  let query = supabase
    .from("location_import_records")
    .select("*")
    .in("status", statusFilter)
    .order("source_name")
    .order("last_seen_at", { ascending: false })
    .limit(200);
  if (filters.source) query = query.eq("source_name", filters.source);
  if (typeFilter) query = query.eq("schedule_type", typeFilter);
  if (verificationFilter) query = query.eq("verification", verificationFilter);
  if (filters.coords === "with") query = query.not("latitude", "is", null);
  if (filters.coords === "without") query = query.is("latitude", null);
  if (filters.q) {
    query = query.or(
      `public_label.ilike.%${filters.q}%,vendor_name.ilike.%${filters.q}%`,
    );
  }

  const [{ data: rawRecords }, { data: sources }] = await Promise.all([
    query,
    supabase.from("location_import_sources").select("*").order("source_name"),
  ]);

  // Region is derived, so it filters after the query (the 200-row window is
  // per-filter-combination; narrow by source for exact control).
  const records: ReviewRecord[] = (rawRecords ?? [])
    .filter(
      (r) => !filters.region || regionOf(r.source_name) === filters.region,
    )
    .map((r) => ({
      id: r.id,
      sourceName: r.source_name,
      region: regionOf(r.source_name),
      scheduleType: r.schedule_type,
      verification: r.verification,
      status: r.status,
      label: r.public_label ?? r.vendor_name ?? r.source_record_id,
      vendorName: r.vendor_name,
      latitude: r.latitude,
      longitude: r.longitude,
      daysText:
        r.days_of_week && r.days_of_week.length > 0
          ? r.days_of_week.map((d) => DAY_LABELS[d] ?? String(d)).join(", ")
          : null,
      hoursText: hoursFromRaw(r.raw_source),
      sourceUrl: r.source_url,
      lastSeenAt: r.last_seen_at,
      rawPretty: JSON.stringify(r.raw_source, null, 2),
    }));

  const regions = [
    ...new Set(LAUNCH_SOURCES.map((s) => regionOf(s.sourceName))),
  ];
  const selectClass = "h-9 rounded-md border border-input bg-card px-2 text-sm";

  return (
    <AppShell nav={[{ href: "/admin", label: "Admin" }]}>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Imported locations
          </h1>
          <p className="text-sm text-muted-foreground">
            External records waiting for review. Approving publishes a neutral
            hotspot pin — never a vendor, never &quot;Live&quot; or &quot;Open
            now&quot;.
          </p>
        </div>

        {params.error ? (
          <Alert variant="destructive">
            <AlertDescription>{params.error}</AlertDescription>
          </Alert>
        ) : null}
        {params.done ? (
          <Alert variant="success">
            <AlertDescription>
              Published {params.done} hotspot pin
              {params.done === "1" ? "" : "s"}.
            </AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              method="get"
              className="flex flex-wrap items-end gap-2 text-sm"
            >
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Region</span>
                <select
                  name="region"
                  defaultValue={filters.region}
                  className={selectClass}
                >
                  <option value="">All</option>
                  {regions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Source</span>
                <select
                  name="source"
                  defaultValue={filters.source}
                  className={selectClass}
                >
                  <option value="">All</option>
                  {LAUNCH_SOURCES.map((s) => (
                    <option key={s.sourceName} value={s.sourceName}>
                      {s.sourceName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Type</span>
                <select
                  name="type"
                  defaultValue={filters.type}
                  className={selectClass}
                >
                  <option value="">All</option>
                  <option value="HOTSPOT">Hotspot candidate</option>
                  <option value="RECURRING">Recurring candidate</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="VENDOR_LEAD">Vendor lead</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  Verification
                </span>
                <select
                  name="verification"
                  defaultValue={filters.verification}
                  className={selectClass}
                >
                  <option value="">All</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="EXPECTED">Expected</option>
                  <option value="UNVERIFIED">Unverified</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Status</span>
                <select
                  name="status"
                  defaultValue={filters.status}
                  className={selectClass}
                >
                  <option value="">Staged + stale</option>
                  <option value="staged">Staged</option>
                  <option value="stale">Stale</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  Coordinates
                </span>
                <select
                  name="coords"
                  defaultValue={filters.coords}
                  className={selectClass}
                >
                  <option value="">All</option>
                  <option value="with">With coordinates</option>
                  <option value="without">Without coordinates</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Search</span>
                <Input
                  name="q"
                  defaultValue={filters.q}
                  placeholder="label or vendor…"
                  className="h-9 w-48"
                />
              </label>
              <Button type="submit" size="sm">
                Apply
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Review queue</CardTitle>
            <CardDescription>
              {records.length} record{records.length === 1 ? "" : "s"} shown
              (max 200 per page of filters). Coordinate-less vendor leads can be
              associated or rejected, never published.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReviewQueue records={records} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Source health</CardTitle>
            <CardDescription>
              Last run per configured feed. Consecutive failures mean the
              endpoint or its shape changed — check before it rots.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(sources ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sources have run yet.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(sources ?? []).map((source) => (
                  <li
                    key={source.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <span className="font-medium">{source.source_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {source.adapter}
                    </span>
                    {source.consecutive_failures > 0 ? (
                      <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                        {source.consecutive_failures} failures —{" "}
                        {source.last_error ?? "unknown error"}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        received {source.records_received} · created{" "}
                        {source.records_created} · updated{" "}
                        {source.records_updated} · rejected{" "}
                        {source.records_rejected}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {source.last_success_at
                        ? `ok ${new Date(source.last_success_at).toLocaleString()}`
                        : "never succeeded"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
