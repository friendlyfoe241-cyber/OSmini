import { requireOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { NotificationList } from "@/components/notifications/notification-list";
import type { Notification } from "@/types";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const ctx = await requireOrgContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", ctx.user.id)
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const notifications = (data ?? []) as Notification[];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" description="Everything that needs your attention." />
      {notifications.length === 0 ? (
        <EmptyState title="No notifications" description="You're all caught up." />
      ) : (
        <NotificationList notifications={notifications} />
      )}
    </div>
  );
}

// Re-export for badge typing (kept for clarity).
export type { Notification };
