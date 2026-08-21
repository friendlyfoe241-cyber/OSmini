import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAutomationCycle, type CycleSummary } from "@/lib/automation/engine";

export const runtime = "nodejs";

// Server-side scheduler entry point. Invoke with:
//   Authorization: Bearer <CRON_SECRET>
// from a Supabase scheduled Edge Function, Vercel Cron, or any external
// scheduler. Never depends on a browser being open.
export async function POST(request: Request) {
  const header = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let summary: CycleSummary;
  try {
    const admin = createAdminClient();
    summary = await runAutomationCycle(admin);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Automation cycle failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, summary });
}

export async function GET(request: Request) {
  return POST(request);
}
