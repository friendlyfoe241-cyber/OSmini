import Link from "next/link";
import { Workflow } from "lucide-react";
import { requireOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManageAutomations } from "@/lib/permissions";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AutomationRowControls } from "@/components/automations/automation-row-controls";
import type { Automation } from "@/types";

export const metadata = { title: "Automations" };

const TRIGGER_LABELS: Record<string, string> = {
  task_created: "Task created",
  task_assigned: "Task assigned",
  task_completed: "Task completed",
  task_overdue: "Task becomes overdue",
  task_status_changed: "Task status changed",
  project_created: "Project created",
  project_status_changed: "Project status changed",
  project_overdue: "Project becomes overdue",
  milestone_completed: "Milestone completed",
  milestone_overdue: "Milestone becomes overdue",
  member_added: "Member added",
  application_submitted: "Application submitted",
  application_approved: "Application approved",
  application_rejected: "Application rejected",
  scheduled_daily: "Every day",
  scheduled_weekly: "Every week",
  scheduled_monthly: "Every month",
};

export default async function AutomationsPage() {
  const ctx = await requireOrgContext();
  const supabase = await createClient();
  const canManage = canManageAutomations(ctx.role);

  const { data: automations } = await supabase
    .from("automations")
    .select("*, actions:automation_actions(count), runs:automation_runs(count)")
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: false });

  const rows = (automations ?? []) as (Automation & {
    actions: { count: number }[];
    runs: { count: number }[];
  })[];

  return (
    <div>
      <PageHeader
        title="Automations"
        description="Event-driven rules that handle repetitive operational work."
        actions={canManage ? <Link href="/automations/new"><Button>New automation</Button></Link> : undefined}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Workflow className="size-8" />}
          title="No automations yet"
          description="WHEN something happens → IF conditions match → THEN actions run."
          action={canManage ? <Link href="/automations/new" className="text-sm font-medium text-primary hover:underline">Create your first automation</Link> : undefined}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Actions</TableHead>
              <TableHead>Runs</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead aria-label="Controls" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Link href={`/automations/${a.id}`} className="font-medium hover:underline">{a.name}</Link>
                  {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                </TableCell>
                <TableCell className="text-sm">{TRIGGER_LABELS[a.trigger_type] ?? a.trigger_type}</TableCell>
                <TableCell className="tabular-nums">{a.actions?.[0]?.count ?? 0}</TableCell>
                <TableCell className="tabular-nums">{a.runs?.[0]?.count ?? 0}</TableCell>
                <TableCell>
                  <Badge variant={a.enabled ? "success" : "secondary"}>{a.enabled ? "Enabled" : "Disabled"}</Badge>
                </TableCell>
                {canManage && (
                  <TableCell>
                    <AutomationRowControls automation={a} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
