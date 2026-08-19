"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormQuestion } from "@/components/ui/form-question";
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

  // The page link is created for the vendor, not asked of them. Component
  // state survives a rejected submit, so fall back to the echoed value only
  // when nothing was typed this mount.
  const effectiveSlug = slugEdited || slug ? slug : (state.values?.slug ?? "");
  // Server-side slug rejections (taken/invalid) reveal an editor; until then
  // the link is a fact, not a field.
  const slugNeedsAttention = Boolean(state.fieldErrors?.slug);

  return (
    <form action={formAction} className="space-y-8" noValidate>
      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <FormQuestion n={1} title="What's your business called?">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="displayName">Business name</Label>
            <Input
              id="displayName"
              name="displayName"
              placeholder="Maria's Taco Cart"
              defaultValue={state.values?.displayName ?? ""}
              required
              onChange={(event) => {
                if (!slugEdited) {
                  setSlug(suggestSlug(event.target.value));
                }
              }}
              aria-describedby="displayName-error slug-preview"
              aria-invalid={Boolean(state.fieldErrors?.displayName)}
            />
            <p id="slug-preview" className="text-xs text-muted-foreground">
              Your page link:{" "}
              <span className="font-mono text-brand">
                curbfare.app/vendors/{effectiveSlug || "your-business-name"}
              </span>{" "}
              · created for you, no domain needed.
            </p>
            <FieldError
              id="displayName-error"
              errors={state.fieldErrors?.displayName}
            />
          </div>

          {slugNeedsAttention ? (
            <div className="space-y-2">
              <Label htmlFor="slug">Page link name</Label>
              <Input
                id="slug"
                name="slug"
                value={effectiveSlug}
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(event.target.value.toLowerCase());
                }}
                aria-describedby="slug-error"
                aria-invalid
              />
              <FieldError id="slug-error" errors={state.fieldErrors?.slug} />
            </div>
          ) : (
            <input type="hidden" name="slug" value={effectiveSlug} />
          )}
        </div>
      </FormQuestion>

      <FormQuestion
        n={2}
        title="Your vending credentials"
        hint="Don't have the numbers on hand? Enter them as best you can. You're approved right away, and we confirm every number with you by email after signup, so a best guess won't sink anything."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="licenseNumber">Vending license number</Label>
            <Input
              id="licenseNumber"
              name="licenseNumber"
              placeholder="As printed on your badge"
              defaultValue={state.values?.licenseNumber ?? ""}
              required
              aria-describedby="licenseNumber-error licenseNumber-hint"
              aria-invalid={Boolean(state.fieldErrors?.licenseNumber)}
            />
            <p
              id="licenseNumber-hint"
              className="text-xs text-muted-foreground"
            >
              The photo ID badge.
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
              defaultValue={state.values?.permitNumber ?? ""}
              required
              aria-describedby="permitNumber-error permitNumber-hint"
              aria-invalid={Boolean(state.fieldErrors?.permitNumber)}
            />
            <p id="permitNumber-hint" className="text-xs text-muted-foreground">
              The decal on your cart or truck.
            </p>
            <FieldError
              id="permitNumber-error"
              errors={state.fieldErrors?.permitNumber}
            />
          </div>
        </div>
      </FormQuestion>

      <div className="space-y-3">
        <SubmitButton
          className="h-12 w-full text-base font-semibold sm:w-auto sm:px-8"
          pendingLabel="Submitting…"
        >
          Submit application
        </SubmitButton>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <strong className="text-foreground">
            You&apos;re live the moment you submit.
          </strong>{" "}
          Right now we approve new businesses instantly, and we individually
          verify every cart after signup to make sure it&apos;s legit; if
          anything doesn&apos;t check out we&apos;ll email you first.
          You&apos;ll be the owner, you can add your registered legal name
          anytime in settings, and you can invite managers and staff from your
          dashboard whenever you&apos;re ready.
        </p>
      </div>
    </form>
  );
}
