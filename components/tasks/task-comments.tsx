"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { formatRelative } from "@/lib/utils";
import { addTaskComment } from "@/app/(app)/tasks/actions";
import type { TaskComment } from "@/types";

export function TaskComments({
  taskId,
  comments,
  canComment,
}: {
  taskId: string;
  comments: (TaskComment & { author?: { full_name: string } | null })[];
  canComment: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [body, setBody] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    const result = await addTaskComment(taskId, body);
    setLoading(false);
    if (result.error) { toast(result.error, "error"); return; }
    setBody("");
    toast("Comment added");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Comments ({comments.length})</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="flex items-start gap-2.5">
                <Avatar name={c.author?.full_name ?? "?"} className="size-6 text-[10px]" />
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{c.author?.full_name ?? "Unknown"}</span>{" "}
                    <span className="text-xs text-muted-foreground">{formatRelative(c.created_at)}</span>
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{c.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {canComment && (
          <form onSubmit={onSubmit} className="space-y-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write a comment…"
              rows={2}
              aria-label="New comment"
              maxLength={4000}
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={loading || !body.trim()}>
                {loading ? "Posting…" : "Post comment"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
