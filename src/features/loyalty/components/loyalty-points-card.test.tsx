import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/loyalty/actions", () => ({
  requestLoyaltyRedemption: vi.fn(),
}));

// The embedded checkout QR pulls in canvas-adjacent code jsdom can't run;
// this suite is about the reward rows, not the code display.
vi.mock("@/features/loyalty/components/checkout-code-card", () => ({
  CheckoutCodeCard: () => <div data-testid="checkout-code-card" />,
}));

import {
  LoyaltyPointsCard,
  type PointsCardData,
} from "@/features/loyalty/components/loyalty-points-card";

function makeCard(overrides: Partial<PointsCardData> = {}): PointsCardData {
  return {
    organizationId: "org-1",
    organizationName: "Rosa Tacos",
    pointBalance: 0,
    pointsPerDollar: 10,
    earningPaused: false,
    redemptionPaused: false,
    catalog: [
      {
        id: "drink",
        points_cost: 250,
        reward_kind: "FREE_ITEM",
        reward_name: "Free drink",
        reward_value_cents: 350,
      },
      {
        id: "discount",
        points_cost: 500,
        reward_kind: "FIXED_DISCOUNT",
        reward_name: "$3 off",
        reward_value_cents: 300,
      },
    ],
    ...overrides,
  };
}

describe("LoyaltyPointsCard — choosing between rewards", () => {
  it("states each reward's dollar worth so options can be compared", () => {
    render(<LoyaltyPointsCard card={makeCard()} />);

    expect(screen.getByText(/Worth \$3\.50/)).toBeInTheDocument();
    expect(
      screen.getByText(/\$3\.00 off your whole order/),
    ).toBeInTheDocument();
  });

  it("translates each points cost into real spending", () => {
    render(<LoyaltyPointsCard card={makeCard()} />);

    // 250 pts at 10 pts/$1 is $25 of visits; 500 pts is $50.
    expect(
      screen.getByText(/earned by about \$25\.00 of visits/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/earned by about \$50\.00 of visits/),
    ).toBeInTheDocument();
  });

  it("marks the reward returning the most value per point", () => {
    render(<LoyaltyPointsCard card={makeCard()} />);

    // Drink: $3.50 / 250 pts beats $3.00 / 500 pts.
    const badge = screen.getByText("Best value");
    expect(badge.closest("li")).toHaveTextContent("Free drink");
  });

  it("shows no best-value badge when there is only one reward", () => {
    const card = makeCard();
    render(
      <LoyaltyPointsCard card={{ ...card, catalog: [card.catalog[0]] }} />,
    );

    expect(screen.queryByText("Best value")).not.toBeInTheDocument();
  });

  it("offers Redeem only on rewards the balance covers", () => {
    render(<LoyaltyPointsCard card={makeCard({ pointBalance: 300 })} />);

    expect(screen.getAllByRole("button", { name: /redeem/i })).toHaveLength(1);
    expect(screen.getByText(/200 pts to go/)).toBeInTheDocument();
  });
});
