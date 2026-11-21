"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useApiForm } from "@/components/use-form";
import { Button } from "@/components/ui/button";
import { Alert, Card, PageSection, PageSkeleton } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { api, type Org } from "@/lib/api";
import { useSession } from "@/lib/session";

const LICENCE: Record<Org["licenceStatus"], string> = {
  unsubmitted: "Not submitted",
  pending: "Waiting for verification",
  verified: "Verified",
  rejected: "Rejected",
};

export default function OrgSettings() {
  const { orgId } = useParams<{ orgId: string }>();
  const { me, refresh } = useSession();
  const role = me?.memberships.find((m) => m.orgId === orgId)?.role;
  const canEdit = role === "owner" || role === "admin";
  const [org, setOrg] = useState<Org | null>(null);
  const [saved, setSaved] = useState(false);
  const { busy, error, fields, run } = useApiForm();

  useEffect(() => {
    void api.get<Org>(`/v1/orgs/${orgId}`).then(setOrg);
  }, [orgId]);
  if (!org) return <PageSkeleton />;
  const set = (k: "name" | "legalName" | "address" | "phone") => (e: { target: { value: string } }) => setOrg({ ...org, [k]: e.target.value });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-tight">Organisation</h1>
      <Card>
        <form
          className="max-w-lg space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              setOrg(await api.patch<Org>(`/v1/orgs/${orgId}`, { name: org.name, legalName: org.legalName, address: org.address, phone: org.phone }));
              setSaved(true);
              await refresh();
            });
          }}
        >
          {saved && <Alert tone="ok">Saved.</Alert>}
          {error && <Alert tone="error">{error}</Alert>}
          <fieldset disabled={!canEdit} className="space-y-4">
            <Field label="Trading name" value={org.name} onChange={set("name")} error={fields.name} />
            <Field label="Registered (legal) name" value={org.legalName ?? ""} onChange={set("legalName")} error={fields.legalName} />
            <Field label="Address" value={org.address ?? ""} onChange={set("address")} error={fields.address} />
            <Field label="Phone" value={org.phone ?? ""} onChange={set("phone")} error={fields.phone} />
          </fieldset>
          {canEdit && (
            <Button type="submit" disabled={busy}>
              Save changes
            </Button>
          )}
        </form>
      </Card>
      <PageSection title="DPCO licence">
        <p className="text-sm text-muted">Status: {LICENCE[org.licenceStatus]}. Licence submission arrives in a later release.</p>
      </PageSection>
    </div>
  );
}
