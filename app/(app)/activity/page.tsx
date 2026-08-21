import { requireOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatRelative } from "@/lib/utils";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ActivityLog } from "@/types";

export const metadata = { title: "Activity" };

const PAGE_SIZE = 50;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const ctx = await requireOrgContext();
  const { page = "1" } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const supabase = await createClient();

  const from = (pageNum - 1) * PAGE_SIZE;
  const { data, count } = await supabase
    .from("activity_logs")
    .select("*, actor:profiles!activity_logs_actor_id_fkey(full_name)", { count: "exact" })
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const logs = (data ?? []) as (ActivityLog & { actor?: { full_name: string } | null })[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Activity"
        description="Full audit trail — every important change, by humans and automations."
      />

      {logs.length === 0 ? (
        <EmptyState title="No activity yet" description="Actions in your organization will appear here." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Avatar name={log.actor?.full_name ?? "OSmini"} className="size-6 text-[10px]" />
                      <span className="text-sm">{log.actor?.full_name ?? "Automation"}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{log.action.replaceAll(".", " ")}</TableCell>
                  <TableCell><Badge variant="outline">{log.entity_type}</Badge></TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell" title={formatDateTime(log.created_at)}>
                    {formatRelative(log.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-muted-foreground">Page {pageNum} of {totalPages}</p>
              <div className="flex gap-2">
                {pageNum > 1 && (
                  <a className="rounded-md border px-3 py-1.5 hover:bg-accent" href={`/activity?page=${pageNum - 1}`}>Previous</a>
                )}
                {pageNum < totalPages && (
                  <a className="rounded-md border px-3 py-1.5 hover:bg-accent" href={`/activity?page=${pageNum + 1}`}>Next</a>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
