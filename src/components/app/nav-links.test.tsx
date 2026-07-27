import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NavLinks } from "@/components/app/nav-links";

const usePathnameMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

describe("NavLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a working link when the item is not the current page", () => {
    usePathnameMock.mockReturnValue("/vendor/loyalty");

    render(<NavLinks items={[{ href: "/vendor", label: "Dashboard" }]} />);

    const link = screen.getByRole("link", { name: "Dashboard" });
    expect(link).toHaveAttribute("href", "/vendor");
    expect(link).not.toHaveAttribute("aria-current");
  });

  it("renders a you-are-here marker, not a link, on the current page", () => {
    usePathnameMock.mockReturnValue("/vendor");

    render(<NavLinks items={[{ href: "/vendor", label: "Dashboard" }]} />);

    // A self-link looks clickable and does nothing — it must not be a link.
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    const marker = screen.getByText("Dashboard");
    expect(marker).toHaveAttribute("aria-current", "page");
  });

  it("marks only the matching item current, never siblings", () => {
    usePathnameMock.mockReturnValue("/vendor");

    render(
      <NavLinks
        items={[
          { href: "/vendor", label: "Dashboard" },
          { href: "/vendor/loyalty", label: "Loyalty" },
        ]}
      />,
    );

    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    expect(screen.getByRole("link", { name: "Loyalty" })).toHaveAttribute(
      "href",
      "/vendor/loyalty",
    );
  });
});
