import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Automation,
  AutomationAction,
  AutomationCondition,
  AutomationEvent,
} from "@/types";
import { evaluateConditions } from "./conditions";
import { executeAction } from "./actions";

// ---------------------------------------------------------------------------
// OSmini automation engine
//
// TRIGGER (automation_events from DB triggers / overdue sweep / scheduler)
//   -> CONDITIONS (evaluated against fresh entity state)
//   -> ACTIONS (executed via service role, audited)
//   -> EXECUTION LOG (automation_runs, idempotent per automation+event)
// ---------------------------------------------------------------------------

const ENTITY_TABLES: Record<string, string> = {
  task: "tasks",
  project: "projects",
  milestone: "milestones",
  member: "organization_members",
  application: "applications",
};

const SCHEDULED_TYPES = ["scheduled_daily", "scheduled_weekly", "scheduled_monthly"];

export interface CycleSummary {
  eventsScanned: number;
  runsCreated: number;
  runsSucceeded: number;
  runsFailed: number;
  runsSkipped: number;
  scheduledRuns: number;
  overdueEventsEmitted: number;
  errors: string[];
}

type FullAutomation = Automation & {
  conditions: AutomationCondition[];
  actions: AutomationAction[];
};

async function loadAutomations(admin: SupabaseClient): Promise<FullAutomation[]> {
  const { data, error } = await admin
    .from("automations")
    .select("*, conditions:automation_conditions(*), actions:automation_actions(*)")
    .eq("enabled", true);
  if (error) throw new Error(`Unable to load automations: ${error.message}`);
  return (data ?? []) as FullAutomation[];
}

