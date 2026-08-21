import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutomationAction, NotificationType } from "@/types";

// Server-side action executor. Runs with the service-role client and is the
// ONLY place automations mutate data. Every mutation is auditable: runs are
// recorded in automation_runs and changes in activity_logs.

export interface ActionContext {
  organizationId: string;
  entityType: string; // task | project | milestone | member | application | schedule
  entity: Record<string, unknown>;
  automation: { id: string; name: string; created_by: string | null };
}

interface ActionResult {
  ok: boolean;
  detail: string;
}

const cfg = (action: AutomationAction) => (action.config ?? {}) as Record<string, unknown>;

async function notify(
  admin: SupabaseClient,
  userId: string | null | undefined,
  ctx: ActionContext,
  type: NotificationType,
  title: string,
  message?: string
): Promise<boolean> {
  if (!userId) return false;
  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    organization_id: ctx.organizationId,
    type,
    title,
    message: message ?? null,
  });
  return !error;
}

async function resolveProjectManager(
  admin: SupabaseClient,
  ctx: ActionContext
): Promise<string | null> {
  const projectId =
    (ctx.entity.project_id as string | undefined) ??
    (ctx.entityType === "project" ? (ctx.entity.id as string) : undefined);
  if (!projectId) return null;
  const { data } = await admin
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .single();
  return (data?.owner_id as string | null) ?? null;
}

async function resolveTargetUser(
  admin: SupabaseClient,
  target: string,
  ctx: ActionContext
): Promise<string | null> {
  switch (target) {
    case "assignee":
      return (ctx.entity.assignee_id as string | null) ?? null;
    case "creator":
      return (ctx.entity.creator_id as string | null) ?? ctx.automation.created_by;
    case "member":
      return (ctx.entity.user_id as string | null) ?? (ctx.entity.id as string | null) ?? null;
    case "project_manager":
    case "project_owner":
      return resolveProjectManager(admin, ctx);
    default:
      return target.match(/^[0-9a-f-]{36}$/i) ? target : null;
  }
}

async function entityTitle(ctx: ActionContext): Promise<string> {
  return (
    (ctx.entity.title as string) ??
    (ctx.entity.name as string) ??
    (ctx.entity.full_name as string) ??
    ctx.entityType
  );
}

