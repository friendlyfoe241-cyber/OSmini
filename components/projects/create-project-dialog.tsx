"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createProject } from "@/app/(app)/projects/actions";
import type { Priority, ProjectStatus } from "@/types";

export function CreateProjectDialog({
  members,
}: {
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await createProject({
      name: fd.get("name") as string,
      description: fd.get("description") as string,
      priority: fd.get("priority") as Priority,
      status: fd.get("status") as ProjectStatus,
      start_date: (fd.get("start_date") as string) || null,
      due_date: (fd.get("due_date") as string) || null,
      owner_id: (fd.get("owner_id") as string) || null,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    toast("Project created");
    if (result.id) router.push(`/projects/${result.id}`);
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden /> New project
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="New project" description="Create a project for your organization.">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" name="name" required maxLength={200} placeholder="Website Redesign" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-desc">Description</Label>
            <Textarea id="p-desc" name="description" placeholder="What is this project about?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-status">Status</Label>
              <Select id="p-status" name="status" defaultValue="active">
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-priority">Priority</Label>
              <Select id="p-priority" name="priority" defaultValue="medium">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-start">Start date</Label>
              <Input id="p-start" name="start_date" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-due">Due date</Label>
              <Input id="p-due" name="due_date" type="date" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-owner">Project manager</Label>
            <Select id="p-owner" name="owner_id" defaultValue="">
              <option value="">Me</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </div>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create project"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
