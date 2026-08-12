import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LandingPage } from "@/components/marketing/landing-page";
import { CUISINE_CATEGORIES } from "@/features/vendors/schemas";

describe("LandingPage", () => {
  it("renders customer and vendor value propositions", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("heading", { name: /For customers/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /For vendors/i }),
    ).toBeInTheDocument();
  });

  it("keeps the hero customer-first with one universal map label", () => {
    render(<LandingPage />);

    // "Explore the map" is the only discovery label on the page — one
    // vocabulary for finding carts, in the hero and the customers panel.
    const mapLinks = screen.getAllByRole("link", { name: /Explore the map/i });
    expect(mapLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of mapLinks) {
      expect(link).toHaveAttribute("href", "/discover");
    }
    expect(screen.queryByRole("link", { name: /Find Vendors/i })).toBeNull();
    // Vendors get their own section further down; the hero sells eating.
    expect(
      screen.queryByRole("link", { name: /List Your Business/i }),
    ).toBeNull();
  });

  it("keeps the cuisine tab row parked (SHOW_CUISINE_TABS off) for now", () => {
    render(<LandingPage />);

    for (const cuisine of CUISINE_CATEGORIES) {
      expect(
        screen.queryByRole("link", {
          name: new RegExp(
            cuisine.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "i",
          ),
        }),
      ).toBeNull();
    }
  });

  it("offers Sign in / Sign up to signed-out visitors", () => {
    render(<LandingPage />);

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    expect(screen.getByRole("link", { name: /sign up/i })).toHaveAttribute(
      "href",
      "/sign-up",
    );
  });

  it("greets a signed-in visitor and links their dashboard instead", () => {
    render(
      <LandingPage viewer={{ firstName: "Maria", dashboardHref: "/vendor" }} />,
    );

    expect(screen.getByText("Hi, Maria")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Dashboard" })).toHaveAttribute(
      "href",
      "/vendor",
    );
    // Never ask an existing user to sign up.
    expect(screen.queryByRole("link", { name: /sign up/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /sign in/i })).toBeNull();
  });

  it("labels a customer's hero button My Rewards, even without a name", () => {
    render(
      <LandingPage viewer={{ firstName: null, dashboardHref: "/customer" }} />,
    );

    expect(screen.getByRole("link", { name: "My Rewards" })).toHaveAttribute(
      "href",
      "/customer",
    );
    expect(screen.queryByText(/^Hi,/)).toBeNull();
  });

  it("presents the four location states with honest wording", () => {
    render(<LandingPage />);

    expect(screen.getByText("Live now")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText("Usually here")).toBeInTheDocument();
    expect(screen.getByText("Hotspot")).toBeInTheDocument();
    // A hotspot must never read as a confirmed vendor — even in marketing.
    expect(screen.getByText(/No vendor confirmed/i)).toBeInTheDocument();
  });
});
