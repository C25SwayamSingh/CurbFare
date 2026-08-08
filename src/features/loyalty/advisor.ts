/**
 * Deterministic Loyalty Advisor — spend-based points programs.
 *
 * Given the vendor's typical order, candidate reward items, budget, and
 * cadence, it (1) prices each reward into a points cost that lands the
 * customer-perceived value in a healthy band while keeping vendor cost under
 * the comfort line, (2) rejects rewards it cannot price safely — with the
 * arithmetic — and (3) proposes up to three genuinely different catalog
 * shapes (one reward, a two-tier ladder, a full catalog).
 *
 * The AI layer may interpret the owner's words and explain tradeoffs; it never
 * produces the figures below. Every economic value comes from engine.ts and
 * every publication block is decided by validatePointsProgram().
 */

import {
  POINTS_BOUNDS,
  WEEKS_PER_MONTH_X100,
  blockingIssues,
  catalogItemEconomics,
  formatBps,
  formatCents,
  formatPoints,
  formatX100,
  pointsProgramEconomics,
  rewardEconomics,
  rewardDisplayLabel,
  rewardKindLabel,
  sourceLabel,
  validatePointsProgram,
  warningIssues,
  type CatalogItemConfig,
  type EconomicsContext,
  type PointsProgramConfig,
  type PointsProgramEconomics,
  type ProgramIssue,
  type RewardSpec,
  type Tracked,
  type ValueSource,
} from "@/features/loyalty/engine";

import { CHAIN_BENCHMARKS } from "@/features/loyalty/benchmarks";

export type LoyaltyGoal = "repeat_visits" | "bigger_orders" | "new_item";
export type ExistingSystem = "none" | "paper" | "square_or_pos" | "other";

/**
 * How generous the program should feel, chosen by the owner. "advisor" keeps
 * the platform default; "chain" targets a published chain's return so the
 * owner can literally run the Subway or McDonald's model; "custom" is their
 * own number. The engine treats all three identically: a target perceived
 * return that pricing aims at, bounded by the same cost ceiling either way.
 */
export type GenerositySelection =
  | { kind: "advisor" }
  | { kind: "chain"; company: string }
  | { kind: "custom"; targetBps: number };

/** Custom targets are clamped to a range where the arithmetic stays sane. */
export const GENEROSITY_MIN_BPS = 100; // 1%
export const GENEROSITY_MAX_BPS = 1200; // 12%

export function generosityTargetBps(
  g: GenerositySelection | undefined,
): number {
  if (!g || g.kind === "advisor") return DEFAULT_TARGET_PERCEIVED_BPS;
  if (g.kind === "custom") {
    return Math.min(
      GENEROSITY_MAX_BPS,
      Math.max(GENEROSITY_MIN_BPS, g.targetBps),
    );
  }
  const chain = CHAIN_BENCHMARKS.find((c) => c.company === g.company);
  return chain ? chain.returnBps : DEFAULT_TARGET_PERCEIVED_BPS;
}

/**
 * The single points scale: 100 points per $1, the McDonald's-style currency.
 * The big numbers are deliberate psychology — a 4,000-point reward feels like
 * progress in a way a 400-point one doesn't — and they cost nothing, because
 * the economics live entirely in the redemption ratio, not in this figure.
 */
export const DEFAULT_POINTS_PER_DOLLAR = 100;

/**
 * Default target customer-perceived reward rate when pricing (basis points).
 * Sits in the 5–10% band the chains use for entry rewards: lower than this and
 * the first reward drifts out of reach; higher and the vendor overpays. The
 * owner can override it through GenerositySelection.
 */
export const DEFAULT_TARGET_PERCEIVED_BPS = 800; // 8%
/** Vendor cost is kept at or below this when pricing (basis points). */
const PRICING_COST_CEILING_BPS = POINTS_BOUNDS.warnCostRateBps; // 5%
/**
 * Two reach limits. A premium tier is *allowed* to sit far away — that is what
 * makes it aspirational — but the cheapest reward in a program is the one a
 * customer actually chases first, so it gets the tighter cap.
 */
const MAX_SPEND_ANY_TIER_CENTS = 25000; // $250
const MAX_SPEND_ENTRY_TIER_CENTS = 8000; // $80

export type VisitCadence =
  "twice_weekly" | "weekly" | "biweekly" | "monthly" | "unsure";

