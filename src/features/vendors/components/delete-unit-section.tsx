"use client";

import * as React from "react";
import { useActionState } from "react";
import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { idleState } from "@/features/authentication/action-state";
import { deleteVendorUnitAction } from "@/features/vendors/actions";
import { SubmitButton } from "@/features/authentication/components/submit-button";

/**
 * Deleting a cart is the one action on this page that can't be walked back,
 * so it is disclosed in two steps: a quiet entry button, then an explicit
 * consequences panel with the confirm. The copy states exactly what goes and
 * what stays — schedules and location history go with the cart; loyalty
 * points and purchase history belong to the organization and survive.
 */
export function DeleteUnitSection({
  unitId,
  unitName,
}: {
  unitId: string;
  unitName: string;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const [state, formAction] = useActionState(deleteVendorUnitAction, idleState);

  return (
    <div className="rounded-xl border border-destructive/40 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <TriangleAlert className="size-4" aria-hidden="true" />
        Delete this cart
      </h2>

      {confirming ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">
              This permanently removes {unitName}
            </strong>{" "}
            — its public page, its photo, its usual locations, scheduled
            appearances, and location history. Your organization&apos;s loyalty
            program, customer points, and purchase history are not affected.
            This cannot be undone.
          </p>
          {state.status === "error" ? (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          <form action={formAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="unitId" value={unitId} />
            <SubmitButton variant="destructive" pendingLabel="Deleting…">
              Yes, delete {unitName} permanently
            </SubmitButton>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirming(false)}
            >
              Keep this cart
            </Button>
          </form>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            Retiring this unit? Deleting removes its page and location data for
            good.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirming(true)}
          >
            Delete this cart…
          </Button>
        </div>
      )}
    </div>
  );
}
