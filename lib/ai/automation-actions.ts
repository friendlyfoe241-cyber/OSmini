import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutomationAction } from "@/types";
import type { ActionContext } from "@/lib/automation/actions";
import { aiProjectHealth, aiWeeklyReport, gatherProjectFacts } from "./features";
import { aiAvailable } from "./gemini";

// Bridges automation actions (generate_ai_summary / generate_ai_suggestion)
// to the AI feature layer. AI is optional: if Gemini is not configured, we
// record that gracefully instead of failing the run.
export async function runAutomationAiAction(
  admin: SupabaseClient,
  action: AutomationAction,
  ctx: ActionContext
): Promise<string> {
  if (!aiAvailable()) {
    await admin.from("activity_logs").insert({
      organization_id: ctx.organizationId,
      actor_id: null,
      action: "ai.unavailable",
      entity_type: "automation",
      entity_id: ctx.automation.id,
      metadata: { automation: ctx.automation.name, action: action.action_type },
    });
    return "AI not configured — recorded ai.unavailable activity";
  }

  if (action.action_type === "generate_ai_summary") {
    const { metrics, narrative } = await aiWeeklyReport(admin, {
      organizationId: ctx.organizationId,
      userId: ctx.automation.created_by,
    });
    if (ctx.automation.created_by) {
      await admin.from("notifications").insert({
        user_id: ctx.automation.created_by,
        organization_id: ctx.organizationId,
        type: "ai_recommendation",
        title: "AI weekly project summary",
        message: narrative.current_status,
      });
    }
    return `Weekly summary generated (${metrics.projects.active} active projects)`;
  }

  // generate_ai_suggestion: health analysis for the project in context.
  const projectId =
    (ctx.entity.project_id as string | undefined) ??
    (ctx.entityType === "project" ? (ctx.entity.id as string) : undefined);
  if (!projectId) return "No project in context — skipped";

  const facts = await gatherProjectFacts(admin, projectId);
  if (!facts) return "Project not found — skipped";

  const { ai } = await aiProjectHealth(admin, {
    organizationId: ctx.organizationId,
    userId: ctx.automation.created_by,
  }, projectId);

  if (ctx.automation.created_by) {
    await admin.from("notifications").insert({
      user_id: ctx.automation.created_by,
      organization_id: ctx.organizationId,
      type: "ai_recommendation",
      title: `AI health assessment: ${facts.project.name}`,
      message: `${ai.health} — ${ai.reasons[0] ?? "see AI suggestions"}`,
    });
  }
  return `AI health assessment: ${ai.health} (confidence ${ai.confidence})`;
}