export async function executeAction(
  admin: SupabaseClient,
  action: AutomationAction,
  ctx: ActionContext
): Promise<ActionResult> {
  const config = cfg(action);

  switch (action.action_type) {
    case "send_notification": {
      const target = (config.target as string) ?? "assignee";
      const titleTemplate = (config.title as string) ?? "OSmini notification";
      const userId = await resolveTargetUser(admin, target, ctx);
      const title = `${titleTemplate}: ${await entityTitle(ctx)}`;
      const ok = await notify(
        admin, userId, ctx,
        (config.type as NotificationType) ?? "general",
        title,
        `Automation "${ctx.automation.name}" triggered by a ${ctx.entityType} event.`
      );
      return ok
        ? { ok: true, detail: `Notified ${target}` }
        : { ok: false, detail: `Could not notify ${target} (no recipient)` };
    }

    case "notify_project_manager": {
      const pm = await resolveProjectManager(admin, ctx);
      const ok = await notify(
        admin, pm, ctx, "project_update",
        `${(config.title as string) ?? "Project update"}: ${await entityTitle(ctx)}`,
        `Automation "${ctx.automation.name}" detected this needs your attention.`
      );
      return ok
        ? { ok: true, detail: "Notified project manager" }
        : { ok: false, detail: "No project manager found" };
    }

    case "assign_task": {
      const target = (config.assignee as string) ?? (config.target as string);
      const userId = await resolveTargetUser(admin, target, ctx);
      const taskId = ctx.entityType === "task" ? (ctx.entity.id as string) : null;
      if (!taskId || !userId) return { ok: false, detail: "Missing task or assignee" };
      const { error } = await admin.from("tasks").update({ assignee_id: userId }).eq("id", taskId);
      return error
        ? { ok: false, detail: error.message }
        : { ok: true, detail: `Assigned task to ${userId}` };
    }

    case "create_task": {
      let projectId = (config.project_id as string) ?? null;
      if (!projectId && config.project_name) {
        const { data } = await admin
          .from("projects")
          .select("id")
          .eq("organization_id", ctx.organizationId)
          .ilike("name", config.project_name as string)
          .limit(1)
          .maybeSingle();
        projectId = data?.id ?? null;
      }
      if (!projectId && ctx.entityType === "task") projectId = ctx.entity.project_id as string;
      if (!projectId) return { ok: false, detail: "No target project resolved" };
      const dueInDays = Number(config.due_in_days ?? 0);
      const dueDate = dueInDays > 0
        ? new Date(Date.now() + dueInDays * 86400000).toISOString().slice(0, 10)
        : null;
      const assigneeTarget = config.assignee as string | undefined;
      const assigneeId = assigneeTarget ? await resolveTargetUser(admin, assigneeTarget, ctx) : null;
      const { error } = await admin.from("tasks").insert({
        organization_id: ctx.organizationId,
        project_id: projectId,
        title: (config.title as string) ?? "Follow-up task",
        description: `Created by automation "${ctx.automation.name}".`,
        priority: (config.priority as string) ?? "medium",
        status: "todo",
        due_date: dueDate,
        assignee_id: assigneeId,
      });
      return error
        ? { ok: false, detail: error.message }
        : { ok: true, detail: `Created task "${config.title}"` };
    }

    case "change_task_status": {
      const taskId = ctx.entityType === "task" ? (ctx.entity.id as string) : null;
      if (!taskId) return { ok: false, detail: "Not a task event" };
      const { error } = await admin
        .from("tasks")
        .update({ status: config.status as string })
        .eq("id", taskId);
      return error
        ? { ok: false, detail: error.message }
        : { ok: true, detail: `Status → ${config.status}` };
    }

    case "change_priority": {
      if (ctx.entityType !== "task") return { ok: false, detail: "Not a task event" };
      const { error } = await admin
        .from("tasks")
        .update({ priority: config.priority as string })
        .eq("id", ctx.entity.id as string);
      return error
        ? { ok: false, detail: error.message }
        : { ok: true, detail: `Priority → ${config.priority}` };
    }

    case "add_label": {
      if (ctx.entityType !== "task") return { ok: false, detail: "Not a task event" };
      const label = config.label as string;
      const existing = (ctx.entity.labels as string[]) ?? [];
      if (existing.includes(label)) return { ok: true, detail: "Label already present" };
      const { error } = await admin
        .from("tasks")
        .update({ labels: [...existing, label] })
        .eq("id", ctx.entity.id as string);
      return error
        ? { ok: false, detail: error.message }
        : { ok: true, detail: `Added label "${label}"` };
    }

    case "mark_milestone_complete": {
      const milestoneId =
        ctx.entityType === "milestone"
          ? (ctx.entity.id as string)
          : (config.milestone_id as string | undefined);
      if (!milestoneId) return { ok: false, detail: "No milestone resolved" };
      const { error } = await admin.rpc("try_complete_milestone", {
        p_milestone_id: milestoneId,
      });
      return error
        ? { ok: false, detail: error.message }
        : { ok: true, detail: "Milestone completion evaluated" };
    }

    case "create_activity_event": {
      const { error } = await admin.from("activity_logs").insert({
        organization_id: ctx.organizationId,
        actor_id: null,
        action: (config.action as string) ?? "automation.event",
        entity_type: ctx.entityType,
        entity_id: (ctx.entity.id as string) ?? null,
        metadata: {
          automation: ctx.automation.name,
          note: config.note ?? null,
        },
      });
      return error
        ? { ok: false, detail: error.message }
        : { ok: true, detail: "Activity event recorded" };
    }

    case "generate_ai_summary":
    case "generate_ai_suggestion": {
      // AI is an enhancement: failures degrade gracefully and do not fail
      // the automation run.
      try {
        const { runAutomationAiAction } = await import("@/lib/ai/automation-actions");
        const result = await runAutomationAiAction(admin, action, ctx);
        return { ok: true, detail: result };
      } catch (err) {
        return {
          ok: true,
          detail: `AI temporarily unavailable — skipped (${err instanceof Error ? err.message : "unknown error"})`,
        };
      }
    }

    default:
      return { ok: false, detail: `Unknown action type: ${action.action_type}` };
  }
}
