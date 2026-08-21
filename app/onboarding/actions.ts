"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ORG_COOKIE } from "@/lib/auth";
import type { OrganizationType } from "@/types";

export async function createOrganization(input: {
  name: string;
  type: OrganizationType;
  fullName: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to create an organization." };

  const name = input.name.trim();
  if (name.length < 2) return { error: "Organization name must be at least 2 characters." };

  // Ensure the profile exists (trigger normally handles this on signup).
  await supabase
    .from("profiles")
    .upsert({ id: user.id, email: user.email ?? "", full_name: input.fullName.trim() });

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name, type: input.type, created_by: user.id })
    .select("id")
    .single();

  if (orgError || !org) {
    return { error: "Unable to create the organization. Please try again." };
  }

  const { error: memberError } = await supabase.from("organization_members").insert({
    organization_id: org.id,
    user_id: user.id,
    role: "owner",
  });

  if (memberError) {
    return { error: "Unable to set up your membership. Please try again." };
  }

  (await cookies()).set(ORG_COOKIE, org.id, { path: "/", sameSite: "lax" });
  revalidatePath("/dashboard");
  return {};
}
