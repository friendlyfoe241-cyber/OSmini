import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateAI, GeminiError, type AiErrorType } from "./gemini";
import type { AiFeature, ProjectHealth } from "@/types";

// ---------------------------------------------------------------------------
// AI feature layer.
//
// Principles enforced here:
// - All facts (counts, dates, names) come from the database; the model only
//   interprets them. Prompts instruct the model never to invent statistics.
// - Structured output is requested as JSON, parsed, and validated with zod.
//   Malformed responses are retried at most once.
// - Every request is logged to ai_requests (never including secrets).
// ---------------------------------------------------------------------------

export class AiUnavailableError extends Error {
  constructor(public errorType: AiErrorType) {
    super("AI analysis is temporarily unavailable. Your organization data is safe and the rest of OSmini is still working.");
    this.name = "AiUnavailableError";
  }
}

async function logRequest(
  admin: SupabaseClient,
  entry: {
    organizationId: string;
    userId: string | null;
    feature: AiFeature;
    result?: Awaited<ReturnType<typeof generateAI>>;
    errorType?: AiErrorType;
  }
): Promise<void> {
  await admin.from("ai_requests").insert({
    organization_id: entry.organizationId,
    user_id: entry.userId,
    feature: entry.feature,
    model: entry.result?.model ?? null,
    credential_identifier: entry.result?.credentialIdentifier ?? null,
    status: entry.result ? "success" : "failed",
    error_type: entry.errorType ?? null,
    duration_ms: entry.result?.durationMs ?? null,
    prompt_tokens: entry.result?.promptTokens ?? null,
    completion_tokens: entry.result?.completionTokens ?? null,
  });
}

// Run a JSON-mode generation with schema validation and one retry on
// malformed output.
async function generateValidated<T>(
  admin: SupabaseClient,
  meta: { organizationId: string; userId: string | null; feature: AiFeature },
  prompt: string,
  schema: z.ZodType<T>,
  model: "fast" | "reasoning" | "summary" = "fast"
): Promise<T> {
  let result;
  try {
    result = await generateAI(prompt, { json: true, model });
  } catch (err) {
    const errorType = err instanceof GeminiError ? err.errorType : "network";
    await logRequest(admin, { ...meta, errorType });
    throw new AiUnavailableError(errorType);
  }
  await logRequest(admin, { ...meta, result });

  const parse = (text: string) => schema.safeParse(JSON.parse(text));
  let parsed = parse(result.text);
  if (!parsed.success) {
    // One retry, asking the model to fix its own output.
    try {
      const retry = await generateAI(
        `${prompt}\n\nYour previous response was not valid JSON matching the required schema. Return ONLY corrected JSON.`,
        { json: true, model }
      );
      await logRequest(admin, { ...meta, result: retry });
      parsed = parse(retry.text);
    } catch (err) {
      const errorType = err instanceof GeminiError ? err.errorType : "network";
      await logRequest(admin, { ...meta, errorType });
      throw new AiUnavailableError(errorType);
    }
  }
  if (!parsed.success) {
    throw new AiUnavailableError("invalid_request");
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Fact gathering (deterministic, database-derived)
// ---------------------------------------------------------------------------

export interface ProjectFacts {
  project: { id: string; name: string; status: string; priority: string; due_date: string | null; progress: number };
  counts: { total: number; completed: number; inProgress: number; blocked: number; overdue: number };
  upcomingDeadlines: { title: string; due_date: string }[];
  milestones: { name: string; status: string; due_date: string | null }[];
  recentActivity: string[];
}

export async function gatherProjectFacts(
  admin: SupabaseClient,
  projectId: string
): Promise<ProjectFacts | null> {
  const { data: project } = await admin
    .from("projects")
    .select("id, name, status, priority, due_date, progress, organization_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;

  const { data: tasks } = await admin
    .from("tasks")
    .select("title, status, priority, due_date")
    .eq("project_id", projectId);

  const today = new Date().toISOString().slice(0, 10);
  const rows = tasks ?? [];
  const open = rows.filter((t) => t.status !== "completed");

  const { data: milestones } = await admin
    .from("milestones")
    .select("name, status, due_date")
    .eq("project_id", projectId)
    .order("due_date", { ascending: true });

  const { data: activity } = await admin
    .from("activity_logs")
    .select("action, metadata, created_at")
    .eq("organization_id", project.organization_id)
    .order("created_at", { ascending: false })
    .limit(10);

  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      priority: project.priority,
      due_date: project.due_date,
      progress: project.progress,
    },
    counts: {
      total: rows.length,
      completed: rows.filter((t) => t.status === "completed").length,
      inProgress: rows.filter((t) => t.status === "in_progress").length,
      blocked: rows.filter((t) => t.status === "blocked").length,
      overdue: open.filter((t) => t.due_date && t.due_date < today).length,
    },
    upcomingDeadlines: open
      .filter((t) => t.due_date && t.due_date >= today)
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
      .slice(0, 5)
      .map((t) => ({ title: t.title, due_date: t.due_date! })),
    milestones: (milestones ?? []).map((m) => ({
      name: m.name,
      status: m.status,
      due_date: m.due_date,
    })),
    recentActivity: (activity ?? []).map((a) => `${a.action} (${a.created_at.slice(0, 10)})`),
  };
}

// ---------------------------------------------------------------------------
// Feature 1: AI Project Summary
// ---------------------------------------------------------------------------

const summarySchema = z.object({
  current_status: z.string(),
  completed_work: z.array(z.string()),
  outstanding_work: z.array(z.string()),
  blockers: z.array(z.string()),
  risks: z.array(z.string()),
  recommended_next_steps: z.array(z.string()),
});

export type ProjectSummary = z.infer<typeof summarySchema>;

export async function aiProjectSummary(
  admin: SupabaseClient,
  meta: { organizationId: string; userId: string | null },
  projectId: string
): Promise<ProjectSummary> {
  const facts = await gatherProjectFacts(admin, projectId);
  if (!facts) throw new Error("Project not found");

  const prompt = [
    "You are OSmini's operational assistant. Analyze this project using ONLY the facts below.",
    "Do not invent statistics, people, or tasks. If information is missing, say so.",
    "",
    "FACTS:",
    JSON.stringify(facts, null, 2),
    "",
    "Return JSON with exactly these keys: current_status (string), completed_work (string[]),",
    "outstanding_work (string[]), blockers (string[]), risks (string[]), recommended_next_steps (string[]).",
  ].join("\n");

  const summary = await generateValidated(admin, { ...meta, feature: "project_summary" }, prompt, summarySchema, "summary");

  await admin.from("ai_suggestions").insert({
    organization_id: meta.organizationId,
    user_id: meta.userId,
    project_id: projectId,
    feature: "project_summary",
    suggestion: summary,
  });
  await admin.from("activity_logs").insert({
    organization_id: meta.organizationId,
    actor_id: meta.userId,
    action: "ai.suggestion_generated",
    entity_type: "project",
    entity_id: projectId,
    metadata: { feature: "project_summary" },
  });
  return summary;
}

// ---------------------------------------------------------------------------
// Feature 2: AI Task Extraction
// ---------------------------------------------------------------------------

const extractionSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(300),
        description: z.string().max(2000).nullable().optional(),
        priority: z.enum(["low", "medium", "high", "critical"]).optional(),
        due_in_days: z.number().int().min(0).max(365).nullable().optional(),
      })
    )
    .max(20),
});

