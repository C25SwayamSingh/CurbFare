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

  it("renders primary call-to-action buttons", () => {
    render(<LandingPage />);

    expect(screen.getByRole("link", { name: /Find Vendors/i })).toHaveAttribute(
      "href",
      "/discover",
    );
    expect(
      screen.getByRole("link", { name: /List Your Business/i }),
    ).toHaveAttribute("href", "/vendors/list");
  });

  it("renders a cuisine tab for every real category, linking to discovery", () => {
    render(<LandingPage />);

    for (const cuisine of CUISINE_CATEGORIES) {
      const tab = screen.getByRole("link", {
        name: new RegExp(
          cuisine.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "i",
        ),
      });
      expect(tab).toHaveAttribute("href", "/discover");
    }
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
