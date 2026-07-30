import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { runImport } from "@/features/location-import/pipeline";
import { LAUNCH_SOURCES } from "@/features/location-import/sources";

/* ------------------------------------------------------------------ */
/* A tiny in-memory Supabase fake covering exactly the chains the      */
/* pipeline uses. It also logs every table it writes, which is how we  */
/* prove the pipeline can never touch vendor truth.                    */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

class FakeDb {
  tables = new Map<string, Row[]>();
  writes: string[] = [];
  private seq = 0;

  constructor() {
    this.tables.set("location_import_sources", []);
    this.tables.set("location_import_records", []);
    this.tables.set("location_hotspots", []);
  }

  rows(table: string): Row[] {
    return this.tables.get(table) ?? [];
  }

  from(table: string) {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return new FakeQuery(this, table);
  }

  nextId(): string {
    this.seq += 1;
    return `id-${this.seq}`;
  }

  asClient(): SupabaseClient<Database> {
    return this as unknown as SupabaseClient<Database>;
  }
}

class FakeQuery implements PromiseLike<{ data: Row[] | null; error: null }> {
  private filters: ((row: Row) => boolean)[] = [];
  private pending: Row | null = null;
  private op: "select" | "insert" | "update" | "upsert" = "select";
  private conflictKeys: string[] = [];

  constructor(
    private db: FakeDb,
    private table: string,
  ) {}

  select() {
    return this;
  }

  insert(row: Row) {
    this.op = "insert";
    this.pending = row;
    return this.finishWrite();
  }

  update(row: Row) {
    this.op = "update";
    this.pending = row;
    return this;
  }

