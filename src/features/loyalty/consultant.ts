import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { ADVISOR_MODEL_ID } from "@/features/loyalty/advisor-model";
import {
  advisorProposalSchema,
  priceProposal,
  MAX_ADVISOR_PROMPTS,
  type AdvisorTurn,
  type PricedProposal,
} from "@/features/loyalty/advisor-agent";
import { CHAIN_BENCHMARKS, RETURN_BANDS } from "@/features/loyalty/benchmarks";
import { formatCents, formatPoints } from "@/features/loyalty/engine";

/**
 * OPTIONAL conversational layer over the deterministic advisor.
 *
 * The language model NEVER produces loyalty economics, balances, or program
 * terms on its own authority. It interviews the owner, explains tradeoffs
 * against published chain benchmarks, and may hand back a structured
 * proposal through one tool — which the server re-validates and re-prices
 * with engine.ts before anyone sees a number. Publishing stays a separate,
 * owner-only action; this module has no write access to anything.
 *
 * Env-gated and fail-closed, mirroring src/lib/geocoding/google-places.ts:
 * absent ANTHROPIC_API_KEY, the advisor dock simply isn't offered. The
 * manual editor and publish flow work with or without it.
 */

const MODEL = ADVISOR_MODEL_ID;
const MAX_TOKENS = 1500;

export function isLoyaltyConsultantConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** The published-chain facts the model may cite, generated from the same
 * dataset the UI shows so the chat can never drift from the cards. */
function benchmarkFacts(): string {
  const chains = CHAIN_BENCHMARKS.map(
    (b) =>
      `- ${b.company}: ${b.structure} (${(b.returnBps / 100).toFixed(1)}% back; ${b.calculation})`,
  ).join("\n");
  const bands = RETURN_BANDS.map(
    (b) =>
      `- ${b.label}: ${(b.lowBps / 100).toFixed(1)}%–${(b.highBps / 100).toFixed(1)}% back — ${b.bestFor}`,
  ).join("\n");
  return `PUBLISHED CHAIN PROGRAMS (the only competitor figures you may cite):\n${chains}\n\nRETURN BANDS:\n${bands}`;
}

const SYSTEM_PROMPT = `You are the Curbfare Loyalty Advisor, a plain-spoken \
consultant for independent food-cart, food-truck, and small-restaurant owners.

How a session works:
- The owner opens by saying what they don't like about their current program \
or what they want. The whole session is capped at ${MAX_ADVISOR_PROMPTS} \
owner messages, so be efficient.
- Ask AT MOST one short clarifying question per reply, and only when you \
truly cannot recommend without it. If you already know enough, recommend \
immediately. Most sessions should reach a proposal within two replies.
- Keep every reply to a few short sentences. Compare to the published chain \
programs when it helps ("that would make your first reward easier to reach \
than McDonald's").
- When you are ready to recommend a concrete change, call the \
propose_program_change tool AND write one or two plain sentences saying what \
changes and why. The platform re-checks and prices every proposal with its \
own calculator, and only the owner can apply it.

Hard rules you must never break:
- You do NOT set, change, publish, pause, or calculate any loyalty program, \
balance, reward, point, price, or financial limit yourself. A deterministic \
server-side engine re-validates everything; the owner applies changes with \
their own button.
- You never invent economic figures. Only reference numbers from the CONTEXT \
block and the published chain facts below. If a number you need isn't there, \
say so rather than guessing.
- Never claim access to any competitor's private algorithm; the chain facts \
below are their published, customer-facing terms.
- Never present an estimate as a fact. Costs labeled "estimated" are the \
platform's 30%-of-menu-price fallback until the owner enters real cost data.
- No guarantees about revenue or results.
- Keep answers free of loyalty-accounting jargon. Never use "liability", \
"breakage", "redemption rate", or "outstanding balance" with an owner — say \
"what it would cost you if everyone cashed in" instead.

${benchmarkFacts()}`;

export type ConsultantContext = {
  activeProgram?: { pointsPerDollar: number } | null;
  catalog?:
    | {
        pointsCost: number;
        rewardKind: string;
        rewardName: string;
        rewardValueCents: number;
      }[]
    | null;
  stats?: {
    members: number;
    pointsIssued: number;
    rewardsRedeemed: number;
    outstandingPoints: number;
    estimatedLiabilityCents: number;
  } | null;
};

