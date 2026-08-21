import { getMemberships, getOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider } from "@/components/ui/toast";
import { AppShell } from "@/components/layout/app-shell";
import type { Notification } from "@/types";
import { redirect } from "next/navigation";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/onboarding");

  const supabase = await createClient();
  const [memberships, notificationsRes] = await Promise.all([
    getMemberships(ctx.user.id),
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", ctx.user.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const notifications = (notificationsRes.data ?? []) as Notification[];
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <ToastProvider>
      <AppShell
        userName={ctx.profile.full_name || ctx.user.email || "User"}
        userEmail={ctx.user.email ?? ""}
        organizationName={ctx.organization.name}
        role={ctx.role}
        currentOrgId={ctx.organization.id}
        memberships={memberships.map((m) => ({
          id: m.organization_id,
          name: m.organization.name,
        }))}
        notifications={notifications}
        unreadCount={unreadCount}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
