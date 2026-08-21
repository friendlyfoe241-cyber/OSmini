"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/auth";
import type { Priority, ProjectStatus } from "@/types";

export async function createProject(input: {
  name: string;
  description?: string;
  priority: Priority;
  status: ProjectStatus;
  start_date?: string | null;
  due_date?: string | null;
  owner_id?: string | null;
}): Promise<{ id?: string; error?: string }> {
  const ctx = await requireOrgContext();
  const supabase = await createClient();

  if (!input.name.trim()) return { error: "Project name is required." };

  const { data, error } = await supabase
    .from("projects")
    .insert({
      organization_id: ctx.organization.id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      priority: input.priority,
      status: input.status,
      start_date: input.start_date || null,
      due_date: input.due_date || null,
      owner_id: input.owner_id || ctx.user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: "Unable to create project. You may not have permission (Owner/Admin/Project Manager required)." };
  }

  await supabase.from("project_members").upsert({
    project_id: data.id,
    user_id: ctx.user.id,
    role: "manager",
  });

  await supabase.from("activity_logs").insert({
    organization_id: ctx.organization.id,
    actor_id: ctx.user.id,
    action: "project.created",
    entity_type: "project",
    entity_id: data.id,
    metadata: { name: input.name.trim() },
  });

  revalidatePath("/projects");
  return { id: data.id };
}

export async function updateProject(
  projectId: string,
  input: Partial<{
    name: string;
    description: string | null;
    status: ProjectStatus;
    priority: Priority;
    start_date: string | null;
    due_date: string | null;
    owner_id: string | null;
  }>
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update(input)
    .eq("id", projectId)
    .eq("organization_id", ctx.organization.id);
  if (error) return { error: "Unable to update project. Please check your permissions and try again." };
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return {};
}

export async function deleteProject(projectId: string): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("organization_id", ctx.organization.id);
  if (error) return { error: "Unable to delete project. Only Owners and Admins can delete projects." };
  revalidatePath("/projects");
  return {};
}

export async function addProjectMember(projectId: string, userId: string): Promise<{ error?: string }> {
  await requireOrgContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_members")
    .upsert({ project_id: projectId, user_id: userId, role: "member" });
  if (error) return { error: "Unable to add member to project." };
  revalidatePath(`/projects/${projectId}`);
  return {};
}

export async function removeProjectMember(projectId: string, userId: string): Promise<{ error?: string }> {
  await requireOrgContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) return { error: "Unable to remove member from project." };
  revalidatePath(`/projects/${projectId}`);
  return {};
}

export async function createMilestone(input: {
  project_id: string;
  name: string;
  description?: string;
  due_date?: string | null;
}): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  const supabase = await createClient();
  if (!input.name.trim()) return { error: "Milestone name is required." };
  const { error } = await supabase.from("milestones").insert({
    organization_id: ctx.organization.id,
    project_id: input.project_id,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    due_date: input.due_date || null,
  });
  if (error) return { error: "Unable to create milestone. You may not have permission." };
  revalidatePath(`/projects/${input.project_id}`);
  return {};
}

export async function linkTaskToMilestone(milestoneId: string, taskId: string, projectId: string): Promise<{ error?: string }> {
  await requireOrgContext();
  const supabase = await createClient();
  const { error } = await supabase.from("milestone_tasks").upsert({ milestone_id: milestoneId, task_id: taskId });
  if (error) return { error: "Unable to link task to milestone." };
  revalidatePath(`/projects/${projectId}`);
  return {};
}
