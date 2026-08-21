"use client";

import { useRouter } from "next/navigation";
import { formatRelative } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { markNotificationRead } from "@/app/(app)/actions";
import type { Notification } from "@/types";

export function NotificationList({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  return (
    <ul className="divide-y rounded-lg border" aria-label="Notifications">
      {notifications.map((n) => (
        <li key={n.id}>
          <button
            className={`block w-full px-4 py-3 text-left hover:bg-accent/50 ${!n.read ? "bg-primary/5" : ""}`}
            onClick={async () => {
              await markNotificationRead(n.id);
              router.refresh();
            }}
          >
            <span className="flex items-center gap-2">
              <span className="text-sm font-medium">{n.title}</span>
              {!n.read && <Badge variant="info">New</Badge>}
              <span className="ml-auto text-xs text-muted-foreground">{formatRelative(n.created_at)}</span>
            </span>
            {n.message && <span className="mt-1 block text-sm text-muted-foreground">{n.message}</span>}
            <span className="mt-1 block text-xs text-muted-foreground">{n.type.replaceAll("_", " ")}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
