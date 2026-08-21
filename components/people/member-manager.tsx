"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { OrgRole } from "@/types";

export function MemberManager() {
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
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: fd.get("email"),
        role: fd.get("role") as OrgRole,
        fullName: fd.get("fullName") || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Unable to invite member.");
      return;
    }
    setOpen(false);
    toast("Invitation sent");
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus aria-hidden /> Invite member
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Invite member"
        description="They will receive an email invitation to join this organization."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="im-email">Email</Label>
            <Input id="im-email" name="email" type="email" required placeholder="person@example.org" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="im-name">Name (optional)</Label>
            <Input id="im-name" name="fullName" placeholder="Ada Lovelace" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="im-role">Role</Label>
            <Select id="im-role" name="role" defaultValue="member">
              <option value="member">Member</option>
              <option value="project_manager">Project Manager</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </Select>
            <p className="text-xs text-muted-foreground">
              Owners can change roles later in Settings.
            </p>
          </div>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Inviting…" : "Send invitation"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
