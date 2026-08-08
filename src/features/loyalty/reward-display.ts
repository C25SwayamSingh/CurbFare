import { formatCents } from "@/features/loyalty/engine";

/**
 * The customer-facing reward-row model, shared by every surface that lists a
 * cart's rewards (wallet cards, public rewards pages). One rule holds
 * everywhere: show what a reward is worth, never what it costs to earn.
 * Spend-to-earn math ("$50 of visits for $3 off") is the vendor's economics;
 * putting it in front of customers kills the habit the program exists to
 * build.
 */

export type CustomerRewardRow = {
  id: string;
  reward_kind: string;
  reward_value_cents: number;
  points_cost: number;
};

/** A few words on what you'd get: worth for items, scope for discounts. */
export function rewardWorthLine(row: CustomerRewardRow): string {
  return row.reward_kind === "FREE_ITEM"
    ? `Worth ${formatCents(row.reward_value_cents)}`
    : "Off your whole order";
}

/**
 * The reward returning the most dollar value per point, or null when there
 * is no real choice to make.
 */
export function bestValueItemId(catalog: CustomerRewardRow[]): string | null {
  if (catalog.length < 2) return null;
  return [...catalog].sort(
    (a, b) =>
      b.reward_value_cents / b.points_cost -
      a.reward_value_cents / a.points_cost,
  )[0].id;
}
