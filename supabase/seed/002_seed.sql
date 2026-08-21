-- ============================================================================
-- OSmini — Development Seed Data
-- Migration: 002_seed.sql  (run AFTER 001_initial_schema.sql)
--
-- DEVELOPMENT ONLY. Creates a demo organization with fake users, projects,
-- tasks, milestones, notifications, activity and sample automations.
--
-- All demo users share the password: password123
--   sarah@demo.osmini.dev  (Owner)
--   ahmed@demo.osmini.dev  (Admin)
--   lena@demo.osmini.dev   (Project Manager)
--   tom@demo.osmini.dev    (Member)
--   mia@demo.osmini.dev    (Member)
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Demo auth users (Supabase auth.users)
-- ---------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sarah@demo.osmini.dev',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Sarah Chen"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ahmed@demo.osmini.dev',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Ahmed Hassan"}'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'lena@demo.osmini.dev',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Lena Park"}'),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tom@demo.osmini.dev',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Tom Alvarez"}'),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mia@demo.osmini.dev',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Mia Wong"}')
on conflict (id) do nothing;

-- Profiles are created by the on_auth_user_created trigger.

-- ---------------------------------------------------------------------------
-- Demo organization + memberships
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, type, created_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Greenfield Community Garden', 'community',
   '11111111-1111-1111-1111-111111111111');

insert into public.organization_members (organization_id, user_id, role, title, skills) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner', 'Coordinator', array['leadership','fundraising']),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'admin', 'Operations Lead', array['operations','logistics']),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'project_manager', 'Project Manager', array['project management','design']),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'member', 'Volunteer', array['gardening','outreach']),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'member', 'Volunteer', array['social media','writing']);

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
insert into public.projects (id, organization_id, name, description, status, priority, start_date, due_date, owner_id) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Website Redesign', 'Rebuild the community garden website with donation and event pages.',
   'active', 'high', current_date - 30, current_date + 21, '33333333-3333-3333-3333-333333333333'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Spring Fundraiser', 'Annual spring plant sale fundraiser targeting $5,000.',
   'active', 'critical', current_date - 10, current_date + 35, '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Volunteer Onboarding Program', 'Structured onboarding for new garden volunteers.',
   'planning', 'medium', current_date + 7, current_date + 60, '22222222-2222-2222-2222-222222222222');

insert into public.project_members (project_id, user_id, role) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '33333333-3333-3333-3333-333333333333', 'manager'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '55555555-5555-5555-5555-555555555555', 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '11111111-1111-1111-1111-111111111111', 'manager'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '44444444-4444-4444-4444-444444444444', 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '22222222-2222-2222-2222-222222222222', 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', '22222222-2222-2222-2222-222222222222', 'manager');

