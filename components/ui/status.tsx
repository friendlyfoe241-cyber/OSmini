import { Badge } from "./badge";
import type { Priority, ProjectHealth, ProjectStatus, TaskStatus } from "@/types";

// Status indicators always pair color with a text label (never color alone).

const taskStatusVariant: Record<TaskStatus, "secondary" | "info" | "warning" | "destructive" | "success"> = {
  backlog: "secondary",
  todo: "info",
  in_progress: "warning",
  blocked: "destructive",
  completed: "success",
};

const taskStatusLabel: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  blocked: "Blocked",
  completed: "Completed",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant={taskStatusVariant[status]}>{taskStatusLabel[status]}</Badge>;
}

const priorityVariant: Record<Priority, "secondary" | "info" | "warning" | "destructive"> = {
  low: "secondary",
  medium: "info",
  high: "warning",
  critical: "destructive",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge variant={priorityVariant[priority]}>{priority[0].toUpperCase() + priority.slice(1)}</Badge>;
}

const projectStatusLabel: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
};

const projectStatusVariant: Record<ProjectStatus, "secondary" | "info" | "warning" | "success" | "outline"> = {
  planning: "secondary",
  active: "info",
  paused: "warning",
  completed: "success",
  archived: "outline",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge variant={projectStatusVariant[status]}>{projectStatusLabel[status]}</Badge>;
}

const healthVariant: Record<ProjectHealth, "success" | "warning" | "destructive" | "info"> = {
  on_track: "success",
  at_risk: "warning",
  delayed: "destructive",
  completed: "info",
};

const healthLabel: Record<ProjectHealth, string> = {
  on_track: "On track",
  at_risk: "At risk",
  delayed: "Delayed",
  completed: "Completed",
};

export function HealthBadge({ health }: { health: ProjectHealth }) {
  return <Badge variant={healthVariant[health]}>{healthLabel[health]}</Badge>;
}
