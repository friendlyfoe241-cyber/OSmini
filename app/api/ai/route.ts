import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import {
  aiExtractTasks, aiProjectHealth, aiProjectSummary, aiWeeklyReport, AiUnavailableError,
  deterministicHealth, gatherProjectFacts,
} from "@/lib/ai/features";
import { AiFeature } from "@/types";

export const runtime = "nodejs";

const requestSchema = z.object({
  feature: z.enum(["project_summary", "task_extraction", "project_health", "weekly_report", "project_health_facts"]),
  projectId: z.string().uuid().optional(),
  text: z.string().max(4000).optional(),
});

// All Gemini traffic goes through this server-side boundary. Credentials
// never reach the browser.
export async function POST(request: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { feature, projectId, text } = parsed.data;

  const meta = { organizationId: ctx.organization.id, userId: ctx.user.id };

  try {
    const admin = hasServiceRole() ? createAdminClient() : ((await createClient()) as never);

    switch (feature as AiFeature | "project_health_facts") {
      case "project_health_facts": {
        // Deterministic, database-derived only. No AI involved.
        if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
        const facts = await gatherProjectFacts(admin, projectId);
        if (!facts) return NextResponse.json({ error: "Project not found" }, { status: 404 });
        return NextResponse.json({ facts, baseline: deterministicHealth(facts) });
      }
      case "project_summary": {
        if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
        const summary = await aiProjectSummary(admin, meta, projectId);
        return NextResponse.json({ summary });
      }
      case "task_extraction": {
        if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });
        const result = await aiExtractTasks(admin, { ...meta, projectId }, text);
        return NextResponse.json({ suggestions: result.tasks });
      }
      case "project_health": {
        if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
        const result = await aiProjectHealth(admin, meta, projectId);
        return NextResponse.json(result);
      }
      case "weekly_report": {
        const result = await aiWeeklyReport(admin, meta);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: "Unknown feature" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return NextResponse.json({ error: err.message, aiUnavailable: true }, { status: 503 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed. Please try again." },
      { status: 500 }
    );
  }
}
