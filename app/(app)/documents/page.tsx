import { requireOrgContext } from "@/lib/auth";
import { PageHeader } from "@/components/ui/misc";
import { DocumentManager } from "@/components/documents/document-manager";

export const metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const ctx = await requireOrgContext();
  return (
    <div>
      <PageHeader
        title="Documents"
        description="Files shared across your organization, secured by Storage RLS."
      />
      <DocumentManager organizationId={ctx.organization.id} />
    </div>
  );
}
