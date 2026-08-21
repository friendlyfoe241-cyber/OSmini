import Link from "next/link";
import {
  LayoutDashboard, Workflow, Sparkles, Users, FolderKanban,
  Bell, ShieldCheck, ArrowRight, CheckCircle2,
} from "lucide-react";

const features = [
  {
    icon: LayoutDashboard,
    title: "One dashboard for everything",
    text: "OSmini answers one question when you open it: what needs my attention right now? Overdue work, blocked tasks, upcoming deadlines and at-risk projects, prioritized.",
  },
  {
    icon: FolderKanban,
    title: "Projects, tasks & milestones",
    text: "Lightweight structure for real work: priorities, dependencies, milestones that complete themselves when their tasks are done, and progress that updates automatically.",
  },
  {
    icon: Workflow,
    title: "Automations that do the busywork",
    text: "WHEN a task becomes overdue, IF priority is high, THEN notify the project manager. Event-driven automations with full execution history and idempotent runs.",
  },
  {
    icon: Sparkles,
    title: "AI operational intelligence",
    text: "Gemini-powered project summaries, task extraction from plain notes, health analysis and weekly reports — clearly separated from database facts. Optional, never a dependency.",
  },
  {
    icon: Users,
    title: "People & roles",
    text: "A directory of your people with roles from Owner to Viewer, enforced server-side with Postgres Row Level Security on every table.",
  },
  {
    icon: Bell,
    title: "Notifications & activity",
    text: "Every important change — by humans or automations — is recorded in an auditable activity trail. Nothing important happens silently.",
  },
];

const steps = [
  { title: "Something happens", text: "A task is created, a deadline passes, a volunteer applies." },
  { title: "OSmini detects it", text: "Database triggers emit events into the automation engine." },
  { title: "Conditions are evaluated", text: "Priority, status, assignee, due dates — with AND/OR logic." },
  { title: "An action is performed", text: "Notify, assign, create tasks, complete milestones, summarize with AI." },
  { title: "The result is recorded", text: "Every run is logged with status, actions executed and errors." },
];

const useCases = [
  "Student organizations",
  "Nonprofits",
  "Volunteer organizations",
  "Research groups",
  "School clubs",
  "Community organizations",
  "Small startups",
  "Small businesses",
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              OS
            </span>
            OSmini
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex" aria-label="Main">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how-it-works" className="hover:text-foreground">How it works</a>
            <a href="#use-cases" className="hover:text-foreground">Use cases</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-24 text-center">
            <p className="mb-4 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              The mini operating system for organizations
            </p>
            <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
              Run your organization without the operational overhead
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              People, projects, tasks, milestones, automations and AI-powered operational
              intelligence in one simple system. Simple enough for a school club,
              powerful enough for a growing organization.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Get started <ArrowRight className="size-4" />
              </Link>
              <a
                href="#how-it-works"
                className="rounded-md border px-5 py-2.5 text-sm font-medium hover:bg-accent"
              >
                How it works
              </a>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="text-center text-2xl font-bold">Everything a small organization needs</h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
              Not a generic project-management clone — OSmini understands how your people,
              projects, deadlines and automations relate.
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="rounded-lg border p-5">
                  <f.icon className="size-5 text-primary" aria-hidden />
                  <h3 className="mt-3 font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-b bg-muted/30">
          <div className="mx-auto max-w-4xl px-4 py-20">
            <h2 className="text-center text-2xl font-bold">How OSmini works</h2>
            <div className="mt-12 space-y-0">
              {steps.map((s, i) => (
                <div key={s.title} className="relative flex gap-4 pb-8">
                  <div className="flex flex-col items-center">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {i + 1}
                    </span>
                    {i < steps.length - 1 && <span className="mt-1 w-px flex-1 bg-border" aria-hidden />}
                  </div>
                  <div className="pb-2 pt-1">
                    <h3 className="font-semibold">{s.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section id="use-cases" className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-20 text-center">
            <h2 className="text-2xl font-bold">Built for organizations like yours</h2>
            <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
              {useCases.map((u) => (
                <div key={u} className="flex items-center gap-2 rounded-md border p-3 text-left text-sm">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
                  {u}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-b bg-muted/30">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center">
            <h2 className="text-2xl font-bold">Pricing</h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              OSmini is in early access. Pricing will be announced soon — small organizations
              and nonprofits will always have a generous free tier.
            </p>
            <div className="mx-auto mt-8 max-w-sm rounded-lg border bg-background p-6 text-left shadow-sm">
              <p className="font-semibold">Early access</p>
              <p className="mt-1 text-3xl font-bold">
                Free <span className="text-sm font-normal text-muted-foreground">during beta</span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>• Unlimited projects, tasks and milestones</li>
                <li>• Full automation engine with execution history</li>
                <li>• AI summaries, task extraction and health analysis</li>
                <li>• Notifications, activity trail and reports</li>
              </ul>
            </div>
          </div>
        </section>

        {/* About / security */}
        <section className="border-b">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 py-16 text-center">
            <ShieldCheck className="size-8 text-primary" aria-hidden />
            <h2 className="text-2xl font-bold">Built on solid ground</h2>
            <p className="max-w-2xl text-muted-foreground">
              OSmini runs on Supabase and Postgres with Row Level Security on every
              organization-owned table. Your data is isolated from every other organization,
              enforced by the database — not by frontend checks. AI is an enhancement,
              never a dependency: if it is unavailable, everything else keeps working.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section>
          <div className="mx-auto max-w-6xl px-4 py-20 text-center">
            <h2 className="text-2xl font-bold">What needs your attention right now?</h2>
            <p className="mt-2 text-muted-foreground">Open OSmini and find out.</p>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Create your organization <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} OSmini — The mini operating system for organizations.</p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">Log in</Link>
            <Link href="/signup" className="hover:text-foreground">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