export type ExtractedTasks = z.infer<typeof extractionSchema>;

export async function aiExtractTasks(
  admin: SupabaseClient,
  meta: { organizationId: string; userId: string | null; projectId?: string },
  text: string
): Promise<ExtractedTasks> {
  const prompt = [
    "Extract actionable tasks from the note below. Return only tasks that still need to be done,",
    "not work that is described as finished.",
    "",
    "NOTE:",
    text.slice(0, 4000),
    "",
    'Return JSON: { "tasks": [ { "title": string, "description": string|null, "priority": "low|medium|high|critical", "due_in_days": number|null } ] }',
  ].join("\n");

  const extracted = await generateValidated(admin, { ...meta, feature: "task_extraction" }, prompt, extractionSchema, "fast");

  await admin.from("ai_suggestions").insert({
    organization_id: meta.organizationId,
    user_id: meta.userId,
    project_id: meta.projectId ?? null,
    feature: "task_extraction",
    suggestion: extracted,
  });
  await admin.from("activity_logs").insert({
    organization_id: meta.organizationId,
    actor_id: meta.userId,
    action: "ai.suggestion_generated",
    entity_type: "project",
    entity_id: meta.projectId ?? null,
    metadata: { feature: "task_extraction", count: extracted.tasks.length },
  });
  return extracted;
}

// ---------------------------------------------------------------------------
// Feature 3: AI Project Health
// ---------------------------------------------------------------------------

const healthSchema = z.object({
  health: z.enum(["on_track", "at_risk", "delayed", "completed"]),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()).max(10),
  recommendations: z.array(z.string()).max(10),
});

export type AiHealthAssessment = z.infer<typeof healthSchema>;

// Deterministic baseline health from database facts only.
export function deterministicHealth(facts: ProjectFacts): ProjectHealth {
  if (facts.project.status === "completed") return "completed";
  const today = new Date().toISOString().slice(0, 10);
  const projectOverdue = facts.project.due_date !== null && facts.project.due_date < today && facts.counts.completed < facts.counts.total;
  const milestoneOverdue = facts.milestones.some(
    (m) => m.status !== "completed" && m.due_date !== null && m.due_date < today
  );
  if (projectOverdue || (facts.counts.overdue > 0 && facts.counts.blocked > 0)) return "delayed";
  if (facts.counts.overdue > 0 || facts.counts.blocked > 0 || milestoneOverdue) return "at_risk";
  return "on_track";
}

