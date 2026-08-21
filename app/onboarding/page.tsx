"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createOrganization } from "./actions";
import type { OrganizationType } from "@/types";

const ORG_TYPES: { value: OrganizationType; label: string }[] = [
  { value: "student_org", label: "Student organization" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "volunteer", label: "Volunteer organization" },
  { value: "research", label: "Research group" },
  { value: "school_club", label: "School club" },
  { value: "community", label: "Community organization" },
  { value: "startup", label: "Startup" },
  { value: "small_business", label: "Small business" },
  { value: "other", label: "Other" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState<OrganizationType>("community");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await createOrganization({ name: orgName, type: orgType, fullName });
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your organization</CardTitle>
          <CardDescription>
            You will become its Owner. You can invite your team right after.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Your name</Label>
              <Input
                id="fullName" required value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ada Lovelace"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orgName">Organization name</Label>
              <Input
                id="orgName" required value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Greenfield Community Garden"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orgType">Organization type</Label>
              <Select
                id="orgType" value={orgType}
                onChange={(e) => setOrgType(e.target.value as OrganizationType)}
              >
                {ORG_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </div>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating…" : "Create organization"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
