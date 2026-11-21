"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useApiForm } from "@/components/use-form";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Field, SelectField } from "@/components/ui/field";
import { api } from "@/lib/api";
import { type ClientDetail, SECTOR_LABEL, SECTORS, TIER_LABEL, TIERS } from "@/lib/clients";

/** CLI-01 */
export default function NewClientPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();
  const { busy, error, fields, run } = useApiForm();
  const [f, setF] = useState({ name: "", rcNumber: "", sector: "insurance", ndpcTier: "unknown", contactName: "", contactEmail: "", contactPhone: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="max-w-xl space-y-6">
      <Link href={`/orgs/${orgId}/clients`} className="text-sm text-muted hover:text-text">
        Back to clients
      </Link>
      <h1 className="font-display text-3xl tracking-tight">Add a client</h1>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const c = await api.post<ClientDetail>(`/v1/orgs/${orgId}/clients`, {
              name: f.name,
              rcNumber: f.rcNumber,
              sector: f.sector,
              ndpcTier: f.ndpcTier,
              contact: { name: f.contactName, email: f.contactEmail, phone: f.contactPhone },
            });
            router.push(`/orgs/${orgId}/clients/${c.id}`);
          });
        }}
      >
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Client name" required value={f.name} onChange={set("name")} error={fields.name} />
        <Field label="CAC registration number (optional)" value={f.rcNumber} onChange={set("rcNumber")} placeholder="RC 123456" spellCheck={false} error={fields.rcNumber} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Sector" value={f.sector} onChange={set("sector")}>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {SECTOR_LABEL[s]}
              </option>
            ))}
          </SelectField>
          <SelectField label="NDPC tier" value={f.ndpcTier} onChange={set("ndpcTier")}>
            {TIERS.map((s) => (
              <option key={s} value={s}>
                {TIER_LABEL[s]}
              </option>
            ))}
          </SelectField>
        </div>
        <fieldset className="space-y-4 border-t border-border pt-4">
          <legend className="pt-2 text-sm font-semibold">Contact person at the client</legend>
          <Field label="Name" value={f.contactName} onChange={set("contactName")} autoComplete="off" />
          <Field label="Email" type="email" value={f.contactEmail} onChange={set("contactEmail")} autoComplete="off" spellCheck={false} error={fields["contact.email"]} />
          <Field label="Phone" type="tel" value={f.contactPhone} onChange={set("contactPhone")} autoComplete="off" />
        </fieldset>
        <Button type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add client"}
        </Button>
      </form>
    </div>
  );
}
