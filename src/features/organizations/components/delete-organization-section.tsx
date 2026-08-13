"use client";

import * as React from "react";
import { useActionState } from "react";
import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idleState } from "@/features/authentication/action-state";
import { deleteOrganizationAction } from "@/features/organizations/actions";
import { SubmitButton } from "@/features/authentication/components/submit-button";

/**
 * Closing the business is the most destructive action on Curbfare, so it is
 * disclosed in two steps and confirmed by retyping the business name — the
 * server checks the name again and the database only obeys an MFA-verified
 * owner. Everything the organization owns goes with it.
 */
export function DeleteOrganizationSection({
  organizationName,
}: {
  organizationName: string;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [state, formAction] = useActionState(
    deleteOrganizationAction,
    idleState,
  );
  const nameMatches = typed.trim() === organizationName.trim();

  return (
    <div className="rounded-xl border border-destructive/40 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <TriangleAlert className="size-4" aria-hidden="true" />
        Close this business
      </h2>

      {confirming ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">
              This permanently deletes {organizationName}
            </strong>{" "}
            — every cart and its public page, schedules and location history,
            your rewards program, the points your customers have earned here,
            pending team invitations, and all team access. Your account stays;
            the business is gone. This cannot be undone.
          </p>
          {state.status === "error" ? (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          <form action={formAction} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="confirmName">
                Type <span className="font-semibold">{organizationName}</span>{" "}
                to confirm
              </Label>
              <Input
                id="confirmName"
                name="confirmName"
                autoComplete="off"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
              />
              {state.fieldErrors?.confirmName ? (
                <p className="text-sm text-destructive">
                  {state.fieldErrors.confirmName[0]}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <SubmitButton
                variant="destructive"
                pendingLabel="Deleting…"
                disabled={!nameMatches}
              >
                Delete {organizationName} permanently
              </SubmitButton>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setConfirming(false);
                  setTyped("");
                }}
              >
                Keep my business
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            Closing up for good? This removes the whole business from Curbfare —
            carts, rewards, and customer points included.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirming(true)}
          >
            Close this business…
          </Button>
        </div>
      )}
    </div>
  );
}
