import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManageAutomations } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/misc";
import { AutomationBuilder } from "@/components/automations/automation-builder";

export const metadata = { title: "New automation" };

export default async function NewAutomationPage() {
  const ctx = await requireOrgContext();
  if (!canManageAutomations(ctx.role)) redirect("/automations");
  const supabase = await createClient();

  const [projectsRes, membersRes] = await Promise.all([
    supabase.from("projects").select("id, name").eq("organization_id", ctx.organization.id).order("name"),
    supabase
      .from("organization_members")
      .select("user_id, profile:profiles!organization_members_user_id_fkey(full_name)")
      .eq("organization_id", ctx.organization.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New automation" description="WHEN something happens → IF conditions match → THEN actions run." />
      <AutomationBuilder
        projects={projectsRes.data ?? []}
        members={(membersRes.data ?? []).map((m) => ({
          id: m.user_id,
          name: (m.profile as unknown as { full_name: string } | null)?.full_name ?? "Unknown",
        }))}
      />
    </div>
  );
}
