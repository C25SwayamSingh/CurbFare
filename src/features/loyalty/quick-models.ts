import {
  CHAIN_BENCHMARKS,
  MODEL_MATCH_TOLERANCE_BPS,
  type ChainBenchmark,
} from "@/features/loyalty/benchmarks";
import {
  priceProposal,
  type AdvisorProposal,
  type PricedProposal,
} from "@/features/loyalty/advisor-agent";
import { rateBps } from "@/features/loyalty/engine";

/**
 * Deterministic one-click reward models — no AI anywhere in this path.
 *
 * Each published chain program becomes a preset: the vendor KEEPS their own
 * rewards and earn rate; only the points prices move so the entry reward
 * pays back at that chain's published percentage. Every preset runs through
 * the same engine validation as the manual editor, and applying one uses
 * the same owner-only publish action. Copying a well-known model is the
 * whole feature — the math is a division, not analytics.
 */

export type CurrentProgram = {
  pointsPerDollar: number;
  rewards: {
    rewardKind: "FREE_ITEM" | "FIXED_DISCOUNT";
    rewardName: string;
    rewardValueCents: number;
    rewardEstCostCents: number | null;
  }[];
};

export type ModelComparison = "richer" | "leaner" | "current";

export type ChainModelPreset = {
  chain: ChainBenchmark;
  /** The vendor's own rewards, repriced to this chain's return. */
  priced: PricedProposal;
  /** Against the vendor's program today. */
  comparison: ModelComparison;
  /** Plain-language read of `comparison`, owner-facing. */
  comparisonLabel: string;
};

/** Points prices land on clean steps, mirroring the advisor's convention. */
function roundPoints(points: number, pointsPerDollar: number): number {
  const step = 5 * pointsPerDollar;
  return Math.max(step, Math.round(points / step) * step);
}

/** pointsCost so that valueCents ÷ spend-to-earn = the chain's return. */
function pointsCostForReturn(
  valueCents: number,
  pointsPerDollar: number,
  returnBps: number,
): number {
  return roundPoints(
    (pointsPerDollar * valueCents * 100) / returnBps,
    pointsPerDollar,
  );
}

/** The customer return of the program's entry tier (its cheapest reward). */
export function entryReturnBps(
  pointsPerDollar: number,
  rewards: { pointsCost: number; rewardValueCents: number }[],
): number | null {
  if (rewards.length === 0) return null;
  const entry = [...rewards].sort((a, b) => a.pointsCost - b.pointsCost)[0];
  const spendCents = Math.floor((entry.pointsCost * 100) / pointsPerDollar);
  return rateBps(entry.rewardValueCents, spendCents);
}

function comparisonFor(
  chainBps: number,
  currentBps: number | null,
): ModelComparison {
  if (
    currentBps !== null &&
    Math.abs(chainBps - currentBps) <= MODEL_MATCH_TOLERANCE_BPS
  ) {
    return "current";
  }
  if (currentBps !== null && chainBps > currentBps) return "richer";
  return "leaner";
}

const COMPARISON_LABELS: Record<ModelComparison, string> = {
  richer: "Rewards come faster than today",
  leaner: "Costs you less than today",
  current: "Your current model",
};

/**
 * One preset per published chain, leanest first. Presets that the engine
 * would block (an over-rich reward, an out-of-bounds price) still appear —
 * with their blocked reasons — so the owner sees why a model doesn't fit
 * rather than wondering where it went.
 */
export function buildChainPresets(
  current: CurrentProgram & {
    currentRewards?: { pointsCost: number; rewardValueCents: number }[];
  },
): ChainModelPreset[] {
  const currentBps = current.currentRewards?.length
    ? entryReturnBps(current.pointsPerDollar, current.currentRewards)
    : null;

  return [...CHAIN_BENCHMARKS]
    .sort((a, b) => a.returnBps - b.returnBps)
    .map((chain) => {
      const proposal: AdvisorProposal = {
        pointsPerDollar: current.pointsPerDollar,
        rewards: current.rewards.map((reward) => ({
          ...reward,
          pointsCost: pointsCostForReturn(
            reward.rewardValueCents,
            current.pointsPerDollar,
            chain.returnBps,
          ),
        })),
      };
      return {
        chain,
        priced: priceProposal(proposal),
        comparison: comparisonFor(chain.returnBps, currentBps),
        comparisonLabel:
          COMPARISON_LABELS[comparisonFor(chain.returnBps, currentBps)],
      };
    });
}

export type Concern = "too_far" | "too_costly";

/**
 * The one minimal question: what bothers you today? "Rewards feel too far
 * away" recommends the cheapest RICHER model (smallest real change that
 * fixes the complaint); "costing me too much" recommends the richest
 * LEANER one. Returns the recommended chain company name, or null when no
 * preset moves in the asked direction.
 */
export function recommendFor(
  concern: Concern,
  presets: ChainModelPreset[],
): string | null {
  const sorted = [...presets].sort(
    (a, b) => a.chain.returnBps - b.chain.returnBps,
  );
  if (concern === "too_far") {
    return sorted.find((p) => p.comparison === "richer")?.chain.company ?? null;
  }
  return (
    [...sorted].reverse().find((p) => p.comparison === "leaner")?.chain
      .company ?? null
  );
}
