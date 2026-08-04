/**
 * Transport core for external open-data fetches. Server-side only.
 *
 * Every adapter goes through fetchJson: hard timeout, bounded retries with
 * backoff, a response-size ceiling, and logging that names the host and path
 * but never a query string (public portals take no secrets, but the habit is
 * the point).
 */

export type FetchJsonOptions = {
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Retries AFTER the first attempt, on network errors and 5xx. */
  retries?: number;
  /** Reject bodies larger than this many bytes. */
  maxBytes?: number;
  method?: "GET" | "POST";
  body?: string;
  headers?: Record<string, string>;
};

const DEFAULTS = {
  timeoutMs: 15_000,
  retries: 2,
  maxBytes: 10_000_000, // 10 MB — municipal datasets, not archives.
} as const;

function loggableUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return "invalid-url";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson(
  url: string,
  options: FetchJsonOptions = {},
): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const retries = options.retries ?? DEFAULTS.retries;
  const maxBytes = options.maxBytes ?? DEFAULTS.maxBytes;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      // 250ms, 500ms, 1s… gentle on shared civic infrastructure.
      await sleep(250 * 2 ** (attempt - 1));
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: options.method ?? "GET",
        body: options.body,
        headers: {
          // Civic APIs (and Overpass etiquette in particular) expect a
          // descriptive client identity; the default undici UA gets 403/406s.
          "User-Agent": "Curbfare-LocationImport/1.0 (open-data ingest)",
          Accept: "application/json",
          ...options.headers,
        },
        signal: controller.signal,
      });

      if (response.status >= 500) {
        lastError = new Error(
          `HTTP ${response.status} from ${loggableUrl(url)}`,
        );
        continue; // retryable
      }
      if (!response.ok) {
        // 4xx is a configuration problem — retrying will not help.
        throw new Error(`HTTP ${response.status} from ${loggableUrl(url)}`);
      }

      const declared = Number(response.headers.get("content-length") ?? "0");
      if (declared > maxBytes) {
        throw new Error(
          `response too large (${declared} bytes) from ${loggableUrl(url)}`,
        );
      }
      const text = await response.text();
      if (text.length > maxBytes) {
        throw new Error(
          `response too large (${text.length} bytes) from ${loggableUrl(url)}`,
        );
      }
      return JSON.parse(text) as unknown;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        lastError = new Error(
          `timeout after ${timeoutMs}ms: ${loggableUrl(url)}`,
        );
        continue; // retryable
      }
      if (
        error instanceof TypeError // fetch network failure
      ) {
        lastError = error;
        continue; // retryable
      }
      throw error; // 4xx, size cap, JSON parse — not retryable
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`fetch failed: ${loggableUrl(url)}`);
}
