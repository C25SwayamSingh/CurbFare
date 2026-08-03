import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LoyaltyQuickChange } from "@/features/loyalty/components/loyalty-quick-change";
import { applyAdvisorProposalAction } from "@/features/loyalty/actions";

vi.mock("@/features/loyalty/actions", () => ({
  applyAdvisorProposalAction: vi.fn(),
}));

const applyAction = vi.mocked(applyAdvisorProposalAction);

const CATALOG = [
  {
    pointsCost: 4000,
    rewardKind: "FIXED_DISCOUNT" as const,
    rewardName: "$3 off",
    rewardValueCents: 300,
    rewardEstCostCents: null,
  },
];

function renderPanel() {
  return render(
    <LoyaltyQuickChange pointsPerDollar={100} catalog={CATALOG}>
      <p>detailed editor form</p>
    </LoyaltyQuickChange>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LoyaltyQuickChange", () => {
  it("shows all three chain models with the vendor's reward repriced", () => {
    renderPanel();
    expect(screen.getByText(/McDonald's model/i)).toBeInTheDocument();
    expect(screen.getByText(/Subway model/i)).toBeInTheDocument();
    expect(screen.getByText(/Starbucks \(Green\) model/i)).toBeInTheDocument();
    // Subway preset reprices the $3 reward to 6,000 pts.
    expect(screen.getByText("6,000 pts")).toBeInTheDocument();
    // The vendor is already on the McDonald's shape — no switch button there.
    expect(screen.getByText(/this is you today/i)).toBeInTheDocument();
  });

  it("marks a recommendation when a concern chip is toggled", async () => {
    const user = userEvent.setup();
    renderPanel();
    expect(screen.queryByText("Best fix")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: /costing me too much/i }),
    );
    expect(screen.getByText("Best fix")).toBeInTheDocument();

    // Toggle off — chips never get stuck.
    await user.click(
      screen.getByRole("button", { name: /costing me too much/i }),
    );
    expect(screen.queryByText("Best fix")).toBeNull();
  });

  it("applies a model through the owner-only action", async () => {
    applyAction.mockResolvedValue({
      status: "success",
      message: "Applied — your program is updated.",
    });
    const user = userEvent.setup();
    renderPanel();

    const buttons = screen.getAllByRole("button", { name: /switch to this/i });
    await user.click(buttons[0]);

    await waitFor(() =>
      expect(
        screen.getByText(/applied — your program is updated/i),
      ).toBeInTheDocument(),
    );
    expect(applyAction).toHaveBeenCalledTimes(1);
    const proposal = applyAction.mock.calls[0][0] as {
      pointsPerDollar: number;
      rewards: { pointsCost: number }[];
    };
    expect(proposal.pointsPerDollar).toBe(100);
    expect(proposal.rewards[0].pointsCost).toBeGreaterThan(4000);
  });

  it("keeps the detailed editor collapsed until asked", async () => {
    const user = userEvent.setup();
    renderPanel();
    expect(screen.queryByText("detailed editor form")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: /open the detailed editor/i }),
    );
    expect(screen.getByText("detailed editor form")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /hide the detailed editor/i }),
    );
    expect(screen.queryByText("detailed editor form")).toBeNull();
  });
});