export const VISIT_CADENCE_X100: Record<VisitCadence, number> = {
  twice_weekly: 200,
  weekly: 100,
  biweekly: 50,
  monthly: 23,
  unsure: 50,
};

export const VISIT_CADENCE_LABEL: Record<VisitCadence, string> = {
  twice_weekly: "About twice a week",
  weekly: "About once a week",
  biweekly: "About every other week",
  monthly: "About once a month",
  unsure: "Not sure",
};

export type ConsultationAnswers = {
  typicalOrderCents: Tracked<number | null>;
  cadence: VisitCadence;
  cadenceSource: ValueSource;
  goal: LoyaltyGoal;
  rewards: RewardSpec[];
  monthlyBudgetCents: Tracked<number | null>;
  regularsPerMonth: Tracked<number>;
  existingSystem: ExistingSystem;
  /** Omitted means the advisor default. */
  generosity?: GenerositySelection;
};

export type RecommendationTier = {
  pointsCost: number;
  reward: RewardSpec;
  rewardKindLabel: string;
  /** e.g. "Free Horchata — 250 pts (≈ $25 spent, ~4.8% back)". */
  summary: string;
};

export type LoyaltyRecommendation = {
  id: string;
  title: string;
  shape: "single" | "ladder" | "full";
  config: PointsProgramConfig;
  economics: PointsProgramEconomics;
  tiers: RecommendationTier[];
  earnRule: string;
  why: string[];
  warnings: ProgramIssue[];
  assumptions: string[];
  refundNote: string;
  pauseNote: string;
  fitScore: number;
  scoreBreakdown: string[];
  budgetFits: boolean | null;
};

export type ExcludedCandidate = {
  label: string;
  severity: "block" | "downgrade";
  reason: string;
  calculation?: string;
  remedy?: string;
};

export type AdvisorResult = {
  recommendations: LoyaltyRecommendation[];
  excluded: ExcludedCandidate[];
  inputSummary: { label: string; value: string; source: string }[];
  pointsPerDollar: number;
};

/* ------------------------------------------------------------------ */
/* Pricing                                                             */
/* ------------------------------------------------------------------ */

type PricedReward = {
  reward: RewardSpec;
  item: CatalogItemConfig;
  economics: ReturnType<typeof catalogItemEconomics>;
};

/**
 * Point prices are advertised numbers, so they land on steps a customer can
 * hold in their head. The step scales with the points currency: at 10 pts/$1
 * that is 50-point steps; at the 100 pts/$1 default it is 500 — the same
 * granularity McDonald's uses for its own tiers.
 */
function roundPoints(points: number, pointsPerDollar: number): number {
  const step = 5 * pointsPerDollar;
  return Math.max(step, Math.round(points / step) * step);
}

/**
 * Price one reward: pick a points cost so the customer-perceived rate lands
 * near the 8% target while vendor cost stays at or below the 5% comfort line.
 * Returns an exclusion when no safe price keeps it within reach.
 */
