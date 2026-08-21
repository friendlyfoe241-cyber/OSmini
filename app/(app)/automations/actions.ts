"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/auth";
import { canManageAutomations } from "@/lib/permissions";
import type { AutomationActionType, AutomationTriggerType } from "@/types";

export interface AutomationPayload {
  name: string;
  description?: string;
  trigger_type: AutomationTriggerType;
  trigger_config: Record<string, unknown>;
  condition_logic: "AND" | "OR";
  enabled: boolean;
  conditions: { field: string; operator: string; value: string }[];
  actions: { action_type: AutomationActionType; config: Record<string, unknown> }[];
}

export async function createAutomation(payload: AutomationPayload): Promise<{ id?: string; error?: string }> {
  const ctx = await requireOrgContext();
  if (!canManageAutomations(ctx.role)) {
    return { error: "Only Owners and Admins can manage automations." };
  }
  const supabase = await createClient();
  if (!payload.name.trim()) return { error: "Automation name is required." };
  if (payload.actions.length === 0) return { error: "Add at least one action." };

  const { data, error } = await supabase
    .from("automations")
    .insert({
      organization_id: ctx.organization.id,
      name: payload.name.trim(),
      description: payload.description?.trim() || null,
      trigger_type: payload.trigger_type,
      trigger_config: payload.trigger_config,
      condition_logic: payload.condition_logic,
      enabled: payload.enabled,
      created_by: ctx.user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Unable to create automation. Please try again." };

  if (payload.conditions.length > 0) {
    const { error: condError } = await supabase.from("automation_conditions").insert(
      payload.conditions.map((c, i) => ({
        automation_id: data.id,
        field: c.field,
        operator: c.operator,
        value: c.value || null,
        sort_order: i,
      }))
    );
    if (condError) return { error: "Unable to save conditions. Please try again." };
  }

  const { error: actError } = await supabase.from("automation_actions").insert(
    payload.actions.map((a, i) => ({
      automation_id: data.id,
      action_type: a.action_type,
      config: a.config,
      sort_order: i,
    }))
  );
  if (actError) return { error: "Unable to save actions. Please try again." };

  revalidatePath("/automations");
  return { id: data.id };
}

export async function updateAutomation(id: string, payload: AutomationPayload): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  if (!canManageAutomations(ctx.role)) {
    return { error: "Only Owners and Admins can manage automations." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("automations")
    .update({
      name: payload.name.trim(),
      description: payload.description?.trim() || null,
      trigger_type: payload.trigger_type,
      trigger_config: payload.trigger_config,
      condition_logic: payload.condition_logic,
      enabled: payload.enabled,
    })
    .eq("id", id);
  if (error) return { error: "Unable to update automation. Please try again." };

  // Replace conditions and actions.
  await supabase.from("automation_conditions").delete().eq("automation_id", id);
  await supabase.from("automation_actions").delete().eq("automation_id", id);
  if (payload.conditions.length > 0) {
    await supabase.from("automation_conditions").insert(
      payload.conditions.map((c, i) => ({
        automation_id: id, field: c.field, operator: c.operator, value: c.value || null, sort_order: i,
      }))
    );
  }
  if (payload.actions.length > 0) {
    await supabase.from("automation_actions").insert(
      payload.actions.map((a, i) => ({
        automation_id: id, action_type: a.action_type, config: a.config, sort_order: i,
      }))
    );
  }

  revalidatePath("/automations");
  revalidatePath(`/automations/${id}`);
  return {};
}

export async function toggleAutomation(id: string, enabled: boolean): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  if (!canManageAutomations(ctx.role)) return { error: "Insufficient permissions." };
  const supabase = await createClient();
  const { error } = await supabase.from("automations").update({ enabled }).eq("id", id);
  if (error) return { error: "Unable to update automation." };
  revalidatePath("/automations");
  return {};
}

export async function deleteAutomation(id: string): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  if (!canManageAutomations(ctx.role)) return { error: "Insufficient permissions." };
  const supabase = await createClient();
  const { error } = await supabase.from("automations").delete().eq("id", id);
  if (error) return { error: "Unable to delete automation." };
  revalidatePath("/automations");
  return {};
}
