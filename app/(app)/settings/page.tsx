import { requireOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManageSettings, ORG_ROLE_LABELS } from "@/lib/permissions";
import { PageHeader, Avatar } from "@/components/ui/misc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsForms } from "@/components/settings/settings-forms";
import { MemberRoleManager } from "@/components/settings/member-role-manager";
import { credentialHealthSnapshot, aiAvailable } from "@/lib/ai/gemini";
import { hasServiceRole } from "@/lib/supabase/admin";
import type { OrganizationMember, OrgRole } from "@/types";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireOrgContext();
  const supabase = await createClient();
  const canManage = canManageSettings(ctx.role);

  const { data: members } = await supabase
    .from("organization_members")
    .select("id, user_id, role, profile:profiles!organization_members_user_id_fkey(full_name,email)")
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: true });

  const aiCredentials = credentialHealthSnapshot();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Organization, profile, roles and system status." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization</CardTitle>
          <CardDescription>Name and type for {ctx.organization.name}.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForms
            kind="organization"
            canEdit={canManage}
            defaults={{ name: ctx.organization.name, type: ctx.organization.type }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your profile</CardTitle>
          <CardDescription>{ctx.user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForms kind="profile" canEdit defaults={{ full_name: ctx.profile.full_name }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roles</CardTitle>
          <CardDescription>
            Owner manages everything. Admin manages members, projects, automations and settings.
            Project Manager manages assigned projects. Members work on tasks. Viewers are read-only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {((members ?? []) as unknown as (OrganizationMember & { profile: { full_name: string; email: string } | null })[]).map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={m.profile?.full_name ?? m.profile?.email} className="size-7" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.profile?.full_name || m.profile?.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.profile?.email}</p>
                </div>
                {canManage && m.user_id !== ctx.user.id ? (
                  <MemberRoleManager
                    memberId={m.id}
                    currentRole={m.role}
                    isOwner={m.role === "owner"}
                  />
                ) : (
                  <Badge variant={m.role === "owner" ? "default" : "secondary"}>{ORG_ROLE_LABELS[m.role as OrgRole]}</Badge>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">System status</CardTitle>
          <CardDescription>
            AI is an enhancement: if it is unavailable, everything else keeps working.
            Credential identifiers are shown — never API keys.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span>Automation engine (service role)</span>
            <Badge variant={hasServiceRole() ? "success" : "warning"}>
              {hasServiceRole() ? "Configured" : "Not configured"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Gemini AI</span>
            <Badge variant={aiAvailable() ? "success" : "secondary"}>
              {aiAvailable() ? `${aiCredentials.length} credential(s)` : "Not configured"}
            </Badge>
          </div>
          {aiCredentials.length > 0 && (
            <ul className="divide-y rounded-md border text-xs">
              {aiCredentials.map((c) => (
                <li key={c.credential_identifier} className="flex items-center justify-between px-3 py-2">
                  <span className="font-mono">{c.credential_identifier}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {c.failure_count > 0 && <span>{c.failure_count} failures</span>}
                    <Badge variant={c.status === "healthy" ? "success" : c.status === "cooldown" ? "warning" : "destructive"}>
                      {c.status}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
