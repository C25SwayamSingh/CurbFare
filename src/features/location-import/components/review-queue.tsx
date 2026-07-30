"use client";

import * as React from "react";
import { CalendarDays, ExternalLink, MapPin } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  approveImportRecordAction,
  associateImportRecordAction,
  bulkApproveImportRecordsAction,
  markImportRecordStaleAction,
  rejectImportRecordAction,
} from "@/features/location-import/review-actions";

/** Server-shaped row, trimmed for the queue UI. */
export type ReviewRecord = {
  id: string;
  sourceName: string;
  region: string;
  scheduleType: string;
  verification: string;
  status: string;
  label: string;
  vendorName: string | null;
  latitude: number | null;
  longitude: number | null;
  daysText: string | null;
  hoursText: string | null;
  sourceUrl: string | null;
  lastSeenAt: string;
  rawPretty: string;
};

/**
 * The review queue. Selection is explicit — a checkbox is the admin saying
 * "I looked at this one" — and bulk publishing requires a confirmation step
 * that names the exact number of records about to become public pins.
 */
export function ReviewQueue({ records }: { records: ReviewRecord[] }) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirming, setConfirming] = React.useState(false);

  const approvable = React.useMemo(
    () =>
      new Set(
        records
          .filter((r) => r.latitude !== null && r.longitude !== null)
          .map((r) => r.id),
      ),
    [records],
  );
  const selectedIds = [...selected].filter((id) => approvable.has(id));

  function toggle(id: string) {
    setConfirming(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {/* Bulk bar — appears only once something is selected. */}
      {selectedIds.length > 0 ? (
        <div className="sticky top-2 z-10 rounded-lg border border-secondary bg-accent/60 p-3 backdrop-blur">
          {confirming ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Publish {selectedIds.length} record
                {selectedIds.length === 1 ? "" : "s"} as public hotspot pins?
              </p>
              <p className="text-xs text-muted-foreground">
                They will appear as neutral hotspot pins — never
                &quot;Live&quot;, never &quot;Open now&quot;, no vendor
                attached.
              </p>
              <form
                action={bulkApproveImportRecordsAction}
                className="flex gap-2"
              >
                <input
                  type="hidden"
                  name="recordIds"
                  value={JSON.stringify(selectedIds)}
                />
                <input
                  type="hidden"
                  name="confirmedCount"
                  value={selectedIds.length}
                />
                <Button type="submit" size="sm">
                  Yes, publish {selectedIds.length}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-medium">
                {selectedIds.length} selected
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => setConfirming(true)}
              >
                Approve selected as hotspots…
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelected(new Set());
                  setConfirming(false);
                }}
              >
                Clear
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {records.length === 0 ? (
        <Alert>
          <AlertDescription>
            Nothing matches these filters. Run{" "}
            <code>npm run import:locations</code> to fetch the configured
            sources, or loosen a filter.
          </AlertDescription>
        </Alert>
      ) : (
        <ul className="space-y-3">
          {records.map((record) => {
            const mappable =
              record.latitude !== null && record.longitude !== null;
            return (
              <li
                key={record.id}
                className="rounded-lg border border-border p-3"
              >
                <div className="flex items-start gap-3">
                  {mappable ? (
                    <input
                      type="checkbox"
                      aria-label={`Select ${record.label}`}
                      checked={selected.has(record.id)}
                      onChange={() => toggle(record.id)}
                      className="mt-1 size-4 accent-primary"
                    />
                  ) : (
                    <span className="mt-1 size-4" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{record.label}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {record.scheduleType}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {record.verification}
                      </span>
                      {record.status === "stale" ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          stale
                        </span>
                      ) : null}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {record.region} · {record.sourceName}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {record.vendorName
                        ? `Vendor named by source: ${record.vendorName} · `
                        : ""}
                      {mappable
                        ? `${record.latitude?.toFixed(5)}, ${record.longitude?.toFixed(5)}`
                        : "no coordinates — lead only, cannot be published"}
                      {" · last seen "}
                      {new Date(record.lastSeenAt).toLocaleDateString()}
                    </p>

                    {record.daysText || record.hoursText ? (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {[record.daysText, record.hoursText]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}

                    <div className="mt-1 flex flex-wrap gap-3 text-xs">
                      {mappable ? (
                        <a
                          href={`https://www.google.com/maps?q=${record.latitude},${record.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2"
                        >
                          <MapPin className="size-3" aria-hidden="true" />
                          Map preview
                        </a>
                      ) : null}
                      {record.sourceUrl ? (
                        <a
                          href={record.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2"
                        >
                          <ExternalLink className="size-3" aria-hidden="true" />
                          Official source
                        </a>
                      ) : null}
                    </div>

                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        Source record details
                      </summary>
                      <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted/60 p-2 text-[11px] leading-snug">
                        {record.rawPretty}
                      </pre>
                    </details>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {mappable ? (
                        <form action={approveImportRecordAction}>
                          <input
                            type="hidden"
                            name="recordId"
                            value={record.id}
                          />
                          <Button type="submit" size="sm">
                            Approve as hotspot
                          </Button>
                        </form>
                      ) : null}
                      <form action={rejectImportRecordAction}>
                        <input
                          type="hidden"
                          name="recordId"
                          value={record.id}
                        />
                        <Button type="submit" size="sm" variant="outline">
                          Reject
                        </Button>
                      </form>
                      {record.status === "staged" ? (
                        <form action={markImportRecordStaleAction}>
                          <input
                            type="hidden"
                            name="recordId"
                            value={record.id}
                          />
                          <Button type="submit" size="sm" variant="ghost">
                            Mark stale
                          </Button>
                        </form>
                      ) : null}
                      <form
                        action={associateImportRecordAction}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="hidden"
                          name="recordId"
                          value={record.id}
                        />
                        <Input
                          name="vendorUnitId"
                          placeholder="Vendor unit id"
                          className="h-8 w-56 text-xs"
                        />
                        <Button type="submit" size="sm" variant="outline">
                          Associate
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
