import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The header's LanguageSwitcher needs the app router for refresh-on-switch;
// unit tests render outside Next's router, so provide a stub.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { LandingPage } from "@/components/marketing/landing-page";
import { CUISINE_CATEGORIES } from "@/features/vendors/schemas";

describe("LandingPage", () => {
  it("renders the hero pitch and the vendor section", async () => {
    render(await LandingPage({}));

    // The customer pitch lives in the hero itself; the only sectioned
    // audience block is the vendor one.
    expect(screen.getByText(/Earn points toward rewards/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /For vendors/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /For customers/i }),
    ).toBeNull();
  });

  it("keeps the hero customer-first with one universal map label", async () => {
    render(await LandingPage({}));

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

  it("keeps the cuisine tab row parked (SHOW_CUISINE_TABS off) for now", async () => {
    render(await LandingPage({}));

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

  it("offers Sign in / Sign up to signed-out visitors", async () => {
    render(await LandingPage({}));

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    expect(screen.getByRole("link", { name: /sign up/i })).toHaveAttribute(
      "href",
      "/sign-up",
    );
  });

  it("greets a signed-in visitor and links their dashboard instead", async () => {
    render(
      await LandingPage({
        viewer: { firstName: "Maria", dashboardHref: "/vendor" },
      }),
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

  it("labels a customer's hero button My Rewards, even without a name", async () => {
    render(
      await LandingPage({
        viewer: { firstName: null, dashboardHref: "/customer" },
      }),
    );

    expect(screen.getByRole("link", { name: "My Rewards" })).toHaveAttribute(
      "href",
      "/customer",
    );
    expect(screen.queryByText(/^Hi,/)).toBeNull();
  });

  it("leaves pin-state education to the map, not the landing", async () => {
    render(await LandingPage({}));

    // The legend moved to /discover; marketing must not carry a stale copy
    // that could drift from the real states.
    expect(screen.queryByText("Live now")).toBeNull();
    expect(screen.queryByText("Curbfare pick")).toBeNull();
  });
});