export async function aiProjectHealth(
  admin: SupabaseClient,
  meta: { organizationId: string; userId: string | null },
  projectId: string
): Promise<{ facts: ProjectFacts; baseline: ProjectHealth; ai: AiHealthAssessment }> {
  const facts = await gatherProjectFacts(admin, projectId);
  if (!facts) throw new Error("Project not found");
  const baseline = deterministicHealth(facts);

  const prompt = [
    "Assess this project's health using ONLY the facts below. Do not invent statistics.",
    "",
    "FACTS:",
    JSON.stringify(facts, null, 2),
    "",
    'Return JSON: { "health": "on_track|at_risk|delayed|completed", "confidence": number 0-1,',
    '"reasons": string[], "recommendations": string[] }.',
  ].join("\n");

  const ai = await generateValidated(admin, { ...meta, feature: "project_health" }, prompt, healthSchema, "reasoning");

  await admin.from("ai_suggestions").insert({
    organization_id: meta.organizationId,
    user_id: meta.userId,
    project_id: projectId,
    feature: "project_health",
    suggestion: ai,
  });
  await admin.from("activity_logs").insert({
    organization_id: meta.organizationId,
    actor_id: meta.userId,
    action: "ai.suggestion_generated",
    entity_type: "project",
    entity_id: projectId,
    metadata: { feature: "project_health", health: ai.health },
  });
  return { facts, baseline, ai };
}

// ---------------------------------------------------------------------------
// Feature 4: AI Weekly Report
// ---------------------------------------------------------------------------

export interface WeeklyMetrics {
  weekOf: string;
  projects: { total: number; active: number; completed: number };
  tasks: { total: number; open: number; completedThisWeek: number; overdue: number; blocked: number };
  milestones: { completed: number; overdue: number };
  automations: { runsThisWeek: number; failed: number };
}

export async function gatherWeeklyMetrics(
  admin: SupabaseClient,
  organizationId: string
): Promise<WeeklyMetrics> {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 86400000).toISOString();
  const todayStr = today.toISOString().slice(0, 10);

  const [projects, tasks, milestones, runs] = await Promise.all([
    admin.from("projects").select("status, due_date").eq("organization_id", organizationId),
    admin.from("tasks").select("status, due_date, completed_at").eq("organization_id", organizationId),
    admin.from("milestones").select("status, due_date").eq("organization_id", organizationId),
    admin
      .from("automation_runs")
      .select("status, started_at, automations!inner(organization_id)")
      .eq("automations.organization_id", organizationId)
      .gte("started_at", weekAgo),
  ]);

  const p = projects.data ?? [];
  const t = tasks.data ?? [];
  const m = milestones.data ?? [];
  const r = runs.data ?? [];
  const open = t.filter((x) => x.status !== "completed");

  return {
    weekOf: todayStr,
    projects: {
      total: p.length,
      active: p.filter((x) => x.status === "active").length,
      completed: p.filter((x) => x.status === "completed").length,
    },
    tasks: {
      total: t.length,
      open: open.length,
      completedThisWeek: t.filter((x) => x.completed_at && x.completed_at >= weekAgo).length,
      overdue: open.filter((x) => x.due_date && x.due_date < todayStr).length,
      blocked: t.filter((x) => x.status === "blocked").length,
    },
    milestones: {
      completed: m.filter((x) => x.status === "completed").length,
      overdue: m.filter((x) => x.status !== "completed" && x.due_date && x.due_date < todayStr).length,
    },
    automations: {
      runsThisWeek: r.length,
      failed: r.filter((x) => x.status === "failed").length,
    },
  };
}

export async function aiWeeklyReport(
  admin: SupabaseClient,
  meta: { organizationId: string; userId: string | null }
): Promise<{ metrics: WeeklyMetrics; narrative: ProjectSummary }> {
  const metrics = await gatherWeeklyMetrics(admin, meta.organizationId);

  const prompt = [
    "Write a concise weekly operational report for a small organization.",
    "Use ONLY the metrics below — never invent numbers.",
    "",
    "METRICS (database-derived):",
    JSON.stringify(metrics, null, 2),
    "",
    "Return JSON with keys: current_status (2-3 sentence summary), completed_work,",
    "outstanding_work, blockers, risks, recommended_next_steps (all string[]).",
  ].join("\n");

  const narrative = await generateValidated(admin, { ...meta, feature: "weekly_report" }, prompt, summarySchema, "summary");

  await admin.from("ai_suggestions").insert({
    organization_id: meta.organizationId,
    user_id: meta.userId,
    project_id: null,
    feature: "weekly_report",
    suggestion: { metrics, narrative },
  });
  return { metrics, narrative };
}