function buildContextBlock(ctx: ConsultantContext): string {
  const parts: string[] = [];
  if (ctx.activeProgram) {
    parts.push(
      `ACTIVE PROGRAM: spend-based points, ${ctx.activeProgram.pointsPerDollar} points per $1 of staff-verified eligible spend.`,
    );
  } else {
    parts.push("ACTIVE PROGRAM: none published yet.");
  }
  if (ctx.catalog?.length) {
    parts.push(
      "CURRENT REWARD MENU:\n" +
        ctx.catalog
          .map(
            (item) =>
              `- ${formatPoints(item.pointsCost)}: ${item.rewardName} (${item.rewardKind === "FREE_ITEM" ? "free item, menu price" : "discount of"} ${formatCents(item.rewardValueCents)})`,
          )
          .join("\n"),
    );
  }
  if (ctx.stats) {
    parts.push(
      `STATS: ${ctx.stats.members} members; ${ctx.stats.pointsIssued} points issued; ` +
        `${ctx.stats.rewardsRedeemed} rewards redeemed; ${ctx.stats.outstandingPoints} outstanding points; ` +
        `cost if every outstanding point were cashed in at once ${formatCents(ctx.stats.estimatedLiabilityCents)}.`,
    );
  }
  return parts.join("\n\n");
}

/** The one tool: a structured program change for the engine to re-price. */
const PROPOSAL_TOOL: Anthropic.Tool = {
  name: "propose_program_change",
  description:
    "Hand the platform a concrete loyalty-program change to validate, " +
    "price, and show the owner as an applyable card. Call this once you " +
    "know enough to recommend. The full program must be included — the " +
    "earn rate and every reward that should exist after the change.",
  input_schema: {
    type: "object",
    required: ["pointsPerDollar", "rewards"],
    properties: {
      pointsPerDollar: {
        type: "integer",
        minimum: 1,
        maximum: 100,
        description: "Points earned per $1 of eligible spend.",
      },
      rewards: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: {
          type: "object",
          required: [
            "pointsCost",
            "rewardKind",
            "rewardName",
            "rewardValueCents",
          ],
          properties: {
            pointsCost: { type: "integer", minimum: 1 },
            rewardKind: {
              type: "string",
              enum: ["FREE_ITEM", "FIXED_DISCOUNT"],
            },
            rewardName: { type: "string", maxLength: 120 },
            rewardValueCents: {
              type: "integer",
              minimum: 1,
              description:
                "FREE_ITEM: the item's menu price in cents. " +
                "FIXED_DISCOUNT: the discount amount in cents.",
            },
            rewardEstCostCents: {
              type: ["integer", "null"],
              minimum: 0,
              description:
                "FREE_ITEM only: the owner's ingredient cost in cents if " +
                "they said it; null to use the platform estimate.",
            },
          },
        },
      },
    },
  },
};

export type AdvisorSessionReply =
  | { ok: true; text: string; proposal: PricedProposal | null }
  | { ok: false; reason: "unconfigured" | "error" };

/**
 * One turn of the capped advisor conversation. The caller (server action)
 * has already authenticated the owner and enforced the prompt budget.
 */
export async function runLoyaltyAdvisorSession(
  turns: AdvisorTurn[],
  context: ConsultantContext,
): Promise<AdvisorSessionReply> {
  if (!isLoyaltyConsultantConfigured()) {
    return { ok: false, reason: "unconfigured" };
  }

  const [first, ...rest] = turns;
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `CONTEXT (the only vendor facts you may cite):\n${buildContextBlock(context)}\n\nOwner: ${first.content}`,
    },
    ...rest.map((t) => ({ role: t.role, content: t.content })),
  ];

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      tools: [PROPOSAL_TOOL],
      messages,
    });

    if (response.stop_reason === "refusal") {
      return {
        ok: true,
        text: "I can't help with that one. For anything else about your program, ask away, or use the editor below to change it yourself.",
        proposal: null,
      };
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock =>
        block.type === "tool_use" && block.name === PROPOSAL_TOOL.name,
    );

    let proposal: PricedProposal | null = null;
    if (toolUse) {
      const parsed = advisorProposalSchema.safeParse(toolUse.input);
      // A malformed tool call is dropped, never repaired: the engine only
      // prices exactly what the schema admits.
      proposal = parsed.success ? priceProposal(parsed.data) : null;
    }

    if (!text && !proposal) {
      return { ok: false, reason: "error" };
    }
    return {
      ok: true,
      text: text || "Here's what I'd change:",
      proposal,
    };
  } catch (error) {
    console.error("loyalty advisor session failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false, reason: "error" };
  }
}
