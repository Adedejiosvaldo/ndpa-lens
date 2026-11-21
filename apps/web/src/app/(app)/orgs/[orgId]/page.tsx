"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageSkeleton } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { ClientRow } from "@/lib/clients";
import { useSession } from "@/lib/session";

const SHOWN = 5;

/** Overview: the organisation's clients at a glance. The full dashboard (credits, CAR deadline) is Step 32. */
export default function OrgHome() {
  const { orgId } = useParams<{ orgId: string }>();
  const { me } = useSession();
  const org = me?.memberships.find((m) => m.orgId === orgId);
  const canEdit = !!org && org.role !== "viewer";
  const [rows, setRows] = useState<ClientRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .get<{ items: ClientRow[] }>(`/v1/orgs/${orgId}/clients?limit=100`)
      .then((r) => setRows(r.items))
      .catch(() => setFailed(true));
  }, [orgId]);

  const addClient = canEdit ? (
    <Button asChild>
      <Link href={`/orgs/${orgId}/clients/new`}>Add client</Link>
    </Button>
  ) : undefined;

  if (failed) return <EmptyState title="We couldn't load your clients" body="Refresh the page to try again." />;
  if (!rows) return <PageSkeleton />;

  const withoutWebsite = rows.filter((c) => c.domainCount === 0).length;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl tracking-tight">{org?.name}</h1>
        {rows.length > 0 && addClient}
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No clients yet" body="Add the organisations you audit and their websites. Scans and evidence packs arrive in the next releases." action={addClient} />
      ) : (
        <section className="rounded-lg border border-border bg-surface">
          <div className="flex items-baseline justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-medium">
              {rows.length} client{rows.length === 1 ? "" : "s"}
              {withoutWebsite > 0 && <span className="ml-2 font-normal text-muted">{withoutWebsite} without a website yet</span>}
            </h2>
            <Link className="text-sm text-muted underline-offset-4 hover:text-text hover:underline" href={`/orgs/${orgId}/clients`}>
              View all clients
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {rows.slice(0, SHOWN).map((c) => (
              <li key={c.id}>
                <Link className="flex items-center justify-between px-5 py-3 text-sm hover:bg-surface-2" href={`/orgs/${orgId}/clients/${c.id}`}>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted">
                    {c.domainCount === 0 ? "No website yet" : `${c.domainCount} website${c.domainCount === 1 ? "" : "s"}`} · Not scanned yet
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
