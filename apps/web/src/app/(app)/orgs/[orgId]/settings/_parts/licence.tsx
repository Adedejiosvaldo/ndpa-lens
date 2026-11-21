"use client";

import { useState } from "react";
import { useApiForm } from "@/components/use-form";
import { Button } from "@/components/ui/button";
import { Alert, PageSection } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { api, type Org } from "@/lib/api";

const STATUS: Record<Org["licenceStatus"], { label: string; tone: string; help: string }> = {
  unsubmitted: { label: "Not submitted", tone: "var(--sev-info)", help: "Add your NDPC DPCO licence number. Your first three packs are free while we verify it." },
  pending: { label: "Waiting for verification", tone: "var(--sev-high)", help: "We check licence numbers against the NDPC register, usually within one working day." },
  verified: { label: "Verified", tone: "var(--ok)", help: "Your licence is verified. Contact support to change it." },
  rejected: { label: "Not verified", tone: "var(--sev-critical)", help: "We couldn't match this number on the NDPC register. Check it and submit again." },
};

/** ORG-02: Owners submit the licence number; everyone sees its status. */
export function LicenceSection({ org, isOwner, onChange }: { org: Org; isOwner: boolean; onChange: (o: Org) => void }) {
  const { busy, error, fields, run } = useApiForm();
  const [value, setValue] = useState(org.dpcoLicenceNo ?? "");
  const s = STATUS[org.licenceStatus];
  const canSubmit = isOwner && org.licenceStatus !== "verified";
  return (
    <PageSection title="DPCO licence" description={s.help}>
      <p className="text-sm">
        Status:{" "}
        <span className="font-medium" style={{ color: s.tone }}>
          {s.label}
        </span>
        {org.dpcoLicenceNo && <span className="ml-2 font-mono text-muted">{org.dpcoLicenceNo}</span>}
      </p>
      {canSubmit && (
        <form
          className="mt-4 flex max-w-lg flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const r = await api.post<{ licenceNumber: string; licenceStatus: Org["licenceStatus"] }>(`/v1/orgs/${org.id}/licence`, { licenceNumber: value });
              onChange({ ...org, dpcoLicenceNo: r.licenceNumber, licenceStatus: r.licenceStatus });
            });
          }}
        >
          <Field
            label="Licence number"
            className="min-w-64 flex-1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="NDPC/DPCO/2026/0148"
            autoComplete="off"
            spellCheck={false}
            required
            error={fields.licenceNumber}
          />
          <Button type="submit" disabled={busy}>
            {org.licenceStatus === "unsubmitted" ? "Submit for verification" : "Submit again"}
          </Button>
        </form>
      )}
      {error && <Alert tone="error" className="mt-3">{error}</Alert>}
    </PageSection>
  );
}
