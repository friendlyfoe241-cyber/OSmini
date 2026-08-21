import Link from "next/link";
import { AlertTriangle, Ban, CalendarClock, FolderKanban, CheckSquare, Users, ArrowRight } from "lucide-react";
import { requireOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatRelative, isOverdue } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Avatar } from "@/components/ui/misc";
import { HealthBadge, PriorityBadge, TaskStatusBadge } from "@/components/ui/status";
import type { ProjectHealth, Task } from "@/types";

export const metadata = { title: "Dashboard" };

interface ProjectHealthRow {
  id: string;
  name: string;
  status: string;
  progress: number;
  due_date: string | null;
  overdue: number;
  nextMilestone: string | null;
  health: ProjectHealth;
}

export default async function DashboardPage() {
  const ctx = await requireOrgContext();
  const supabase = await createClient();
  const orgId = ctx.organization.id;
  const today = new Date().toISOString().slice(0, 10);
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  const [projectsRes, tasksRes, membersRes, activityRes, milestonesRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status, progress, due_date, owner:profiles!projects_owner_id_fkey(full_name)")
      .eq("organization_id", orgId)
      .neq("status", "archived")
      .order("updated_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_date, project_id, assignee_id, project:projects(name), assignee:profiles!tasks_assignee_id_fkey(full_name)")
      .eq("organization_id", orgId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(500),
    supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase
      .from("activity_logs")
      .select("*, actor:profiles!activity_logs_actor_id_fkey(full_name)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("milestones")
      .select("id, name, status, due_date, project_id")
      .eq("organization_id", orgId)
      .neq("status", "completed")
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  const projects = projectsRes.data ?? [];
  const tasks = (tasksRes.data ?? []) as unknown as (Task & { project: { name: string } | null })[];
  const openTasks = tasks.filter((t) => t.status !== "completed");
  const overdueTasks = openTasks.filter((t) => isOverdue(t.due_date, t.status));
  const blockedTasks = openTasks.filter((t) => t.status === "blocked");
  const upcoming = openTasks.filter((t) => t.due_date && t.due_date >= today && t.due_date <= in14);

  const projectRows: ProjectHealthRow[] = projects.map((p) => {
    const pTasks = tasks.filter((t) => t.project_id === p.id);
    const overdue = pTasks.filter((t) => isOverdue(t.due_date, t.status)).length;
    const blocked = pTasks.filter((t) => t.status === "blocked").length;
    const nextMilestone =
      (milestonesRes.data ?? []).find((m) => m.project_id === p.id)?.name ?? null;
    let health: ProjectHealth = "on_track";
    if (p.status === "completed") health = "completed";
    else if ((p.due_date && p.due_date < today && p.status !== "completed") || (overdue > 0 && blocked > 0))
      health = "delayed";
    else if (overdue > 0 || blocked > 0) health = "at_risk";
    return { id: p.id, name: p.name, status: p.status, progress: p.progress, due_date: p.due_date, overdue, nextMilestone, health };
  });

  const activeProjects = projects.filter((p) => p.status === "active").length;
  const atRisk = projectRows.filter((p) => p.health === "at_risk" || p.health === "delayed");

  const stats = [
    { label: "Active projects", value: activeProjects, icon: FolderKanban },
    { label: "Open tasks", value: openTasks.length, icon: CheckSquare },
    { label: "Overdue tasks", value: overdueTasks.length, icon: AlertTriangle, alert: overdueTasks.length > 0 },
    { label: "Upcoming deadlines", value: upcoming.length, icon: CalendarClock },
    { label: "Active members", value: membersRes.count ?? 0, icon: Users },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good day${ctx.profile.full_name ? `, ${ctx.profile.full_name.split(" ")[0]}` : ""}`}
        description={`Here's what needs attention in ${ctx.organization.name}.`}
      />

      {/* Overview stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <s.icon className={s.alert ? "size-5 text-red-600" : "size-5 text-muted-foreground"} aria-hidden />
              <div>
                <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Attention section */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" aria-hidden />
              Needs attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {overdueTasks.length === 0 && blockedTasks.length === 0 && atRisk.length === 0 && upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing needs attention right now. Nice work.
              </p>
            ) : (
              <>
                {overdueTasks.length > 0 && (
                  <section aria-label="Overdue tasks">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">
                      Overdue tasks ({overdueTasks.length})
                    </h3>
                    <ul className="divide-y rounded-md border">
                      {overdueTasks.slice(0, 5).map((t) => (
                        <li key={t.id}>
                          <Link href={`/tasks/${t.id}`} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent/50">
                            <span className="flex-1 truncate font-medium">{t.title}</span>
                            <span className="hidden text-xs text-muted-foreground sm:inline">{t.project?.name}</span>
                            <PriorityBadge priority={t.priority} />
                            <span className="text-xs font-medium text-red-600">due {formatDate(t.due_date)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {blockedTasks.length > 0 && (
                  <section aria-label="Blocked tasks">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">
                      Blocked tasks ({blockedTasks.length})
                    </h3>
                    <ul className="divide-y rounded-md border">
                      {blockedTasks.slice(0, 3).map((t) => (
                        <li key={t.id}>
                          <Link href={`/tasks/${t.id}`} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent/50">
                            <Ban className="size-3.5 text-red-600" aria-hidden />
                            <span className="flex-1 truncate">{t.title}</span>
                            <span className="text-xs text-muted-foreground">{t.project?.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {atRisk.length > 0 && (
                  <section aria-label="At-risk projects">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Projects at risk ({atRisk.length})
                    </h3>
                    <ul className="divide-y rounded-md border">
                      {atRisk.map((p) => (
                        <li key={p.id}>
                          <Link href={`/projects/${p.id}`} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent/50">
                            <span className="flex-1 truncate font-medium">{p.name}</span>
                            <HealthBadge health={p.health} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {upcoming.length > 0 && (
                  <section aria-label="Upcoming deadlines">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Upcoming deadlines ({upcoming.length})
                    </h3>
                    <ul className="divide-y rounded-md border">
                      {upcoming.slice(0, 4).map((t) => (
                        <li key={t.id}>
                          <Link href={`/tasks/${t.id}`} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent/50">
                            <span className="flex-1 truncate">{t.title}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(t.due_date)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Recent activity
              <Link href="/activity" className="text-xs font-normal text-primary hover:underline">
                View all
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(activityRes.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {(activityRes.data ?? []).slice(0, 8).map((a) => (
                  <li key={a.id} className="flex items-start gap-2.5 text-sm">
                    <Avatar name={a.actor?.full_name ?? "OSmini"} className="size-6 text-[10px]" />
                    <div className="min-w-0">
                      <p className="leading-snug">
                        <span className="font-medium">{a.actor?.full_name ?? "Automation"}</span>{" "}
                        <span className="text-muted-foreground">{describeAction(a.action, a.metadata)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{formatRelative(a.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Project health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Project health
            <Link href="/projects" className="inline-flex items-center gap-1 text-xs font-normal text-primary hover:underline">
              All projects <ArrowRight className="size-3" aria-hidden />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projectRows.length === 0 ? (
            <EmptyState
              title="No projects yet"
              description="Create your first project to start tracking work."
              action={<Link href="/projects" className="text-sm font-medium text-primary hover:underline">Go to Projects</Link>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Project</th>
                    <th className="py-2 pr-4 font-medium">Progress</th>
                    <th className="py-2 pr-4 font-medium">Health</th>
                    <th className="hidden py-2 pr-4 font-medium sm:table-cell">Overdue</th>
                    <th className="hidden py-2 pr-4 font-medium md:table-cell">Next milestone</th>
                    <th className="hidden py-2 font-medium md:table-cell">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {projectRows.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/40">
                      <td className="py-2.5 pr-4">
                        <Link href={`/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name} progress`}>
                            <div className="h-full bg-primary" style={{ width: `${p.progress}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{p.progress}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4"><HealthBadge health={p.health} /></td>
                      <td className="hidden py-2.5 pr-4 sm:table-cell">
                        {p.overdue > 0 ? (
                          <span className="text-xs font-medium text-red-600">{p.overdue} overdue</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="hidden py-2.5 pr-4 text-muted-foreground md:table-cell">{p.nextMilestone ?? "—"}</td>
                      <td className="hidden py-2.5 text-muted-foreground md:table-cell">{formatDate(p.due_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function describeAction(action: string, metadata: Record<string, unknown>): string {
  const meta = (metadata ?? {}) as Record<string, string | undefined>;
  switch (action) {
    case "task.completed": return `completed "${meta.title ?? "a task"}"`;
    case "task.assigned": return `was assigned "${meta.title ?? "a task"}"`;
    case "milestone.completed": return `milestone completed: ${meta.name ?? ""}`;
    case "project.created": return `created project "${meta.name ?? ""}"`;
    case "automation.executed": return `automation "${meta.automation ?? ""}" executed successfully`;
    case "automation.failed": return `automation "${meta.automation ?? ""}" failed`;
    case "ai.suggestion_generated": return `AI ${(meta.feature ?? "suggestion").replaceAll("_", " ")} generated`;
    case "member.added": return "joined the organization";
    case "application.submitted": return "submitted an application";
    default: return action.replaceAll(".", " ");
  }
}
