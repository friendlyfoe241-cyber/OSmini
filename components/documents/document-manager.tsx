"use client";

import * as React from "react";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import type { DocumentRecord } from "@/types";

// Uploads/downloads use the browser Supabase client: Storage RLS scopes all
// objects to the organization folder (<orgId>/...) automatically.
export function DocumentManager({
  organizationId,
  projectId,
}: {
  organizationId: string;
  projectId?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [documents, setDocuments] = React.useState<DocumentRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [deleting, setDeleting] = React.useState<DocumentRecord | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    const supabase = createClient();
    let query = supabase
      .from("documents")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (projectId) query = query.eq("project_id", projectId);
    const { data } = await query;
    setDocuments((data ?? []) as DocumentRecord[]);
    setLoading(false);
  }, [organizationId, projectId]);

  React.useEffect(() => { load(); }, [load]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast("File is too large (20 MB max).", "error");
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const path = `${organizationId}/${projectId ?? "misc"}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
    if (uploadError) {
      toast("Unable to upload file. Please try again.", "error");
      setUploading(false);
      return;
    }

    const { error: rowError } = await supabase.from("documents").insert({
      organization_id: organizationId,
      project_id: projectId ?? null,
      name: file.name,
      file_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: user?.id ?? null,
    });
    setUploading(false);
    if (rowError) {
      toast("File uploaded but could not be registered. Please try again.", "error");
      return;
    }
    toast("Document uploaded");
    load();
    router.refresh();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onDownload(doc: DocumentRecord) {
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 60);
    if (error || !data?.signedUrl) {
      toast("Unable to download file. Please try again.", "error");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function onDelete() {
    if (!deleting) return;
    const supabase = createClient();
    await supabase.storage.from("documents").remove([deleting.file_path]);
    const { error } = await supabase.from("documents").delete().eq("id", deleting.id);
    if (error) {
      toast("Unable to delete document. You may not have permission.", "error");
      return;
    }
    toast("Document deleted");
    setDeleting(null);
    load();
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={onUpload}
          aria-label="Upload document"
        />
        <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload aria-hidden /> {uploading ? "Uploading…" : "Upload document"}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-8" />}
          title="No documents yet"
          description="Upload files to share with your organization."
        />
      ) : (
        <ul className="divide-y rounded-lg border">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.size_bytes ? `${(doc.size_bytes / 1024).toFixed(1)} KB · ` : ""}
                  {formatDate(doc.created_at)}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onDownload(doc)} aria-label={`Download ${doc.name}`}>
                <Download />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setDeleting(doc)} aria-label={`Delete ${doc.name}`}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title="Delete document?"
        description={`This permanently deletes "${deleting?.name}". This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={onDelete}
      />
    </div>
  );
}
