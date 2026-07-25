import { describe, expect, it } from "vitest";

import {
  CATALOG_BENCHMARKS,
  CHAIN_BENCHMARKS,
  DEFAULT_STANCE,
  MODEL_MATCH_TOLERANCE_BPS,
  RETURN_BANDS,
  bandFor,
  benchmarkModelPhrase,
  benchmarkPosition,
} from "@/features/loyalty/benchmarks";

describe("chain benchmarks", () => {
  it("cites a source and a review date for every figure", () => {
    for (const b of [...CHAIN_BENCHMARKS, ...CATALOG_BENCHMARKS]) {
      expect(b.source).toMatch(/^https:\/\//);
      // These programs change without notice; an undated benchmark is a
      // claim a vendor cannot check.
      expect(b.reviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(b.structure.length).toBeGreaterThan(10);
    }
  });

  it("shows the arithmetic behind each percentage", () => {
    for (const b of CHAIN_BENCHMARKS) {
      expect(b.calculation).toMatch(/÷|\//);
      expect(b.calculation).toMatch(/%/);
    }
  });

  it("spans the observed 3.3%–7.5% range", () => {
    const rates = CHAIN_BENCHMARKS.map((b) => b.returnBps);
    expect(Math.min(...rates)).toBe(330);
    expect(Math.max(...rates)).toBe(750);
  });

  it("omits a percentage for catalog programs, which have no single rate", () => {
    for (const b of CATALOG_BENCHMARKS) {
      expect(b).not.toHaveProperty("returnBps");
    }
  });
});

describe("return bands", () => {
  it("orders conservative below balanced below competitive", () => {
    const [c, b, k] = RETURN_BANDS;
    expect(c.highBps).toBeLessThanOrEqual(b.highBps);
    expect(b.highBps).toBeLessThanOrEqual(k.highBps);
  });

  it("stays inside the range the chains actually occupy", () => {
    const lowest = Math.min(...CHAIN_BENCHMARKS.map((x) => x.returnBps));
    const highest = Math.max(...CHAIN_BENCHMARKS.map((x) => x.returnBps));
    for (const band of RETURN_BANDS) {
      expect(band.lowBps).toBeGreaterThanOrEqual(lowest - 50);
      expect(band.highBps).toBeLessThanOrEqual(highest + 50);
    }
  });

  it("defaults to balanced, centred near the 5% cluster", () => {
    const band = bandFor(DEFAULT_STANCE);
    expect(band.stance).toBe("balanced");
    expect(band.lowBps).toBeLessThanOrEqual(500);
    expect(band.highBps).toBeGreaterThanOrEqual(500);
  });
});

describe("benchmarkPosition", () => {
  it("declares an exact chain match a model", () => {
    const pos = benchmarkPosition(750);
    expect(pos.kind).toBe("model");
    if (pos.kind === "model") expect(pos.chain.company).toMatch(/McDonald/);
  });

  it("treats rounding-distance differences as the same model", () => {
    const pos = benchmarkPosition(750 - MODEL_MATCH_TOLERANCE_BPS);
    expect(pos.kind).toBe("model");
  });

  it("positions a rate between its neighbouring chains", () => {
    // 6% sits between Subway (5%) and McDonald's (7.5%) — 100 bps from
    // Subway, 150 from McDonald's, so Subway is nearest.
    const pos = benchmarkPosition(600);
    expect(pos.kind).toBe("between");
    if (pos.kind === "between") {
      expect(pos.lower.company).toMatch(/Subway/);
      expect(pos.upper.company).toMatch(/McDonald/);
      expect(pos.nearest.company).toMatch(/Subway/);
    }
  });

  it("flags a program leaner than every chain", () => {
    const pos = benchmarkPosition(100);
    expect(pos.kind).toBe("leaner");
  });

  it("flags a program richer than every chain", () => {
    const pos = benchmarkPosition(1200);
    expect(pos.kind).toBe("richer");
  });
});

describe("benchmarkModelPhrase", () => {
  it("names an exact match as an identity, with its structure", () => {
    const text = benchmarkModelPhrase(750);
    expect(text).toMatch(/This is the McDonald's model/);
    expect(text).toMatch(/100 points per \$1/);
    expect(text).toMatch(/7\.5% back/);
  });

  it("names the nearest chain and both neighbours in between", () => {
    const text = benchmarkModelPhrase(600);
    expect(text).toMatch(/Closest to Subway/);
    expect(text).toMatch(/McDonald/);
  });

  it("says plainly when a program is leaner than every chain", () => {
    expect(benchmarkModelPhrase(100)).toMatch(/Leaner than every published/i);
  });

  it("says plainly when a program is richer than every chain", () => {
    expect(benchmarkModelPhrase(1200)).toMatch(/Richer than every published/i);
  });

  it("never invents a model name for a non-matching rate", () => {
    expect(benchmarkModelPhrase(600)).not.toMatch(/This is the/);
  });
});
