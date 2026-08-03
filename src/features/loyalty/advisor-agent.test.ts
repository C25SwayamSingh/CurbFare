import { describe, expect, it } from "vitest";

import {
  advisorProposalSchema,
  advisorTurnsSchema,
  priceProposal,
  promptsRemaining,
  userPromptCount,
  MAX_ADVISOR_PROMPTS,
  type AdvisorTurn,
} from "@/features/loyalty/advisor-agent";

function turns(userCount: number): AdvisorTurn[] {
  const list: AdvisorTurn[] = [];
  for (let i = 0; i < userCount; i++) {
    list.push({ role: "user", content: `question ${i + 1}` });
    if (i < userCount - 1) {
      list.push({ role: "assistant", content: `answer ${i + 1}` });
    }
  }
  return list;
}

describe("advisor session budget", () => {
  it("caps a session at five vendor prompts", () => {
    expect(MAX_ADVISOR_PROMPTS).toBe(5);
    expect(userPromptCount(turns(3))).toBe(3);
    expect(promptsRemaining(turns(3))).toBe(2);
    expect(promptsRemaining(turns(5))).toBe(0);
  });

  it("rejects a conversation that does not end on the vendor's turn", () => {
    const ended = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ];
    expect(advisorTurnsSchema.safeParse(ended).success).toBe(false);
    expect(advisorTurnsSchema.safeParse(turns(2)).success).toBe(true);
  });

  it("rejects oversized conversations outright", () => {
    const oversized = [
      ...turns(5),
      { role: "assistant", content: "a" },
      { role: "user", content: "one too many" },
    ];
    expect(oversized.length).toBeGreaterThan(MAX_ADVISOR_PROMPTS * 2);
    expect(advisorTurnsSchema.safeParse(oversized).success).toBe(false);
  });
});

describe("proposal pricing", () => {
  const mcdonaldsLike = {
    pointsPerDollar: 100,
    rewards: [
      {
        pointsCost: 4000,
        rewardKind: "FIXED_DISCOUNT" as const,
        rewardName: "$3 off",
        rewardValueCents: 300,
      },
    ],
  };

  it("names the chain model from the engine's own math", () => {
    const priced = priceProposal(advisorProposalSchema.parse(mcdonaldsLike));
    expect(priced.blockedReasons).toEqual([]);
    expect(priced.benchmark).toContain("McDonald's");
  });

  it("blocks a proposal the engine blocks — the model has no override", () => {
    const reckless = advisorProposalSchema.parse({
      pointsPerDollar: 100,
      rewards: [
        {
          pointsCost: 400,
          rewardKind: "FIXED_DISCOUNT",
          rewardName: "$30 off",
          rewardValueCents: 3000,
        },
      ],
    });
    const priced = priceProposal(reckless);
    expect(priced.blockedReasons.length).toBeGreaterThan(0);
  });

  it("rejects out-of-bounds programs at the schema, before pricing", () => {
    expect(
      advisorProposalSchema.safeParse({
        pointsPerDollar: 200,
        rewards: mcdonaldsLike.rewards,
      }).success,
    ).toBe(false);
    expect(
      advisorProposalSchema.safeParse({
        pointsPerDollar: 100,
        rewards: [],
      }).success,
    ).toBe(false);
  });
});
