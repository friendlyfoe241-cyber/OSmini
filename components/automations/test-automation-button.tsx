"use client";

import * as React from "react";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

// Dry-run: evaluates conditions against the latest matching event without
// executing any actions.
export function TestAutomationButton({ automationId }: { automationId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<{
    matchedEvent: { event_type: string; created_at: string } | null;
    conditionsPassed: boolean;
    plannedActions: { action_type: string }[];
  } | null>(null);

  async function onTest() {
    setLoading(true);
    try {
      const res = await fetch(`/api/automations/${automationId}/test`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Unable to test automation.", "error");
        return;
      }
      setResult(data);
      setOpen(true);
    } catch {
      toast("Unable to test automation. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={onTest} disabled={loading}>
        <FlaskConical aria-hidden /> {loading ? "Testing…" : "Test"}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Test result"
        description="Dry run — no actions were executed and no runs were recorded."
      >
        {result && (
          <div className="space-y-3 text-sm">
            <p>
              Latest matching event:{" "}
              <strong>{result.matchedEvent ? result.matchedEvent.event_type.replaceAll("_", " ") : "none found"}</strong>
            </p>
            <p>
              Conditions:{" "}
              <strong className={result.conditionsPassed ? "text-emerald-700" : "text-amber-700"}>
                {result.conditionsPassed ? "passed" : "would not pass"}
              </strong>
            </p>
            <div>
              <p className="mb-1 font-medium">Actions that would run ({result.plannedActions.length}):</p>
              <ul className="list-disc pl-5">
                {result.plannedActions.map((a, i) => (
                  <li key={i}>{a.action_type.replaceAll("_", " ")}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