  upsert(row: Row, options?: { onConflict?: string }) {
    this.op = "upsert";
    this.pending = row;
    this.conflictKeys = options?.onConflict?.split(",") ?? [];
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    if (this.op === "update") return this.finishWrite();
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push((row) => String(row[column]) < String(value));
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  private matches(): Row[] {
    return this.db
      .rows(this.table)
      .filter((row) => this.filters.every((f) => f(row)));
  }

  private finishWrite() {
    this.db.writes.push(this.table);
    if (this.op === "insert" && this.pending) {
      // Mirror the column defaults the real schema applies.
      const defaults: Row =
        this.table === "location_import_records"
          ? { status: "staged", last_seen_at: new Date().toISOString() }
          : {};
      this.db
        .rows(this.table)
        .push({ id: this.db.nextId(), ...defaults, ...this.pending });
      return { error: null, select: () => this.selfResult() };
    }
    if (this.op === "update" && this.pending) {
      for (const row of this.matches()) Object.assign(row, this.pending);
      return { error: null };
    }
    return { error: null };
  }

  private applyUpsert(): Row {
    this.db.writes.push(this.table);
    const existing = this.db
      .rows(this.table)
      .find((row) =>
        this.conflictKeys.every((k) => row[k] === this.pending?.[k]),
      );
    if (existing) {
      Object.assign(existing, this.pending);
      return existing;
    }
    const row = { id: this.db.nextId(), ...this.pending };
    this.db.rows(this.table).push(row);
    return row;
  }

  private selfResult() {
    return {
      single: async () => ({ data: null, error: null }),
    };
  }

  async single(): Promise<{ data: Row | null; error: unknown }> {
    if (this.op === "upsert") {
      return { data: this.applyUpsert(), error: null };
    }
    const row = this.matches()[0] ?? null;
    return { data: row, error: row ? null : { code: "PGRST116" } };
  }

  async maybeSingle(): Promise<{ data: Row | null; error: null }> {
    return { data: this.matches()[0] ?? null, error: null };
  }

  then<TResult1, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: Row[] | null;
          error: null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.matches(), error: null as null }).then(
      onfulfilled,
      onrejected,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const JC = LAUNCH_SOURCES.find(
  (s) => s.sourceName === "jerseycity-food-truck-location",
)!;

function odsPage(results: Row[]): Response {
  return new Response(
    JSON.stringify({ total_count: results.length, results }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const ZONE_A = {
  recordid: "zone-a",
  location: "Grove St & Newark Ave",
  geo_point_2d: { lat: 40.7194, lon: -74.0428 },
};
const ZONE_B = {
  recordid: "zone-b",
  location: "Exchange Pl",
  geo_point_2d: { lat: 40.7162, lon: -74.033 },
};
const ZONE_BROKEN = { recordid: "zone-broken", location: "No coords" };

/* ------------------------------------------------------------------ */

describe("runImport", () => {
  it("stages, publishes trusted hotspots, and reports counts", async () => {
    const db = new FakeDb();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(odsPage([ZONE_A, ZONE_B, ZONE_BROKEN]));

    const result = await runImport(db.asClient(), JC, { fetchImpl });

    expect(result.ok).toBe(true);
    expect(result.received).toBe(3);
    expect(result.created).toBe(2);
    expect(result.rejected).toHaveLength(1); // the coordinate-less zone
    expect(result.published).toBe(2); // JC is trusted

    const hotspots = db.rows("location_hotspots");
    expect(hotspots).toHaveLength(2);
    for (const h of hotspots) {
      expect(h.verification).toBe("CONFIRMED");
      expect(h.source_type).toBe("MUNICIPAL_OPEN_DATA");
    }
    const records = db.rows("location_import_records");
    expect(records.every((r) => r.status === "published")).toBe(true);
  });

  it("is idempotent: a re-import updates instead of duplicating", async () => {
    const db = new FakeDb();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(odsPage([ZONE_A]));

    await runImport(db.asClient(), JC, { fetchImpl });
    fetchImpl.mockResolvedValue(odsPage([ZONE_A]));
    const second = await runImport(db.asClient(), JC, { fetchImpl });

    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);
    expect(db.rows("location_import_records")).toHaveLength(1);
    expect(db.rows("location_hotspots")).toHaveLength(1); // upsert, not clone
  });

  it("marks records the source stopped returning stale — never deletes", async () => {
    const db = new FakeDb();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(odsPage([ZONE_A, ZONE_B]));
    await runImport(db.asClient(), JC, { fetchImpl });

    // Force both back to staged so staleness is observable, then re-import
    // with only zone A present.
    for (const row of db.rows("location_import_records")) {
      row.status = "staged";
      row.last_seen_at = "2000-01-01T00:00:00Z";
    }
    fetchImpl.mockResolvedValueOnce(odsPage([ZONE_A]));
    const second = await runImport(db.asClient(), JC, { fetchImpl });

    const records = db.rows("location_import_records");
    expect(records).toHaveLength(2); // nothing deleted
    const zoneB = records.find((r) =>
      String(r.source_record_id).endsWith("zone-b"),
    );
    expect(zoneB?.status).toBe("stale");
    expect(second.markedStale).toBe(1);
  });

  it("never resurrects a human decision", async () => {
    const db = new FakeDb();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(odsPage([ZONE_A]));
    await runImport(db.asClient(), JC, { fetchImpl });

    const record = db.rows("location_import_records")[0];
    record.status = "rejected"; // an admin said no

    fetchImpl.mockResolvedValue(odsPage([ZONE_A]));
    await runImport(db.asClient(), JC, { fetchImpl });

    expect(record.status).toBe("rejected");
  });

  it("writes only to import tables and hotspots — vendor truth is unreachable", async () => {
    const db = new FakeDb();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(odsPage([ZONE_A]));
    await runImport(db.asClient(), JC, { fetchImpl });

    const touched = new Set(db.writes);
    expect(touched).toEqual(
      new Set([
        "location_import_sources",
        "location_import_records",
        "location_hotspots",
      ]),
    );
    expect(touched.has("vendor_location_sessions")).toBe(false);
    expect(touched.has("vendor_recurring_locations")).toBe(false);
    expect(touched.has("vendor_units")).toBe(false);
  });

  it("records failure health without throwing", async () => {
    const db = new FakeDb();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("gone", { status: 404 }));

    const result = await runImport(db.asClient(), JC, { fetchImpl });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/HTTP 404/);
    const source = db.rows("location_import_sources")[0];
    expect(source.consecutive_failures).toBe(1);
    expect(String(source.last_error)).toMatch(/HTTP 404/);
    expect(source.last_attempt_at).toBeTruthy();
    expect(source.last_success_at ?? null).toBeNull();
  });
});
