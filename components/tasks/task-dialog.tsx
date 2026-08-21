"use client";

import * as React from "react";
import { Plus, Pencil, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createTask, updateTask } from "@/app/(app)/tasks/actions";
import type { Priority, Task, TaskStatus } from "@/types";

interface TaskDialogProps {
  mode: "create" | "edit";
  projects: { id: string; name: string }[];
  members: { id: string; name: string }[];
  task?: Task;
  defaultProjectId?: string;
  trigger?: React.ReactNode;
}

export function TaskDialog({ mode, projects, members, task, defaultProjectId, trigger }: TaskDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // AI task extraction state
  const [aiOpen, setAiOpen] = React.useState(false);
  const [aiText, setAiText] = React.useState("");
  const [aiLoading, setAiLoading] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<
    { title: string; description?: string | null; priority?: Priority; due_in_days?: number | null; selected: boolean }[]
  >([]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const input = {
      title: fd.get("title") as string,
      description: (fd.get("description") as string) || undefined,
      assignee_id: (fd.get("assignee_id") as string) || null,
      priority: fd.get("priority") as Priority,
      status: fd.get("status") as TaskStatus,
      due_date: (fd.get("due_date") as string) || null,
      labels: ((fd.get("labels") as string) || "").split(",").map((s) => s.trim()).filter(Boolean),
    };
    const result =
      mode === "create"
        ? await createTask({ ...input, project_id: fd.get("project_id") as string })
        : await updateTask(task!.id, input);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    toast(mode === "create" ? "Task created" : "Task updated");
    router.refresh();
  }

  async function extractTasks() {
    setAiLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature: "task_extraction",
          text: aiText,
          projectId: defaultProjectId ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "AI analysis is temporarily unavailable. Everything else still works.");
        return;
      }
      setSuggestions(data.suggestions.map((s: Record<string, unknown>) => ({ ...s, selected: true })));
    } catch {
      setError("AI analysis is temporarily unavailable. Your organization data is safe.");
    } finally {
      setAiLoading(false);
    }
  }

  async function createSelectedSuggestions() {
    const selected = suggestions.filter((s) => s.selected);
    if (selected.length === 0) return;
    setLoading(true);
    let failed = 0;
    for (const s of selected) {
      const result = await createTask({
        project_id: defaultProjectId ?? projects[0].id,
        title: s.title,
        description: s.description ?? undefined,
        priority: s.priority ?? "medium",
        status: "todo",
        due_date: s.due_in_days
          ? new Date(Date.now() + s.due_in_days * 86400000).toISOString().slice(0, 10)
          : null,
      });
      if (result.error) failed++;
    }
    setLoading(false);
    setAiOpen(false);
    setSuggestions([]);
    setAiText("");
    toast(
      failed > 0
        ? `Created ${selected.length - failed} tasks; ${failed} failed.`
        : `Created ${selected.length} tasks from AI suggestions`,
      failed > 0 ? "error" : "success"
    );
    router.refresh();
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button onClick={() => setOpen(true)}>
          {mode === "create" ? <><Plus aria-hidden /> New task</> : <><Pencil aria-hidden /> Edit</>}
        </Button>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={mode === "create" ? "New task" : "Edit task"}
        description={mode === "create" ? "Add a task to a project." : undefined}
      >
        {mode === "create" && (
          <div className="mb-4">
            <Button variant="outline" size="sm" onClick={() => setAiOpen(true)}>
              <Sparkles aria-hidden /> Extract tasks from a note (AI)
            </Button>
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "create" && (
            <div className="space-y-1.5">
              <Label htmlFor="t-project">Project</Label>
              <Select id="t-project" name="project_id" required defaultValue={defaultProjectId ?? ""}>
                <option value="" disabled>Select a project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="t-title">Title</Label>
            <Input id="t-title" name="title" required maxLength={300} defaultValue={task?.title} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea id="t-desc" name="description" defaultValue={task?.description ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-status">Status</Label>
              <Select id="t-status" name="status" defaultValue={task?.status ?? "todo"}>
                <option value="backlog">Backlog</option>
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="completed">Completed</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-priority">Priority</Label>
              <Select id="t-priority" name="priority" defaultValue={task?.priority ?? "medium"}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-assignee">Assignee</Label>
              <Select id="t-assignee" name="assignee_id" defaultValue={task?.assignee_id ?? ""}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-due">Due date</Label>
              <Input id="t-due" name="due_date" type="date" defaultValue={task?.due_date ?? ""} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-labels">Labels (comma separated)</Label>
            <Input id="t-labels" name="labels" defaultValue={task?.labels?.join(", ") ?? ""} placeholder="design, launch" />
          </div>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : mode === "create" ? "Create task" : "Save changes"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        title="Extract tasks with AI"
        description="Paste a note — AI suggests tasks. Nothing is created until you confirm."
      >
        {suggestions.length === 0 ? (
          <div className="space-y-3">
            <Textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              rows={5}
              placeholder='e.g. "We finished the homepage but still need to test mobile layouts and get approval from Sarah."'
              aria-label="Note to extract tasks from"
            />
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAiOpen(false)}>Cancel</Button>
              <Button onClick={extractTasks} disabled={aiLoading || !aiText.trim()}>
                {aiLoading ? "Analyzing…" : "Extract tasks"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">
              AI suggestions — review and confirm. AI can be wrong.
            </p>
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-2 rounded-md border p-2">
                  <input
                    type="checkbox"
                    checked={s.selected}
                    onChange={(e) =>
                      setSuggestions((prev) => prev.map((x, j) => (j === i ? { ...x, selected: e.target.checked } : x)))
                    }
                    aria-label={`Include task: ${s.title}`}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.title}</p>
                    {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSuggestions([])}>Back</Button>
              <Button onClick={createSelectedSuggestions} disabled={loading}>
                {loading ? "Creating…" : "Create selected tasks"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
