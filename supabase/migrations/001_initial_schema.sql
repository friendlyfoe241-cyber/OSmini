-- ============================================================================
-- OSmini — Initial Database Schema
-- Migration: 001_initial_schema.sql
--
-- Run order:
--   1. supabase/migrations/001_initial_schema.sql  (this file)
--   2. supabase/seed/002_seed.sql                  (optional development data)
--
-- This file is complete and executable against a fresh Supabase project.
-- Paste it into the Supabase SQL editor or run it via `supabase db push`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
create type public.organization_type as enum (
  'student_org', 'nonprofit', 'volunteer', 'research',
  'school_club', 'community', 'startup', 'small_business', 'other'
);

create type public.org_role as enum (
  'owner', 'admin', 'project_manager', 'member', 'viewer'
);

create type public.project_status as enum (
  'planning', 'active', 'paused', 'completed', 'archived'
);

create type public.priority_level as enum (
  'low', 'medium', 'high', 'critical'
);

create type public.task_status as enum (
  'backlog', 'todo', 'in_progress', 'blocked', 'completed'
);

create type public.milestone_status as enum (
  'pending', 'in_progress', 'completed', 'overdue'
);

create type public.project_health as enum (
  'on_track', 'at_risk', 'delayed', 'completed'
);

create type public.application_status as enum (
  'pending', 'approved', 'rejected'
);

create type public.notification_type as enum (
  'task_assignment', 'overdue_task', 'project_update', 'automation_result',
  'application_review', 'milestone_completion', 'ai_recommendation', 'general'
);

create type public.automation_trigger_type as enum (
  'task_created', 'task_assigned', 'task_completed', 'task_overdue',
  'task_status_changed', 'project_created', 'project_status_changed',
  'project_overdue', 'milestone_completed', 'milestone_overdue',
  'member_added', 'application_submitted', 'application_approved',
  'application_rejected', 'scheduled_daily', 'scheduled_weekly', 'scheduled_monthly'
);

create type public.automation_action_type as enum (
  'send_notification', 'assign_task', 'create_task', 'change_task_status',
  'change_priority', 'add_label', 'mark_milestone_complete',
  'notify_project_manager', 'create_activity_event', 'generate_ai_summary',
  'generate_ai_suggestion'
);

create type public.automation_run_status as enum (
  'running', 'successful', 'failed', 'skipped'
);

-- ---------------------------------------------------------------------------
-- 2. Core identity tables
-- ---------------------------------------------------------------------------

-- Profiles mirror auth.users. Created automatically by trigger below.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 200),
  type        public.organization_type not null default 'other',
  created_by  uuid not null references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  role            public.org_role not null default 'member',
  title           text,
  skills          text[] not null default '{}',
  invited_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_members_user_idx on public.organization_members (user_id);
create index organization_members_org_idx  on public.organization_members (organization_id);

-- ---------------------------------------------------------------------------
-- 3. Projects / tasks / milestones
-- ---------------------------------------------------------------------------

create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 200),
  description     text,
  status          public.project_status not null default 'planning',
  priority        public.priority_level not null default 'medium',
  health          public.project_health not null default 'on_track',
  start_date      date,
  due_date        date,
  owner_id        uuid references public.profiles (id) on delete set null,
  progress        integer not null default 0 check (progress between 0 and 100),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index projects_org_idx on public.projects (organization_id);
create index projects_owner_idx on public.projects (owner_id);

create table public.project_members (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null default 'member',
  created_at  timestamptz not null default now(),
  unique (project_id, user_id)
);

create index project_members_user_idx on public.project_members (user_id);

create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid not null references public.projects (id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 300),
  description     text,
  creator_id      uuid references public.profiles (id) on delete set null,
  assignee_id     uuid references public.profiles (id) on delete set null,
  priority        public.priority_level not null default 'medium',
  status          public.task_status not null default 'todo',
  due_date        date,
  labels          text[] not null default '{}',
  parent_task_id  uuid references public.tasks (id) on delete set null,
  position        integer not null default 0,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index tasks_org_idx on public.tasks (organization_id);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_assignee_idx on public.tasks (assignee_id);
