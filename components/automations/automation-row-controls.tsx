"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { deleteAutomation, toggleAutomation } from "@/app/(app)/automations/actions";
import type { Automation } from "@/types";

export function AutomationRowControls({ automation }: { automation: Automation }) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function onToggle() {
    const result = await toggleAutomation(automation.id, !automation.enabled);
    if (result.error) { toast(result.error, "error"); return; }
    toast(automation.enabled ? "Automation disabled" : "Automation enabled");
    router.refresh();
  }

  async function onDelete() {
    setLoading(true);
    const result = await deleteAutomation(automation.id);
    setLoading(false);
    if (result.error) { toast(result.error, "error"); return; }
    toast("Automation deleted");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost" size="icon" onClick={onToggle}
        aria-label={automation.enabled ? `Disable ${automation.name}` : `Enable ${automation.name}`}
      >
        <Power className={automation.enabled ? "text-emerald-600" : "text-muted-foreground"} />
      </Button>
      <Link
        href={`/automations/${automation.id}`}
        aria-label={`Edit ${automation.name}`}
        className="inline-flex size-9 items-center justify-center rounded-md hover:bg-accent [&_svg]:size-4"
      >
        <Pencil />
      </Link>
      <Button variant="ghost" size="icon" onClick={() => setConfirmOpen(true)} aria-label={`Delete ${automation.name}`}>
        <Trash2 />
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete automation?"
        description={`This permanently deletes "${automation.name}" and its configuration. Run history is also removed.`}
        confirmLabel="Delete automation"
        destructive
        loading={loading}
        onConfirm={onDelete}
      />
    </div>
  );
}
