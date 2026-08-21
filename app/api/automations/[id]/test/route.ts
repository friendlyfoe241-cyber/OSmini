import { NextResponse } from "next/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { testAutomation } from "@/lib/automation/engine";

export const runtime = "nodejs";

// Dry-run an automation: evaluates conditions against the most recent
// matching event without executing actions or writing runs.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: "Service role not configured on this deployment." },
      { status: 503 }
    );
  }

  const { id } = await params;
  try {
    const admin = createAdminClient();
    const result = await testAutomation(admin, id, ctx.organization.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to test automation." },
      { status: 500 }
    );
  }
}
