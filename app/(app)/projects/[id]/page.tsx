import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManageProjects, canCreateTasks } from "@/lib/permissions";
import { formatDate, formatRelative, isOverdue } from "@/lib/utils";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PriorityBadge, ProjectStatusBadge, TaskStatusBadge } from "@/components/ui/status";
import { Badge } from "@/components/ui/badge";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { AiProjectPanel } from "@/components/ai/ai-panel";
import { ProjectControls } from "@/components/projects/project-controls";
import { MilestoneManager } from "@/components/projects/milestone-manager";
import { ProjectMemberManager } from "@/components/projects/project-member-manager";
import { DocumentManager } from "@/components/documents/document-manager";
import type { Milestone, Task } from "@/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Project" };

const TABS = ["overview", "tasks", "milestones", "people", "documents", "activity"] as const;
type Tab = (typeof TABS)[number];

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const ctx = await requireOrgContext();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*, owner:profiles!projects_owner_id_fkey(full_name)")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (!project) notFound();

  const [tasksRes, membersRes, orgMembersRes, milestonesRes, activityRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, assignee:profiles!tasks_assignee_id_fkey(full_name)")
      .eq("project_id", id)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("project_members")
      .select("user_id, role, profile:profiles!project_members_user_id_fkey(full_name,email)")
      .eq("project_id", id),
    supabase
      .from("organization_members")
      .select("user_id, profile:profiles!organization_members_user_id_fkey(full_name)")
      .eq("organization_id", ctx.organization.id),
    supabase
      .from("milestones")
      .select("*, milestone_tasks(task_id, tasks(id, title, status))")
      .eq("project_id", id)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("activity_logs")
      .select("*, actor:profiles!activity_logs_actor_id_fkey(full_name)")
      .eq("organization_id", ctx.organization.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const tasks = (tasksRes.data ?? []) as Task[];
  const milestones = (milestonesRes.data ?? []) as (Milestone & {
    milestone_tasks: { task_id: string; tasks: { id: string; title: string; status: string } | null }[];
  })[];
  const orgMembers = (orgMembersRes.data ?? []).map((m) => ({
    id: m.user_id,
    name: (m.profile as unknown as { full_name: string } | null)?.full_name ?? "Unknown",
  }));
  const projects = [{ id: project.id, name: project.name }];
  const openTasks = tasks.filter((t) => t.status !== "completed");
  const overdueCount = openTasks.filter((t) => isOverdue(t.due_date, t.status)).length;

  // Activity for this project: project events + its task/milestone events.
  const taskIds = new Set(tasks.map((t) => t.id));
  const milestoneIds = new Set(milestones.map((m) => m.id));
  const projectActivity = (activityRes.data ?? []).filter((a) =>
    a.entity_id === id || taskIds.has(a.entity_id ?? "") || milestoneIds.has(a.entity_id ?? "")
  ).slice(0, 20);

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        actions={
          canManageProjects(ctx.role) ? (
            <ProjectControls project={project} members={orgMembers} />
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ProjectStatusBadge status={project.status} />
        <PriorityBadge priority={project.priority} />
        {project.owner && (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Avatar name={project.owner.full_name} className="size-5 text-[9px]" />
            {project.owner.full_name}
          </span>
        )}
        <span className="text-muted-foreground">Due {formatDate(project.due_date)}</span>
        {overdueCount > 0 && (
          <Badge variant="destructive">{overdueCount} overdue</Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={project.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Project progress">
            <div className="h-full bg-primary" style={{ width: `${project.progress}%` }} />
          </div>
          <span className="text-xs text-muted-foreground">{project.progress}%</span>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b" role="tablist" aria-label="Project sections">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/projects/${id}?tab=${t}`}
            role="tab"
            aria-selected={tab === t}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium capitalize",
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Status</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted-foreground">Total tasks</dt><dd className="text-lg font-semibold">{tasks.length}</dd></div>
                <div><dt className="text-muted-foreground">Open</dt><dd className="text-lg font-semibold">{openTasks.length}</dd></div>
                <div><dt className="text-muted-foreground">Blocked</dt><dd className="text-lg font-semibold">{openTasks.filter((t) => t.status === "blocked").length}</dd></div>
                <div><dt className="text-muted-foreground">Overdue</dt><dd className="text-lg font-semibold">{overdueCount}</dd></div>
                <div><dt className="text-muted-foreground">Milestones</dt><dd className="text-lg font-semibold">{milestones.length}</dd></div>
                <div><dt className="text-muted-foreground">Team</dt><dd className="text-lg font-semibold">{(membersRes.data ?? []).length}</dd></div>
              </dl>
            </CardContent>
          </Card>
          <AiProjectPanel projectId={id} />
        </div>
      )}

      {tab === "tasks" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            {canCreateTasks(ctx.role) && (
              <TaskDialog mode="create" projects={projects} members={orgMembers} defaultProjectId={id} />
            )}
          </div>
          {tasks.length === 0 ? (
            <EmptyState title="No tasks yet" description="Create the first task for this project." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="hidden md:table-cell">Assignee</TableHead>
                  <TableHead>Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link href={`/tasks/${t.id}`} className="font-medium hover:underline">{t.title}</Link>
                      {t.labels.length > 0 && (
                        <span className="ml-2 inline-flex gap-1">
                          {t.labels.map((l) => <Badge key={l} variant="outline">{l}</Badge>)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell><TaskStatusBadge status={t.status} /></TableCell>
                    <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                    <TableCell className="hidden md:table-cell">{t.assignee?.full_name ?? "—"}</TableCell>
                    <TableCell className={cn("text-sm", isOverdue(t.due_date, t.status) ? "font-medium text-red-600" : "text-muted-foreground")}>
                      {formatDate(t.due_date)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {tab === "milestones" && (
        <MilestoneManager
          projectId={id}
          milestones={milestones}
          tasks={tasks.map((t) => ({ id: t.id, title: t.title, status: t.status }))}
          canManage={canManageProjects(ctx.role)}
        />
      )}

      {tab === "people" && (
        <ProjectMemberManager
          projectId={id}
          projectMembers={(membersRes.data ?? []).map((m) => ({
            userId: m.user_id,
            role: m.role,
            name: (m.profile as unknown as { full_name: string } | null)?.full_name ?? "Unknown",
            email: (m.profile as unknown as { email: string } | null)?.email ?? "",
          }))}
          orgMembers={orgMembers}
          canManage={canManageProjects(ctx.role) || project.owner_id === ctx.user.id}
        />
      )}

      {tab === "documents" && (
        <DocumentManager organizationId={ctx.organization.id} projectId={id} />
      )}

      {tab === "activity" && (
        <Card>
          <CardHeader><CardTitle>Project activity</CardTitle></CardHeader>
          <CardContent>
            {projectActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded for this project yet.</p>
            ) : (
              <ul className="space-y-3">
                {projectActivity.map((a) => (
                  <li key={a.id} className="flex items-start gap-2.5 text-sm">
                    <Avatar name={a.actor?.full_name ?? "OSmini"} className="size-6 text-[10px]" />
                    <div>
                      <p>
                        <span className="font-medium">{a.actor?.full_name ?? "Automation"}</span>{" "}
                        <span className="text-muted-foreground">{a.action.replaceAll(".", " ")}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{formatRelative(a.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
