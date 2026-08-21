import { requireOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WeeklyReportButton } from "@/components/ai/weekly-report-button";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const ctx = await requireOrgContext();
  const supabase = await createClient();
  const orgId = ctx.organization.id;
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [projectsRes, tasksRes, milestonesRes, membersRes, activityRes] = await Promise.all([
    supabase.from("projects").select("id, name, status, due_date, progress").eq("organization_id", orgId),
    supabase.from("tasks").select("id, title, status, due_date, project_id, assignee_id").eq("organization_id", orgId),
    supabase.from("milestones").select("id, name, status, due_date, project_id").eq("organization_id", orgId),
    supabase
      .from("organization_members")
      .select("user_id, profile:profiles!organization_members_user_id_fkey(full_name)")
      .eq("organization_id", orgId),
    supabase
      .from("activity_logs")
      .select("created_at")
      .eq("organization_id", orgId)
      .gte("created_at", thirtyDaysAgo),
  ]);

  const projects = projectsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const milestones = milestonesRes.data ?? [];
  const members = membersRes.data ?? [];

  // --- Project completion report
  const completionRows = projects.map((p) => {
    const pTasks = tasks.filter((t) => t.project_id === p.id);
    const done = pTasks.filter((t) => t.status === "completed").length;
    return {
      id: p.id,
      name: p.name,
      total: pTasks.length,
      completed: done,
      pct: pTasks.length === 0 ? 0 : Math.round((100 * done) / pTasks.length),
    };
  });

  // --- Overdue work report
  const overdueTasks = tasks.filter((t) => t.status !== "completed" && t.due_date && t.due_date < today);
  const overdueProjects = projects.filter((p) => p.due_date && p.due_date < today && p.status !== "completed" && p.status !== "archived");
  const overdueMilestones = milestones.filter((m) => m.status !== "completed" && m.due_date && m.due_date < today);

  // --- People report
  const peopleRows = members.map((m) => {
    const assigned = tasks.filter((t) => t.assignee_id === m.user_id);
    return {
      id: m.user_id,
      name: (m.profile as unknown as { full_name: string } | null)?.full_name ?? "Unknown",
      assigned: assigned.length,
      completed: assigned.filter((t) => t.status === "completed").length,
      open: assigned.filter((t) => t.status !== "completed").length,
    };
  });

  // --- Activity over time (last 30 days, daily counts)
  const activityByDay = new Map<string, number>();
  for (const a of activityRes.data ?? []) {
    const day = a.created_at.slice(0, 10);
    activityByDay.set(day, (activityByDay.get(day) ?? 0) + 1);
  }
  const days: { day: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    days.push({ day: d, count: activityByDay.get(d) ?? 0 });
  }
  const maxCount = Math.max(1, ...days.map((d) => d.count));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="All metrics are computed directly from your database — never AI-generated."
        actions={<WeeklyReportButton />}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Project completion</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Tasks</TableHead>
                  <TableHead>Done</TableHead>
                  <TableHead>%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completionRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="tabular-nums">{r.total}</TableCell>
                    <TableCell className="tabular-nums">{r.completed}</TableCell>
                    <TableCell className="tabular-nums">{r.pct}%</TableCell>
                  </TableRow>
                ))}
                {completionRows.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-muted-foreground">No projects yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Overdue work</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-4 text-center">
              <div>
                <dt className="text-xs text-muted-foreground">Overdue tasks</dt>
                <dd className="text-2xl font-semibold tabular-nums">{overdueTasks.length}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Overdue projects</dt>
                <dd className="text-2xl font-semibold tabular-nums">{overdueProjects.length}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Overdue milestones</dt>
                <dd className="text-2xl font-semibold tabular-nums">{overdueMilestones.length}</dd>
              </div>
            </dl>
            {overdueTasks.length > 0 && (
              <ul className="mt-4 space-y-1 border-t pt-3 text-sm">
                {overdueTasks.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex justify-between">
                    <span className="truncate">{t.title}</span>
                    <span className="text-red-600">{formatDate(t.due_date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">People</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {peopleRows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="tabular-nums">{p.assigned}</TableCell>
                    <TableCell className="tabular-nums">{p.completed}</TableCell>
                    <TableCell className="tabular-nums">{p.open}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Activity — last 30 days</CardTitle></CardHeader>
          <CardContent>
            <div className="flex h-32 items-end gap-0.5" role="img" aria-label="Daily activity counts for the last 30 days">
              {days.map((d) => (
                <div
                  key={d.day}
                  className="flex-1 rounded-t bg-primary/70"
                  style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: d.count > 0 ? "4px" : "1px" }}
                  title={`${d.day}: ${d.count} events`}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {(activityRes.data ?? []).length} events in the last 30 days
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
