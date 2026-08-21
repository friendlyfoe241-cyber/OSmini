import type { OrgRole } from "@/types";

// Server-enforced permission model. RLS is the real enforcement layer;
// these helpers mirror it for UI decisions (hiding/disabling controls).
// NEVER trust these checks for security — they are UX conveniences only.

const ROLE_RANK: Record<OrgRole, number> = {
  viewer: 0,
  member: 1,
  project_manager: 2,
  admin: 3,
  owner: 4,
};

export function roleAtLeast(role: OrgRole, minimum: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export const canManageMembers = (role: OrgRole) => roleAtLeast(role, "admin");
export const canManageProjects = (role: OrgRole) => roleAtLeast(role, "project_manager");
export const canManageAutomations = (role: OrgRole) => roleAtLeast(role, "admin");
export const canManageSettings = (role: OrgRole) => roleAtLeast(role, "admin");
export const canCreateTasks = (role: OrgRole) => roleAtLeast(role, "member");
export const canViewOnly = (role: OrgRole) => role === "viewer";

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  project_manager: "Project Manager",
  member: "Member",
  viewer: "Viewer",
};
