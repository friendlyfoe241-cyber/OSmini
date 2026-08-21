"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, CheckSquare, Users, Workflow,
  Activity, BarChart3, FileText, Settings, Bell, Search, Menu, X,
  LogOut, ChevronDown, Building2,
} from "lucide-react";
import { cn, formatRelative } from "@/lib/utils";
import { Avatar } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { switchOrganization, markNotificationRead, markAllNotificationsRead } from "@/app/(app)/actions";
import type { Notification, OrgRole } from "@/types";
import { ORG_ROLE_LABELS } from "@/lib/permissions";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/people", label: "People", icon: Users },
  { href: "/automations", label: "Automations", icon: Workflow },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface AppShellProps {
  userName: string;
  userEmail: string;
  organizationName: string;
  role: OrgRole;
  currentOrgId: string;
  memberships: { id: string; name: string }[];
  notifications: Notification[];
  unreadCount: number;
  children: React.ReactNode;
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5 px-2" aria-label="Application">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell(props: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [userOpen, setUserOpen] = React.useState(false);
  const [orgOpen, setOrgOpen] = React.useState(false);

  function closeAll() {
    setNotifOpen(false);
    setUserOpen(false);
    setOrgOpen(false);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 z-30 hidden w-60 flex-col border-r bg-background md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            OS
          </span>
          OSmini
        </div>
        <div className="relative border-b px-2 py-2">
          <button
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-accent"
            onClick={() => { closeAll(); setOrgOpen((v) => !v); }}
            aria-expanded={orgOpen}
            aria-haspopup="menu"
          >
            <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex-1 truncate text-left font-medium">{props.organizationName}</span>
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
          </button>
          {orgOpen && (
            <div className="absolute left-2 right-2 top-full z-40 mt-1 rounded-md border bg-background p-1 shadow-lg" role="menu">
              {props.memberships.map((m) => (
                <button
                  key={m.id}
                  role="menuitem"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                    m.id === props.currentOrgId && "font-medium"
                  )}
                  onClick={async () => {
                    setOrgOpen(false);
                    if (m.id !== props.currentOrgId) {
                      await switchOrganization(m.id);
                      router.push("/dashboard");
                      router.refresh();
                    }
                  }}
                >
                  <Building2 className="size-3.5 text-muted-foreground" aria-hidden />
                  <span className="truncate">{m.name}</span>
                </button>
              ))}
              <div className="my-1 h-px bg-border" />
              <Link
                href="/onboarding"
                role="menuitem"
                className="block rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                onClick={() => setOrgOpen(false)}
              >
                + New organization
              </Link>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto py-3">
          <NavLinks pathname={pathname} />
        </div>
        <div className="border-t px-4 py-3 text-xs text-muted-foreground">
          {ORG_ROLE_LABELS[props.role]}
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-64 border-r bg-background py-3">
            <div className="mb-2 flex items-center justify-between px-4">
              <span className="font-semibold">{props.organizationName}</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X />
              </Button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col md:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur">
          <Button
            variant="ghost" size="icon" className="md:hidden"
            onClick={() => setMobileOpen(true)} aria-label="Open menu"
          >
            <Menu />
          </Button>

          {/* Global search */}
          <form
            className="relative flex-1 max-w-md"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q") as string;
              if (q?.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
            }}
            role="search"
          >
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden />
            <input
              name="q"
              type="search"
              placeholder="Search projects, tasks, people, documents…"
              aria-label="Search"
              className="h-9 w-full rounded-md border bg-muted/40 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </form>

          <div className="ml-auto flex items-center gap-1">
            {/* Notifications */}
            <div className="relative">
              <Button
                variant="ghost" size="icon"
                onClick={() => { closeAll(); setNotifOpen((v) => !v); }}
                aria-label={`Notifications${props.unreadCount > 0 ? `, ${props.unreadCount} unread` : ""}`}
                aria-expanded={notifOpen}
              >
                <Bell />
                {props.unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {props.unreadCount > 9 ? "9+" : props.unreadCount}
                  </span>
                )}
              </Button>
              {notifOpen && (
                <div className="absolute right-0 top-full z-40 mt-1 w-80 rounded-md border bg-background shadow-lg" role="menu" aria-label="Notifications">
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <span className="text-sm font-medium">Notifications</span>
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={async () => { await markAllNotificationsRead(); router.refresh(); }}
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {props.notifications.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>
                    ) : (
                      props.notifications.map((n) => (
                        <button
                          key={n.id}
                          className={cn(
                            "block w-full border-b px-3 py-2 text-left last:border-0 hover:bg-accent/50",
                            !n.read && "bg-primary/5"
                          )}
                          onClick={async () => { await markNotificationRead(n.id); router.refresh(); }}
                        >
                          <p className="text-sm font-medium leading-snug">{n.title}</p>
                          {n.message && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">{formatRelative(n.created_at)}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="relative">
              <button
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                onClick={() => { closeAll(); setUserOpen((v) => !v); }}
                aria-expanded={userOpen}
                aria-haspopup="menu"
                aria-label="User menu"
              >
                <Avatar name={props.userName} />
              </button>
              {userOpen && (
                <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-md border bg-background p-1 shadow-lg" role="menu">
                  <div className="px-2 py-2">
                    <p className="truncate text-sm font-medium">{props.userName}</p>
                    <p className="truncate text-xs text-muted-foreground">{props.userEmail}</p>
                  </div>
                  <div className="my-1 h-px bg-border" />
                  <Link
                    href="/settings"
                    role="menuitem"
                    className="block rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                    onClick={() => setUserOpen(false)}
                  >
                    Settings
                  </Link>
                  <button
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-red-600 hover:bg-accent"
                    onClick={signOut}
                  >
                    <LogOut className="size-3.5" aria-hidden /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6" onClick={() => { if (notifOpen || userOpen || orgOpen) closeAll(); }}>
          {props.children}
        </main>
      </div>
    </div>
  );
}
