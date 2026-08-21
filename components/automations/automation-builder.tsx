"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createAutomation, updateAutomation, type AutomationPayload } from "@/app/(app)/automations/actions";
import { CONDITION_FIELDS, CONDITION_FIELD_LABELS, CONDITION_OPERATORS } from "@/lib/automation/conditions";
import type { Automation, AutomationActionType, AutomationTriggerType } from "@/types";

const TRIGGERS: { value: AutomationTriggerType; label: string; group: string }[] = [
  { value: "task_created", label: "Task created", group: "Tasks" },
  { value: "task_assigned", label: "Task assigned", group: "Tasks" },
  { value: "task_completed", label: "Task completed", group: "Tasks" },
  { value: "task_overdue", label: "Task becomes overdue", group: "Tasks" },
  { value: "task_status_changed", label: "Task status changed", group: "Tasks" },
  { value: "project_created", label: "Project created", group: "Projects" },
  { value: "project_status_changed", label: "Project status changed", group: "Projects" },
  { value: "project_overdue", label: "Project becomes overdue", group: "Projects" },
  { value: "milestone_completed", label: "Milestone completed", group: "Milestones" },
  { value: "milestone_overdue", label: "Milestone becomes overdue", group: "Milestones" },
  { value: "member_added", label: "Member added", group: "People" },
  { value: "application_submitted", label: "Application submitted", group: "People" },
  { value: "application_approved", label: "Application approved", group: "People" },
  { value: "application_rejected", label: "Application rejected", group: "People" },
  { value: "scheduled_daily", label: "Every day", group: "Scheduled" },
  { value: "scheduled_weekly", label: "Every week", group: "Scheduled" },
  { value: "scheduled_monthly", label: "Every month", group: "Scheduled" },
];

const ACTIONS: { value: AutomationActionType; label: string }[] = [
  { value: "send_notification", label: "Send notification" },
  { value: "notify_project_manager", label: "Notify project manager" },
  { value: "assign_task", label: "Assign task" },
  { value: "create_task", label: "Create task" },
  { value: "change_task_status", label: "Change task status" },
  { value: "change_priority", label: "Change priority" },
  { value: "add_label", label: "Add label" },
  { value: "mark_milestone_complete", label: "Mark milestone complete" },
  { value: "create_activity_event", label: "Create activity event" },
  { value: "generate_ai_summary", label: "Generate AI summary" },
  { value: "generate_ai_suggestion", label: "Generate AI suggestion" },
];

interface ConditionRow { field: string; operator: string; value: string }
interface ActionRow { action_type: AutomationActionType; config: Record<string, string> }

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function ActionConfigFields({
  row,
  onChange,
  projects,
  members,
}: {
  row: ActionRow;
  onChange: (config: Record<string, string>) => void;
  projects: { id: string; name: string }[];
  members: { id: string; name: string }[];
}) {
  const set = (key: string, value: string) => onChange({ ...row.config, [key]: value });

  switch (row.action_type) {
    case "send_notification":
      return (
        <div className="grid grid-cols-2 gap-2">
          <Select aria-label="Notification target" value={row.config.target ?? "assignee"} onChange={(e) => set("target", e.target.value)}>
            <option value="assignee">Task assignee</option>
            <option value="creator">Task creator</option>
            <option value="project_manager">Project manager</option>
            <option value="member">The member</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <Input aria-label="Notification title" placeholder="Title" value={row.config.title ?? ""} onChange={(e) => set("title", e.target.value)} />
        </div>
      );
    case "notify_project_manager":
      return (
        <Input aria-label="Notification title" placeholder="Title (optional)" value={row.config.title ?? ""} onChange={(e) => set("title", e.target.value)} />
      );
    case "assign_task":
      return (
        <Select aria-label="Assignee" value={row.config.assignee ?? "creator"} onChange={(e) => set("assignee", e.target.value)}>
          <option value="creator">Task creator</option>
          <option value="project_manager">Project manager</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      );
    case "create_task":
      return (
        <div className="grid grid-cols-2 gap-2">
          <Input aria-label="Task title" placeholder="Task title" value={row.config.title ?? ""} onChange={(e) => set("title", e.target.value)} />
          <Select aria-label="Project" value={row.config.project_id ?? ""} onChange={(e) => set("project_id", e.target.value)}>
            <option value="">Event's project (if any)</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select aria-label="Priority" value={row.config.priority ?? "medium"} onChange={(e) => set("priority", e.target.value)}>
            <option value="low">Low</option><option value="medium">Medium</option>
            <option value="high">High</option><option value="critical">Critical</option>
          </Select>
          <Input aria-label="Due in days" placeholder="Due in days (optional)" type="number" min={0} value={row.config.due_in_days ?? ""} onChange={(e) => set("due_in_days", e.target.value)} />
        </div>
      );
    case "change_task_status":
      return (
        <Select aria-label="New status" value={row.config.status ?? "in_progress"} onChange={(e) => set("status", e.target.value)}>
          <option value="backlog">Backlog</option><option value="todo">Todo</option>
          <option value="in_progress">In Progress</option><option value="blocked">Blocked</option>
          <option value="completed">Completed</option>
        </Select>
      );
    case "change_priority":
      return (
        <Select aria-label="New priority" value={row.config.priority ?? "high"} onChange={(e) => set("priority", e.target.value)}>
          <option value="low">Low</option><option value="medium">Medium</option>
          <option value="high">High</option><option value="critical">Critical</option>
        </Select>
      );
    case "add_label":
      return (
        <Input aria-label="Label" placeholder="Label" value={row.config.label ?? ""} onChange={(e) => set("label", e.target.value)} />
      );
    case "create_activity_event":
      return (
        <div className="grid grid-cols-2 gap-2">
          <Input aria-label="Activity action" placeholder="action name (e.g. milestone.reviewed)" value={row.config.action ?? ""} onChange={(e) => set("action", e.target.value)} />
          <Input aria-label="Note" placeholder="Note (optional)" value={row.config.note ?? ""} onChange={(e) => set("note", e.target.value)} />
        </div>
      );
    default:
      return null;
  }
}

