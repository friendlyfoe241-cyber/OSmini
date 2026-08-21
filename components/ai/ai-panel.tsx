"use client";

import * as React from "react";
import { Sparkles, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HealthBadge } from "@/components/ui/status";
import type { ProjectHealth } from "@/types";

interface Summary {
  current_status: string;
  completed_work: string[];
  outstanding_work: string[];
  blockers: string[];
  risks: string[];
  recommended_next_steps: string[];
}

interface HealthResult {
  baseline: ProjectHealth;
  ai: { health: ProjectHealth; confidence: number; reasons: string[]; recommendations: string[] };
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}

export function AiProjectPanel({ projectId }: { projectId: string }) {
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [health, setHealth] = React.useState<HealthResult | null>(null);
  const [loading, setLoading] = React.useState<"summary" | "health" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run(feature: "project_summary" | "project_health") {
    setLoading(feature === "project_summary" ? "summary" : "health");
    setError(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature, projectId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "AI analysis is temporarily unavailable.");
        return;
      }
      if (feature === "project_summary") setSummary(data.summary);
      else setHealth({ baseline: data.baseline, ai: data.ai });
    } catch {
      setError("AI analysis is temporarily unavailable. Your organization data is safe and the rest of OSmini is still working.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" aria-hidden />
          AI insights
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          AI analysis is clearly separated from database facts and is never guaranteed to be correct.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => run("project_summary")} disabled={loading !== null}>
            {loading === "summary" ? "Generating…" : "Generate project summary"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => run("project_health")} disabled={loading !== null}>
            <HeartPulse aria-hidden />
            {loading === "health" ? "Analyzing…" : "Analyze project health"}
          </Button>
        </div>

        {error && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800" role="alert">{error}</p>
        )}

        {health && (
          <div className="space-y-3 rounded-md border p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Database-derived health</span>
                <HealthBadge health={health.baseline} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">AI assessment</span>
                <HealthBadge health={health.ai.health} />
                <span className="text-xs text-muted-foreground">
                  confidence {Math.round(health.ai.confidence * 100)}%
                </span>
              </div>
            </div>
            <ListSection title="AI reasons" items={health.ai.reasons} />
            <ListSection title="AI recommendations" items={health.ai.recommendations} />
          </div>
        )}

        {summary && (
          <div className="space-y-3 rounded-md border p-4">
            <p className="text-sm">{summary.current_status}</p>
            <ListSection title="Completed work" items={summary.completed_work} />
            <ListSection title="Outstanding work" items={summary.outstanding_work} />
            <ListSection title="Blockers" items={summary.blockers} />
            <ListSection title="Risks" items={summary.risks} />
            <ListSection title="Recommended next steps" items={summary.recommended_next_steps} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
