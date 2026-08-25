# OSmini

**The mini operating system for organizations.**

People + Projects + Tasks + Milestones + Automations + AI-powered operational
intelligence in one simple system. OSmini answers one question whenever you
open the dashboard: **"What needs my attention right now?"**

Built with Next.js 15 (App Router), React, TypeScript, Tailwind CSS,
Supabase (PostgreSQL + Auth + Row Level Security + Storage), and Google
Gemini for the AI layer.

---

## 1. Architecture

```text
Browser ──► Next.js (App Router)
              │
              ├─ Server Components / Server Actions ──► Supabase (anon key, user's JWT)
              │      RLS enforces everything
              │
              ├─ /api/ai ──► lib/ai (Gemini service w/ credential failover)
              │
              ├─ /api/cron ──► lib/automation engine (service role)
              │
              └─ /api/members, /api/automations/[id]/test ──► privileged flows
```

* **Multi-tenancy**: every organization-owned table carries `organization_id`
  and RLS scopes every query to the organizations you belong to. Never trust
  the client for authorization — it is always enforced in PostgreSQL.
* **Automation**: event-driven, batch-processed by a server-side scheduler
  (`POST /api/cron`). No browser dependency for scheduled work.
* **AI**: enhancement, not dependency. All Gemini traffic goes through a
  centralized server-side service with multi-credential failover. If AI is
  down, everything else keeps working.

## 2. Technology stack

- Next.js 15, React 19, TypeScript, Tailwind CSS 4 (custom component library)
- Supabase: PostgreSQL, Auth, RLS, Storage
- Google Gemini API (server-side only)
- Vercel-compatible deployment

## 3. Setup

### Prerequisites

1. Node.js 20+
2. A Supabase project (free tier is fine)
3. (Optional) one or more Google AI Studio API keys

### Steps