async function loadFreshEntity(
  admin: SupabaseClient,
  entityType: string,
  entityId: string | null
): Promise<Record<string, unknown> | null> {
  const table = ENTITY_TABLES[entityType];
  if (!table || !entityId) return null;
  const { data } = await admin.from(table).select("*").eq("id", entityId).maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

// Create the run row first. The unique (automation_id, trigger_event_id)
// constraint makes execution idempotent: a duplicate insert means this
// event was already processed for this automation.
async function claimRun(
  admin: SupabaseClient,
  automationId: string,
  eventId: string | null
): Promise<string | null> {
  const { data, error } = await admin
    .from("automation_runs")
    .insert({ automation_id: automationId, trigger_event_id: eventId, status: "running" })
    .select("id")
    .maybeSingle();
  if (error || !data) return null; // already processed or conflict
  return data.id as string;
}

async function finalizeRun(
  admin: SupabaseClient,
  runId: string,
  status: "successful" | "failed" | "skipped",
  actionsExecuted: number,
  errorMessage: string | null
): Promise<void> {
  await admin
    .from("automation_runs")
    .update({ status, actions_executed: actionsExecuted, error_message: errorMessage, completed_at: new Date().toISOString() })
    .eq("id", runId);
}

async function logAutomationActivity(
  admin: SupabaseClient,
  automation: FullAutomation,
  status: string,
  detail: Record<string, unknown>
): Promise<void> {
  await admin.from("activity_logs").insert({
    organization_id: automation.organization_id,
    actor_id: null,
    action: status === "failed" ? "automation.failed" : "automation.executed",
    entity_type: "automation",
    entity_id: automation.id,
    metadata: { automation: automation.name, status, ...detail },
  });
}

async function executeAutomationForEvent(
  admin: SupabaseClient,
  automation: FullAutomation,
  event: AutomationEvent,
  summary: CycleSummary
): Promise<void> {
  const runId = await claimRun(admin, automation.id, event.id);
  if (!runId) return; // idempotency: already processed

  try {
    const entity =
      (await loadFreshEntity(admin, event.entity_type, event.entity_id)) ??
      ((event.payload?.[event.entity_type] as Record<string, unknown> | undefined) ?? {});

    const conditions = [...automation.conditions].sort((a, b) => a.sort_order - b.sort_order);
    const passed = evaluateConditions(conditions, entity, automation.condition_logic);

    if (!passed) {
      await finalizeRun(admin, runId, "skipped", 0, null);
      summary.runsSkipped++;
      return;
    }

    const ctx = {
      organizationId: automation.organization_id,
      entityType: event.entity_type,
      entity,
      automation: { id: automation.id, name: automation.name, created_by: automation.created_by },
    };

    let executed = 0;
    const failures: string[] = [];
    for (const action of [...automation.actions].sort((a, b) => a.sort_order - b.sort_order)) {
      try {
        const result = await executeAction(admin, action, ctx);
        if (result.ok) executed++;
        else failures.push(`${action.action_type}: ${result.detail}`);
      } catch (err) {
        failures.push(`${action.action_type}: ${err instanceof Error ? err.message : "error"}`);
      }
    }

    const status = failures.length > 0 ? "failed" : "successful";
    await finalizeRun(admin, runId, status, executed, failures[0] ?? null);
    await logAutomationActivity(admin, automation, status, {
      event_type: event.event_type,
      actions_executed: executed,
      error: failures[0] ?? null,
    });
    if (status === "failed") {
      summary.runsFailed++;
      // Failure is never silent: notify the automation creator.
      if (automation.created_by) {
        await admin.from("notifications").insert({
          user_id: automation.created_by,
          organization_id: automation.organization_id,
          type: "automation_result",
          title: `Automation failed: ${automation.name}`,
          message: failures[0] ?? "View execution details.",
        });
      }
    } else {
      summary.runsSucceeded++;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown engine error";
    await finalizeRun(admin, runId, "failed", 0, message);
    summary.runsFailed++;
    summary.errors.push(message);
  }
}

// Overdue sweep: emit one-time overdue events for tasks, projects and
// milestones. The partial unique index on automation_events guarantees each
// entity produces at most one overdue event per type.
async function overdueSweep(admin: SupabaseClient, summary: CycleSummary): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  const sweeps: {
    table: string;
    type: "task_overdue" | "project_overdue" | "milestone_overdue";
    entityType: string;
    excludeStatuses: string[];
  }[] = [
    { table: "tasks", type: "task_overdue", entityType: "task", excludeStatuses: ["completed"] },
    { table: "projects", type: "project_overdue", entityType: "project", excludeStatuses: ["completed", "archived"] },
    { table: "milestones", type: "milestone_overdue", entityType: "milestone", excludeStatuses: ["completed"] },
  ];

  for (const sweep of sweeps) {
    const { data, error } = await admin
      .from(sweep.table)
      .select("id, organization_id")
      .not("status", "in", `(${sweep.excludeStatuses.join(",")})`)
      .not("due_date", "is", null)
      .lt("due_date", today)
      .limit(500);
    if (error || !data) continue;

    for (const row of data) {
      const { error: insertError } = await admin.from("automation_events").insert({
        organization_id: row.organization_id,
        event_type: sweep.type,
        entity_type: sweep.entityType,
        entity_id: row.id,
        payload: {},
      });
      if (!insertError) summary.overdueEventsEmitted++;
      // Conflict on the partial unique index = already emitted; ignore.
    }
  }
}

// Scheduled triggers: run daily/weekly/monthly automations once per period.
// trigger_config: { hour, minute, weekday (0-6), day_of_month (1-31) }
async function processSchedules(
  admin: SupabaseClient,
  automations: FullAutomation[],
  summary: CycleSummary
): Promise<void> {
  const now = new Date();

  for (const automation of automations.filter((a) => SCHEDULED_TYPES.includes(a.trigger_type))) {
    const cfg = (automation.trigger_config ?? {}) as Record<string, number>;
    const hour = cfg.hour ?? 9;

    if (now.getUTCHours() < hour) continue; // not yet time today

    let periodStart: Date;
    if (automation.trigger_type === "scheduled_daily") {
      periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour));
    } else if (automation.trigger_type === "scheduled_weekly") {
      const weekday = cfg.weekday ?? 1; // Monday
      if (now.getUTCDay() !== weekday) continue;
      periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour));
    } else {
      const dayOfMonth = cfg.day_of_month ?? 1;
      if (now.getUTCDate() !== dayOfMonth) continue;
      periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), dayOfMonth, hour));
    }

    const { data: recentRun } = await admin
      .from("automation_runs")
      .select("id")
      .eq("automation_id", automation.id)
      .gte("started_at", periodStart.toISOString())
      .limit(1)
      .maybeSingle();
    if (recentRun) continue; // already ran this period

    // Emit a synthetic schedule event, then dispatch through the same path.
    const { data: event } = await admin
      .from("automation_events")
      .insert({
        organization_id: automation.organization_id,
        event_type: automation.trigger_type,
        entity_type: "schedule",
        entity_id: null,
        payload: { scheduled_for: periodStart.toISOString() },
      })
      .select()
      .single();
    if (!event) continue;

    const runId = await claimRun(admin, automation.id, event.id);
    if (!runId) continue;

    const ctx = {
      organizationId: automation.organization_id,
      entityType: "schedule",
      entity: {},
      automation: { id: automation.id, name: automation.name, created_by: automation.created_by },
    };

    let executed = 0;
    const failures: string[] = [];
    for (const action of [...automation.actions].sort((a, b) => a.sort_order - b.sort_order)) {
      try {
        const result = await executeAction(admin, action, ctx);
        if (result.ok) executed++;
        else failures.push(`${action.action_type}: ${result.detail}`);
      } catch (err) {
        failures.push(`${action.action_type}: ${err instanceof Error ? err.message : "error"}`);
      }
    }

    const status = failures.length > 0 ? "failed" : "successful";
    await finalizeRun(admin, runId, status, executed, failures[0] ?? null);
    await logAutomationActivity(admin, automation, status, {
      event_type: automation.trigger_type,
      actions_executed: executed,
      error: failures[0] ?? null,
    });
    summary.scheduledRuns++;
    if (status === "failed") summary.runsFailed++;
    else summary.runsSucceeded++;
  }
}

