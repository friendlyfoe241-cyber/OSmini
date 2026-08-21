"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { deleteProject, updateProject } from "@/app/(app)/projects/actions";
import type { Priority, Project, ProjectStatus } from "@/types";

export function ProjectControls({
  project,
  members,
}: {
  project: Project;
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await updateProject(project.id, {
      name: fd.get("name") as string,
      description: (fd.get("description") as string) || null,
      status: fd.get("status") as ProjectStatus,
      priority: fd.get("priority") as Priority,
      start_date: (fd.get("start_date") as string) || null,
      due_date: (fd.get("due_date") as string) || null,
      owner_id: (fd.get("owner_id") as string) || null,
    });
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    setEditOpen(false);
    toast("Project updated");
    router.refresh();
  }

  async function onDelete() {
    setLoading(true);
    const result = await deleteProject(project.id);
    setLoading(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    toast("Project deleted");
    router.push("/projects");
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
        <Pencil aria-hidden /> Edit
      </Button>
      <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} aria-label={`Delete ${project.name}`}>
        <Trash2 aria-hidden />
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit project">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ep-name">Name</Label>
            <Input id="ep-name" name="name" required maxLength={200} defaultValue={project.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-desc">Description</Label>
            <Textarea id="ep-desc" name="description" defaultValue={project.description ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-status">Status</Label>
              <Select id="ep-status" name="status" defaultValue={project.status}>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-priority">Priority</Label>
              <Select id="ep-priority" name="priority" defaultValue={project.priority}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-start">Start date</Label>
              <Input id="ep-start" name="start_date" type="date" defaultValue={project.start_date ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-due">Due date</Label>
              <Input id="ep-due" name="due_date" type="date" defaultValue={project.due_date ?? ""} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-owner">Project manager</Label>
            <Select id="ep-owner" name="owner_id" defaultValue={project.owner_id ?? ""}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </div>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete project?"
        description={`This permanently deletes "${project.name}" and all its tasks, milestones and links. This cannot be undone.`}
        confirmLabel="Delete project"
        destructive
        loading={loading}
        onConfirm={onDelete}
      />
    </div>
  );
}
