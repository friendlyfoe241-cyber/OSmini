"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label, Select } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { addProjectMember, removeProjectMember } from "@/app/(app)/projects/actions";

interface Member { userId: string; role: string; name: string; email: string }

export function ProjectMemberManager({
  projectId,
  projectMembers,
  orgMembers,
  canManage,
}: {
  projectId: string;
  projectMembers: Member[];
  orgMembers: { id: string; name: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const memberIds = new Set(projectMembers.map((m) => m.userId));
  const addable = orgMembers.filter((m) => !memberIds.has(m.id));

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const userId = new FormData(e.currentTarget).get("user_id") as string;
    if (!userId) return;
    setLoading(true);
    const result = await addProjectMember(projectId, userId);
    setLoading(false);
    if (result.error) { toast(result.error, "error"); return; }
    setOpen(false);
    toast("Member added to project");
    router.refresh();
  }

  async function onRemove(userId: string) {
    const result = await removeProjectMember(projectId, userId);
    if (result.error) { toast(result.error, "error"); return; }
    toast("Member removed from project");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canManage && addable.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={() => setOpen(true)}>Add member</Button>
        </div>
      )}
      {projectMembers.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No one is assigned to this project yet.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {projectMembers.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={m.name} />
              <div className="flex-1">
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </div>
              <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
              {canManage && (
                <Button variant="ghost" size="sm" onClick={() => onRemove(m.userId)}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen} title="Add project member">
        <form onSubmit={onAdd} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pm-user">Organization member</Label>
            <Select id="pm-user" name="user_id" required defaultValue="">
              <option value="" disabled>Select a person</option>
              {addable.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Adding…" : "Add member"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
