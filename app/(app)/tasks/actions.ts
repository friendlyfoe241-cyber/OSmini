"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext, getOrgContext } from "@/lib/auth";
import type { Priority, TaskStatus } from "@/types";

export async function createTask(input: {
  project_id: string;
  title: string;
  description?: string;
  assignee_id?: string | null;
  priority: Priority;
  status: TaskStatus;
  due_date?: string | null;
  labels?: string[];
  parent_task_id?: string | null;
}): Promise<{ id?: string; error?: string }> {
  const ctx = await requireOrgContext();
  const supabase = await createClient();
  if (!input.title.trim()) return { error: "Task title is required." };

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      organization_id: ctx.organization.id,
      project_id: input.project_id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      creator_id: ctx.user.id,
      assignee_id: input.assignee_id || null,
      priority: input.priority,
      status: input.status,
      due_date: input.due_date || null,
      labels: input.labels ?? [],
      parent_task_id: input.parent_task_id ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: "Unable to create task. Please check your permissions and try again." };

  await supabase.from("activity_logs").insert({
    organization_id: ctx.organization.id,
    actor_id: ctx.user.id,
    action: "task.created",
    entity_type: "task",
    entity_id: data.id,
    metadata: { title: input.title.trim() },
  });

  revalidatePath("/tasks");
  revalidatePath(`/projects/${input.project_id}`);
  return { id: data.id };
}

export async function updateTask(
  taskId: string,
  input: Partial<{
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: Priority;
    assignee_id: string | null;
    due_date: string | null;
    labels: string[];
  }>
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update(input).eq("id", taskId);

  if (error) {
    return { error: "Unable to update task. You can only update tasks you created, are assigned to, or manage." };
  }

  if (input.status === "completed") {
    const { data: task } = await supabase.from("tasks").select("title, project_id").eq("id", taskId).single();
    await supabase.from("activity_logs").insert({
      organization_id: ctx.organization.id,
      actor_id: ctx.user.id,
      action: "task.completed",
      entity_type: "task",
      entity_id: taskId,
      metadata: { title: task?.title },
    });
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  return {};
}

export async function deleteTask(taskId: string): Promise<{ error?: string }> {
  await requireOrgContext();
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { error: "Unable to delete task." };
  revalidatePath("/tasks");
  return {};
}

export async function addTaskComment(taskId: string, body: string): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  const supabase = await createClient();
  if (!body.trim()) return { error: "Comment cannot be empty." };
  const { error } = await supabase.from("task_comments").insert({
    organization_id: ctx.organization.id,
    task_id: taskId,
    author_id: ctx.user.id,
    body: body.trim(),
  });
  if (error) return { error: "Unable to add comment." };
  revalidatePath(`/tasks/${taskId}`);
  return {};
}

export async function addTaskDependency(taskId: string, dependsOnTaskId: string): Promise<{ error?: string }> {
  const ctx = await getOrgContext();
  if (!ctx) return { error: "Unauthorized" };
  const supabase = await createClient();
  if (taskId === dependsOnTaskId) return { error: "A task cannot depend on itself." };
  const { error } = await supabase.from("task_dependencies").insert({
    organization_id: ctx.organization.id,
    task_id: taskId,
    depends_on_task_id: dependsOnTaskId,
  });
  if (error) return { error: "Unable to add dependency." };
  revalidatePath(`/tasks/${taskId}`);
  return {};
}

export async function removeTaskDependency(taskId: string, dependencyId: string): Promise<{ error?: string }> {
  await getOrgContext();
  const supabase = await createClient();
  const { error } = await supabase.from("task_dependencies").delete().eq("id", dependencyId);
  if (error) return { error: "Unable to remove dependency." };
  revalidatePath(`/tasks/${taskId}`);
  return {};
}
