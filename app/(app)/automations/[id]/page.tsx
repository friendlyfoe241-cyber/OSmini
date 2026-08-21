import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManageAutomations } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutomationBuilder } from "@/components/automations/automation-builder";
import { TestAutomationButton } from "@/components/automations/test-automation-button";
import { describeCondition } from "@/lib/automation/conditions";
import type { Automation, AutomationRun } from "@/types";

export const metadata = { title: "Automation" };

export default async function AutomationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const ctx = await requireOrgContext();
  const supabase = await createClient();
  const canManage = canManageAutomations(ctx.role);

  const { data: automation } = await supabase
    .from("automations")
    .select("*, conditions:automation_conditions(*), actions:automation_actions(*)")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (!automation) notFound();

  const { data: runs } = await supabase
    .from("automation_runs")
    .select("*")
    .eq("automation_id", id)
    .order("started_at", { ascending: false })
    .limit(50);

  const [projectsRes, membersRes] = await Promise.all([
    supabase.from("projects").select("id, name").eq("organization_id", ctx.organization.id).order("name"),
    supabase
      .from("organization_members")
      .select("user_id, profile:profiles!organization_members_user_id_fkey(full_name)")
      .eq("organization_id", ctx.organization.id),
  ]);

  const a = automation as Automation;
  const sortedConditions = [...(a.conditions ?? [])].sort((x, y) => x.sort_order - y.sort_order);
  const sortedActions = [...(a.actions ?? [])].sort((x, y) => x.sort_order - y.sort_order);

  if (edit === "true" && canManage) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={`Edit: ${a.name}`} />
        <AutomationBuilder
          automation={a}
          projects={projectsRes.data ?? []}
          members={(membersRes.data ?? []).map((m) => ({
            id: m.user_id,
            name: (m.profile as unknown as { full_name: string } | null)?.full_name ?? "Unknown",
          }))}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={a.name}
        description={a.description ?? undefined}
        actions={
          <div className="flex gap-2">
            <TestAutomationButton automationId={a.id} />
            {canManage && (
              <Link
                href={`/automations/${a.id}?edit=true`}
                className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
              >
                Edit
              </Link>
            )}
          </div>
        }
      />

      <div className="flex items-center gap-2">
        <Badge variant={a.enabled ? "success" : "secondary"}>{a.enabled ? "Enabled" : "Disabled"}</Badge>
        <Badge variant="outline">{a.trigger_type.replaceAll("_", " ")}</Badge>
      </div>

      {/* Visual flow */}
      <Card>
        <CardHeader><CardTitle className="text-base">Flow</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-0">
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">When</p>
              <p className="mt-1 text-sm font-medium">{a.trigger_type.replaceAll("_", " ")}</p>
              {a.trigger_type.startsWith("scheduled_") && (
                <p className="text-xs text-muted-foreground">
                  {a.trigger_type === "scheduled_weekly" &&
                    `weekday ${a.trigger_config.weekday ?? 1}, `}
                  {a.trigger_type === "scheduled_monthly" &&
                    `day ${a.trigger_config.day_of_month ?? 1}, `}
                  at {String(a.trigger_config.hour ?? 9).padStart(2, "0")}:00 UTC
                </p>
              )}
            </div>
            {sortedConditions.length > 0 && (
              <>
                <p className="py-1 text-center text-xs text-muted-foreground" aria-hidden>↓</p>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    If ({a.condition_logic})
                  </p>
                  <ul className="mt-1 space-y-0.5 text-sm">
                    {sortedConditions.map((c) => (
                      <li key={c.id}>• {describeCondition(c)}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
            <p className="py-1 text-center text-xs text-muted-foreground" aria-hidden>↓</p>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Then</p>
              <ul className="mt-1 space-y-0.5 text-sm">
                {sortedActions.map((act) => (
                  <li key={act.id}>• {act.action_type.replaceAll("_", " ")}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Execution history */}
      <Card>
        <CardHeader><CardTitle className="text-base">Execution history</CardTitle></CardHeader>
        <CardContent>
          {(runs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No runs yet. Runs appear here when matching events are processed by the scheduler.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead className="hidden md:table-cell">Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(runs as AutomationRun[]).map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <Badge
                        variant={
                          run.status === "successful" ? "success"
                          : run.status === "failed" ? "destructive"
                          : run.status === "skipped" ? "secondary"
                          : "info"
                        }
                      >
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatDateTime(run.started_at)}</TableCell>
                    <TableCell className="tabular-nums">{run.actions_executed}</TableCell>
                    <TableCell className="hidden max-w-xs truncate text-sm text-muted-foreground md:table-cell">
                      {run.error_message ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
