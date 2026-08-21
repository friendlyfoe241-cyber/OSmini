// Database row types mirroring supabase/migrations/001_initial_schema.sql

export type OrganizationType =
  | "student_org" | "nonprofit" | "volunteer" | "research"
  | "school_club" | "community" | "startup" | "small_business" | "other";

export type OrgRole = "owner" | "admin" | "project_manager" | "member" | "viewer";

export type ProjectStatus = "planning" | "active" | "paused" | "completed" | "archived";
export type Priority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "backlog" | "todo" | "in_progress" | "blocked" | "completed";
export type MilestoneStatus = "pending" | "in_progress" | "completed" | "overdue";
export type ProjectHealth = "on_track" | "at_risk" | "delayed" | "completed";
export type ApplicationStatus = "pending" | "approved" | "rejected";

export type NotificationType =
  | "task_assignment" | "overdue_task" | "project_update" | "automation_result"
  | "application_review" | "milestone_completion" | "ai_recommendation" | "general";

export type AutomationTriggerType =
  | "task_created" | "task_assigned" | "task_completed" | "task_overdue"
  | "task_status_changed" | "project_created" | "project_status_changed"
  | "project_overdue" | "milestone_completed" | "milestone_overdue"
  | "member_added" | "application_submitted" | "application_approved"
  | "application_rejected" | "scheduled_daily" | "scheduled_weekly" | "scheduled_monthly";

export type AutomationActionType =
  | "send_notification" | "assign_task" | "create_task" | "change_task_status"
  | "change_priority" | "add_label" | "mark_milestone_complete"
  | "notify_project_manager" | "create_activity_event" | "generate_ai_summary"
  | "generate_ai_suggestion";

export type AutomationRunStatus = "running" | "successful" | "failed" | "skipped";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  title: string | null;
  skills: string[];
  invited_by: string | null;
  created_at: string;
  profile?: Profile;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: Priority;
  health: ProjectHealth;
  start_date: string | null;
  due_date: string | null;
  owner_id: string | null;
  progress: number;
  created_at: string;
  updated_at: string;
  owner?: Profile | null;
}

export interface Task {
  id: string;
  organization_id: string;
  project_id: string;
  title: string;
  description: string | null;
  creator_id: string | null;
  assignee_id: string | null;
  priority: Priority;
  status: TaskStatus;
  due_date: string | null;
  labels: string[];
  parent_task_id: string | null;
  position: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assignee?: Profile | null;
  project?: { id: string; name: string } | null;
}

export interface TaskDependency {
  id: string;
  organization_id: string;
  task_id: string;
  depends_on_task_id: string;
  created_at: string;
}

export interface Milestone {
  id: string;
  organization_id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: MilestoneStatus;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  organization_id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  author?: Profile | null;
}

export interface ActivityLog {
  id: string;
  organization_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor?: Profile | null;
}

export interface Notification {
  id: string;
  user_id: string;
  organization_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
}

export interface Automation {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  trigger_type: AutomationTriggerType;
  trigger_config: Record<string, unknown>;
  condition_logic: "AND" | "OR";
  enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  conditions?: AutomationCondition[];
  actions?: AutomationAction[];
}

export interface AutomationCondition {
  id: string;
  automation_id: string;
  field: string;
  operator: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "within_days" | "is_overdue";
  value: string | null;
  sort_order: number;
}

export interface AutomationAction {
  id: string;
  automation_id: string;
  action_type: AutomationActionType;
  config: Record<string, unknown>;
  sort_order: number;
}

export interface AutomationEvent {
  id: string;
  organization_id: string;
  event_type: AutomationTriggerType;
  entity_type: string;
  entity_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AutomationRun {
  id: string;
  automation_id: string;
  trigger_event_id: string | null;
  status: AutomationRunStatus;
  actions_executed: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  automation?: { name: string } | null;
}

export interface DocumentRecord {
  id: string;
  organization_id: string;
  project_id: string | null;
  name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
}

export interface Application {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  message: string | null;
  status: ApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AiRequest {
  id: string;
  organization_id: string;
  user_id: string | null;
  feature: string;
  model: string | null;
  credential_identifier: string | null;
  status: "success" | "failed";
  error_type: string | null;
  duration_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  created_at: string;
}

export interface AiSuggestion {
  id: string;
  organization_id: string;
  user_id: string | null;
  project_id: string | null;
  feature: string;
  suggestion: Record<string, unknown>;
  status: "pending" | "approved" | "dismissed";
  created_at: string;
  resolved_at: string | null;
}

export type AiFeature =
  | "project_summary"
  | "task_extraction"
  | "project_health"
  | "weekly_report";