```bash
npm install
cp .env.example .env
# fill in NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

## 4. Environment variables

See `.env.example` — placeholders only, never commit real secrets.

| Variable | Exposure | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon key (RLS user client) |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | Automation engine + member invitations |
| `CRON_SECRET` | server-only | Bearer token guarding `POST /api/cron` |
| `GEMINI_API_KEY_1..3` | server-only | Gemini credentials for failover |
| `AI_MODEL_FAST / REASONING / SUMMARY` | server-only | Model routing per feature |
| `AI_REQUEST_TIMEOUT_MS` etc. | server-only | AI cost/latency controls |

Client bundles only ever see the two `NEXT_PUBLIC_*` values. Service-role
and Gemini keys are loaded exclusively in server code (`lib/supabase/admin.ts`,
`lib/ai/gemini.ts`).

## 5. Supabase setup & SQL migration

The complete database lives in one migration:

```text
supabase/migrations/001_initial_schema.sql
```

Run it in the **Supabase SQL editor** (or via the Supabase CLI). It is
idempotent-safe (uses `create ... if not exists` where PostgreSQL allows)
and contains:

1. Extensions: `uuid-ossp`, `pgcrypto`
2. Enums: org roles/types, task/project/milestone statuses, priorities,
   notification types, automation trigger/action types, application status,
   AI feature names, run statuses
3. Tables: profiles, organizations, organization_members, projects,
   project_members, tasks, task_dependencies, milestones, milestone_tasks,
   task_comments, activity_logs, notifications, automations,
   automation_conditions, automation_actions, automation_events,
   automation_runs, documents, applications, ai_requests, ai_suggestions,
   ai_credentials (health tracking)
4. Helper functions: `is_member`, `org_role`, `role_at_least`,
   `is_shared_organization`
   (SECURITY DEFINER to avoid recursive RLS joins)
5. Triggers: `updated_at` on key tables, `handle_new_user` profile creation,
   `task_completed_at`, `recalculate_project_progress`,
   `maybe_complete_milestone`
6. Indexes: `organization_id` and hot-query indexes on every org table
7. **RLS enabled on every table with full policies**, plus a
   `storage.objects` policy constraining the `documents` bucket to
   org-membership folder paths (`<orgId>/...`)
8. Table/column comments

Optional demo data: `supabase/seed/002_seed.sql` (demo organization,
3 projects, ~15 tasks, milestones, notifications, activity, 4 demo
automations; requires creating the demo users manually first — see the
notes at the top of the seed file).

Storage: migration enables `storage` policies on a `documents` bucket —
create the bucket in the Dashboard (Storage → New bucket, private).
Uploads go through the browser client; RLS restricts every path to
`<organization_id>/...` for members of that organization.

## 6. Authentication

* Supabase email/password, password recovery (`/forgot-password`,
  `/reset-password`), magic-link capable endpoints (`/auth/callback`).
* Sessions are handled by `@supabase/ssr` with cookie-based middleware
  (`middleware.ts` refreshes the session and guards the app routes).
* After signup → `/onboarding`: create organization, choose type, enter
  your name → you become **Owner**.
* Invite more members from People → "Invite member" (Owner/Admin).
* Logout is available in the user menu.

## 7. Multi-tenancy & Row Level Security

Every org-owned table includes `organization_id`. RLS uses helper
functions `is_member(orgId)` / `org_role(orgId)` (SECURITY DEFINER, avoids
recursive RLS) and data-resolution hierarchy:

- `profiles`: you can see yourself and members of your organizations.
- `organizations`: members can read; creators can insert.
- `organization_members`: Owners/Admins manage; everyone in the org can read;
  self-insert as `owner` allowed during onboarding.
- `projects`: org members read; Owner/Admin/Project Manager write.
- `tasks`: org members read; creator/assignee/PM/admin updates allowed.
- `notifications`: only the recipient can read/update.
- `automations*`: org members read; Owner/Admin manages.
- `activity_logs` / `ai_requests` / `ai_suggestions`: org-visible,
  insertable by members / system.
- `documents`: depends on org membership; storage objects follow the same
  org-folder rule.

The service-role admin client is used **only** in:
- `POST /api/cron` (automation scheduler — bearer `CRON_SECRET`)
- member invitations (`/api/members`, Owner/Admin check first)
- server-side automation tests (`/api/automations/[id]/test`)

If `SUPABASE_SERVICE_ROLE_KEY` isn't set, those routes degrade gracefully
(the UI surfaces an internal-systems warning).

## 8. Automation architecture

```text
TRIGGER (event type) ──► CONDITIONS (AND/OR) ──► ACTIONS ──► RUN LOG
```

Tables: `automations`, `automation_conditions`, `automation_actions`,
`automation_events`, `automation_runs`.

* **Triggers**: task created/assigned/completed/overdue/status changed,
  project created/status-changed/overdue, milestone completed/overdue,
  member added, application submitted/approved/rejected, and
  scheduled daily/weekly/monthly.
* **Emitters**: Next.js server actions emit events into
  `automation_events` for user-driven triggers; the scheduler also scans
  for overdue tasks/projects/milestones and schedule-timeliness with a
  **dedup_key** uniqueness check so scanners are idempotent.
* **Processing**: `POST /api/cron` (authorized with `CRON_SECRET`) scans
  pending events, evaluates enabled automations, executes actions and
  records every run (`successful` / `failed` / `skipped`) with the event
  id attached. Skipped runs mean "conditions didn't match" — they are
  still audit-logged.
* **Actions**: send notification, assign task, create task, change task
  status, change priority, add label, mark milestone complete, notify
  project manager, create activity event, generate AI summary,
  generate AI suggestion.
* **AI actions** are optional: if Gemini is unavailable the action is
  skipped and the run continues.
* **Builder**: `/automations/new` and `/automations/[id]?edit=true` render
  the visual WHEN → IF → THEN form. Test an automation dry-run from its
  detail page (evaluates conditions against the latest matching event;
  never executes actions).

### Scheduling

Any scheduler that can send an HTTP POST works:

- Vercel Cron: `vercel.json` registers `/api/cron` once daily (09:00 UTC) —
  the maximum frequency allowed on Hobby plans. For finer-grained cycles
  (e.g. every 5 minutes), use the Supabase Edge Function below or any
  external scheduler hitting `POST /api/cron` with the `CRON_SECRET` bearer
  token.
- Supabase Edge Function: `supabase/functions/automation-cron/index.ts`
  forwards to `/api/cron`. Schedule it from `pg_cron` (SQL shown in the
  file header).
- External: curl/CI/uptime services — anything with the `CRON_SECRET`.

The scanner itself is idempotent: both event emission and run processing
use dedup keys / unique event linkage, so retries and overlapping cycles
don't duplicate work.

## 9. Gemini AI architecture

Everything goes through `lib/ai/gemini.ts` → `generateAI(...)`:

1. Credentials are read once server-side from `GEMINI_API_KEY_1..3` and
   _only_ ever reference identifiers like `gemini-primary` in logs.
2. Requests pick a healthy credential; transient failures (429 / 5xx /
   network) temporarily disable that credential (cooldown with reset
   after a cooldown period), then retry the next credential within
   `AI_MAX_RETRIES`.
3. Non-transient failures (auth, invalid request) fail fast.
4. Zod-validated structured JSON outputs; invalid JSON triggers one strict
   retry, then the request fails gracefully (`AI unavailable` UX).
5. Every request is logged to `ai_requests` (feature, model, credential
   identifier, latency, status, error type) — never the raw key, prompt,
   or payload.
6. Credential health is persisted in the `ai_credentials` table (also
   exposed in-memory via Settings → System status).

Implemented features:

- **Project summary** (project → 6-section narrative)
- **Task extraction** (free text → task suggestions; suggestions are logged
  in `ai_suggestions` and confirmed by the user before tasks are created)
- **Project health** (deterministic DB baseline + AI assessment, both
  displayed side by side so facts and interpretation are separated)
- **Weekly report** (DB-computed metrics + AI narrative)

Cost control: max input chars, max output tokens, timeout, retry limit,
and usage logging are enforced in `lib/ai/gemini.ts`.

## 10. Notifications & Activity

- In-app notifications table + top-bar bell with unread counts and
  "mark all read".
- `activity_logs` records every important change (own actions,
  automation runs, AI suggestion approvals) with actor, entity and
  metadata.
- Auditable: e.g. automation actions always write
  `automation.executed` / `.failed` entries, so automated changes are
  never silent.

## 11. Seed / demo data

`supabase/seed/002_seed.sql` creates a demo organization “Greenfield
Community Garden” with:

- 4 membership rows wired to demo users you create first (see header note)
- 3 projects (Website Redesign, Spring Fundraiser, Volunteer Onboarding)
- ~15 tasks with dependencies
- Milestones linked to tasks
- Notifications, activity, 4 demo automations (overdue escalation,
  onboarding task, overdue project manager alert, Monday AI summary)

Demo auth users create via (Supabase Studio → Authentication → add user)
or let the header of the seed explain the API call.

## 12. Local development

```bash
npm run dev        # dev server
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
npm run build      # production build
```

## 13. Deployment (Vercel + Supabase)

1. Create a Supabase project, run `001_initial_schema.sql` (SQL editor).
2. Create the `documents` storage bucket (private).
3. Generate `CRON_SECRET` with `openssl rand -hex 32`.
4. In Vercel, add the environment variables from `.env.example` (Gemini
   optional).
5. Import the repo in Vercel. `vercel.json` configures `/api/cron` to run
   daily at 09:00 UTC — the maximum frequency on Hobby plans. For
   finer-grained automation cycles, deploy the Supabase Edge Function and
   schedule it with pg_cron (see §8).
6. (Optional) Deploy the Edge Function:
   `supabase functions deploy automation-cron`, set
   `OSMINI_APP_URL` / `OSMINI_CRON_SECRET` secrets, schedule via pg_cron.

## 14. Security notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY_*`, `CRON_SECRET`
  in client bundles. The server centrally validates secret usage.
