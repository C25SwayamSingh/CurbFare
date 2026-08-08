import { useActionState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/authentication/actions", () => ({
  signUpAction: vi.fn(async () => ({ status: "idle" })),
}));

// Only useActionState is stubbed, so the component's own rendering of the
// returned state stays under test.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});

import { SignUpForm } from "@/features/authentication/components/sign-up-form";

describe("SignUpForm", () => {
  it("renders accessible fields", () => {
    render(<SignUpForm />);

    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);

    const password = screen.getByLabelText(/^password$/i);
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(password).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("links to sign-in", () => {
    render(<SignUpForm />);
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });

  it("tells the user a nickname is acceptable", () => {
    render(<SignUpForm />);
    expect(screen.getByText(/nicknames work too/i)).toBeInTheDocument();
  });
});

/**
 * A rejected submit must not cost the user everything they typed. React
 * resets an uncontrolled form after every action, so the fields are only
 * refilled if the action echoes them back and the inputs read them as
 * defaults. The password is deliberately excluded — secrets never
 * round-trip through server state.
 */
describe("SignUpForm — keeping what the user typed", () => {
  it("refills name and email from a rejected submit, but never the password", () => {
    vi.mocked(useActionState).mockReturnValueOnce([
      {
        status: "error",
        message: "Please fix the highlighted fields.",
        fieldErrors: { password: ["Password must be at least 10 characters"] },
        values: { displayName: "Maria", email: "maria@example.com" },
      },
      vi.fn(),
      false,
    ]);

    render(<SignUpForm />);

    expect(screen.getByLabelText(/your name/i)).toHaveValue("Maria");
    expect(screen.getByLabelText(/email/i)).toHaveValue("maria@example.com");
    expect(screen.getByLabelText(/^password$/i)).toHaveValue("");
  });

  it("starts empty when there is nothing to restore", () => {
    render(<SignUpForm />);

    expect(screen.getByLabelText(/your name/i)).toHaveValue("");
    expect(screen.getByLabelText(/email/i)).toHaveValue("");
  });
});
