"use client";

import { signOutAction } from "@/features/authentication/actions";
import { SubmitButton } from "@/features/authentication/components/submit-button";

export function SignOutButton({ label = "Sign out" }: { label?: string }) {
  return (
    <form action={signOutAction}>
      <SubmitButton variant="ghost" size="sm" pendingLabel="…">
        {label}
      </SubmitButton>
    </form>
  );
}
