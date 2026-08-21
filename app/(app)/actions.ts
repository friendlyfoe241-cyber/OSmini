"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMemberships, ORG_COOKIE } from "@/lib/auth";

// Switch the active organization. Validated against actual memberships —
// the cookie alone never grants access (RLS enforces real isolation).
export async function switchOrganization(orgId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const memberships = await getMemberships(user.id);
  if (!memberships.some((m) => m.organization_id === orgId)) {
    return { error: "You are not a member of that organization." };
  }

  (await cookies()).set(ORG_COOKIE, orgId, { path: "/", sameSite: "lax" });
  revalidatePath("/", "layout");
  return {};
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("notifications").update({ read: true }).eq("id", id);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  revalidatePath("/", "layout");
}
