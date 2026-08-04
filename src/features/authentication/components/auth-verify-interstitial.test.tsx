import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

let search = "token_hash=test-token&type=signup";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

import { AuthVerifyInterstitial } from "@/features/authentication/components/auth-verify-interstitial";

describe("AuthVerifyInterstitial", () => {
  const source = readFileSync(
    join(
      process.cwd(),
      "src/features/authentication/components/auth-verify-interstitial.tsx",
    ),
    "utf8",
  );

  it("does not use window.open or target=_blank", () => {
    expect(source).not.toMatch(/window\.open/i);
    expect(source).not.toMatch(/target\s*=\s*["']_blank["']/i);
  });

  it("submits sign-up verification via POST form", () => {
    search = "token_hash=test-token&type=signup";
    render(<AuthVerifyInterstitial />);

    const form = screen
      .getByRole("button", { name: /verify my email/i })
      .closest("form");
    expect(form).toHaveAttribute("action", "/auth/confirm");
    expect(form).toHaveAttribute("method", "POST");
    expect(form?.querySelector('input[name="token_hash"]')).toHaveAttribute(
      "value",
      "test-token",
    );
    expect(form?.querySelector('input[name="type"]')).toHaveAttribute(
      "value",
      "signup",
    );
  });

  it("disables Verify immediately after submit", async () => {
    search = "token_hash=test-token&type=signup";
    const user = userEvent.setup();
    render(<AuthVerifyInterstitial />);

    const button = screen.getByRole("button", { name: /verify my email/i });
    await user.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/verifying/i);
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("shows the invalid-link card when details are missing", () => {
    search = "type=signup";
    render(<AuthVerifyInterstitial />);

    expect(
      screen.getByText(/this verification link isn't valid/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /verify my email/i }),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: /go to sign in/i }),
    ).toHaveAttribute("href", "/sign-in");
  });
});
