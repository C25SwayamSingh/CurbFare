"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePlatformAdmin } from "@/lib/auth/guards";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Vendor-application review, platform-admin only. Thin wrappers over the
 * SECURITY DEFINER review functions — the database re-checks admin status
 * and legal transitions independently, mirroring the location-import
 * review actions.
 */

const QUEUE_PATH = "/admin/applications";

const reviewSchema = z.object({
  organizationId: z.uuid(),
  note: z.string().trim().max(500).optional(),
});

function friendly(error: { code?: string; message?: string }): string {
  if ((error.code === "P0001" || error.code === "P0002") && error.message) {
    return error.message.replace(/^[^:]*:\s*/, "");
  }
  if (error.code === "42501") {
    return "You don't have permission to review applications.";
  }
  return "Something went wrong. Please try again.";
}

async function review(
  formData: FormData,
  run: (
    supabase: Awaited<ReturnType<typeof createServerClient>>,
    input: z.infer<typeof reviewSchema>,
  ) => PromiseLike<{ error: { code?: string; message?: string } | null }>,
): Promise<never> {
  await requirePlatformAdmin(QUEUE_PATH);

  const parsed = reviewSchema.safeParse({
    organizationId: formData.get("organizationId"),
    note: formData.get("note")?.toString() || undefined,
  });
  if (!parsed.success) {
    redirect(`${QUEUE_PATH}?error=${encodeURIComponent("Invalid request.")}`);
  }

  const supabase = await createServerClient();
  const { error } = await run(supabase, parsed.data);
  if (error) {
    console.error("vendor application review failed", { code: error.code });
    redirect(`${QUEUE_PATH}?error=${encodeURIComponent(friendly(error))}`);
  }

  revalidatePath(QUEUE_PATH);
  redirect(QUEUE_PATH);
}

export async function approveVendorApplicationAction(formData: FormData) {
  return review(formData, (supabase, input) =>
    supabase.rpc("vendor_application_approve", {
      p_organization_id: input.organizationId,
    }),
  );
}

export async function rejectVendorApplicationAction(formData: FormData) {
  return review(formData, (supabase, input) =>
    supabase.rpc("vendor_application_reject", {
      p_organization_id: input.organizationId,
      p_note: input.note ?? null,
    }),
  );
}
