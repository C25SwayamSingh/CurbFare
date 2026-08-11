"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, MailPlus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resendConfirmationEmailAction } from "@/features/authentication/actions";
import { idleState } from "@/features/authentication/action-state";
import { SubmitButton } from "@/features/authentication/components/submit-button";

/**
 * "Didn't get the email?" recovery on the verify-email screen. When the
 * sign-up flow handed us the address it's one tap; otherwise we ask for it.
 * The server action enforces the send rate limit either way.
 */
export function ResendConfirmation({ email }: { email?: string }) {
  const [state, formAction] = useActionState(
    resendConfirmationEmailAction,
    idleState,
  );

  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {state.status === "success" && state.message ? (
        <Alert>
          <CheckCircle2 aria-hidden="true" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {email ? (
        <input type="hidden" name="email" value={email} />
      ) : (
        <div className="space-y-2">
          <Label htmlFor="resend-email">Your sign-up email</Label>
          <Input
            id="resend-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            defaultValue={state.values?.email ?? ""}
          />
        </div>
      )}

      <SubmitButton variant="outline" pendingLabel="Sending…">
        <MailPlus aria-hidden="true" />
        Send a fresh link
      </SubmitButton>
    </form>
  );
}
