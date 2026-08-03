import { describe, expect, it } from "vitest";

import {
  buildChainPresets,
  entryReturnBps,
  recommendFor,
} from "@/features/loyalty/quick-models";

const THREE_OFF = {
  rewardKind: "FIXED_DISCOUNT" as const,
  rewardName: "$3 off",
  rewardValueCents: 300,
  rewardEstCostCents: null,
};

/** A vendor already running the McDonald's shape: 100/$1, $3 at 4,000. */
const CURRENT = {
  pointsPerDollar: 100,
  rewards: [THREE_OFF],
  currentRewards: [{ pointsCost: 4000, rewardValueCents: 300 }],
};

describe("chain model presets", () => {
  it("reprices the vendor's own reward to each chain's published return", () => {
    const presets = buildChainPresets(CURRENT);
    const byChain = Object.fromEntries(
      presets.map((p) => [p.chain.company, p]),
    );

    // $3 at 7.5% back needs $40 of spend → 4,000 points at 100/$1.
    expect(byChain["McDonald's"].priced.proposal.rewards[0].pointsCost).toBe(
      4000,
    );
    // $3 at 5% back needs $60 of spend → 6,000 points.
    expect(byChain["Subway"].priced.proposal.rewards[0].pointsCost).toBe(6000);
    // $3 at 3.3% back needs ~$91 → 9,000 after rounding to 500s.
    expect(
      byChain["Starbucks (Green)"].priced.proposal.rewards[0].pointsCost,
    ).toBe(9000);
  });

  it("orders leanest-first and marks the vendor's current model", () => {
    const presets = buildChainPresets(CURRENT);
    expect(presets.map((p) => p.chain.company)).toEqual([
      "Starbucks (Green)",
      "Subway",
      "McDonald's",
    ]);
    expect(presets[2].comparison).toBe("current");
    expect(presets[0].comparison).toBe("leaner");
  });

  it("every preset passes the same engine validation as the manual form", () => {
    for (const preset of buildChainPresets(CURRENT)) {
      expect(preset.priced.blockedReasons).toEqual([]);
      expect(preset.priced.benchmark).toContain(preset.chain.company);
    }
  });

  it("recommends the smallest fix for each concern", () => {
    // Currently on Subway (5%): too-far → McDonald's (richer); too-costly →
    // Subway is current, so the leaner Starbucks.
    const onSubway = buildChainPresets({
      ...CURRENT,
      currentRewards: [{ pointsCost: 6000, rewardValueCents: 300 }],
    });
    expect(recommendFor("too_far", onSubway)).toBe("McDonald's");
    expect(recommendFor("too_costly", onSubway)).toBe("Starbucks (Green)");
    // Already the richest model: nothing richer to recommend.
    expect(recommendFor("too_far", buildChainPresets(CURRENT))).toBeNull();
  });

  it("computes the entry return from the cheapest reward", () => {
    expect(
      entryReturnBps(100, [
        { pointsCost: 6000, rewardValueCents: 300 },
        { pointsCost: 4000, rewardValueCents: 100 },
      ]),
      // Entry tier is the 4,000-point reward: $1 back on $40 = 2.5%.
    ).toBe(250);
    expect(entryReturnBps(100, [])).toBeNull();
  });
});
