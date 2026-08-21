"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/auth";
import { canManageSettings } from "@/lib/permissions";
import type { OrganizationType, OrgRole } from "@/types";

export async function updateOrganization(input: {
  name: string;
  type: OrganizationType;
}): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  if (!canManageSettings(ctx.role)) return { error: "Only Owners and Admins can change organization settings." };
  const supabase = await createClient();
  if (!input.name.trim()) return { error: "Organization name is required." };
  const { error } = await supabase
    .from("organizations")
    .update({ name: input.name.trim(), type: input.type })
    .eq("id", ctx.organization.id);
  if (error) return { error: "Unable to update organization. Please try again." };
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return {};
}

export async function updateProfile(input: { full_name: string }): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: input.full_name.trim() })
    .eq("id", ctx.user.id);
  if (error) return { error: "Unable to update your profile. Please try again." };
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return {};
}

export async function updateMemberRole(memberId: string, role: OrgRole): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  if (!canManageSettings(ctx.role)) return { error: "Only Owners and Admins can change roles." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_members")
    .update({ role })
    .eq("id", memberId)
    .eq("organization_id", ctx.organization.id);
  if (error) return { error: "Unable to change role. Only Owners can change the Owner role." };
  revalidatePath("/settings");
  revalidatePath("/people");
  return {};
}

export async function removeMember(memberId: string): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  if (!canManageSettings(ctx.role)) return { error: "Only Owners and Admins can remove members." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", memberId)
    .eq("organization_id", ctx.organization.id);
  if (error) return { error: "Unable to remove member. The Owner cannot be removed." };
  revalidatePath("/settings");
  revalidatePath("/people");
  return {};
}
