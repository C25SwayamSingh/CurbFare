import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LoyaltyAdvisorDock } from "@/features/loyalty/components/loyalty-advisor-dock";
import {
  applyAdvisorProposalAction,
  loyaltyAdvisorTurnAction,
} from "@/features/loyalty/actions";

vi.mock("@/features/loyalty/actions", () => ({
  loyaltyAdvisorTurnAction: vi.fn(),
  applyAdvisorProposalAction: vi.fn(),
}));

const turnAction = vi.mocked(loyaltyAdvisorTurnAction);
const applyAction = vi.mocked(applyAdvisorProposalAction);

const PRICED_PROPOSAL = {
  proposal: {
    pointsPerDollar: 100,
    rewards: [
      {
        pointsCost: 4000,
        rewardKind: "FIXED_DISCOUNT" as const,
        rewardName: "$3 off",
        rewardValueCents: 300,
        rewardEstCostCents: null,
      },
    ],
  },
  benchmark: "This is the McDonald's model — 7.5% back.",
  blockedReasons: [] as string[],
};

beforeEach(() => {
  vi.clearAllMocks();
});

async function openDock() {
  const user = userEvent.setup();
  render(<LoyaltyAdvisorDock />);
  await user.click(screen.getByRole("button", { name: /advisor/i }));
  return user;
}

describe("LoyaltyAdvisorDock", () => {
  it("opens with the what-would-you-change prompt and sends an opener chip", async () => {
    turnAction.mockResolvedValue({
      ok: true,
      text: "How far away does it feel?",
      proposal: null,
      promptsLeft: 4,
    });
    const user = await openDock();

    expect(
      screen.getByText(/what would you change about your program/i),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /costing me too much/i }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(/how far away does it feel/i),
      ).toBeInTheDocument(),
    );
    expect(turnAction).toHaveBeenCalledWith([
      { role: "user", content: "This is costing me too much" },
    ]);
    expect(screen.getByText(/4 of 5 prompts left/i)).toBeInTheDocument();
  });

  it("renders a proposal card and applies it through the owner action", async () => {
    turnAction.mockResolvedValue({
      ok: true,
      text: "Here's what I'd change.",
      proposal: PRICED_PROPOSAL,
      promptsLeft: 4,
    });
    applyAction.mockResolvedValue({
      status: "success",
      message: "Applied — your program is updated.",
    });
    const user = await openDock();

    await user.click(
      screen.getByRole("button", { name: /too hard to reach/i }),
    );
    await waitFor(() =>
      expect(screen.getByText(/proposed change/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/McDonald's model/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /apply this change/i }),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/applied — your program is updated/i),
      ).toBeInTheDocument(),
    );
    expect(applyAction).toHaveBeenCalledWith(PRICED_PROPOSAL.proposal);
  });

  it("never offers apply on a proposal the engine blocked", async () => {
    turnAction.mockResolvedValue({
      ok: true,
      text: "This one is too rich.",
      proposal: {
        ...PRICED_PROPOSAL,
        blockedReasons: ["That discount costs more than the spend behind it."],
      },
      promptsLeft: 4,
    });
    const user = await openDock();

    await user.click(screen.getByRole("button", { name: /like a big chain/i }));
    await waitFor(() =>
      expect(screen.getByText(/can't be applied as-is/i)).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /apply this change/i }),
    ).toBeNull();
  });

  it("disables the composer after five prompts", async () => {
    turnAction.mockResolvedValue({
      ok: true,
      text: "Answer.",
      proposal: null,
      promptsLeft: 0,
    });
    const user = await openDock();

    const input = screen.getByLabelText(/message the advisor/i);
    for (let i = 1; i <= 5; i++) {
      await user.type(input, `question ${i}`);
      await user.click(screen.getByRole("button", { name: /send/i }));
      await waitFor(() => expect(turnAction).toHaveBeenCalledTimes(i));
    }

    expect(screen.getByText(/0 of 5 prompts left/i)).toBeInTheDocument();
    expect(screen.getByText(/limit for one session/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message the advisor/i)).toBeDisabled();

    // Start over restores the budget.
    await user.click(screen.getByRole("button", { name: /start over/i }));
    expect(screen.getByText(/5 of 5 prompts left/i)).toBeInTheDocument();
  });
});
