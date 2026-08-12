import { describe, expect, it } from "vitest";

import { cartPathFromScan } from "@/features/loyalty/components/cart-qr-scan";

const ORIGIN = "https://curbfare.app";

describe("cartPathFromScan", () => {
  it("follows a same-origin cart page URL", () => {
    expect(
      cartPathFromScan(
        "https://curbfare.app/vendors/rosa-tacos/cart-1",
        ORIGIN,
      ),
    ).toBe("/vendors/rosa-tacos/cart-1");
  });

  it("keeps the query string", () => {
    expect(
      cartPathFromScan("https://curbfare.app/vendors/a/b?src=qr", ORIGIN),
    ).toBe("/vendors/a/b?src=qr");
  });

  it("refuses another site's URL, even one that looks close", () => {
    expect(
      cartPathFromScan("https://curbfare.app.evil.com/vendors/a/b", ORIGIN),
    ).toBeNull();
  });

  it("refuses same-origin paths outside /vendors/", () => {
    expect(cartPathFromScan("https://curbfare.app/admin", ORIGIN)).toBeNull();
  });

  it("refuses non-URL payloads like checkout tokens", () => {
    expect(cartPathFromScan("curbfare:c1:abc123", ORIGIN)).toBeNull();
  });
});
