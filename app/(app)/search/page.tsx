import Link from "next/link";
import { FileText, FolderKanban, CheckSquare, Users } from "lucide-react";
import { requireOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireOrgContext();
  const { q = "" } = await searchParams;
  const query = q.trim();
  const supabase = await createClient();

  let projects: { id: string; name: string }[] = [];
  let tasks: { id: string; title: string }[] = [];
  let people: { user_id: string; profile: { full_name: string; email: string } | null }[] = [];
  let documents: { id: string; name: string }[] = [];

  if (query.length >= 2) {
    const pattern = `%${query}%`;
    const [p, t, m, d] = await Promise.all([
      supabase.from("projects").select("id, name").eq("organization_id", ctx.organization.id).ilike("name", pattern).limit(10),
      supabase.from("tasks").select("id, title").eq("organization_id", ctx.organization.id).ilike("title", pattern).limit(10),
      supabase
        .from("organization_members")
        .select("user_id, profile:profiles!organization_members_user_id_fkey(full_name,email)")
        .eq("organization_id", ctx.organization.id),
      supabase.from("documents").select("id, name").eq("organization_id", ctx.organization.id).ilike("name", pattern).limit(10),
    ]);
    projects = p.data ?? [];
    tasks = t.data ?? [];
    people = ((m.data ?? []) as unknown as typeof people).filter(
      (x) =>
        x.profile?.full_name?.toLowerCase().includes(query.toLowerCase()) ||
        x.profile?.email?.toLowerCase().includes(query.toLowerCase())
    );
    documents = d.data ?? [];
  }

  const total = projects.length + tasks.length + people.length + documents.length;

  return (
    <div>
      <PageHeader title="Search" description={query ? `Results for "${query}"` : "Search across projects, tasks, people and documents."} />
      {!query ? (
        <EmptyState title="Type to search" description="Use the search box in the top bar." />
      ) : total === 0 ? (
        <EmptyState title="No results" description={`Nothing matched "${query}".`} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {projects.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FolderKanban className="size-4" aria-hidden /> Projects</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {projects.map((x) => (
                    <li key={x.id}><Link className="text-sm text-primary hover:underline" href={`/projects/${x.id}`}>{x.name}</Link></li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {tasks.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckSquare className="size-4" aria-hidden /> Tasks</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {tasks.map((x) => (
                    <li key={x.id}><Link className="text-sm text-primary hover:underline" href={`/tasks/${x.id}`}>{x.title}</Link></li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {people.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="size-4" aria-hidden /> People</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {people.map((x) => (
                    <li key={x.user_id}>
                      {x.profile?.full_name} <span className="text-muted-foreground">({x.profile?.email})</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {documents.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="size-4" aria-hidden /> Documents</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {documents.map((x) => (
                    <li key={x.id}><Link className="text-sm text-primary hover:underline" href="/documents">{x.name}</Link></li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