-- ---------------------------------------------------------------------------
-- Tasks (~15) — includes overdue and blocked work for the demo
-- ---------------------------------------------------------------------------
insert into public.tasks (id, organization_id, project_id, title, description, creator_id, assignee_id, priority, status, due_date, labels) values
  -- Website Redesign
  ('cccccccc-cccc-cccc-cccc-cccccccccc01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
   'Design homepage mockup', 'High-fidelity mockup for the new homepage.', '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'high', 'completed', current_date - 14, array['design']),
  ('cccccccc-cccc-cccc-cccc-cccccccccc02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
   'Design donation page', 'Donation flow mockups with payment options.', '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'high', 'completed', current_date - 7, array['design']),
  ('cccccccc-cccc-cccc-cccc-cccccccccc03', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
   'Write site copy', 'Copy for home, about, events, and donate pages.', '33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555', 'medium', 'in_progress', current_date - 2, array['content']),
  ('cccccccc-cccc-cccc-cccc-cccccccccc04', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
   'Implement frontend', 'Build pages from approved mockups.', '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'high', 'todo', current_date + 7, array['dev']),
  ('cccccccc-cccc-cccc-cccc-cccccccccc05', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
   'Test mobile layouts', 'Responsive QA on phone and tablet breakpoints.', '33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555', 'medium', 'backlog', current_date + 12, array['qa']),
  ('cccccccc-cccc-cccc-cccc-cccccccccc06', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
   'Launch website', 'DNS cutover and launch announcement.', '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'critical', 'backlog', current_date + 20, array['launch']),
  -- Spring Fundraiser
  ('cccccccc-cccc-cccc-cccc-cccccccccc07', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
   'Book event venue', 'Reserve the community hall for the plant sale.', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'high', 'completed', current_date - 8, array['logistics']),
  ('cccccccc-cccc-cccc-cccc-cccccccccc08', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
   'Order plant inventory', 'Order 300 starter plants from the nursery.', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'high', 'in_progress', current_date - 1, array['logistics']),
  ('cccccccc-cccc-cccc-cccc-cccccccccc09', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
   'Create social media campaign', 'Two weeks of scheduled posts promoting the sale.', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'medium', 'in_progress', current_date + 5, array['marketing']),
  ('cccccccc-cccc-cccc-cccc-cccccccccc10', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
   'Recruit sale-day volunteers', 'Need 10 volunteers for setup, sales, and cleanup.', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'high', 'blocked', current_date - 3, array['volunteers']),
  ('cccccccc-cccc-cccc-cccc-cccccccccc11', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
   'Set up donation page', 'Configure online donations ahead of the sale.', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'high', 'todo', current_date + 9, array['dev']),
  ('cccccccc-cccc-cccc-cccc-cccccccccc12', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
   'Print signage', 'Yard signs and price boards for the sale.', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'low', 'todo', current_date + 15, array['logistics']),
  -- Volunteer Onboarding
  ('cccccccc-cccc-cccc-cccc-cccccccccc13', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
   'Draft onboarding checklist', 'Checklist covering welcome, safety, and first tasks.', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'medium', 'todo', current_date + 14, array['process']),
  ('cccccccc-cccc-cccc-cccc-cccccccccc14', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
   'Write volunteer handbook', 'Short handbook with policies and contacts.', '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555', 'medium', 'todo', current_date + 28, array['content']),
  ('cccccccc-cccc-cccc-cccc-cccccccccc15', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
   'Schedule orientation session', 'First orientation for new volunteers.', '22222222-2222-2222-2222-222222222222', null, 'low', 'backlog', current_date + 40, array['events']);

-- Dependency chain on Website Redesign
insert into public.task_dependencies (organization_id, task_id, depends_on_task_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccc04', 'cccccccc-cccc-cccc-cccc-cccccccccc02'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccc05', 'cccccccc-cccc-cccc-cccc-cccccccccc04'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccc06', 'cccccccc-cccc-cccc-cccc-cccccccccc05');

-- ---------------------------------------------------------------------------
-- Milestones
-- ---------------------------------------------------------------------------
insert into public.milestones (id, organization_id, project_id, name, description, status, due_date) values
  ('dddddddd-dddd-dddd-dddd-dddddddddd01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
   'Design approved', 'All design work signed off.', 'completed', current_date - 7),
  ('dddddddd-dddd-dddd-dddd-dddddddddd02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
   'Website launch', 'New site live on the main domain.', 'pending', current_date + 21),
  ('dddddddd-dddd-dddd-dddd-dddddddddd03', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
   'Fundraiser ready', 'Venue, inventory, and promotion all confirmed.', 'pending', current_date + 30);

-- Link tasks to the launch milestone (not yet all complete)
insert into public.milestone_tasks (milestone_id, task_id) values
  ('dddddddd-dddd-dddd-dddd-dddddddddd02', 'cccccccc-cccc-cccc-cccc-cccccccccc03'),
  ('dddddddd-dddd-dddd-dddd-dddddddddd02', 'cccccccc-cccc-cccc-cccc-cccccccccc04'),
  ('dddddddd-dddd-dddd-dddd-dddddddddd02', 'cccccccc-cccc-cccc-cccc-cccccccccc05'),
  ('dddddddd-dddd-dddd-dddd-dddddddddd02', 'cccccccc-cccc-cccc-cccc-cccccccccc06');

update public.milestones set completed_at = now() where id = 'dddddddd-dddd-dddd-dddd-dddddddddd01';

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
insert into public.notifications (user_id, organization_id, type, title, message) values
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'overdue_task',
   'Task overdue: Write site copy', 'The task "Write site copy" is past its due date.'),
  ('44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'overdue_task',
   'Task overdue: Order plant inventory', 'The task "Order plant inventory" is past its due date.'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'project_update',
   'Spring Fundraiser is blocked', '"Recruit sale-day volunteers" is blocked and overdue.'),
  ('55555555-5555-5555-5555-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'task_assignment',
   'You were assigned: Create social media campaign', 'Sarah Chen assigned you a task in Spring Fundraiser.');

-- ---------------------------------------------------------------------------
-- Activity
-- ---------------------------------------------------------------------------
insert into public.activity_logs (organization_id, actor_id, action, entity_type, entity_id, metadata) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'task.completed', 'task', 'cccccccc-cccc-cccc-cccc-cccccccccc01', '{"title":"Design homepage mockup"}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'task.completed', 'task', 'cccccccc-cccc-cccc-cccc-cccccccccc02', '{"title":"Design donation page"}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'task.assigned', 'task', 'cccccccc-cccc-cccc-cccc-cccccccccc09', '{"title":"Create social media campaign"}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'milestone.completed', 'milestone', 'dddddddd-dddd-dddd-dddd-dddddddddd01', '{"name":"Design approved"}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'project.created', 'project', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', '{"name":"Volunteer Onboarding Program"}');

-- ---------------------------------------------------------------------------
-- Demo automations (the four reference automations from the spec)
-- ---------------------------------------------------------------------------
insert into public.automations (id, organization_id, name, description, trigger_type, trigger_config, condition_logic, enabled, created_by) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Overdue task escalation', 'WHEN task becomes overdue THEN notify assignee AND notify project manager',
   'task_overdue', '{}', 'AND', true, '11111111-1111-1111-1111-111111111111'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Milestone completion', 'WHEN all milestone tasks are completed THEN mark milestone complete',
   'milestone_completed', '{}', 'AND', true, '11111111-1111-1111-1111-111111111111'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'New member onboarding', 'WHEN new member joins THEN create onboarding task',
   'member_added', '{}', 'AND', true, '22222222-2222-2222-2222-222222222222'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Weekly project summary', 'EVERY MONDAY 09:00 THEN generate project summary',
   'scheduled_weekly', '{"weekday": 1, "hour": 9, "minute": 0}', 'AND', true, '11111111-1111-1111-1111-111111111111');

insert into public.automation_actions (automation_id, action_type, config, sort_order) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', 'send_notification',
   '{"target": "assignee", "title": "Task overdue", "type": "overdue_task"}', 1),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', 'notify_project_manager',
   '{"title": "A task is overdue in your project"}', 2),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', 'send_notification',
   '{"target": "project_manager", "title": "Milestone completed", "type": "milestone_completion"}', 1),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', 'create_activity_event',
   '{"action": "milestone.completed", "note": "Milestone auto-completed by automation"}', 2),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', 'create_task',
   '{"title": "Complete onboarding checklist", "project_name": "Volunteer Onboarding Program", "priority": "medium", "due_in_days": 7}', 1),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', 'generate_ai_summary',
   '{"scope": "active_projects", "deliver": "notification"}', 1);

commit;

-- ============================================================================
-- End of 002_seed.sql
-- ============================================================================
