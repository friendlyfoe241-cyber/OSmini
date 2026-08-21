"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

interface ReportData {
  metrics: {
    weekOf: string;
    projects: { total: number; active: number; completed: number };
    tasks: { total: number; open: number; completedThisWeek: number; overdue: number; blocked: number };
    milestones: { completed: number; overdue: number };
    automations: { runsThisWeek: number; failed: number };
  };
  narrative: {
    current_status: string;
    completed_work: string[];
    outstanding_work: string[];
    blockers: string[];
    risks: string[];
    recommended_next_steps: string[];
  };
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

export function WeeklyReportButton() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [report, setReport] = React.useState<ReportData | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature: "weekly_report" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "AI analysis is temporarily unavailable.");
        setOpen(true);
        return;
      }
      setReport(data);
      setOpen(true);
    } catch {
      setError("AI analysis is temporarily unavailable. Your organization data is safe.");
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={generate} disabled={loading}>
        <Sparkles aria-hidden /> {loading ? "Generating…" : "AI weekly report"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Weekly project report" className="max-w-2xl">
        {error ? (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800" role="alert">{error}</p>
        ) : report ? (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            {/* Database-derived metrics */}
            <div className="rounded-md border p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Metrics (database-derived)
              </p>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-muted-foreground">Active projects</dt><dd className="font-semibold">{report.metrics.projects.active}</dd></div>
                <div><dt className="text-muted-foreground">Open tasks</dt><dd className="font-semibold">{report.metrics.tasks.open}</dd></div>
                <div><dt className="text-muted-foreground">Done this week</dt><dd className="font-semibold">{report.metrics.tasks.completedThisWeek}</dd></div>
                <div><dt className="text-muted-foreground">Overdue</dt><dd className="font-semibold">{report.metrics.tasks.overdue}</dd></div>
                <div><dt className="text-muted-foreground">Blocked</dt><dd className="font-semibold">{report.metrics.tasks.blocked}</dd></div>
                <div><dt className="text-muted-foreground">Automation runs</dt><dd className="font-semibold">{report.metrics.automations.runsThisWeek}</dd></div>
              </dl>
            </div>
            {/* AI narrative */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                AI narrative — interpretive, not guaranteed
              </p>
              <p className="text-sm">{report.narrative.current_status}</p>
              <Section title="Completed" items={report.narrative.completed_work} />
              <Section title="Outstanding" items={report.narrative.outstanding_work} />
              <Section title="Blocked" items={report.narrative.blockers} />
              <Section title="Risks" items={report.narrative.risks} />
              <Section title="Next week" items={report.narrative.recommended_next_steps} />
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
