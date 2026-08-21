import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrgRole, Organization, OrganizationMember, Profile } from "@/types";

export const ORG_COOKIE = "osmini_org";

export interface OrgContext {
  user: { id: string; email?: string };
  profile: Profile;
  organization: Organization;
  membership: OrganizationMember;
  role: OrgRole;
}

// React cache() dedupes within a single request render pass.
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getMemberships = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_members")
    .select("*, organization:organizations(*)")
    .eq("user_id", userId);
  return (data ?? []) as (OrganizationMember & { organization: Organization })[];
});

// Resolve the current organization from the org cookie, validated against
// the user's actual memberships (never trust the cookie blindly).
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const user = await getUser();
  if (!user) return null;

  const memberships = await getMemberships(user.id);
  if (memberships.length === 0) return null;

  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get(ORG_COOKIE)?.value;
  const selected =
    memberships.find((m) => m.organization_id === cookieOrgId) ?? memberships[0];

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return {
    user: { id: user.id, email: user.email },
    profile: (profile ?? {
      id: user.id,
      email: user.email ?? "",
      full_name: "",
      avatar_url: null,
      created_at: "",
      updated_at: "",
    }) as Profile,
    organization: selected.organization,
    membership: selected,
    role: selected.role,
  };
});

// Page guard: require an authenticated user with an organization.
export async function requireOrgContext(): Promise<OrgContext> {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/onboarding");
  return ctx;
}
