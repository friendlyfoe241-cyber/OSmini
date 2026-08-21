"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateOrganization, updateProfile } from "@/app/(app)/settings/actions";
import type { OrganizationType } from "@/types";

export function SettingsForms({
  kind,
  canEdit,
  defaults,
}: {
  kind: "organization" | "profile";
  canEdit: boolean;
  defaults: { name?: string; type?: OrganizationType; full_name?: string };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result =
      kind === "organization"
        ? await updateOrganization({
            name: fd.get("name") as string,
            type: fd.get("type") as OrganizationType,
          })
        : await updateProfile({ full_name: fd.get("full_name") as string });
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    toast("Settings saved");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {kind === "organization" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="so-name">Name</Label>
            <Input id="so-name" name="name" required defaultValue={defaults.name} disabled={!canEdit} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="so-type">Type</Label>
            <Select id="so-type" name="type" defaultValue={defaults.type} disabled={!canEdit}>
              <option value="student_org">Student organization</option>
              <option value="nonprofit">Nonprofit</option>
              <option value="volunteer">Volunteer organization</option>
              <option value="research">Research group</option>
              <option value="school_club">School club</option>
              <option value="community">Community organization</option>
              <option value="startup">Startup</option>
              <option value="small_business">Small business</option>
              <option value="other">Other</option>
            </Select>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="sp-name">Full name</Label>
          <Input id="sp-name" name="full_name" required defaultValue={defaults.full_name} disabled={!canEdit} />
        </div>
      )}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {canEdit && (
        <div className="flex justify-end">
          <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Save"}</Button>
        </div>
      )}
    </form>
  );
}
