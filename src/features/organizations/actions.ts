"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuth, requireVendorSensitiveAction } from "@/lib/auth/guards";
import { createServerClient } from "@/lib/supabase/server";
import {
  errorState,
  keepValues,
  successState,
  type ActionState,
} from "@/features/authentication/action-state";
import {
  createOrganizationSchema,
  updateOrganizationSchema,
} from "@/features/organizations/schemas";
import { notifyVendorApplication } from "@/lib/notify/vendor-application";
import { VENDOR_PHOTO_BUCKET } from "@/features/vendors/photo";

/**
 * Vendor onboarding: create the organization and its initial owner
 * membership. Delegates to the create_organization_with_owner database
 * function, which runs both inserts in one transaction (no ownerless org)
 * — the client supplies only the org names/slug, never roles or IDs.
 *
 * Creating an organization requires only an authenticated, confirmed-email
 * session — MFA is not a precondition. Sensitive management actions
 * afterward (updating org settings, inviting/removing members, changing
 * roles) remain mandatory-MFA via `requireVendorSensitiveAction` and the
 * database's restrictive `mfa_assurance_ok()` policies.
 */
export async function createOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireAuth();

  // Idempotency: if this user already owns an org (e.g. duplicate submit or
  // browser retry), don't create a second one — continue onboarding.
  if (ctx.memberships.some((m) => m.role === "owner")) {
    redirect("/vendor");
  }

  const parsed = createOrganizationSchema.safeParse({
    legalName: formData.get("legalName"),
    displayName: formData.get("displayName"),
    slug: formData.get("slug"),
    licenseNumber: formData.get("licenseNumber"),
    permitNumber: formData.get("permitNumber"),
    applicationNote: formData.get("applicationNote") ?? undefined,
  });

  // A rejected application must not cost the vendor everything they typed.
  const submitted = keepValues(formData, [
    "displayName",
    "legalName",
    "slug",
    "licenseNumber",
    "permitNumber",
    "applicationNote",
  ]);

  if (!parsed.success) {
    return errorState(
      "Please fix the highlighted fields.",
      z.flattenError(parsed.error).fieldErrors,
      submitted,
    );
  }

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("create_organization_with_owner", {
    p_legal_name: parsed.data.legalName,
    p_display_name: parsed.data.displayName,
    p_slug: parsed.data.slug,
    p_license_number: parsed.data.licenseNumber,
    p_permit_number: parsed.data.permitNumber,
    p_application_note: parsed.data.applicationNote,
  });

  if (error) {
    if (error.code === "23505") {
      return errorState(
        "That page link is already taken.",
        { slug: ["Adjust the link name below, then resubmit."] },
        submitted,
      );
    }
    // P0001 messages are authored, applicant-safe sentences (duplicate
    // license, credential shape) — pass them through.
    if (error.code === "P0001" && error.message) {
      return errorState(
        error.message.replace(/^[^:]*:\s*/, ""),
        undefined,
        submitted,
      );
    }
    console.error("organization creation failed", { code: error.code });
    return errorState(
      "Something went wrong. Please try again in a moment.",
      undefined,
      submitted,
    );
  }

  // Doorbell for the reviewer; the queue is the record. Never blocks the
  // application (the notifier swallows its own failures).
  await notifyVendorApplication({
    displayName: parsed.data.displayName,
    legalName: parsed.data.legalName,
    slug: parsed.data.slug,
    licenseNumber: parsed.data.licenseNumber,
    permitNumber: parsed.data.permitNumber,
    applicationNote: parsed.data.applicationNote,
    applicantEmail: ctx.user.email ?? null,
  });

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      onboarding_status: "complete",
      preferred_mode: "vendor",
    })
    .eq("id", ctx.user.id);

  if (profileError) {
    console.error("onboarding status update failed", {
      code: profileError.code,
    });
  }

  redirect("/vendor");
}

/**
 * Update the caller's organization's business details (display name, legal
 * name, URL slug). Owner-only and mandatory-MFA (requireVendorSensitiveAction)
 * — matches the database's own organizations_update_owner /
 * organizations_update_requires_mfa restrictive policies, which this action
 * relies on as the actual enforcement, not just the app-layer role check.
 */
export async function updateOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireVendorSensitiveAction(
    ["owner"],
    "/vendor/organization/edit",
  );

  const parsed = updateOrganizationSchema.safeParse({
    legalName: formData.get("legalName"),
    displayName: formData.get("displayName"),
    slug: formData.get("slug"),
  });

  if (!parsed.success) {
    return errorState(
      "Please fix the highlighted fields.",
      z.flattenError(parsed.error).fieldErrors,
    );
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      legal_name: parsed.data.legalName,
      display_name: parsed.data.displayName,
      slug: parsed.data.slug,
    })
    .eq("id", ctx.membership.organization_id);

  if (error) {
    if (error.code === "23505") {
      return errorState("That URL name is already taken.", {
        slug: ["Choose a different URL name."],
      });
    }
    console.error("organization update failed", { code: error.code });
    return errorState("Something went wrong. Please try again in a moment.");
  }

  revalidatePath("/vendor");
  return successState("Business details updated.");
}

/**
 * Delete the caller's entire organization — carts, schedules, rewards
 * program, customer points at this business, invitations, and memberships,
 * via the database's ON DELETE CASCADEs. Owner-only and mandatory-MFA, with
 * the organizations_delete_owner / organizations_delete_requires_mfa
 * policies as the real enforcement. The client must retype the business
 * name; the organization id itself is always derived from the caller's own
 * membership, never from the form.
 */
export async function deleteOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireVendorSensitiveAction(
    ["owner"],
    "/vendor/organization/edit",
  );
  const organizationId = ctx.membership.organization_id;
  const supabase = await createServerClient();

  const { data: organization } = await supabase
    .from("organizations")
    .select("id, display_name")
    .eq("id", organizationId)
    .maybeSingle();

  if (!organization) {
    return errorState("Your organization could not be found.");
  }

  const confirmName = formData.get("confirmName")?.toString().trim() ?? "";
  if (confirmName !== organization.display_name.trim()) {
    return errorState("Type your business name exactly to confirm deletion.", {
      confirmName: [`Type "${organization.display_name}" to confirm.`],
    });
  }

  // Photo paths are read before the rows cascade away; removal afterward is
  // best-effort — an orphaned storage object is logged, never fatal.
  const { data: units } = await supabase
    .from("vendor_units")
    .select("id, primary_image_path")
    .eq("organization_id", organizationId);
  const photoPaths = (units ?? [])
    .map((unit) => unit.primary_image_path)
    .filter((path): path is string => Boolean(path));

  const { error } = await supabase
    .from("organizations")
    .delete()
    .eq("id", organizationId);

  if (error) {
    console.error("organization delete failed", { code: error.code });
    return errorState("Something went wrong. Please try again in a moment.");
  }

  // RLS refusals delete zero rows without an error; verify the row is gone
  // so a refused delete never reads as success.
  const { data: survivor } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle();
  if (survivor) {
    return errorState(
      "The business could not be deleted. Sign in again with your two-factor code and retry.",
    );
  }

  if (photoPaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(VENDOR_PHOTO_BUCKET)
      .remove(photoPaths);
    if (storageError) {
      console.error("organization photo cleanup failed", {
        message: storageError.message,
      });
    }
  }

  redirect("/");
}
