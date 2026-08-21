"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { removeMember, updateMemberRole } from "@/app/(app)/settings/actions";
import type { OrgRole } from "@/types";

export function MemberRoleManager({
  memberId,
  currentRole,
  isOwner,
}: {
  memberId: string;
  currentRole: OrgRole;
  isOwner: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function onRoleChange(role: OrgRole) {
    const result = await updateMemberRole(memberId, role);
    if (result.error) { toast(result.error, "error"); return; }
    toast("Role updated");
    router.refresh();
  }

  async function onRemove() {
    setLoading(true);
    const result = await removeMember(memberId);
    setLoading(false);
    if (result.error) { toast(result.error, "error"); return; }
    toast("Member removed");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <Select
        aria-label="Member role"
        className="h-8 w-36 text-xs"
        defaultValue={currentRole}
        disabled={isOwner}
        onChange={(e) => onRoleChange(e.target.value as OrgRole)}
      >
        <option value="owner" disabled={!isOwner}>Owner</option>
        <option value="admin">Admin</option>
        <option value="project_manager">Project Manager</option>
        <option value="member">Member</option>
        <option value="viewer">Viewer</option>
      </Select>
      {!isOwner && (
        <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
          Remove
        </Button>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove member?"
        description="They will lose access to this organization immediately. Their account is not deleted."
        confirmLabel="Remove member"
        destructive
        loading={loading}
        onConfirm={onRemove}
      />
    </div>
  );
}
