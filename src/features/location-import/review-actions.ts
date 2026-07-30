"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePlatformAdmin } from "@/lib/auth/guards";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Admin review actions for imported location records. Thin wrappers: the
 * SECURITY DEFINER functions in the database are the enforcement (platform
 * admin + aal2, legal state transitions only); these actions are the polite
 * first line and the redirect plumbing.
 */

const uuid = z.uuid();

function back(error?: string): never {
  redirect(
    error
      ? `/admin/locations?error=${encodeURIComponent(error)}`
      : "/admin/locations",
  );
}

async function callReview(
  fn:
    | "location_import_approve_hotspot"
    | "location_import_reject"
    | "location_import_mark_stale",
  recordId: string,
): Promise<string | null> {
  const supabase = await createServerClient();
  const { error } = await supabase.rpc(fn, { p_record_id: recordId });
  return error ? error.message : null;
}

export async function approveImportRecordAction(formData: FormData) {
  await requirePlatformAdmin("/admin/locations");
  const recordId = uuid.safeParse(formData.get("recordId")?.toString());
  if (!recordId.success) back("Invalid record.");
  const error = await callReview(
    "location_import_approve_hotspot",
    recordId.data,
  );
  if (error) back(error);
  revalidatePath("/admin/locations");
}

export async function rejectImportRecordAction(formData: FormData) {
  await requirePlatformAdmin("/admin/locations");
  const recordId = uuid.safeParse(formData.get("recordId")?.toString());
  if (!recordId.success) back("Invalid record.");
  const error = await callReview("location_import_reject", recordId.data);
  if (error) back(error);
  revalidatePath("/admin/locations");
}

export async function markImportRecordStaleAction(formData: FormData) {
  await requirePlatformAdmin("/admin/locations");
  const recordId = uuid.safeParse(formData.get("recordId")?.toString());
  if (!recordId.success) back("Invalid record.");
  const error = await callReview("location_import_mark_stale", recordId.data);
  if (error) back(error);
  revalidatePath("/admin/locations");
}

/**
 * Bulk approval. The client must send BOTH the id list and the count it
 * showed the admin in the confirmation step — a mismatch means the selection
 * changed under them, and nothing publishes.
 */
export async function bulkApproveImportRecordsAction(formData: FormData) {
  await requirePlatformAdmin("/admin/locations");

  let ids: string[] = [];
  try {
    const parsed = JSON.parse(formData.get("recordIds")?.toString() ?? "[]");
    ids = z.array(uuid).max(200).parse(parsed);
  } catch {
    back("Invalid selection.");
  }
  const confirmedCount = Number(formData.get("confirmedCount"));
  if (ids.length === 0) back("Nothing selected.");
  if (confirmedCount !== ids.length) {
    back("Selection changed since confirmation — nothing was published.");
  }

  const supabase = await createServerClient();
  let published = 0;
  let failed = 0;
  for (const id of ids) {
    const { error } = await supabase.rpc("location_import_approve_hotspot", {
      p_record_id: id,
    });
    if (error) failed += 1;
    else published += 1;
  }
  revalidatePath("/admin/locations");
  redirect(
    failed > 0
      ? `/admin/locations?error=${encodeURIComponent(`Published ${published}; ${failed} failed (already reviewed or missing coordinates).`)}`
      : `/admin/locations?done=${published}`,
  );
}

export async function associateImportRecordAction(formData: FormData) {
  await requirePlatformAdmin("/admin/locations");
  const recordId = uuid.safeParse(formData.get("recordId")?.toString());
  const unitId = uuid.safeParse(formData.get("vendorUnitId")?.toString());
  if (!recordId.success) back("Invalid record.");
  if (!unitId.success) back("Enter a valid vendor unit id.");
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("location_import_associate", {
    p_record_id: recordId.data,
    p_vendor_unit_id: unitId.data,
  });
  if (error) back(error.message);
  revalidatePath("/admin/locations");
}
