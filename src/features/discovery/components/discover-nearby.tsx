"use client";

import * as React from "react";
import Link from "next/link";
import {
  BadgeCheck,
  List,
  LocateFixed,
  Map as MapIcon,
  RefreshCw,
  Truck,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import type { NearbyVendorLocation } from "@/lib/supabase/database.types";
import { NearbyMap } from "@/features/discovery/components/nearby-map";
import {
  HotspotGroupCard,
  NearbyLocationCard,
} from "@/features/discovery/components/nearby-location-card";
import {
  HOTSPOT_EXPLANATION,
  groupHotspotResults,
  matchesNameQuery,
  requiredAttribution,
} from "@/features/discovery/location-state";

const RADIUS_OPTIONS = [1, 3, 5, 10] as const;
type RadiusMiles = (typeof RADIUS_OPTIONS)[number];

/**
 * Multi-select state filters. Every chip toggles independently — tapping a
 * selected chip unselects it. An EMPTY selection means "everything" (the
 * All chip), so the customer can never strand themselves with zero states
 * stuck on.
 */
type StateKey = "live" | "scheduled" | "recurring" | "hotspots";
const STATE_FILTERS: {
  key: StateKey;
  labelKey:
    "filterLive" | "filterScheduled" | "filterRecurring" | "filterHotspots";
}[] = [
  { key: "live", labelKey: "filterLive" },
  { key: "scheduled", labelKey: "filterScheduled" },
  { key: "recurring", labelKey: "filterRecurring" },
  { key: "hotspots", labelKey: "filterHotspots" },
];

function flagsFor(active: ReadonlySet<StateKey>) {
  const all = active.size === 0;
  return {
    live: all || active.has("live"),
    scheduled: all || active.has("scheduled"),
    recurring: all || active.has("recurring"),
    hotspots: all || active.has("hotspots"),
  };
}

type SearchCenter = {
  lat: number;
  lng: number;
  label: string;
  source: "device" | "manual";
};

type AreaSuggestion = { placeId: string; description: string };

type CartSuggestion = { name: string; href: string; place: string };

/**
 * Customer discovery across all four location states.
 *
 * Device location is requested ONLY when the customer presses "Use my current
 * location" — never on load — and their coordinates feed one query, never
 * stored. The list works with no Maps script; the map loads lazily. The four
 * states stay visibly distinct, and a hotspot is never shown as a vendor.
 */
export function DiscoverNearby({ mapsApiKey }: { mapsApiKey: string | null }) {
  const t = useT("discover");
  const [center, setCenter] = React.useState<SearchCenter | null>(null);
  const [locating, setLocating] = React.useState(false);
  const [geoError, setGeoError] = React.useState<string | null>(null);

  const [radius, setRadius] = React.useState<RadiusMiles>(3);
  const [active, setActive] = React.useState<ReadonlySet<StateKey>>(new Set());
  const flags = flagsFor(active);
  const flagsQuery = `live=${flags.live}&scheduled=${flags.scheduled}&recurring=${flags.recurring}&hotspots=${flags.hotspots}`;
  const hotspotsOnly = active.size === 1 && active.has("hotspots");
  const [results, setResults] = React.useState<NearbyVendorLocation[] | null>(
    null,
  );

  function toggleState(key: StateKey) {
    setActive((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }
  // A separate fetch used only when the main view is empty, so hotspots can be
  // offered as a fallback without ever mixing into the primary vendor results.
  const [fallback, setFallback] = React.useState<NearbyVendorLocation[]>([]);
  const [resultsError, setResultsError] = React.useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = React.useState(0);

  // Loading is DERIVED (search key vs last completed key), never a flag toggled
  // inside the fetch effect — so the two can't fall out of sync.
  const searchKey = center
    ? `${center.lat},${center.lng},${radius},${flagsQuery},${refreshNonce}`
    : null;
  const [completedKey, setCompletedKey] = React.useState<string | null>(null);
  const loading = searchKey !== null && searchKey !== completedKey;

  const [view, setView] = React.useState<"list" | "map">("list");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const [areaQuery, setAreaQuery] = React.useState("");
  const [areaSuggestions, setAreaSuggestions] = React.useState<
    AreaSuggestion[]
  >([]);
  const [cartSuggestions, setCartSuggestions] = React.useState<
    CartSuggestion[]
  >([]);
  const [areaConfigured, setAreaConfigured] = React.useState(true);
  const [areaError, setAreaError] = React.useState<string | null>(null);
  const areaDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  function requestDeviceLocation() {
    setGeoError(null);
    if (!("geolocation" in navigator)) {
      setGeoError(t("geoUnsupported"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: t("yourLocation"),
          source: "device",
        });
        setLocating(false);
      },
      (error) => {
        setGeoError(
          error.code === error.PERMISSION_DENIED
            ? t("geoDenied")
            : t("geoFailed"),
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function handleAreaQueryChange(value: string) {
    setAreaQuery(value);
    setAreaError(null);
    if (areaDebounceRef.current) {
      clearTimeout(areaDebounceRef.current);
    }
    if (value.trim().length < 2) {
      setAreaSuggestions([]);
      setCartSuggestions([]);
      return;
    }
    areaDebounceRef.current = setTimeout(async () => {
      // One box, two sources: places from Google, carts from Curbfare.
      // Either one failing must not take the other down.
      const [areaResult, cartResult] = await Promise.allSettled([
        fetch(`/api/discover/area?q=${encodeURIComponent(value)}`).then(
          (response) =>
            response.json() as Promise<{
              configured?: boolean;
              suggestions?: AreaSuggestion[];
            }>,
        ),
        fetch(`/api/discover/carts?q=${encodeURIComponent(value)}`).then(
          (response) =>
            response.json() as Promise<{ carts?: CartSuggestion[] }>,
        ),
      ]);

      if (areaResult.status === "fulfilled") {
        if (areaResult.value.configured === false) {
          setAreaConfigured(false);
          setAreaSuggestions([]);
        } else {
          setAreaSuggestions(areaResult.value.suggestions ?? []);
        }
      } else {
        setAreaSuggestions([]);
      }
      setCartSuggestions(
        cartResult.status === "fulfilled" ? (cartResult.value.carts ?? []) : [],
      );
    }, 300);
  }

  async function selectArea(suggestion: AreaSuggestion) {
    setAreaSuggestions([]);
    setCartSuggestions([]);
    setAreaQuery(suggestion.description);
    setAreaError(null);
    try {
      const response = await fetch(
        `/api/discover/area?placeId=${encodeURIComponent(suggestion.placeId)}`,
      );
      const data = (await response.json()) as {
        location?: { latitude: number; longitude: number };
      };
      if (!response.ok || !data.location) {
        setAreaError(t("areaNotFound"));
        return;
      }
      setCenter({
        lat: data.location.latitude,
        lng: data.location.longitude,
        label: suggestion.description,
        source: "manual",
      });
      setGeoError(null);
    } catch {
      setAreaError(t("areaNotFound"));
    }
  }

  // Fetch results whenever the center, radius, filter, or an explicit refresh
  // changes. Aborted on change so a stale response never overwrites a newer one.
  React.useEffect(() => {
    if (!center || !searchKey) {
      return;
    }
    const controller = new AbortController();
    const base = `lat=${center.lat}&lng=${center.lng}&radius=${radius}`;

    fetch(`/api/discover/nearby?${base}&${flagsQuery}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`nearby lookup failed: ${response.status}`);
        }
        const data = (await response.json()) as {
          results: NearbyVendorLocation[];
        };
        setResults(data.results);
        setResultsError(null);
        setSelectedId(null);

        // Fallback: if the customer's chosen view has nothing, offer nearby
        // hotspots — but only when they weren't already asking for hotspots.
        if (data.results.length === 0 && !hotspotsOnly) {
          try {
            const spotRes = await fetch(
              `/api/discover/nearby?${base}&live=false&scheduled=false&recurring=false&hotspots=true`,
              { signal: controller.signal },
            );
            const spots = (await spotRes.json()) as {
              results: NearbyVendorLocation[];
            };
            setFallback(spots.results ?? []);
          } catch {
            setFallback([]);
          }
        } else {
          setFallback([]);
        }
        setCompletedKey(searchKey);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setResultsError(t("loadFailed"));
        setCompletedKey(searchKey);
      });
    return () => controller.abort();
  }, [center, radius, flagsQuery, hotspotsOnly, refreshNonce, searchKey, t]);

  function refresh() {
    if (center?.source === "device") {
      requestDeviceLocation();
    }
    setRefreshNonce((n) => n + 1);
  }

  const handleSelect = React.useCallback((resultId: string) => {
    setSelectedId((current) => (current === resultId ? null : resultId));
  }, []);

  // Name/food filter: pure narrowing of what the server already returned,
  // applied to the list and the map alike so they can never disagree.
  const [nameQuery, setNameQuery] = React.useState("");
  const nameFilterActive = nameQuery.trim().length > 0;
  const visible = React.useMemo(
    () =>
      results && nameFilterActive
        ? results.filter((result) => matchesNameQuery(result, nameQuery))
        : results,
    [results, nameQuery, nameFilterActive],
  );

  const isEmpty = results !== null && results.length === 0;
  const mapData = isEmpty ? fallback : (visible ?? []);
  const filteredOutEverything =
    results !== null && results.length > 0 && visible?.length === 0;

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-lg border border-border p-4">
        <Button
          type="button"
          onClick={requestDeviceLocation}
          disabled={locating}
          className="w-full sm:w-auto"
        >
          <LocateFixed aria-hidden="true" />
          {locating ? t("findingYou") : t("useMyLocation")}
        </Button>
        {geoError ? (
          <Alert variant="destructive">
            <AlertDescription>{geoError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="relative">
          <label
            htmlFor="area-search"
            className="mb-1 block text-sm text-muted-foreground"
          >
            {t("searchLabel")}
          </label>
          <Input
            id="area-search"
            value={areaQuery}
            onChange={(event) => handleAreaQueryChange(event.target.value)}
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
            disabled={!areaConfigured}
          />
          {areaSuggestions.length > 0 || cartSuggestions.length > 0 ? (
            <ul className="absolute z-10 mt-1 w-full rounded-md border border-input bg-background shadow-md">
              {/* Carts first: a name match is almost always what was meant,
                  and it jumps straight to that cart's page. */}
              {cartSuggestions.map((cart) => (
                <li key={cart.href}>
                  <Link
                    href={cart.href}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <Truck
                      className="size-4 shrink-0 text-brand"
                      aria-hidden="true"
                    />
                    <span className="font-medium">{cart.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {cart.place}
                    </span>
                  </Link>
                </li>
              ))}
              {areaSuggestions.map((suggestion) => (
                <li key={suggestion.placeId}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => selectArea(suggestion)}
                  >
                    {suggestion.description}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {!areaConfigured ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("areaUnavailable")}
            </p>
          ) : null}
          {areaError ? (
            <p className="mt-1 text-sm text-destructive">{areaError}</p>
          ) : null}
        </div>
      </div>

      {center ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{t("within")}</span>
            {RADIUS_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRadius(option)}
                aria-pressed={radius === option}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
                  radius === option
                    ? "border-secondary bg-secondary font-medium text-secondary-foreground"
                    : "border-border text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
                )}
              >
                {option === 1
                  ? t("mileChipOne")
                  : t("miles", { count: option })}
              </button>
            ))}
            <span className="text-sm text-muted-foreground">
              {t("ofPlace", { place: center.label })}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={refresh}
              className="ml-auto"
            >
              <RefreshCw aria-hidden="true" />
              {t("refresh")}
            </Button>
          </div>

          {/* State filters — true toggles. Tap to focus a state, tap again
              to unselect it; none selected means everything shows. */}
          <div
            role="group"
            aria-label={t("statusFilterLabel")}
            className="flex flex-wrap gap-1.5"
          >
            <button
              type="button"
              onClick={() => setActive(new Set())}
              aria-pressed={active.size === 0}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
                active.size === 0
                  ? "border-secondary bg-secondary font-medium text-secondary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
              )}
            >
              {t("filterAll")}
            </button>
            {STATE_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleState(f.key)}
                aria-pressed={active.has(f.key)}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
                  active.has(f.key)
                    ? "border-secondary bg-secondary font-medium text-secondary-foreground"
                    : "border-border text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
                )}
              >
                {t(f.labelKey)}
              </button>
            ))}
          </div>

          {/* Narrow the results by what or who you're craving. Hidden until
              there is something to filter. */}
          {results !== null && results.length > 0 ? (
            <div>
              <label htmlFor="name-filter" className="sr-only">
                {t("nameFilterLabel")}
              </label>
              <Input
                id="name-filter"
                value={nameQuery}
                onChange={(event) => setNameQuery(event.target.value)}
                placeholder={t("nameFilterPlaceholder")}
                autoComplete="off"
                className="max-w-sm"
              />
              {nameFilterActive && !filteredOutEverything ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("showingCount", {
                    shown: visible?.length ?? 0,
                    total: results.length,
                  })}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* The one-line legend: what a checkmark means, what a pick is.
              Colors are decorative here; the words carry the meaning. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <BadgeCheck
                className="size-3.5 text-success"
                aria-hidden="true"
              />
              {t("legendConfirmed")}
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full border-2 border-muted-foreground/70"
              />
              {t("legendPicks")}
            </span>
          </div>

          <div
            role="tablist"
            aria-label={t("viewLabel")}
            className="inline-flex rounded-lg border border-border p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === "list"}
              onClick={() => setView("list")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                view === "list"
                  ? "bg-secondary font-medium text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="size-4" aria-hidden="true" />
              {t("listView")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "map"}
              onClick={() => setView("map")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                view === "map"
                  ? "bg-secondary font-medium text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <MapIcon className="size-4" aria-hidden="true" />
              {t("mapView")}
            </button>
          </div>

          {resultsError && !loading ? (
            <Alert variant="destructive">
              <AlertDescription>{resultsError}</AlertDescription>
            </Alert>
          ) : null}

          {loading && results === null ? (
            <p className="text-sm text-muted-foreground">{t("looking")}</p>
          ) : null}

          {results !== null ? (
            <>
              {/* The map renders even with zero results: an empty map of
                  the searched area reads as "nothing here yet", while a
                  vanished map reads as broken. */}
              {view === "map" ? (
                <NearbyMap
                  apiKey={mapsApiKey}
                  center={{ lat: center.lat, lng: center.lng }}
                  centerLabel={center.label}
                  results={mapData}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                />
              ) : null}

              {filteredOutEverything ? (
                <div className="rounded-lg border border-border p-6 text-center">
                  <p className="font-medium">
                    {t("noMatchTitle", { query: nameQuery.trim() })}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {results.length === 1
                      ? t("noMatchBodyOne")
                      : t("noMatchBody", { count: results.length })}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setNameQuery("")}
                  >
                    {t("clearFilter")}
                  </Button>
                </div>
              ) : results.length > 0 ? (
                <GroupedResultList
                  results={visible ?? []}
                  view={view}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                />
              ) : (
                <EmptyState
                  radius={radius}
                  hotspotsOnly={hotspotsOnly}
                  fallback={fallback}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                />
              )}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * Vendors render one card each; hotspot spots collapse into one card per
 * street (see groupHotspotResults). If anything on screen derives from
 * OpenStreetMap, the ODbL attribution renders with it — required the moment
 * such data is public, free the rest of the time.
 */
function GroupedResultList({
  results,
  view,
  selectedId,
  onSelect,
}: {
  results: NearbyVendorLocation[];
  view: "list" | "map";
  selectedId: string | null;
  onSelect: (resultId: string) => void;
}) {
  const { vendors, hotspotGroups } = groupHotspotResults(results);
  const attribution = requiredAttribution(results);

  return (
    <div className="space-y-2">
      <ul
        className={cn(
          "space-y-3",
          view === "map" ? "max-h-72 overflow-y-auto" : "",
        )}
      >
        {vendors.map((result) => (
          <NearbyLocationCard
            key={result.result_id}
            result={result}
            selected={selectedId === result.result_id}
            onSelect={onSelect}
          />
        ))}
        {hotspotGroups.map((group) => (
          <HotspotGroupCard
            key={group.label}
            group={group}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
      </ul>
      {attribution ? (
        <p className="text-right text-[11px] text-muted-foreground">
          {attribution}
        </p>
      ) : null}
    </div>
  );
}

/**
 * What a customer sees when their chosen view is empty. Confirmed vendors are
 * always preferred, so the fallback offers nearby hotspots only — and says
 * plainly that nobody is confirmed there.
 */
function EmptyState({
  radius,
  hotspotsOnly,
  fallback,
  selectedId,
  onSelect,
}: {
  radius: number;
  hotspotsOnly: boolean;
  fallback: NearbyVendorLocation[];
  selectedId: string | null;
  onSelect: (resultId: string) => void;
}) {
  const t = useT("discover");
  const noun = hotspotsOnly ? t("nounHotspots") : t("nounVendors");
  const radiusLabel = `${radius} ${radius === 1 ? t("mileOne") : t("mileMany")}`;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border p-6 text-center">
        <p className="font-medium">
          {t("emptyTitle", { noun, radius: radiusLabel })}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{t("emptyBody")}</p>
      </div>

      {!hotspotsOnly && fallback.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{HOTSPOT_EXPLANATION}</p>
          <GroupedResultList
            results={fallback}
            view="list"
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </div>
      ) : null}
    </div>
  );
}
