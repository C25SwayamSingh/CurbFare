import { describe, expect, it, vi } from "vitest";

import {
  fetchArcGisFeatures,
  fetchOpendatasoftRows,
  fetchOverpassElements,
  fetchSocrataRows,
} from "@/features/location-import/adapters";
import { fetchJson } from "@/features/location-import/http";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("http core", () => {
  it("retries a 500 and then succeeds", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ boom: true }, 500))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const data = await fetchJson("https://example.test/x", { fetchImpl });
    expect(data).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retry limit", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({}, 503));
    await expect(
      fetchJson("https://example.test/x", { fetchImpl, retries: 1 }),
    ).rejects.toThrow(/HTTP 503/);
    expect(fetchImpl).toHaveBeenCalledTimes(2); // first try + 1 retry
  });

  it("does not retry a 404 — that is configuration, not weather", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({}, 404));
    await expect(
      fetchJson("https://example.test/x", { fetchImpl }),
    ).rejects.toThrow(/HTTP 404/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects oversized responses", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ big: "x".repeat(2000) }));
    await expect(
      fetchJson("https://example.test/x", { fetchImpl, maxBytes: 100 }),
    ).rejects.toThrow(/too large/);
  });

  it("treats a timeout as retryable", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(abortError)
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const data = await fetchJson("https://example.test/x", { fetchImpl });
    expect(data).toEqual({ ok: true });
  });
});

describe("Socrata transport", () => {
  it("pages with $offset until a short page", async () => {
    const pageOne = Array.from({ length: 1000 }, (_, i) => ({ id: `${i}` }));
    const pageTwo = [{ id: "last" }];
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(pageOne))
      .mockResolvedValueOnce(jsonResponse(pageTwo));
    const rows = await fetchSocrataRows("https://data.sfgov.org", "rqzj-sfat", {
      fetchImpl,
    });
    expect(rows).toHaveLength(1001);
    expect(String(fetchImpl.mock.calls[1][0])).toContain("$offset=1000");
  });

  it("rejects a non-array page as shape drift", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: "nope" }));
    await expect(
      fetchSocrataRows("https://data.sfgov.org", "rqzj-sfat", { fetchImpl }),
    ).rejects.toThrow(/expected a JSON array/);
  });
});

describe("Opendatasoft transport", () => {
  it("reads results[] and stops at total_count", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        total_count: 2,
        results: [{ a: 1 }, { a: 2 }],
      }),
    );
    const rows = await fetchOpendatasoftRows(
      "https://data.jerseycitynj.gov/api/explore/v2.1",
      "food-truck-location",
      { fetchImpl },
    );
    expect(rows).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects a page without a results array", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ oops: true }));
    await expect(
      fetchOpendatasoftRows("https://x.test", "d", { fetchImpl }),
    ).rejects.toThrow(/expected a results array/);
  });
});

describe("ArcGIS transport", () => {
  it("follows exceededTransferLimit paging", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          features: [{ id: 1 }],
          exceededTransferLimit: true,
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ features: [{ id: 2 }] }));
    const features = await fetchArcGisFeatures(
      "https://maps.nola.gov/layer/5",
      {
        fetchImpl,
      },
    );
    expect(features).toHaveLength(2);
    expect(String(fetchImpl.mock.calls[1][0])).toContain("resultOffset=1");
  });
});

describe("Overpass transport", () => {
  it("POSTs the query and returns elements", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        elements: [{ type: "node", id: 42, lat: 40.7, lon: -74.0, tags: {} }],
      }),
    );
    const elements = await fetchOverpassElements(
      "https://overpass-api.de/api/interpreter",
      "[out:json];node;out;",
      { fetchImpl },
    );
    expect(elements).toHaveLength(1);
    const init = fetchImpl.mock.calls[0][1];
    expect(init?.method).toBe("POST");
    expect(String(init?.body)).toContain("data=");
  });
});
