import { Users } from "lucide-react";
import { requireOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManageMembers, ORG_ROLE_LABELS } from "@/lib/permissions";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MemberManager } from "@/components/people/member-manager";
import type { OrganizationMember } from "@/types";

export const metadata = { title: "People" };

export default async function PeoplePage() {
  const ctx = await requireOrgContext();
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("organization_members")
    .select("*, profile:profiles!organization_members_user_id_fkey(full_name,email,avatar_url)")
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: true });

  const { data: tasksAgg } = await supabase
    .from("tasks")
    .select("assignee_id, status")
    .eq("organization_id", ctx.organization.id)
    .not("assignee_id", "is", null);

  const { data: projectsAgg } = await supabase
    .from("project_members")
    .select("user_id")
    .in("user_id", (members ?? []).map((m) => m.user_id));

  const rows = ((members ?? []) as (OrganizationMember & { profile: { full_name: string; email: string } | null })[]).map(
    (m) => {
      const assigned = (tasksAgg ?? []).filter((t) => t.assignee_id === m.user_id);
      return {
        ...m,
        assignedCount: assigned.length,
        openCount: assigned.filter((t) => t.status !== "completed").length,
        projectCount: (projectsAgg ?? []).filter((p) => p.user_id === m.user_id).length,
      };
    }
  );

  return (
    <div>
      <PageHeader
        title="People"
        description="Organization directory — roles, skills and active work."
        actions={canManageMembers(ctx.role) ? <MemberManager /> : undefined}
      />

      {rows.length === 0 ? (
        <EmptyState icon={<Users className="size-8" />} title="No members" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">Title</TableHead>
              <TableHead className="hidden lg:table-cell">Skills</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead>Open tasks</TableHead>
              <TableHead>Assigned</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <span className="flex items-center gap-2.5">
                    <Avatar name={m.profile?.full_name ?? m.profile?.email} />
                    <span>
                      <span className="block text-sm font-medium">
                        {m.profile?.full_name || m.profile?.email}
                      </span>
                      <span className="block text-xs text-muted-foreground">{m.profile?.email}</span>
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={m.role === "owner" ? "default" : m.role === "admin" ? "info" : "secondary"}>
                    {ORG_ROLE_LABELS[m.role]}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{m.title ?? "—"}</TableCell>
                <TableCell className="hidden lg:table-cell">
                  {m.skills.length > 0 ? (
                    <span className="flex flex-wrap gap-1">
                      {m.skills.slice(0, 3).map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className="tabular-nums">{m.projectCount}</TableCell>
                <TableCell className="tabular-nums">{m.openCount}</TableCell>
                <TableCell className="tabular-nums">{m.assignedCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
