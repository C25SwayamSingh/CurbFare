"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idleState } from "@/features/authentication/action-state";
import { FieldError } from "@/features/authentication/components/field-error";
import { SubmitButton } from "@/features/authentication/components/submit-button";
import { createOrganizationAction } from "@/features/organizations/actions";
import { suggestSlug } from "@/features/organizations/schemas";

export function CreateOrganizationForm() {
  const [state, formAction] = useActionState(
    createOrganizationAction,
    idleState,
  );
  const [slug, setSlug] = React.useState("");
  const [slugEdited, setSlugEdited] = React.useState(false);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="displayName">Business name</Label>
        <Input
          id="displayName"
          name="displayName"
          placeholder="Maria's Taco Cart"
          required
          onChange={(event) => {
            if (!slugEdited) {
              setSlug(suggestSlug(event.target.value));
            }
          }}
          aria-describedby="displayName-error"
          aria-invalid={Boolean(state.fieldErrors?.displayName)}
        />
        <FieldError
          id="displayName-error"
          errors={state.fieldErrors?.displayName}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="legalName">Legal name</Label>
        <Input
          id="legalName"
          name="legalName"
          placeholder="Maria's Taco Cart LLC"
          required
          aria-describedby="legalName-error legalName-hint"
          aria-invalid={Boolean(state.fieldErrors?.legalName)}
        />
        <p id="legalName-hint" className="text-xs text-muted-foreground">
          The registered name of your business, if different.
        </p>
        <FieldError
          id="legalName-error"
          errors={state.fieldErrors?.legalName}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">URL name</Label>
        <Input
          id="slug"
          name="slug"
          value={slug}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(event.target.value.toLowerCase());
          }}
          placeholder="marias-taco-cart"
          required
          aria-describedby="slug-error slug-hint"
          aria-invalid={Boolean(state.fieldErrors?.slug)}
        />
        <p id="slug-hint" className="text-xs text-muted-foreground">
          Lowercase letters, numbers, and hyphens. Used in links to your page.
        </p>
        <FieldError id="slug-error" errors={state.fieldErrors?.slug} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="licenseNumber">Vending license number</Label>
          <Input
            id="licenseNumber"
            name="licenseNumber"
            placeholder="As printed on your badge"
            required
            aria-describedby="licenseNumber-error licenseNumber-hint"
            aria-invalid={Boolean(state.fieldErrors?.licenseNumber)}
          />
          <p id="licenseNumber-hint" className="text-xs text-muted-foreground">
            Your mobile food vending license (the photo ID badge).
          </p>
          <FieldError
            id="licenseNumber-error"
            errors={state.fieldErrors?.licenseNumber}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="permitNumber">Cart permit number</Label>
          <Input
            id="permitNumber"
            name="permitNumber"
            placeholder="As printed on the decal"
            required
            aria-describedby="permitNumber-error permitNumber-hint"
            aria-invalid={Boolean(state.fieldErrors?.permitNumber)}
          />
          <p id="permitNumber-hint" className="text-xs text-muted-foreground">
            The permit decal on your cart or truck.
          </p>
          <FieldError
            id="permitNumber-error"
            errors={state.fieldErrors?.permitNumber}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="applicationNote">
          Anything we should know? (optional)
        </Label>
        <Input
          id="applicationNote"
          name="applicationNote"
          placeholder="e.g. We're the cart at 46th & 6th on weekdays"
          aria-describedby="applicationNote-error"
          aria-invalid={Boolean(state.fieldErrors?.applicationNote)}
        />
        <FieldError
          id="applicationNote-error"
          errors={state.fieldErrors?.applicationNote}
        />
      </div>

      <SubmitButton className="w-full sm:w-auto" pendingLabel="Submitting…">
        Submit application
      </SubmitButton>

      <p className="text-xs text-muted-foreground">
        We review every application by hand, usually within a day or two. While
        it&apos;s pending you can set up your carts and rewards; nothing shows
        to customers until you&apos;re approved. You&apos;ll be the owner and
        can invite managers and staff later.
      </p>
    </form>
  );
}
