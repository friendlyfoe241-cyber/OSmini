import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { canManageMembers } from "@/lib/permissions";

export const runtime = "nodejs";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "project_manager", "member", "viewer"]),
  fullName: z.string().max(200).optional(),
});

// Member invitation. Requires the service role (Supabase admin API) and an
// Owner/Admin role in the organization. RLS enforces this again at insert.
export async function POST(request: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMembers(ctx.role)) {
    return NextResponse.json(
      { error: "Only Owners and Admins can invite members." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }

  if (!hasServiceRole()) {
    return NextResponse.json(
      {
        error:
          "Invitations require SUPABASE_SERVICE_ROLE_KEY on the server. " +
          "Ask the user to sign up directly, then Owners/Admins can manage roles.",
      },
      { status: 503 }
    );
  }

  const { email, role, fullName } = parsed.data;
  const origin = new URL(request.url).origin;
  const admin = createAdminClient();

  // Invite (or locate) the user, then attach them to the organization.
  const invite = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback`,
    data: fullName ? { full_name: fullName } : undefined,
  });

  let userId: string | null = invite.data.user?.id ?? null;
  if (invite.error) {
    // User may already exist — look them up.
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    userId = profile?.id ?? null;
    if (!userId) {
      return NextResponse.json(
        { error: "Unable to invite this user. Please try again." },
        { status: 500 }
      );
    }
  }

  const { error } = await admin.from("organization_members").upsert(
    {
      organization_id: ctx.organization.id,
      user_id: userId,
      role,
      invited_by: ctx.user.id,
    },
    { onConflict: "organization_id,user_id" }
  );
  if (error) {
    return NextResponse.json({ error: "Unable to add the member. Please try again." }, { status: 500 });
  }

  await admin.from("activity_logs").insert({
    organization_id: ctx.organization.id,
    actor_id: ctx.user.id,
    action: "member.invited",
    entity_type: "member",
    entity_id: userId,
    metadata: { email, role },
  });

  return NextResponse.json({ ok: true });
}

// List profiles for client pickers (org-scoped by RLS).
export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_members")
    .select("user_id, role, profile:profiles!organization_members_user_id_fkey(full_name,email)")
    .eq("organization_id", ctx.organization.id);
  return NextResponse.json({ members: data ?? [] });
}
