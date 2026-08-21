"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, Ban, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { addTaskDependency, removeTaskDependency } from "@/app/(app)/tasks/actions";

interface Dependency {
  id: string;
  depends_on_task_id: string;
  depends_on: { id: string; title: string; status: string } | null;
}

export function TaskDependencies({
  taskId,
  dependencies,
  blockedBy,
  candidates,
  canEdit,
}: {
  taskId: string;
  dependencies: Dependency[];
  blockedBy: { id: string; title: string; status: string }[];
  candidates: { id: string; title: string; status: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const existing = new Set(dependencies.map((d) => d.depends_on_task_id));
  const addable = candidates.filter((c) => !existing.has(c.id));

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dependsOn = new FormData(e.currentTarget).get("depends_on") as string;
    if (!dependsOn) return;
    setLoading(true);
    const result = await addTaskDependency(taskId, dependsOn);
    setLoading(false);
    if (result.error) { toast(result.error, "error"); return; }
    setOpen(false);
    toast("Dependency added");
    router.refresh();
  }

  async function onRemove(depId: string) {
    const result = await removeTaskDependency(taskId, depId);
    if (result.error) { toast(result.error, "error"); return; }
    toast("Dependency removed");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          Dependencies
          {canEdit && addable.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              <Plus aria-hidden /> Add
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {blockedBy.length > 0 && (
          <p className="flex items-center gap-2 rounded-md bg-red-50 p-2 text-sm text-red-700" role="alert">
            <Ban className="size-4" aria-hidden />
            Blocked by {blockedBy.length} incomplete {blockedBy.length === 1 ? "task" : "tasks"}
          </p>
        )}
        {dependencies.length === 0 ? (
          <p className="text-sm text-muted-foreground">This task has no dependencies.</p>
        ) : (
          <ul className="space-y-1.5">
            {dependencies.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-sm">
                <ArrowDown className="size-3.5 text-muted-foreground" aria-hidden />
                <span className="text-muted-foreground">depends on</span>
                <Link
                  href={`/tasks/${d.depends_on_task_id}`}
                  className={d.depends_on?.status === "completed" ? "text-muted-foreground line-through hover:underline" : "font-medium hover:underline"}
                >
                  {d.depends_on?.title ?? "Unknown task"}
                </Link>
                {canEdit && (
                  <button
                    className="ml-auto text-muted-foreground hover:text-foreground"
                    onClick={() => onRemove(d.id)}
                    aria-label="Remove dependency"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen} title="Add dependency" description="This task will depend on the selected task.">
        <form onSubmit={onAdd} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dep-task">Depends on</Label>
            <Select id="dep-task" name="depends_on" required defaultValue="">
              <option value="" disabled>Select a task</option>
              {addable.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Adding…" : "Add dependency"}</Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}
