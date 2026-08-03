import { z } from "zod";

import { benchmarkModelPhrase } from "@/features/loyalty/benchmarks";
import {
  blockingIssues,
  rateBps,
  validatePointsProgram,
  type CatalogItemConfig,
} from "@/features/loyalty/engine";

/**
 * Pure rules for the conversational advisor session: the prompt budget, the
 * shape of a conversation, and the pricing of a proposed program change.
 *
 * Deliberately free of the Anthropic SDK and of "server-only" so every rule
 * here is unit-testable. The LLM never prices anything: a proposal it emits
 * is re-validated and re-priced by the same deterministic engine that guards
 * the manual publish form.
 */

/** A session is capped: five vendor prompts is enough to change a program. */
export const MAX_ADVISOR_PROMPTS = 5;

export const advisorTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});

export type AdvisorTurn = z.infer<typeof advisorTurnSchema>;

/** Whole-conversation shape: bounded, and it must end on the vendor's turn. */
export const advisorTurnsSchema = z
  .array(advisorTurnSchema)
  .min(1)
  .max(MAX_ADVISOR_PROMPTS * 2)
  .refine((turns) => turns[turns.length - 1]?.role === "user", {
    message: "The last turn must be the vendor's.",
  });

export function userPromptCount(turns: readonly AdvisorTurn[]): number {
  return turns.filter((t) => t.role === "user").length;
}

export function promptsRemaining(turns: readonly AdvisorTurn[]): number {
  return Math.max(0, MAX_ADVISOR_PROMPTS - userPromptCount(turns));
}

/* ------------------------------------------------------------------ */
/* Proposals                                                           */
/* ------------------------------------------------------------------ */

/** What the model may hand back through its one tool. Mirrors the publish
 * form's schema — nothing the tool can express is beyond what the owner
 * could type into the manual editor. */
export const advisorProposalSchema = z.object({
  pointsPerDollar: z.number().int().min(1).max(100),
  rewards: z
    .array(
      z.object({
        pointsCost: z.number().int().positive(),
        rewardKind: z.enum(["FREE_ITEM", "FIXED_DISCOUNT"]),
        rewardName: z.string().trim().min(1).max(120),
        rewardValueCents: z.number().int().positive(),
        rewardEstCostCents: z
          .number()
          .int()
          .min(0)
          .nullish()
          .transform((v) => v ?? null),
      }),
    )
    .min(1)
    .max(6),
});

export type AdvisorProposal = z.infer<typeof advisorProposalSchema>;

export type PricedProposal = {
  proposal: AdvisorProposal;
  /** Named-chain positioning of the entry tier, from the vendor's numbers. */
  benchmark: string;
  /** Engine blocks; empty means the owner may apply it. */
  blockedReasons: string[];
};

function toCatalogConfig(p: AdvisorProposal): CatalogItemConfig[] {
  return p.rewards.map((item) => ({
    pointsCost: item.pointsCost,
    reward:
      item.rewardKind === "FREE_ITEM"
        ? {
            kind: "FREE_ITEM" as const,
            name: item.rewardName,
            retailCents: item.rewardValueCents,
            unitCostCents: item.rewardEstCostCents,
          }
        : {
            kind: "FIXED_DISCOUNT" as const,
            name: item.rewardName,
            discountCents: item.rewardValueCents,
          },
  }));
}

/**
 * Run a model-emitted proposal through the deterministic engine: the same
 * validation that gates the manual form, plus the named-benchmark sentence
 * for its entry tier. This is the only path from chat to numbers.
 */
export function priceProposal(proposal: AdvisorProposal): PricedProposal {
  const validation = validatePointsProgram({
    pointsPerDollar: proposal.pointsPerDollar,
    catalog: toCatalogConfig(proposal),
  });
  const entry = [...proposal.rewards].sort(
    (a, b) => a.pointsCost - b.pointsCost,
  )[0];
  const spendToEarnCents = Math.floor(
    (entry.pointsCost * 100) / proposal.pointsPerDollar,
  );
  return {
    proposal,
    benchmark: benchmarkModelPhrase(
      rateBps(entry.rewardValueCents, spendToEarnCents),
    ),
    blockedReasons: blockingIssues(validation).map((i) => i.message),
  };
}