create index tasks_due_date_idx on public.tasks (due_date);
create index tasks_status_idx on public.tasks (status);

create table public.task_dependencies (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  task_id            uuid not null references public.tasks (id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks (id) on delete cascade,
  created_at         timestamptz not null default now(),
  unique (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create index task_dependencies_task_idx on public.task_dependencies (task_id);

create table public.milestones (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid not null references public.projects (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 200),
  description     text,
  status          public.milestone_status not null default 'pending',
  due_date        date,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index milestones_project_idx on public.milestones (project_id);

create table public.milestone_tasks (
  id           uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.milestones (id) on delete cascade,
  task_id      uuid not null references public.tasks (id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (milestone_id, task_id)
);

create table public.task_comments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id         uuid not null references public.tasks (id) on delete cascade,
  author_id       uuid references public.profiles (id) on delete set null,
  body            text not null check (char_length(body) between 1 and 4000),
  created_at      timestamptz not null default now()
);

create index task_comments_task_idx on public.task_comments (task_id);

-- ---------------------------------------------------------------------------
-- 4. Activity / notifications
-- ---------------------------------------------------------------------------

create table public.activity_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id        uuid references public.profiles (id) on delete set null,
  action          text not null,
  entity_type     text not null,
  entity_id       uuid,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

create index activity_logs_org_idx on public.activity_logs (organization_id, created_at desc);

create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  type            public.notification_type not null default 'general',
  title           text not null,
  message         text,
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Automation engine
-- ---------------------------------------------------------------------------

create table public.automations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 200),
  description     text,
  trigger_type    public.automation_trigger_type not null,
  -- For scheduled triggers, e.g. { "hour": 9, "minute": 0, "weekday": 1 }
  trigger_config  jsonb not null default '{}',
  condition_logic text not null default 'AND' check (condition_logic in ('AND', 'OR')),
  enabled         boolean not null default true,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index automations_org_idx on public.automations (organization_id);
create index automations_trigger_idx on public.automations (trigger_type) where enabled;

create table public.automation_conditions (
  id            uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations (id) on delete cascade,
  field         text not null,  -- e.g. 'priority', 'status', 'project_id', 'assignee_id', 'due_date'
  operator      text not null check (operator in ('eq','neq','lt','lte','gt','gte','within_days','is_overdue')),
  value         text,
  sort_order    integer not null default 0
);

create index automation_conditions_automation_idx on public.automation_conditions (automation_id);

create table public.automation_actions (
  id            uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations (id) on delete cascade,
  action_type   public.automation_action_type not null,
  config        jsonb not null default '{}',
  sort_order    integer not null default 0
);

create index automation_actions_automation_idx on public.automation_actions (automation_id);

-- Events are emitted by database triggers (or the overdue sweep) and
-- processed by the server-side automation dispatcher.
create table public.automation_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_type      public.automation_trigger_type not null,
  entity_type     text not null,
  entity_id       uuid,
  payload         jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

create index automation_events_created_idx on public.automation_events (created_at);

-- One-time detections (overdue events) must never duplicate per entity.
create unique index automation_events_overdue_unique
  on public.automation_events (event_type, entity_id)
  where event_type in ('task_overdue', 'project_overdue', 'milestone_overdue');

-- Idempotency: one run per automation per trigger event, enforced below.
create table public.automation_runs (
  id               uuid primary key default gen_random_uuid(),
  automation_id    uuid not null references public.automations (id) on delete cascade,
  trigger_event_id uuid references public.automation_events (id) on delete set null,
  status           public.automation_run_status not null default 'running',
  actions_executed integer not null default 0,
  error_message    text,
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  unique (automation_id, trigger_event_id)
);

create index automation_runs_automation_idx on public.automation_runs (automation_id, started_at desc);

-- ---------------------------------------------------------------------------
-- 6. Documents / applications / AI records
-- ---------------------------------------------------------------------------

create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid references public.projects (id) on delete set null,
  name            text not null,
  file_path       text not null,
  mime_type       text,
  size_bytes      bigint,
  uploaded_by     uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index documents_org_idx on public.documents (organization_id);

create table public.applications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null,
  email           text not null,
  message         text,
  status          public.application_status not null default 'pending',
  reviewed_by     uuid references public.profiles (id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index applications_org_idx on public.applications (organization_id);

-- AI audit log. Never stores API keys or raw secrets.
create table public.ai_requests (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  user_id               uuid references public.profiles (id) on delete set null,
  feature               text not null,  -- project_summary | task_extraction | project_health | weekly_report
  model                 text,
  credential_identifier text,           -- e.g. 'gemini-primary' (never the raw key)
  status                text not null,  -- success | failed
  error_type            text,           -- auth | invalid_request | rate_limit | quota | model_unavailable | server | network | timeout
  duration_ms           integer,
  prompt_tokens         integer,
  completion_tokens     integer,
  created_at            timestamptz not null default now()
);

create index ai_requests_org_idx on public.ai_requests (organization_id, created_at desc);

create table public.ai_suggestions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid references public.profiles (id) on delete set null,
  project_id      uuid references public.projects (id) on delete set null,
  feature         text not null,   -- e.g. 'task_extraction', 'project_health', 'project_summary'
  suggestion      jsonb not null,  -- structured AI payload, schema-validated by the app
  status          text not null default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);

create index ai_suggestions_org_idx on public.ai_suggestions (organization_id);

-- ---------------------------------------------------------------------------
-- 7. Helper functions (security definer to avoid RLS recursion)
-- ---------------------------------------------------------------------------

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id and user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(org_id uuid, roles public.org_role[])
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and role = any (roles)
  );
$$;

-- updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Emit an automation event (security definer so triggers can insert past RLS)
create or replace function public.emit_event(
  p_org_id uuid,
  p_event_type public.automation_trigger_type,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb default '{}'
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.automation_events (organization_id, event_type, entity_type, entity_id, payload)
  values (p_org_id, p_event_type, p_entity_type, p_entity_id, p_payload);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Auth trigger: create profile on signup
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 9. Relation functions: events, milestone completion, project progress
-- ---------------------------------------------------------------------------

-- Recompute project progress = share of completed tasks.
create or replace function public.recompute_project_progress(p_project_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  total integer;
  done integer;
begin
  select count(*), count(*) filter (where status = 'completed')
    into total, done
  from public.tasks where project_id = p_project_id;

  update public.projects
  set progress = case when total = 0 then 0 else round(100.0 * done / total) end
  where id = p_project_id;
end;
$$;

-- Milestone completion: when all linked tasks are complete, mark milestone
-- complete, recompute project progress, emit event. Deterministic.
create or replace function public.try_complete_milestone(p_milestone_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  m record;
  open_count integer;
begin
  select * into m from public.milestones where id = p_milestone_id;
  if not found or m.status = 'completed' then
    return;
  end if;

  select count(*) into open_count
  from public.milestone_tasks mt
  join public.tasks t on t.id = mt.task_id
  where mt.milestone_id = p_milestone_id
    and t.status <> 'completed';

  if open_count = 0 then
    update public.milestones
      set status = 'completed', completed_at = now()
      where id = p_milestone_id;
    perform public.emit_event(m.organization_id, 'milestone_completed', 'milestone', p_milestone_id,
      jsonb_build_object('milestone', to_jsonb(m)));
    perform public.recompute_project_progress(m.project_id);
  end if;
end;
$$;

create or replace function public.on_task_insert()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  perform public.emit_event(new.organization_id, 'task_created', 'task', new.id,
    jsonb_build_object('task', to_jsonb(new)));
  if new.assignee_id is not null then
    perform public.emit_event(new.organization_id, 'task_assigned', 'task', new.id,
      jsonb_build_object('task', to_jsonb(new)));
  end if;
  return new;
end;
$$;

create or replace function public.on_task_update()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    perform public.emit_event(new.organization_id, 'task_status_changed', 'task', new.id,
      jsonb_build_object('task', to_jsonb(new), 'old_status', old.status));
    if new.status = 'completed' then
      new.completed_at := coalesce(new.completed_at, now());
      perform public.emit_event(new.organization_id, 'task_completed', 'task', new.id,
        jsonb_build_object('task', to_jsonb(new)));
    else
      new.completed_at := null;
    end if;
  end if;
  if old.assignee_id is distinct from new.assignee_id and new.assignee_id is not null then
    perform public.emit_event(new.organization_id, 'task_assigned', 'task', new.id,
      jsonb_build_object('task', to_jsonb(new)));
  end if;
  return new;
end;
$$;

create or replace function public.on_project_insert()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  perform public.emit_event(new.organization_id, 'project_created', 'project', new.id,
    jsonb_build_object('project', to_jsonb(new)));
  return new;
end;
$$;

create or replace function public.on_project_update()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    perform public.emit_event(new.organization_id, 'project_status_changed', 'project', new.id,
      jsonb_build_object('project', to_jsonb(new), 'old_status', old.status));
  end if;
  return new;
end;
$$;

create or replace function public.on_member_insert()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  perform public.emit_event(new.organization_id, 'member_added', 'member', new.id,
    jsonb_build_object('member', to_jsonb(new)));
  return new;
end;
$$;

create or replace function public.on_application_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.emit_event(new.organization_id, 'application_submitted', 'application', new.id,
      jsonb_build_object('application', to_jsonb(new)));
  elsif old.status is distinct from new.status then
    if new.status = 'approved' then
      perform public.emit_event(new.organization_id, 'application_approved', 'application', new.id,
        jsonb_build_object('application', to_jsonb(new)));
    elsif new.status = 'rejected' then
      perform public.emit_event(new.organization_id, 'application_rejected', 'application', new.id,
        jsonb_build_object('application', to_jsonb(new)));
    end if;
  end if;
  return new;
end;
$$;

-- On any task change: check milestone readiness + refresh project progress.
create or replace function public.on_task_progress_check()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  mt record;
begin
  for mt in select milestone_id from public.milestone_tasks where task_id = new.id loop
    perform public.try_complete_milestone(mt.milestone_id);
  end loop;
  perform public.recompute_project_progress(new.project_id);
  return new;
end;
$$;

create or replace function public.try_complete_milestone_trigger()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  perform public.try_complete_milestone(new.id);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Attach triggers
-- ---------------------------------------------------------------------------

create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger organizations_touch before update on public.organizations
  for each row execute function public.touch_updated_at();
create trigger automations_touch before update on public.automations
  for each row execute function public.touch_updated_at();
create trigger milestones_touch before update on public.milestones
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger tasks_on_insert after insert on public.tasks
  for each row execute function public.on_task_insert();
create trigger tasks_on_update before update on public.tasks
  for each row execute function public.on_task_update();
create trigger tasks_progress_check after insert or update on public.tasks
  for each row execute function public.on_task_progress_check();

create trigger projects_on_insert after insert on public.projects
  for each row execute function public.on_project_insert();
create trigger projects_on_update after update on public.projects
  for each row execute function public.on_project_update();

create trigger members_on_insert after insert on public.organization_members
  for each row execute function public.on_member_insert();

create trigger applications_on_change after insert or update on public.applications
  for each row execute function public.on_application_change();

create trigger milestones_on_update after update on public.milestones
  for each row execute function public.try_complete_milestone_trigger();

-- ---------------------------------------------------------------------------
-- 11. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles              enable row level security;
alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.projects              enable row level security;
alter table public.project_members       enable row level security;
alter table public.tasks                 enable row level security;
alter table public.task_dependencies     enable row level security;
alter table public.milestones            enable row level security;
alter table public.milestone_tasks       enable row level security;
alter table public.task_comments         enable row level security;
alter table public.activity_logs         enable row level security;
alter table public.notifications         enable row level security;
alter table public.automations           enable row level security;
alter table public.automation_conditions enable row level security;
alter table public.automation_actions    enable row level security;
alter table public.automation_events     enable row level security;
alter table public.automation_runs       enable row level security;
alter table public.documents             enable row level security;
alter table public.applications          enable row level security;
alter table public.ai_requests           enable row level security;
alter table public.ai_suggestions        enable row level security;

-- Profiles: visible to self and to members of any shared organization.
create policy profiles_select_shared_org on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.organization_members a
      join public.organization_members b
        on a.organization_id = b.organization_id
      where a.user_id = auth.uid() and b.user_id = profiles.id
    )
  );
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Organizations: members can read; creator inserts; owner/admin updates.
create policy organizations_select_member on public.organizations
  for select using (public.is_org_member(id));
create policy organizations_insert_creator on public.organizations
  for insert with check (created_by = auth.uid());
create policy organizations_update_admin on public.organizations
  for update using (public.has_org_role(id, array['owner','admin']::public.org_role[]));

-- Membership: org members can read; owner/admin manage; a user may add
-- themselves as owner right after creating the organization.
create policy members_select on public.organization_members
  for select using (public.is_org_member(organization_id));
create policy members_insert_admin_or_self_owner on public.organization_members
  for insert with check (
    public.has_org_role(organization_id, array['owner','admin']::public.org_role[])
    or (user_id = auth.uid() and role = 'owner'
        and exists (select 1 from public.organizations o
                    where o.id = organization_id and o.created_by = auth.uid()))
  );
create policy members_update_admin on public.organization_members
  for update using (public.has_org_role(organization_id, array['owner','admin']::public.org_role[]));
create policy members_delete_admin on public.organization_members
  for delete using (
    public.has_org_role(organization_id, array['owner','admin']::public.org_role[])
    and role <> 'owner'
  );

-- Projects: any org member can read; owner/admin/project_manager write.
create policy projects_select_member on public.projects
  for select using (public.is_org_member(organization_id));
create policy projects_insert_manager on public.projects
  for insert with check (public.has_org_role(organization_id, array['owner','admin','project_manager']::public.org_role[]));
create policy projects_update_manager on public.projects
  for update using (
    public.has_org_role(organization_id, array['owner','admin','project_manager']::public.org_role[])
    or owner_id = auth.uid()
  );
create policy projects_delete_admin on public.projects
  for delete using (public.has_org_role(organization_id, array['owner','admin']::public.org_role[]));

-- Project members: read by org members; managed by project owner/admin.
create policy project_members_select on public.project_members
  for select using (
    public.is_org_member((select p.organization_id from public.projects p where p.id = project_id))
  );
create policy project_members_write on public.project_members
  for all using (
    public.has_org_role((select p.organization_id from public.projects p where p.id = project_id),
                        array['owner','admin','project_manager']::public.org_role[])
    or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );

-- Tasks: org members read; members create; assignee/creator/managers update.
create policy tasks_select_member on public.tasks
  for select using (public.is_org_member(organization_id));
create policy tasks_insert_member on public.tasks
  for insert with check (public.is_org_member(organization_id));
create policy tasks_update_perm on public.tasks
  for update using (
    public.is_org_member(organization_id)
    and (
      assignee_id = auth.uid()
      or creator_id = auth.uid()
      or public.has_org_role(organization_id, array['owner','admin','project_manager']::public.org_role[])
      or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
    )
  );
create policy tasks_delete_perm on public.tasks
  for delete using (
    creator_id = auth.uid()
    or public.has_org_role(organization_id, array['owner','admin','project_manager']::public.org_role[])
  );

-- Task dependencies / milestone links / comments: org member access.
create policy task_deps_select on public.task_dependencies
  for select using (public.is_org_member(organization_id));
create policy task_deps_write on public.task_dependencies
  for all using (public.is_org_member(organization_id));

create policy milestone_tasks_select on public.milestone_tasks
  for select using (
    public.is_org_member((select m.organization_id from public.milestones m where m.id = milestone_id))
  );
create policy milestone_tasks_write on public.milestone_tasks
  for all using (
    public.is_org_member((select m.organization_id from public.milestones m where m.id = milestone_id))
  );

create policy comments_select on public.task_comments
  for select using (public.is_org_member(organization_id));
create policy comments_insert on public.task_comments
  for insert with check (public.is_org_member(organization_id) and author_id = auth.uid());
create policy comments_delete on public.task_comments
  for delete using (author_id = auth.uid());

-- Milestones
create policy milestones_select on public.milestones
  for select using (public.is_org_member(organization_id));
create policy milestones_write on public.milestones
  for all using (public.has_org_role(organization_id, array['owner','admin','project_manager']::public.org_role[]));

-- Activity: org members read and record.
create policy activity_select on public.activity_logs
  for select using (public.is_org_member(organization_id));
create policy activity_insert on public.activity_logs
  for insert with check (public.is_org_member(organization_id));

-- Notifications: users see only their own; org members may create.
create policy notifications_select_own on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_insert_member on public.notifications
  for insert with check (public.is_org_member(organization_id));
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid());

-- Automations: members read; owner/admin manage. Runs are read-only for
-- members and written exclusively by the service role (RLS denied).
create policy automations_select on public.automations
  for select using (public.is_org_member(organization_id));
create policy automations_write on public.automations
  for all using (public.has_org_role(organization_id, array['owner','admin']::public.org_role[]));

create policy automation_conditions_select on public.automation_conditions
  for select using (
    public.is_org_member((select a.organization_id from public.automations a where a.id = automation_id))
  );
create policy automation_conditions_write on public.automation_conditions
  for all using (
    public.has_org_role((select a.organization_id from public.automations a where a.id = automation_id),
                        array['owner','admin']::public.org_role[])
  );

create policy automation_actions_select on public.automation_actions
  for select using (
    public.is_org_member((select a.organization_id from public.automations a where a.id = automation_id))
  );
create policy automation_actions_write on public.automation_actions
  for all using (
    public.has_org_role((select a.organization_id from public.automations a where a.id = automation_id),
                        array['owner','admin']::public.org_role[])
  );

create policy automation_events_select on public.automation_events
  for select using (public.is_org_member(organization_id));

create policy automation_runs_select on public.automation_runs
  for select using (
    public.is_org_member((select a.organization_id from public.automations a where a.id = automation_id))
  );

-- Documents
create policy documents_select on public.documents
  for select using (public.is_org_member(organization_id));
create policy documents_insert on public.documents
  for insert with check (public.is_org_member(organization_id));
create policy documents_delete on public.documents
  for delete using (
    uploaded_by = auth.uid()
    or public.has_org_role(organization_id, array['owner','admin']::public.org_role[])
  );

-- Applications: org owner/admin review; any authenticated user can submit.
create policy applications_select_admin on public.applications
  for select using (public.has_org_role(organization_id, array['owner','admin']::public.org_role[]));
create policy applications_insert_authenticated on public.applications
  for insert with check (auth.uid() is not null);
create policy applications_update_admin on public.applications
  for update using (public.has_org_role(organization_id, array['owner','admin']::public.org_role[]));

-- AI records: members see their own org's records; written by the app
-- server (service role bypasses RLS).
create policy ai_requests_select on public.ai_requests
  for select using (public.is_org_member(organization_id));
create policy ai_suggestions_select on public.ai_suggestions
  for select using (public.is_org_member(organization_id));
create policy ai_suggestions_update on public.ai_suggestions
  for update using (public.is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- 12. Storage: private "documents" bucket scoped by organization
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Object path convention: <organization_id>/<filename>
create policy documents_storage_read on storage.objects
  for select using (
    bucket_id = 'documents'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );
create policy documents_storage_write on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );
create policy documents_storage_delete on storage.objects
  for delete using (
    bucket_id = 'documents'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

-- ============================================================================
-- End of 001_initial_schema.sql
-- ============================================================================
