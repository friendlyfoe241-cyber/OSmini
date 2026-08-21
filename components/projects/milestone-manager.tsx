"use client";

import * as React from "react";
import { CheckCircle2, Circle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { createMilestone, linkTaskToMilestone } from "@/app/(app)/projects/actions";
import type { Milestone } from "@/types";

interface MilestoneWithTasks extends Milestone {
  milestone_tasks: { task_id: string; tasks: { id: string; title: string; status: string } | null }[];
}

export function MilestoneManager({
  projectId,
  milestones,
  tasks,
  canManage,
}: {
  projectId: string;
  milestones: MilestoneWithTasks[];
  tasks: { id: string; title: string; status: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await createMilestone({
      project_id: projectId,
      name: fd.get("name") as string,
      description: fd.get("description") as string,
      due_date: (fd.get("due_date") as string) || null,
    });
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    setOpen(false);
    toast("Milestone created");
    router.refresh();
  }

  async function onLink(milestoneId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const taskId = new FormData(e.currentTarget).get("task_id") as string;
    if (!taskId) return;
    setLoading(true);
    const result = await linkTaskToMilestone(milestoneId, taskId, projectId);
    setLoading(false);
    if (result.error) { toast(result.error, "error"); return; }
    setLinkOpen(null);
    toast("Task linked to milestone");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setOpen(true)}><Plus aria-hidden /> New milestone</Button>
        </div>
      )}
      {milestones.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No milestones yet. Milestones complete automatically when all their linked tasks are done.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {milestones.map((m) => {
            const linked = m.milestone_tasks.filter((mt) => mt.tasks);
            const done = linked.filter((mt) => mt.tasks!.status === "completed").length;
            return (
              <Card key={m.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      {m.status === "completed"
                        ? <CheckCircle2 className="size-4 text-emerald-600" aria-label="Completed" />
                        : <Circle className="size-4 text-muted-foreground" aria-label="Open" />}
                      {m.name}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {m.status === "completed" ? `Completed ${formatDate(m.completed_at)}` : `Due ${formatDate(m.due_date)}`}
                    </span>
                  </CardTitle>
                  {m.description && <p className="text-sm text-muted-foreground">{m.description}</p>}
                </CardHeader>
                <CardContent className="space-y-2">
                  <ul className="space-y-1">
                    {linked.map((mt) => (
                      <li key={mt.task_id} className="flex items-center gap-2 text-sm">
                        {mt.tasks!.status === "completed"
                          ? <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden />
                          : <Circle className="size-3.5 text-muted-foreground" aria-hidden />}
                        <span className={mt.tasks!.status === "completed" ? "text-muted-foreground line-through" : ""}>
                          {mt.tasks!.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {linked.length > 0 && (
                    <p className="text-xs text-muted-foreground">{done} of {linked.length} tasks complete</p>
                  )}
                  {canManage && (
                    <Button variant="outline" size="sm" onClick={() => setLinkOpen(m.id)}>
                      Link a task
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen} title="New milestone">
        <form onSubmit={onCreate} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="m-name">Name</Label>
            <Input id="m-name" name="name" required maxLength={200} placeholder="Website Launch" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-desc">Description</Label>
            <Input id="m-desc" name="description" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-due">Due date</Label>
            <Input id="m-due" name="due_date" type="date" />
          </div>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create milestone"}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={linkOpen !== null} onOpenChange={() => setLinkOpen(null)} title="Link task to milestone">
        <form onSubmit={(e) => onLink(linkOpen!, e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lm-task">Task</Label>
            <Select id="lm-task" name="task_id" required defaultValue="">
              <option value="" disabled>Select a task</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLinkOpen(null)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Linking…" : "Link task"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
