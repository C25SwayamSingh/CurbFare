/**
 * Opt-in live smoke test: fetches ONE page from each configured public
 * endpoint and reports reachability and row shape — no database writes.
 *
 *   npm run smoke:sources
 *
 * This is deliberately not part of the vitest suite: the normal tests never
 * touch the network. Run this manually (or weekly) to catch endpoint
 * removals and schema drift before they break a real import.
 */
import {
  fetchArcGisFeatures,
  fetchOpendatasoftRows,
  fetchOverpassElements,
  fetchSocrataRows,
} from "../src/features/location-import/adapters";
import { validateNormalized } from "../src/features/location-import/normalized";
import { LAUNCH_SOURCES } from "../src/features/location-import/sources";

async function main() {
  let failures = 0;

  for (const source of LAUNCH_SOURCES) {
    process.stdout.write(`${source.sourceName} … `);
    if (!source.enabled) {
      console.log("disabled (see sources.ts for why)");
      continue;
    }
    try {
      let rows: Record<string, unknown>[] = [];
      const ctx = { maxPages: 1, timeoutMs: 20000 };
      if (source.adapter === "SOCRATA" && source.dataset) {
        rows = await fetchSocrataRows(
          source.endpoint,
          source.dataset,
          ctx,
          source.socrataSelect,
        );
      } else if (source.adapter === "OPENDATASOFT" && source.dataset) {
        rows = await fetchOpendatasoftRows(
          source.endpoint,
          source.dataset,
          ctx,
        );
      } else if (source.adapter === "OVERPASS" && source.overpassQuery) {
        rows = await fetchOverpassElements(
          source.endpoint,
          source.overpassQuery,
          ctx,
        );
      } else if (source.adapter === "ARCGIS") {
        rows = await fetchArcGisFeatures(source.endpoint, ctx);
      } else {
        console.log("skipped (no smoke handler)");
        continue;
      }

      let valid = 0;
      let skipped = 0;
      let rejected = 0;
      for (const row of rows.slice(0, 200)) {
        const candidate = source.normalizeRow(row);
        if (candidate === null) {
          skipped += 1;
          continue;
        }
        const outcome = validateNormalized(source.sourceName, candidate, null);
        if (outcome.ok) valid += 1;
        else rejected += 1;
      }
      console.log(
        `reachable — ${rows.length} rows sampled; ${valid} valid, ` +
          `${skipped} filtered, ${rejected} rejected`,
      );
      const sampled = Math.min(rows.length, 200);
      if (sampled > 0 && valid === 0 && skipped < sampled) {
        console.log("   ⚠ shape drift? every unfiltered row failed validation");
        failures += 1;
      }
    } catch (error) {
      console.log(`FAILED — ${error instanceof Error ? error.message : error}`);
      failures += 1;
    }
  }

  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
