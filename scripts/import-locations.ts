/**
 * Manual import runner: fetches every enabled launch source and stages it.
 *
 *   npm run import:locations              # all sources
 *   npm run import:locations -- sf-mobile-food-permits   # one source
 *
 * Server-side only. Uses the service-role key from .env.local — that file
 * never leaves this machine and this script is never bundled. Publishing
 * stays limited to trusted municipal hotspots; everything else lands in the
 * review queue.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/supabase/database.types";
import { runImport } from "../src/features/location-import/pipeline";
import { LAUNCH_SOURCES } from "../src/features/location-import/sources";

function loadEnvLocal(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) env[match[1]] = match[2].replace(/^"|"$/g, "");
    }
  } catch {
    // fall through to process.env
  }
  return env;
}

async function main() {
  const env = { ...loadEnvLocal(), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local)",
    );
    process.exit(1);
  }

  const db = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });

  const only = process.argv[2];
  const sources = only
    ? LAUNCH_SOURCES.filter((s) => s.sourceName === only)
    : LAUNCH_SOURCES;
  if (sources.length === 0) {
    console.error(`No source named "${only}".`);
    console.error(
      `Known: ${LAUNCH_SOURCES.map((s) => s.sourceName).join(", ")}`,
    );
    process.exit(1);
  }

  for (const source of sources) {
    process.stdout.write(`${source.sourceName} … `);
    if (!source.enabled) {
      console.log("disabled (see sources.ts for why)");
      continue;
    }
    const result = await runImport(db, source, { pageDelayMs: 500 });
    if (result.ok) {
      console.log(
        `ok — received ${result.received}, created ${result.created}, ` +
          `updated ${result.updated}, published ${result.published}, ` +
          `stale ${result.markedStale}, rejected ${result.rejected.length}`,
      );
      for (const r of result.rejected.slice(0, 5)) {
        console.log(`   rejected ${r.recordId ?? "(no id)"}: ${r.reason}`);
      }
      if (result.rejected.length > 5) {
        console.log(`   … and ${result.rejected.length - 5} more`);
      }
    } else {
      console.log(`FAILED — ${result.error}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