function priceReward(
  reward: RewardSpec,
  pointsPerDollar: number,
  targetPerceivedBps: number,
):
  | { ok: true; priced: PricedReward }
  | { ok: false; excluded: ExcludedCandidate } {
  const e0 = rewardEconomics(reward);
  // Spend so perceived value ≈ target: spend = value / targetRate.
  const spendForPerceived = Math.floor(
    (e0.customerValueCents * 10000) / targetPerceivedBps,
  );
  // Spend so vendor cost ≤ ceiling: spend = cost / ceilingRate.
  const spendForCostFloor = Math.floor(
    (e0.vendorCostCents * 10000) / PRICING_COST_CEILING_BPS,
  );
  const spendTarget = Math.max(spendForPerceived, spendForCostFloor);
  const pointsCost = roundPoints(
    (spendTarget * pointsPerDollar) / 100,
    pointsPerDollar,
  );
  const item: CatalogItemConfig = { pointsCost, reward };
  const economics = catalogItemEconomics(item, pointsPerDollar);

  if (economics.spendToEarnCents > MAX_SPEND_ANY_TIER_CENTS) {
    return {
      ok: false,
      excluded: {
        label: reward.name,
        severity: "block",
        reason: `Pricing “${reward.name}” at a sustainable rate would need about ${formatCents(economics.spendToEarnCents)} of spend — beyond what any reward tier should require.`,
        calculation: `Customer-perceived target ${formatBps(targetPerceivedBps)} on a ${formatCents(e0.customerValueCents)} reward needs ${formatCents(spendForPerceived)}; keeping vendor cost ≤ ${formatBps(PRICING_COST_CEILING_BPS)} needs ${formatCents(spendForCostFloor)}. The binding figure is ${formatCents(spendTarget)}.`,
        remedy:
          "Offer a lower-value reward, or split it into a cheaper entry reward plus this one as a premium tier.",
      },
    };
  }
  return { ok: true, priced: { reward, item, economics } };
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

function scoreProgram(
  economics: PointsProgramEconomics,
  shape: LoyaltyRecommendation["shape"],
  answers: ConsultationAnswers,
  featuresNamedItem: boolean,
): { score: number; budgetFits: boolean | null; breakdown: string[] } {
  let score = 100;
  const breakdown: string[] = ["Base 100"];
  const entry = economics.entry;

  if (entry.costRateBps <= POINTS_BOUNDS.warnCostRateBps) {
    score += 20;
    breakdown.push(
      `+20 entry reward cost ${formatBps(entry.costRateBps)} stays under the ${formatBps(POINTS_BOUNDS.warnCostRateBps)} comfort line`,
    );
  } else {
    score -= 20;
    breakdown.push(
      `−20 entry reward cost ${formatBps(entry.costRateBps)} is above the comfort line`,
    );
  }

  if (entry.perceivedRateBps >= 400) {
    score += 10;
    breakdown.push(
      `+10 customers see ${formatBps(entry.perceivedRateBps)} back at the first reward`,
    );
  } else if (entry.perceivedRateBps < 250) {
    score -= 15;
    breakdown.push(
      `−15 entry perceived value ${formatBps(entry.perceivedRateBps)} may be too small to motivate`,
    );
  }

  let budgetFits: boolean | null = null;
  const budget = answers.monthlyBudgetCents.value;
  if (budget !== null) {
    budgetFits = economics.monthlyCostHighCents <= budget;
    score += budgetFits ? 15 : -40;
    breakdown.push(
      budgetFits
        ? `+15 fits your ${formatCents(budget)}/month budget at the high end (${formatCents(economics.monthlyCostHighCents)})`
        : `−40 exceeds your ${formatCents(budget)}/month budget at the high end (${formatCents(economics.monthlyCostHighCents)})`,
    );
  }

  if (economics.items.every((it) => it.reward.kind === "FREE_ITEM")) {
    score += 10;
    breakdown.push(
      "+10 every reward is a free item — value the customer sees exceeds your cost",
    );
  } else {
    score -= 5;
    breakdown.push("−5 includes a fixed discount, which costs full face value");
  }

  // Shape fit: simple single reward reads clearest; a ladder adds a goal.
  if (shape === "single") {
    score += 5;
    breakdown.push("+5 one reward is the easiest to explain");
  } else if (shape === "ladder") {
    score += 8;
    breakdown.push("+8 an entry + premium reward gives progress and a goal");
  } else {
    score += 3;
    breakdown.push("+3 a full catalog offers the most choice");
  }

  // The stated goal changes which shape ranks first, never the prices.
  if (answers.goal === "repeat_visits" && shape === "single") {
    score += 4;
    breakdown.push(
      "+4 matches your repeat-visits goal: one clear habit loop at the counter",
    );
  }
  if (answers.goal === "bigger_orders" && shape !== "single") {
    score += 6;
    breakdown.push(
      "+6 matches your bigger-orders goal: a premium tier gives large orders a target",
    );
  }
  if (answers.goal === "new_item" && featuresNamedItem) {
    score += 6;
    breakdown.push(
      "+6 matches your featured-item goal: the item you named is the first reward",
    );
  }

  return { score, budgetFits, breakdown };
}

/* ------------------------------------------------------------------ */
/* Recommendations                                                     */
/* ------------------------------------------------------------------ */

function buildContext(answers: ConsultationAnswers): EconomicsContext {
  return {
    typicalOrderCents: answers.typicalOrderCents,
    regularsPerMonth: answers.regularsPerMonth,
    visitsPerWeekX100: {
      value: VISIT_CADENCE_X100[answers.cadence],
      source: answers.cadenceSource,
    },
  };
}

function tierSummary(t: PricedReward): string {
  const label = rewardDisplayLabel(
    t.reward.kind,
    t.reward.name,
    t.economics.reward.customerValueCents,
  );
  return `${label} — ${formatPoints(t.item.pointsCost)} (≈ ${formatCents(t.economics.spendToEarnCents)} spent, ${formatBps(t.economics.perceivedRateBps)} back)`;
}

function makeRecommendation(
  shape: LoyaltyRecommendation["shape"],
  priced: PricedReward[],
  answers: ConsultationAnswers,
  pointsPerDollar: number,
): { rec: LoyaltyRecommendation | null; excluded: ExcludedCandidate[] } {
  const config: PointsProgramConfig = {
    pointsPerDollar,
    catalog: priced.map((p) => p.item),
  };
  const validation = validatePointsProgram(config);
  if (validation.blocked) {
    return {
      rec: null,
      excluded: blockingIssues(validation).map((issue) => ({
        label: shape === "single" ? priced[0].reward.name : `${shape} catalog`,
        severity: "block" as const,
        reason: issue.message,
        calculation: issue.calculation,
        remedy: issue.remedy,
      })),
    };
  }

  const context = buildContext(answers);
  const economics = pointsProgramEconomics(config, context);

  // The cheapest reward is the one customers chase first; it must be in reach.
  if (economics.entry.spendToEarnCents > MAX_SPEND_ENTRY_TIER_CENTS) {
    return {
      rec: null,
      excluded: [
        {
          label: shapeTitle(shape, priced),
          severity: "block",
          reason: `Its cheapest reward needs about ${formatCents(economics.entry.spendToEarnCents)} of spend — too far for a first reward.`,
          calculation: `Entry tier ${formatPoints(economics.entry.pointsCost)} ÷ ${pointsPerDollar} pts/$ = ${formatCents(economics.entry.spendToEarnCents)}.`,
          remedy: `Add a cheaper reward so customers reach something within about ${formatCents(MAX_SPEND_ENTRY_TIER_CENTS)}.`,
        },
      ],
    };
  }
  const featuresNamedItem =
    Boolean(answers.rewards[0]?.name) &&
    priced[0]?.reward.name === answers.rewards[0]?.name;
  const { score, budgetFits, breakdown } = scoreProgram(
    economics,
    shape,
    answers,
    featuresNamedItem,
  );

  const excluded: ExcludedCandidate[] = [];
  if (budgetFits === false) {
    const budgetCents = answers.monthlyBudgetCents.value ?? 0;
    const regulars = answers.regularsPerMonth.value ?? 0;
    // Whole rewards a month across everyone, rounded for reading aloud.
    const rewardsPerMonth = Math.round(
      (regulars * economics.entryRewardsPerRegularPerMonthX10000) / 10000,
    );
    const overBy =
      budgetCents > 0
        ? Math.round(economics.monthlyCostHighCents / budgetCents)
        : 0;

    excluded.push({
      label: shapeTitle(shape, priced),
      // Beyond roughly triple the stated budget this stops being a tradeoff
      // and becomes a program the vendor has said they cannot fund.
      severity: overBy >= 3 ? "block" : "downgrade",
      reason: `This would cost about ${formatCents(economics.monthlyCostLowCents)}–${formatCents(economics.monthlyCostHighCents)} a month in rewards — ${overBy >= 2 ? `roughly ${overBy}× ` : ""}more than the ${formatCents(budgetCents)} you said you could spend.`,
      calculation:
        `Your ${regulars} regulars would earn about ${rewardsPerMonth} rewards a month between them ` +
        `(each regular earns one every ${describeEarnPace(economics.entryRewardsPerRegularPerMonthX10000)}). ` +
        `Assuming only 40–70% actually get claimed, at ${formatCents(economics.entry.reward.vendorCostCents)} of cost each.`,
      remedy:
        `Either raise the budget to about ${formatCents(economics.monthlyCostHighCents)}, make the reward cost you less, ` +
        `or price it higher in points so it takes longer to reach.`,
    });
  }

  const why: string[] = [];
  if (answers.goal === "repeat_visits") {
    why.push(
      "Every visit adds points, so regulars keep coming back to reach their next reward.",
    );
  }
  if (answers.goal === "bigger_orders") {
    why.push("Bigger orders earn more points automatically — no extra rules.");
  }
  if (answers.goal === "new_item") {
    why.push(
      `Featuring "${priced[0].reward.name}" as the reward puts your item in regulars' hands at your cost, not menu price.`,
    );
  }
  why.push(economics.entry.reward.modelNote);
  if (
    economics.entry.reward.kind === "FREE_ITEM" &&
    economics.entry.costRateBps <= 400 &&
    economics.entry.perceivedRateBps >= 350
  ) {
    why.push(
      `Customers see ${formatBps(economics.entry.perceivedRateBps)} back at the first reward; it only costs you ${formatBps(economics.entry.costRateBps)}.`,
    );
  }

  const rec: LoyaltyRecommendation = {
    id: `points-${shape}-${priced.map((p) => p.item.pointsCost).join("-")}`,
    title: shapeTitle(shape, priced),
    shape,
    config,
    economics,
    tiers: priced.map((p) => ({
      pointsCost: p.item.pointsCost,
      reward: p.reward,
      rewardKindLabel: rewardKindLabel(p.reward.kind),
      summary: tierSummary(p),
    })),
    earnRule: `${pointsPerDollar} points per $1 of eligible spend, confirmed by your staff at the counter.`,
    why,
    warnings: warningIssues(validation),
    assumptions: [
      economics.conversionNote,
      `About ${answers.regularsPerMonth.value} active regulars per month (${sourceLabel(answers.regularsPerMonth.source)}).`,
      "Completion band 40–70% of earned rewards — an assumption to validate, not a fact.",
      answers.typicalOrderCents.value === null
        ? "Typical order not given, so monthly projections can't be computed — enter it for exposure figures."
        : `Typical order ${formatCents(answers.typicalOrderCents.value)} (${sourceLabel(answers.typicalOrderCents.source)}).`,
    ],
    refundNote:
      "If a purchase is refunded, you or a manager reverse those points from the customer's history — one action, fully audited.",
    pauseNote:
      "Pausing stops new points but never erases earned points; customers can still redeem unless you pause redemptions too.",
    fitScore: score,
    scoreBreakdown: breakdown,
    budgetFits,
  };
  return { rec, excluded };
}

/**
 * How often one regular reaches the entry reward, said the way an owner would
 * say it. "0.87 rewards per month" is a rate; "about every 5 weeks" is a fact
 * about a person walking back up to the cart.
 */
export function describeEarnPace(rewardsPerMonthX10000: number): string {
  if (rewardsPerMonthX10000 <= 0) return "never, at this price";
  const weeks = Math.round(
    (WEEKS_PER_MONTH_X100 * 10000) / rewardsPerMonthX10000 / 100,
  );
  if (weeks <= 1) return "week";
  if (weeks <= 8) return `${weeks} weeks`;
  const months = Math.round(weeks / 4.33);
  return `${months} months`;
}

function shapeTitle(
  shape: LoyaltyRecommendation["shape"],
  priced: PricedReward[],
): string {
  if (shape === "single") {
    return `One-reward points card — ${priced[0].reward.name}`;
  }
  if (shape === "ladder") {
    return `Two-tier points ladder — ${priced[0].reward.name} → ${priced[priced.length - 1].reward.name}`;
  }
  return `Full points catalog — ${priced.length} rewards`;
}

export function recommendPrograms(answers: ConsultationAnswers): AdvisorResult {
  const pointsPerDollar = DEFAULT_POINTS_PER_DOLLAR;
  const targetPerceivedBps = generosityTargetBps(answers.generosity);
  const rewards: RewardSpec[] =
    answers.rewards.length > 0
      ? answers.rewards
      : [
          {
            kind: "FREE_ITEM",
            name: "Free drink",
            retailCents: 300,
            unitCostCents: null,
          },
        ];

  const excluded: ExcludedCandidate[] = [];
  const priced: PricedReward[] = [];
  for (const reward of rewards.slice(0, 4)) {
    const result = priceReward(reward, pointsPerDollar, targetPerceivedBps);
    if (result.ok) priced.push(result.priced);
    else excluded.push(result.excluded);
  }
  priced.sort((a, b) => a.item.pointsCost - b.item.pointsCost);

  const recommendations: LoyaltyRecommendation[] = [];
  if (priced.length > 0) {
    // Featuring an item means it IS the single-shape reward, even when a
    // cheaper one exists; the entry-reach cap then honestly rejects it if it
    // prices too far away.
    const featured =
      answers.goal === "new_item"
        ? (priced.find((p) => p.reward.name === answers.rewards[0]?.name) ??
          priced[0])
        : priced[0];
    const shapes: {
      shape: LoyaltyRecommendation["shape"];
      items: PricedReward[];
    }[] = [{ shape: "single", items: [featured] }];
    if (priced.length >= 2) {
      shapes.push({
        shape: "ladder",
        items: [priced[0], priced[priced.length - 1]],
      });
    }
    if (priced.length >= 3) {
      shapes.push({ shape: "full", items: priced.slice(0, 4) });
    }
    for (const s of shapes) {
      const { rec, excluded: exc } = makeRecommendation(
        s.shape,
        s.items,
        answers,
        pointsPerDollar,
      );
      if (rec) recommendations.push(rec);
      excluded.push(...exc);
    }
  }

  recommendations.sort((a, b) => b.fitScore - a.fitScore);
  return {
    recommendations: recommendations.slice(0, 3),
    excluded,
    inputSummary: inputSummary(answers, pointsPerDollar),
    pointsPerDollar,
  };
}

function generositySummary(g: GenerositySelection | undefined): {
  value: string;
  source: string;
} {
  const target = generosityTargetBps(g);
  if (!g || g.kind === "advisor") {
    return {
      value: `about ${formatBps(target)} back at the first reward (advisor default)`,
      source: sourceLabel("estimated"),
    };
  }
  if (g.kind === "chain") {
    return {
      value: `${formatBps(target)} back, the ${g.company} model`,
      source: sourceLabel("provided"),
    };
  }
  return {
    value: `${formatBps(target)} back, your own number`,
    source: sourceLabel("provided"),
  };
}

function inputSummary(
  answers: ConsultationAnswers,
  pointsPerDollar: number,
): AdvisorResult["inputSummary"] {
  const order = answers.typicalOrderCents;
  const generosity = generositySummary(answers.generosity);
  return [
    {
      label: "Points per dollar",
      value: `${pointsPerDollar} points for every $1 spent`,
      source: sourceLabel("estimated"),
    },
    {
      label: "Generosity target",
      value: generosity.value,
      source: generosity.source,
    },
    {
      label: "Typical order total",
      value:
        order.value === null
          ? "not given — we can't estimate your monthly cost without it"
          : formatCents(order.value),
      source: sourceLabel(order.source),
    },
    {
      label: "Regular visits per week",
      value: `${formatX100(VISIT_CADENCE_X100[answers.cadence])} (${VISIT_CADENCE_LABEL[answers.cadence]})`,
      source: sourceLabel(answers.cadenceSource),
    },
    {
      label: "Regulars per month",
      value: String(answers.regularsPerMonth.value),
      source: sourceLabel(answers.regularsPerMonth.source),
    },
    {
      label: "Monthly reward budget",
      value:
        answers.monthlyBudgetCents.value === null
          ? "not given — budget fit not checked"
          : formatCents(answers.monthlyBudgetCents.value),
      source: sourceLabel(answers.monthlyBudgetCents.source),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Existing-system guidance                                            */
/* ------------------------------------------------------------------ */

export type ExistingSystemGuidance = {
  title: string;
  summary: string;
  steps: string[];
};

export function existingSystemGuidance(
  system: ExistingSystem,
): ExistingSystemGuidance | null {
  switch (system) {
    case "paper":
      return {
        title: "Moving from paper punch cards",
        summary:
          "Your regulars are carrying half-finished cards. Don't void them — run both briefly and let paper age out.",
        steps: [
          "Keep honoring existing paper cards until each one is redeemed.",
          "Start new customers on the digital points card now.",
          "Pick a transition date a few weeks out and tell regulars about it.",
          "Never erase progress someone already earned on paper.",
        ],
      };
    case "square_or_pos":
      return {
        title: "Using Curbfare with your POS loyalty",
        summary:
          "Your POS program keeps working at the register. Curbfare's points card is strongest for customers who discover you here.",
        steps: [
          "Decide which system earns on a given sale — one purchase should not earn in both.",
          "Many vendors run Curbfare as a complement for new regulars rather than replacing the POS.",
          "Keep the rewards roughly comparable so neither card feels like the worse deal.",
        ],
      };
    case "other":
      return {
        title: "Using Curbfare with your current loyalty program",
        summary:
          "You can run both, but a single purchase should earn in one place only — otherwise you pay twice for the same visit.",
        steps: [
          "Pick one system per transaction and make sure staff know which.",
          "Watch for customers asking to earn in both — that is the double-reward risk.",
          "If your current program is working well, keeping it is a legitimate choice.",
        ],
      };
    case "none":
      return null;
  }
}
