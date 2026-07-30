"use client";

import Link from "next/link";
import {
  ExternalLink,
  Footprints,
  Info,
  MapPin,
  MapPinned,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { NearbyVendorLocation } from "@/lib/supabase/database.types";
import { VendorUnitPhoto } from "@/features/vendors/components/vendor-unit-photo";
import {
  CUISINE_CATEGORIES,
  VENDOR_UNIT_TYPES,
  labelFor,
} from "@/features/vendors/schemas";
import {
  STATE_STYLES,
  walkingDirectionsUrl,
  type HotspotGroup,
} from "@/features/discovery/location-state";

export function formatDistance(miles: number) {
  return miles < 0.1 ? "< 0.1 mi" : `${miles.toFixed(1)} mi`;
}

function formatVerified(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days === 0) return "Confirmed today";
  if (days === 1) return "Confirmed yesterday";
  if (days < 30) return `Confirmed ${days} days ago`;
  return `Confirmed ${then.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

/** Google-Maps walking route, opened outside the card's select behavior. */
function WalkThereLink({
  latitude,
  longitude,
  note,
}: {
  latitude: number;
  longitude: number;
  note?: string;
}) {
  return (
    <a
      href={walkingDirectionsUrl(latitude, longitude)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-2"
    >
      <Footprints className="size-3.5" aria-hidden="true" />
      Walk there{note ? ` ${note}` : ""}
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  );
}

function CardShell({
  selected,
  onActivate,
  children,
}: {
  selected: boolean;
  onActivate: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={onActivate}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onActivate();
          }
        }}
        className={cn(
          "cursor-pointer rounded-lg border bg-card p-3 transition-colors",
          selected
            ? "border-secondary bg-accent/40 ring-1 ring-secondary"
            : "border-border hover:bg-accent/40",
        )}
      >
        {children}
      </div>
    </li>
  );
}

/**
 * One street's worth of hotspot spots, as a single organized card.
 *
 * Municipal feeds list every permitted curb space separately; showing six
 * near-identical "Columbus Drive" rows reads as a bug. The group card keeps
 * the honesty rules — no photo, no vendor identity, explicit "vendor not
 * confirmed" — while presenting a street once, with its spot count and a
 * walking route to the nearest space.
 */
export function HotspotGroupCard({
  group,
  selectedId,
  onSelect,
}: {
  group: HotspotGroup;
  selectedId: string | null;
  onSelect: (resultId: string) => void;
}) {
  const style = STATE_STYLES.HOTSPOT;
  const selected = group.spots.some((s) => s.result_id === selectedId);
  const count = group.spots.length;

  return (
    <CardShell
      selected={selected}
      onActivate={() => onSelect(group.nearest.result_id)}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border"
          aria-hidden="true"
        >
          <MapPinned className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{group.label}</p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                style.badgeClass,
              )}
            >
              {style.badge}
            </span>
            {count > 1 ? (
              <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-xs font-medium text-brand">
                {count} spots
              </span>
            ) : null}
            <span className="ml-auto text-sm text-muted-foreground">
              {formatDistance(group.nearest.distance_miles)}
            </span>
          </div>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {group.nearest.reason_label}
          </p>
          <WalkThereLink
            latitude={group.nearest.latitude}
            longitude={group.nearest.longitude}
            note={count > 1 ? "(nearest spot)" : undefined}
          />
        </div>
      </div>
    </CardShell>
  );
}

/**
 * One vendor discovery result (live, scheduled, or usually-here).
 *
 * Hotspots render through HotspotGroupCard instead — the shapes are kept
 * apart in code, because the failure mode to avoid is a parking zone that
 * looks like a claimed business.
 */
export function NearbyLocationCard({
  result,
  selected,
  onSelect,
}: {
  result: NearbyVendorLocation;
  selected: boolean;
  onSelect: (resultId: string) => void;
}) {
  const style = STATE_STYLES[result.state];
  const verified = formatVerified(result.last_verified_at);

  return (
    <CardShell
      selected={selected}
      onActivate={() => onSelect(result.result_id)}
    >
      <div className="flex items-start gap-3">
        <VendorUnitPhoto
          path={result.primary_image_path}
          displayName={result.name ?? result.public_label}
          className="size-12 text-sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{result.name ?? result.public_label}</p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                style.badgeClass,
              )}
            >
              {style.badge}
            </span>
            <span className="ml-auto text-sm text-muted-foreground">
              {formatDistance(result.distance_miles)}
            </span>
          </div>
          {result.unit_type ? (
            <p className="text-sm text-muted-foreground">
              {labelFor(VENDOR_UNIT_TYPES, result.unit_type)}
              {result.cuisine_categories && result.cuisine_categories.length > 0
                ? ` · ${result.cuisine_categories
                    .map((c) => labelFor(CUISINE_CATEGORIES, c))
                    .join(", ")}`
                : ""}
            </p>
          ) : null}
          <p className="mt-1 flex items-center gap-1.5 text-sm">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            {result.public_label}
          </p>
          {/* The same sentence the marker announces — one source of truth. */}
          <p className="mt-0.5 text-sm text-muted-foreground">
            {result.reason_label}
          </p>
          {verified && result.state !== "LIVE" ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{verified}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-4">
            {result.organization_slug && result.unit_slug ? (
              <Link
                href={`/vendors/${result.organization_slug}/${result.unit_slug}`}
                onClick={(event) => event.stopPropagation()}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-2"
              >
                View page
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            ) : null}
            <WalkThereLink
              latitude={result.latitude}
              longitude={result.longitude}
            />
          </div>
        </div>
      </div>
    </CardShell>
  );
}
