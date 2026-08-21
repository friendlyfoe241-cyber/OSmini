import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { requireOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canCreateTasks } from "@/lib/permissions";
import { formatDate, isOverdue, cn } from "@/lib/utils";
import { EmptyState, PageHeader, Avatar } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PriorityBadge, TaskStatusBadge } from "@/components/ui/status";
import { TaskDialog } from "@/components/tasks/task-dialog";
import type { Task } from "@/types";

export const metadata = { title: "Tasks" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; assignee?: string; project?: string; filter?: string }>;
}) {
  const ctx = await requireOrgContext();
  const filters = await searchParams;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from("tasks")
    .select("*, project:projects(name), assignee:profiles!tasks_assignee_id_fkey(full_name)")
    .eq("organization_id", ctx.organization.id)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(300);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.project) query = query.eq("project_id", filters.project);
  if (filters.assignee === "me") query = query.eq("assignee_id", ctx.user.id);
  if (filters.filter === "overdue") {
    query = query.neq("status", "completed").lt("due_date", today);
  }

  const [tasksRes, projectsRes, membersRes] = await Promise.all([
    query,
    supabase.from("projects").select("id, name").eq("organization_id", ctx.organization.id).order("name"),
    supabase
      .from("organization_members")
      .select("user_id, profile:profiles!organization_members_user_id_fkey(full_name)")
      .eq("organization_id", ctx.organization.id),
  ]);

  const tasks = (tasksRes.data ?? []) as Task[];
  const projects = (projectsRes.data ?? []).map((p) => ({ id: p.id, name: p.name }));
  const members = (membersRes.data ?? []).map((m) => ({
    id: m.user_id,
    name: (m.profile as unknown as { full_name: string } | null)?.full_name ?? "Unknown",
  }));

  const quickFilters = [
    { label: "All", href: "/tasks", active: !filters.filter && !filters.assignee && !filters.status },
    { label: "Assigned to me", href: "/tasks?assignee=me", active: filters.assignee === "me" },
    { label: "Overdue", href: "/tasks?filter=overdue", active: filters.filter === "overdue" },
    { label: "Blocked", href: "/tasks?status=blocked", active: filters.status === "blocked" },
    { label: "In progress", href: "/tasks?status=in_progress", active: filters.status === "in_progress" },
    { label: "Completed", href: "/tasks?status=completed", active: filters.status === "completed" },
  ];

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="All tasks across your organization's projects."
        actions={
          canCreateTasks(ctx.role) && projects.length > 0 ? (
            <TaskDialog mode="create" projects={projects} members={members} />
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-1" aria-label="Quick filters">
        {quickFilters.map((f) => (
          <Link
            key={f.label}
            href={f.href}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              f.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="size-8" />}
          title="No tasks found"
          description={projects.length === 0 ? "Create a project first, then add tasks." : "No tasks match this filter."}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead className="hidden md:table-cell">Project</TableHead>
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
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{t.project?.name ?? "—"}</TableCell>
                <TableCell><TaskStatusBadge status={t.status} /></TableCell>
                <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                <TableCell className="hidden md:table-cell">
                  {t.assignee ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar name={t.assignee.full_name} className="size-5 text-[9px]" />
                      <span className="text-sm">{t.assignee.full_name}</span>
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className={cn("text-sm", isOverdue(t.due_date, t.status) ? "font-medium text-red-600" : "text-muted-foreground")}>
                  {formatDate(t.due_date)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
