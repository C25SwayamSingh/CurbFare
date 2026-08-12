import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const TEMPLATE_PATH = join(process.cwd(), "supabase/templates/recovery.html");

describe("recovery email template", () => {
  const template = readFileSync(TEMPLATE_PATH, "utf8");

  it("does not use target=_blank", () => {
    expect(template).not.toMatch(/target\s*=\s*["']_blank["']/i);
  });

  it("does not call window.open", () => {
    expect(template).not.toMatch(/window\.open/i);
  });

  it("contains exactly one token-bearing link, routed to the interstitial", () => {
    const hrefs = template.match(/href="[^"]+"/g) ?? [];
    const tokenLinks = hrefs.filter((h) => h.includes("token_hash="));
    expect(tokenLinks).toHaveLength(1);
    expect(tokenLinks[0]).toContain("/auth/recovery");
    expect(tokenLinks[0]).toContain("type=recovery");
    // Any other link (footer, wordmark) must be token-free marketing only.
    for (const href of hrefs) {
      if (!href.includes("token_hash=")) {
        expect(href).toContain("curbfare.app");
      }
    }
  });

  it("routes through the interstitial page instead of direct verify URLs", () => {
    expect(template).not.toContain("/auth/v1/verify");
    expect(template).not.toContain("/auth/confirm");
  });
});
