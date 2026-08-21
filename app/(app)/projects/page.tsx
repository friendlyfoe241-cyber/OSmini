import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { requireOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManageProjects } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { PageHeader, EmptyState, Avatar } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PriorityBadge, ProjectStatusBadge } from "@/components/ui/status";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import type { OrganizationMember, Project } from "@/types";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requireOrgContext();
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("projects")
    .select("*, owner:profiles!projects_owner_id_fkey(full_name)")
    .eq("organization_id", ctx.organization.id)
    .order("updated_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const [projectsRes, membersRes] = await Promise.all([
    query,
    supabase
      .from("organization_members")
      .select("user_id, profile:profiles!organization_members_user_id_fkey(full_name)")
      .eq("organization_id", ctx.organization.id),
  ]);

  const projects = (projectsRes.data ?? []) as Project[];
  const members = ((membersRes.data ?? []) as unknown as (OrganizationMember & { profile: { full_name: string } })[]);

  const statuses = ["", "planning", "active", "paused", "completed", "archived"];

  return (
    <div>
      <PageHeader
        title="Projects"
        description="All projects in your organization."
        actions={
          canManageProjects(ctx.role) ? (
            <CreateProjectDialog
              members={members.map((m) => ({ id: m.user_id, name: m.profile?.full_name ?? "Unknown" }))}
            />
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-1" role="tablist" aria-label="Filter by status">
        {statuses.map((s) => (
          <Link
            key={s || "all"}
            href={s ? `/projects?status=${s}` : "/projects"}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              (status ?? "") === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {s ? s[0].toUpperCase() + s.slice(1) : "All"}
          </Link>
        ))}
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="size-8" />}
          title="No projects found"
          description={status ? "No projects with this status." : "Create your first project to get started."}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead className="hidden md:table-cell">Owner</TableHead>
              <TableHead className="hidden md:table-cell">Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell><ProjectStatusBadge status={p.status} /></TableCell>
                <TableCell><PriorityBadge priority={p.priority} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name} progress`}>
                      <div className="h-full bg-primary" style={{ width: `${p.progress}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{p.progress}%</span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {p.owner ? (
                    <span className="inline-flex items-center gap-2 text-sm">
                      <Avatar name={p.owner.full_name} className="size-6 text-[10px]" />
                      {p.owner.full_name}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(p.due_date)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
