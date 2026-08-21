"use client";

import { useRouter } from "next/navigation";
import { Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateTask } from "@/app/(app)/tasks/actions";
import type { TaskStatus } from "@/types";

export function TaskQuickStatus({ taskId, currentStatus }: { taskId: string; currentStatus: TaskStatus }) {
  const router = useRouter();
  const { toast } = useToast();

  async function onChange(status: TaskStatus) {
    const result = await updateTask(taskId, { status });
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    toast(status === "completed" ? "Task completed" : "Status updated");
    router.refresh();
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="quick-status">Update status</Label>
      <Select
        id="quick-status"
        defaultValue={currentStatus}
        onChange={(e) => onChange(e.target.value as TaskStatus)}
      >
        <option value="backlog">Backlog</option>
        <option value="todo">Todo</option>
        <option value="in_progress">In Progress</option>
        <option value="blocked">Blocked</option>
        <option value="completed">Completed</option>
      </Select>
    </div>
  );
}
