import {
  fetchJson,
  type FetchJsonOptions,
} from "@/features/location-import/http";

/**
 * Transport adapters: one per portal technology, shared by every city on
 * that technology. They fetch and paginate RAW rows; turning a row into a
 * NormalizedExternalLocation is per-source mapping in sources.ts. Keeping
 * transport and meaning apart is what makes "add another Socrata city" a
 * config change instead of new code.
 */

export type AdapterKind = "SOCRATA" | "OPENDATASOFT" | "ARCGIS" | "OVERPASS";

export type AdapterContext = {
  fetchImpl?: typeof fetch;
  /** Pause between page requests; source-specific politeness. */
  pageDelayMs?: number;
  /** Hard cap on pages per run, whatever the source claims. */
  maxPages?: number;
  timeoutMs?: number;
};

const PAGE_SIZE = 1000;
const DEFAULT_MAX_PAGES = 20;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpOptions(ctx: AdapterContext): FetchJsonOptions {
  return { fetchImpl: ctx.fetchImpl, timeoutMs: ctx.timeoutMs };
}

/**
 * Socrata (data.sfgov.org, data.cambridgema.gov, data.ny.gov, …):
 * GET {domain}/resource/{dataset}.json with $limit/$offset paging.
 * Returns a plain JSON array per page; a short page ends the walk.
 */
export async function fetchSocrataRows(
  domain: string,
  dataset: string,
  ctx: AdapterContext = {},
  /** Optional $select column list — wide civic tables (monthly-fee ledgers…)
   *  can blow the response-size cap when every column ships. */
  selectColumns?: string[],
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const maxPages = ctx.maxPages ?? DEFAULT_MAX_PAGES;
  const select = selectColumns?.length
    ? `&$select=${encodeURIComponent(selectColumns.join(","))}`
    : "";
  for (let page = 0; page < maxPages; page++) {
    if (page > 0 && ctx.pageDelayMs) await sleep(ctx.pageDelayMs);
    // $order=:id pins a stable sort — Socrata paging without it can repeat
    // or drop rows across page boundaries, which reads as phantom staleness.
    const url = `${domain}/resource/${dataset}.json?$limit=${PAGE_SIZE}&$offset=${page * PAGE_SIZE}&$order=:id${select}`;
    const data = await fetchJson(url, httpOptions(ctx));
    if (!Array.isArray(data)) {
      throw new Error(`Socrata ${dataset}: expected a JSON array page`);
    }
    rows.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

/**
 * Opendatasoft Explore v2.1 (data.jerseycitynj.gov, data.brisbane.qld.gov.au):
 * GET {base}/catalog/datasets/{dataset}/records?limit&offset, records inside
 * a `results` array with `total_count`.
 */
export async function fetchOpendatasoftRows(
  base: string,
  dataset: string,
  ctx: AdapterContext = {},
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const limit = 100; // Explore v2.1 caps offset paging at small windows.
  const maxPages = ctx.maxPages ?? DEFAULT_MAX_PAGES;
  for (let page = 0; page < maxPages; page++) {
    if (page > 0 && ctx.pageDelayMs) await sleep(ctx.pageDelayMs);
    const url = `${base}/catalog/datasets/${dataset}/records?limit=${limit}&offset=${page * limit}`;
    const data = (await fetchJson(url, httpOptions(ctx))) as {
      total_count?: number;
      results?: unknown;
    };
    if (!Array.isArray(data?.results)) {
      throw new Error(`Opendatasoft ${dataset}: expected a results array`);
    }
    rows.push(...(data.results as Record<string, unknown>[]));
    const total = typeof data.total_count === "number" ? data.total_count : 0;
    if (rows.length >= total || data.results.length < limit) break;
  }
  return rows;
}

/**
 * ArcGIS feature service query (maps.nola.gov, …): f=geojson features with
 * resultOffset paging; `exceededTransferLimit` signals another page.
 */
export async function fetchArcGisFeatures(
  layerUrl: string,
  ctx: AdapterContext = {},
): Promise<Record<string, unknown>[]> {
  const features: Record<string, unknown>[] = [];
  const maxPages = ctx.maxPages ?? DEFAULT_MAX_PAGES;
  let offset = 0;
  for (let page = 0; page < maxPages; page++) {
    if (page > 0 && ctx.pageDelayMs) await sleep(ctx.pageDelayMs);
    const url =
      `${layerUrl}/query?where=1%3D1&outFields=*&returnGeometry=true` +
      `&f=geojson&resultOffset=${offset}&resultRecordCount=${PAGE_SIZE}`;
    const data = (await fetchJson(url, httpOptions(ctx))) as {
      features?: unknown;
      properties?: { exceededTransferLimit?: boolean };
      exceededTransferLimit?: boolean;
    };
    if (!Array.isArray(data?.features)) {
      throw new Error(`ArcGIS layer: expected a features array`);
    }
    features.push(...(data.features as Record<string, unknown>[]));
    const more =
      data.exceededTransferLimit === true ||
      data.properties?.exceededTransferLimit === true;
    if (!more) break;
    offset += data.features.length;
  }
  return features;
}

/**
 * Overpass (OpenStreetMap): POST the query, elements[] back. No pagination —
 * the query's own area bound is the size control.
 */
export async function fetchOverpassElements(
  endpoint: string,
  query: string,
  ctx: AdapterContext = {},
): Promise<Record<string, unknown>[]> {
  const data = (await fetchJson(endpoint, {
    ...httpOptions(ctx),
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  })) as { elements?: unknown };
  if (!Array.isArray(data?.elements)) {
    throw new Error("Overpass: expected an elements array");
  }
  return data.elements as Record<string, unknown>[];
}