export function AutomationBuilder({
  automation,
  projects,
  members,
}: {
  automation?: Automation;
  projects: { id: string; name: string }[];
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState(automation?.name ?? "");
  const [description, setDescription] = React.useState(automation?.description ?? "");
  const [trigger, setTrigger] = React.useState<AutomationTriggerType>(automation?.trigger_type ?? "task_overdue");
  const [scheduleHour, setScheduleHour] = React.useState(String((automation?.trigger_config?.hour as number) ?? 9));
  const [scheduleWeekday, setScheduleWeekday] = React.useState(String((automation?.trigger_config?.weekday as number) ?? 1));
  const [scheduleDay, setScheduleDay] = React.useState(String((automation?.trigger_config?.day_of_month as number) ?? 1));
  const [logic, setLogic] = React.useState<"AND" | "OR">(automation?.condition_logic ?? "AND");
  const [conditions, setConditions] = React.useState<ConditionRow[]>(
    (automation?.conditions ?? []).map((c) => ({ field: c.field, operator: c.operator, value: c.value ?? "" }))
  );
  const [actions, setActions] = React.useState<ActionRow[]>(
    (automation?.actions ?? []).map((a) => ({ action_type: a.action_type, config: (a.config ?? {}) as Record<string, string> }))
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isScheduled = trigger.startsWith("scheduled_");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const trigger_config: Record<string, unknown> = {};
    if (trigger === "scheduled_daily") trigger_config.hour = Number(scheduleHour);
    if (trigger === "scheduled_weekly") { trigger_config.hour = Number(scheduleHour); trigger_config.weekday = Number(scheduleWeekday); }
    if (trigger === "scheduled_monthly") { trigger_config.hour = Number(scheduleHour); trigger_config.day_of_month = Number(scheduleDay); }

    const payload: AutomationPayload = {
      name,
      description,
      trigger_type: trigger,
      trigger_config,
      condition_logic: logic,
      enabled: automation?.enabled ?? true,
      conditions: conditions.filter((c) => c.operator === "is_overdue" || c.value),
      actions,
    };

    const result = automation
      ? await updateAutomation(automation.id, payload)
      : await createAutomation(payload);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    toast(automation ? "Automation updated" : "Automation created");
    router.push(automation ? `/automations/${automation.id}` : "/automations");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ab-name">Name</Label>
          <Input id="ab-name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} placeholder="Overdue task escalation" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ab-desc">Description (optional)</Label>
          <Input id="ab-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      <section className="rounded-lg border p-4" aria-label="Trigger">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">When</h3>
        <Select aria-label="Trigger" value={trigger} onChange={(e) => setTrigger(e.target.value as AutomationTriggerType)}>
          {["Tasks", "Projects", "Milestones", "People", "Scheduled"].map((group) => (
            <optgroup key={group} label={group}>
              {TRIGGERS.filter((t) => t.group === group).map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </optgroup>
          ))}
        </Select>
        {isScheduled && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {trigger === "scheduled_weekly" && (
              <Select aria-label="Weekday" className="w-auto" value={scheduleWeekday} onChange={(e) => setScheduleWeekday(e.target.value)}>
                {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </Select>
            )}
            {trigger === "scheduled_monthly" && (
              <span className="flex items-center gap-2">
                on day
                <Input aria-label="Day of month" className="w-20" type="number" min={1} max={28} value={scheduleDay} onChange={(e) => setScheduleDay(e.target.value)} />
              </span>
            )}
            <span className="flex items-center gap-2">
              at
              <Input aria-label="Hour (UTC)" className="w-20" type="number" min={0} max={23} value={scheduleHour} onChange={(e) => setScheduleHour(e.target.value)} />
              :00 UTC
            </span>
          </div>
        )}
      </section>

      <div className="flex justify-center" aria-hidden><ArrowDown className="size-4 text-muted-foreground" /></div>

      <section className="rounded-lg border p-4" aria-label="Conditions">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            If <span className="text-xs font-normal">(optional)</span>
          </h3>
          {conditions.length > 1 && (
            <Select aria-label="Condition logic" className="w-28" value={logic} onChange={(e) => setLogic(e.target.value as "AND" | "OR")}>
              <option value="AND">All (AND)</option>
              <option value="OR">Any (OR)</option>
            </Select>
          )}
        </div>
        <div className="space-y-2">
          {conditions.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Select aria-label={`Condition ${i + 1} field`} className="w-40" value={c.field} onChange={(e) => setConditions((prev) => prev.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))}>
                {CONDITION_FIELDS.map((f) => <option key={f} value={f}>{CONDITION_FIELD_LABELS[f]}</option>)}
              </Select>
              <Select aria-label={`Condition ${i + 1} operator`} className="w-44" value={c.operator} onChange={(e) => setConditions((prev) => prev.map((x, j) => (j === i ? { ...x, operator: e.target.value } : x)))}>
                {CONDITION_OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
              {c.operator !== "is_overdue" && (
                <Input aria-label={`Condition ${i + 1} value`} className="w-40" placeholder="Value" value={c.value} onChange={(e) => setConditions((prev) => prev.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
              )}
              <Button variant="ghost" size="icon" onClick={() => setConditions((prev) => prev.filter((_, j) => j !== i))} aria-label="Remove condition">
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setConditions((prev) => [...prev, { field: "priority", operator: "eq", value: "high" }])}>
          <Plus aria-hidden /> Add condition
        </Button>
      </section>

      <div className="flex justify-center" aria-hidden><ArrowDown className="size-4 text-muted-foreground" /></div>

      <section className="rounded-lg border p-4" aria-label="Actions">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Then</h3>
        <div className="space-y-3">
          {actions.map((a, i) => (
            <div key={i} className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Select aria-label={`Action ${i + 1} type`} className="flex-1" value={a.action_type} onChange={(e) => setActions((prev) => prev.map((x, j) => (j === i ? { action_type: e.target.value as AutomationActionType, config: {} } : x)))}>
                  {ACTIONS.map((ac) => <option key={ac.value} value={ac.value}>{ac.label}</option>)}
                </Select>
                <Button variant="ghost" size="icon" onClick={() => setActions((prev) => prev.filter((_, j) => j !== i))} aria-label="Remove action">
                  <Trash2 />
                </Button>
              </div>
              <div className="mt-2">
                <ActionConfigFields
                  row={a}
                  onChange={(config) => setActions((prev) => prev.map((x, j) => (j === i ? { ...x, config } : x)))}
                  projects={projects}
                  members={members}
                />
              </div>
              {i < actions.length - 1 && (
                <p className="mt-2 text-center text-xs text-muted-foreground" aria-hidden>AND ↓</p>
              )}
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setActions((prev) => [...prev, { action_type: "send_notification", config: { target: "assignee" } }])}>
          <Plus aria-hidden /> Add action
        </Button>
      </section>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={loading || actions.length === 0}>
          {loading ? "Saving…" : automation ? "Save changes" : "Create automation"}
        </Button>
      </div>
    </form>
  );
}
