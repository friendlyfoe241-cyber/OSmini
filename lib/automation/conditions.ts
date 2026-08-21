import type { AutomationCondition } from "@/types";

// Pure condition evaluation against an entity snapshot.
// Entities are plain row objects (task, project, milestone, member, application).

export interface ConditionResult {
  passed: boolean;
  detail: string;
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function evaluateCondition(
  condition: Pick<AutomationCondition, "field" | "operator" | "value">,
  entity: Record<string, unknown>
): boolean {
  const fieldValue = entity[condition.field];
  const value = condition.value ?? "";

  switch (condition.operator) {
    case "eq":
      return String(fieldValue ?? "") === value;
    case "neq":
      return String(fieldValue ?? "") !== value;
    case "lt":
      return Number(fieldValue) < Number(value);
    case "lte":
      return Number(fieldValue) <= Number(value);
    case "gt":
      return Number(fieldValue) > Number(value);
    case "gte":
      return Number(fieldValue) >= Number(value);
    case "within_days": {
      const days = daysUntil(fieldValue as string | null);
      return days !== null && days >= 0 && days <= Number(value);
    }
    case "is_overdue": {
      const due = entity.due_date as string | null | undefined;
      const status = entity.status as string | undefined;
      if (!due) return false;
      if (status === "completed" || status === "archived") return false;
      const days = daysUntil(due);
      return days !== null && days < 0;
    }
    default:
      return false;
  }
}

export function evaluateConditions(
  conditions: Pick<AutomationCondition, "field" | "operator" | "value">[],
  entity: Record<string, unknown>,
  logic: "AND" | "OR"
): boolean {
  if (conditions.length === 0) return true;
  const results = conditions.map((c) => evaluateCondition(c, entity));
  return logic === "OR" ? results.some(Boolean) : results.every(Boolean);
}

// Human-readable description of a condition for the UI.
export function describeCondition(
  condition: Pick<AutomationCondition, "field" | "operator" | "value">
): string {
  const fieldLabel = CONDITION_FIELD_LABELS[condition.field] ?? condition.field;
  switch (condition.operator) {
    case "eq": return `${fieldLabel} = ${condition.value}`;
    case "neq": return `${fieldLabel} ≠ ${condition.value}`;
    case "lt": return `${fieldLabel} < ${condition.value}`;
    case "lte": return `${fieldLabel} ≤ ${condition.value}`;
    case "gt": return `${fieldLabel} > ${condition.value}`;
    case "gte": return `${fieldLabel} ≥ ${condition.value}`;
    case "within_days": return `${fieldLabel} within ${condition.value} days`;
    case "is_overdue": return `${fieldLabel} is overdue`;
    default: return `${fieldLabel} ${condition.operator} ${condition.value}`;
  }
}

export const CONDITION_FIELDS = [
  "priority",
  "status",
  "project_id",
  "assignee_id",
  "due_date",
  "role",
] as const;

export const CONDITION_FIELD_LABELS: Record<string, string> = {
  priority: "Priority",
  status: "Status",
  project_id: "Project",
  assignee_id: "Assignee",
  due_date: "Due date",
  role: "Member role",
};

export const CONDITION_OPERATORS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "does not equal" },
  { value: "lt", label: "is less than" },
  { value: "lte", label: "is at most" },
  { value: "gt", label: "is greater than" },
  { value: "gte", label: "is at least" },
  { value: "within_days", label: "is due within (days)" },
  { value: "is_overdue", label: "is overdue" },
] as const;