- RLS is the enforcement layer. Frontend permission helpers
  (`lib/permissions`) only hide UI affordances.
- Role checks are re-validated in server actions everywhere (e.g. only
  Owners/Admins can manage automations, invite, delete members).
- AI never executes arbitrary code or writes data directly — users confirm
  AI suggestions explicitly.
- Upload quotas: 20 MB; storage policy scopes paths to org members.

## 15. Implemented feature list

- Signup / login / reset; onboarding → organization creation
- Multi-organization membership with a safe org switcher
- Dashboard: KPIs, attention section, project health (deterministic),
  recent activity
- Projects: statuses, priorities, detail with tabs (overview, tasks,
  milestones, people, documents, activity), AI panel
- Tasks: filters, detail, comments, dependencies, labels, quick status
  update; AI task extraction flow with user confirmation
- Milestones: linked tasks, deterministic auto-completion, overdue scanner
- People: directory w/ role, title, skills, work counts; invitations
  (service role optional)
- Automations: visual builder, test (dry run), enable/disable, runs
  history, scheduler scans, idempotency
- Reports: project completion, overdue work, people, activity timeline,
  AI weekly report
- Documents: upload/download/delete with Storage RLS
- Global search across projects/tasks/people/documents
- Settings: organization type/name, profile, role management, system
  status (AI credential health, service-role presence)
- Notifications: bell + page

## 16. Known limitations

- The dashboard aggregates from a bounded query set (up to 500 recent
  tasks) — sufficient for MVP scale but pagination in loaders is a future
  improvement.
- Scheduled automation uses the `/api/cron` HTTP endpoint. On Vercel Hobby
  plans, daily crons (recommended: Supabase pg_cron hitting the endpoint).
- Email notifications are in-app only (no external SMTP integration by
  design for MVP).
- Task extraction maps AI suggestions into logged `ai_suggestions` rows;
  user approval flow is client-side today, and server-side approvals can
  be added if needed.
- Reports/views on orgs with very large history should add server-side
  aggregates (SQL views) in the future.
- Only ~2ms couriers: AI health snapshot in Settings uses in-memory state
  (fresh instance) when DB-persisted history isn't loaded yet.

## 17. Testing results

- `npm run typecheck` — passes (tsc strict)
- `npm run build` — production build succeeds for all routes
- Manual validation of RLS policies: org isolation, member reads,
  owner/admin management paths, service-role restricted to scheduler
  routes
- The cron route and all authenticated surfaces return 401/403 on
  missing/insufficient authorization as appropriate

## 18. Project structure

```text
app/                 # routes: marketing, auth, (app) dashboard domain, api/
components/          # feature folders + ui primitives
lib/                 # supabase clients, auth, permissions, automation, ai
supabase/
  migrations/001_initial_schema.sql
  seed/002_seed.sql
  functions/automation-cron/index.ts
types/               # shared TypeScript domain types
```

---

OSmini reduces administrative work — not people. Automations handle
repetitive operations, AI interprets complex information, humans approve
important decisions, and OSmini executes approved actions.
