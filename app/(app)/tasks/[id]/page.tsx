import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canCreateTasks } from "@/lib/permissions";
import { formatDate, formatDateTime, isOverdue } from "@/lib/utils";
import { Avatar, PageHeader } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge, TaskStatusBadge } from "@/components/ui/status";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { TaskComments } from "@/components/tasks/task-comments";
import { TaskDependencies } from "@/components/tasks/task-dependencies";
import { TaskQuickStatus } from "@/components/tasks/task-quick-status";
import type { Task } from "@/types";

export const metadata = { title: "Task" };

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgContext();
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("*, project:projects(id,name), assignee:profiles!tasks_assignee_id_fkey(full_name), creator:profiles!tasks_creator_id_fkey(full_name)")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (!task) notFound();

  const t = task as Task & {
    project: { id: string; name: string } | null;
    creator: { full_name: string } | null;
  };

  const [commentsRes, depsRes, projectTasksRes, membersRes, projectsRes] = await Promise.all([
    supabase
      .from("task_comments")
      .select("*, author:profiles!task_comments_author_id_fkey(full_name)")
      .eq("task_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("task_dependencies")
      .select("id, depends_on_task_id, depends_on:tasks!task_dependencies_depends_on_task_id_fkey(id, title, status)")
      .eq("task_id", id),
    supabase.from("tasks").select("id, title, status").eq("project_id", t.project_id).neq("id", id),
    supabase
      .from("organization_members")
      .select("user_id, profile:profiles!organization_members_user_id_fkey(full_name)")
      .eq("organization_id", ctx.organization.id),
    supabase.from("projects").select("id, name").eq("organization_id", ctx.organization.id),
  ]);

  const members = (membersRes.data ?? []).map((m) => ({
    id: m.user_id,
    name: (m.profile as unknown as { full_name: string } | null)?.full_name ?? "Unknown",
  }));
  const projects = (projectsRes.data ?? []).map((p) => ({ id: p.id, name: p.name }));

  const deps = (depsRes.data ?? []) as unknown as {
    id: string;
    depends_on_task_id: string;
    depends_on: { id: string; title: string; status: string } | null;
  }[];
  const blockedBy = deps.filter((d) => d.depends_on && d.depends_on.status !== "completed");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={t.title}
        description={t.project ? <>In <Link className="text-primary hover:underline" href={`/projects/${t.project.id}`}>{t.project.name}</Link></> as unknown as string : undefined}
        actions={
          canCreateTasks(ctx.role) ? (
            <TaskDialog mode="edit" task={t} projects={projects} members={members} />
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <TaskStatusBadge status={t.status} />
        <PriorityBadge priority={t.priority} />
        {isOverdue(t.due_date, t.status) && <Badge variant="destructive">Overdue</Badge>}
        {t.labels.map((l) => <Badge key={l} variant="outline">{l}</Badge>)}
        <span className="text-muted-foreground">Due {formatDate(t.due_date)}</span>
      </div>

      {t.description && (
        <Card>
          <CardContent className="p-4 text-sm">{t.description}</CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Assignee</span>
              <span className="inline-flex items-center gap-1.5">
                {t.assignee ? <><Avatar name={t.assignee.full_name} className="size-5 text-[9px]" />{t.assignee.full_name}</> : "Unassigned"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Creator</span>
              <span>{t.creator?.full_name ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{formatDateTime(t.created_at)}</span>
            </div>
            {t.completed_at && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span>{formatDateTime(t.completed_at)}</span>
              </div>
            )}
            <div className="border-t pt-3">
              <TaskQuickStatus taskId={t.id} currentStatus={t.status} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 md:col-span-2">
          <TaskDependencies
            taskId={t.id}
            dependencies={deps}
            blockedBy={blockedBy.map((b) => b.depends_on!)}
            candidates={(projectTasksRes.data ?? []) as { id: string; title: string; status: string }[]}
            canEdit={canCreateTasks(ctx.role)}
          />
          <TaskComments
            taskId={t.id}
            comments={(commentsRes.data ?? []) as never}
            canComment={canCreateTasks(ctx.role)}
          />
        </div>
      </div>
    </div>
  );
}