async function dispatchEvents(
  admin: SupabaseClient,
  automations: FullAutomation[],
  summary: CycleSummary
): Promise<void> {
  // Scan recent events. Idempotency via automation_runs makes re-scanning
  // safe even if the same event is seen many times.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: events, error } = await admin
    .from("automation_events")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) {
    summary.errors.push(`Unable to load events: ${error.message}`);
    return;
  }

  summary.eventsScanned = events?.length ?? 0;

  const byTrigger = new Map<string, FullAutomation[]>();
  for (const automation of automations) {
    if (SCHEDULED_TYPES.includes(automation.trigger_type)) continue;
    const list = byTrigger.get(automation.trigger_type) ?? [];
    list.push(automation);
    byTrigger.set(automation.trigger_type, list);
  }

  for (const event of (events ?? []) as AutomationEvent[]) {
    const matches = (byTrigger.get(event.event_type) ?? []).filter(
      (a) => a.organization_id === event.organization_id
    );
    for (const automation of matches) {
      summary.runsCreated++;
      await executeAutomationForEvent(admin, automation, event, summary);
    }
  }
}

// One full engine cycle: sweep overdue work, fire due schedules, dispatch events.
export async function runAutomationCycle(admin: SupabaseClient): Promise<CycleSummary> {
  const summary: CycleSummary = {
    eventsScanned: 0,
    runsCreated: 0,
    runsSucceeded: 0,
    runsFailed: 0,
    runsSkipped: 0,
    scheduledRuns: 0,
    overdueEventsEmitted: 0,
    errors: [],
  };

  const automations = await loadAutomations(admin);

  await overdueSweep(admin, summary);
  await processSchedules(admin, automations, summary);
  await dispatchEvents(admin, automations, summary);

  return summary;
}

// Dry-run a single automation against the latest matching event (or an empty
// entity) without mutating anything. Powers the "Test" button in the UI.
export async function testAutomation(
  admin: SupabaseClient,
  automationId: string,
  organizationId: string
): Promise<{
  matchedEvent: AutomationEvent | null;
  conditionsPassed: boolean;
  plannedActions: { action_type: string; config: Record<string, unknown> }[];
}> {
  const { data: automation } = await admin
    .from("automations")
    .select("*, conditions:automation_conditions(*), actions:automation_actions(*)")
    .eq("id", automationId)
    .eq("organization_id", organizationId)
    .single();
  if (!automation) throw new Error("Automation not found");

  const { data: event } = await admin
    .from("automation_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("event_type", automation.trigger_type)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const entity = event
    ? ((await loadFreshEntity(admin, event.entity_type, event.entity_id)) ??
      ((event.payload?.[event.entity_type] as Record<string, unknown> | undefined) ?? {}))
    : {};

  const conditions = [...(automation.conditions ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const conditionsPassed = evaluateConditions(conditions, entity, automation.condition_logic);

  return {
    matchedEvent: (event as AutomationEvent | null) ?? null,
    conditionsPassed,
    plannedActions: [...(automation.actions ?? [])]
      .sort((a: AutomationAction, b: AutomationAction) => a.sort_order - b.sort_order)
      .map((a: AutomationAction) => ({ action_type: a.action_type, config: a.config })),
  };
}
