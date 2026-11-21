"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useApiForm } from "@/components/use-form";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, PageSection, PageSkeleton } from "@/components/ui/card";
import { Confirm } from "@/components/ui/confirm";
import { Field } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api";
import { type ClientDetail, type Domain, SECTOR_LABEL, TIER_LABEL } from "@/lib/clients";
import { formatDate, formatDateTime } from "@/lib/format";
import { useSession } from "@/lib/session";

/** CLI-03: read the exact statement, tick, confirm. */
function AttestDialog({ orgId, domain, onDone }: { orgId: string; domain: Domain; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [statement, setStatement] = useState<{ statement: string; statementVersion: string } | null>(null);
  const [checked, setChecked] = useState(false);
  const { busy, error, run } = useApiForm();
  useEffect(() => {
    if (open) void api.get<typeof statement>(`/v1/orgs/${orgId}/domains/${domain.id}/authorisation`).then(setStatement);
  }, [open, orgId, domain.id]);
  return (
    <Dialog.Root open={open} onOpenChange={(v) => (setOpen(v), setChecked(false))}>
      <Dialog.Trigger asChild>
        <Button size="sm">Confirm engagement</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-bg p-6 shadow-xl">
          <Dialog.Title className="text-base font-semibold">Confirm you're engaged for {domain.hostname}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted">We record who confirmed this, when, and from which address. It's kept with every scan of this domain.</Dialog.Description>
          {statement ? (
            <blockquote className="mt-4 rounded-md bg-surface p-4 text-sm leading-relaxed">{statement.statement}</blockquote>
          ) : (
            <div className="skeleton mt-4 h-24" />
          )}
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => setChecked(e.target.checked)} />I confirm this statement is true.
          </label>
          {error && <Alert tone="error" className="mt-3">{error}</Alert>}
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Dialog.Close>
            <Button
              disabled={!checked || !statement || busy}
              onClick={() =>
                void run(async () => {
                  await api.post(`/v1/orgs/${orgId}/domains/${domain.id}/authorisation`, { statementVersion: statement!.statementVersion, confirm: true });
                  setOpen(false);
                  onDone();
                })
              }
            >
              Confirm engagement
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DomainRow({ orgId, d, canEdit, reload }: { orgId: string; d: Domain; canEdit: boolean; reload: () => void }) {
  const [editing, setEditing] = useState(false);
  const [pages, setPages] = useState(d.extraUrls.join("\n"));
  const { busy, error, run } = useApiForm();
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-sm font-medium">{d.hostname}</span>
        {d.authorisation?.current ? (
          <span className="text-xs text-ok">
            Engagement confirmed by {d.authorisation.by ?? "a former member"}, {formatDate(d.authorisation.at)}
          </span>
        ) : (
          <span className="text-xs" style={{ color: "var(--sev-high)" }}>
            {d.authorisation ? "Statement changed: confirm again before the next scan" : "Engagement not confirmed yet"}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {canEdit && !d.authorisation?.current && <AttestDialog orgId={orgId} domain={d} onDone={reload} />}
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(!editing)}>
              {editing ? "Close" : "Named pages"}
            </Button>
          )}
          {canEdit && (
            <Confirm
              trigger={<Button variant="ghost" size="sm">Remove</Button>}
              title={`Remove ${d.hostname}?`}
              body="It won't be included in future scans. You can add it again later."
              confirmLabel={`Remove ${d.hostname}`}
              onConfirm={async () => {
                await api.del(`/v1/orgs/${orgId}/domains/${d.id}`);
                reload();
              }}
            />
          )}
        </div>
      </div>
      {d.extraUrls.length > 0 && !editing && <p className="mt-1 text-xs text-muted">Always scanned: {d.extraUrls.map((u) => new URL(u).pathname).join(", ")}</p>}
      {editing && (
        <form
          className="mt-3 max-w-xl space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api.patch(`/v1/orgs/${orgId}/domains/${d.id}`, { extraUrls: pages.split("\n").map((l) => l.trim()).filter(Boolean) });
              setEditing(false);
              reload();
            });
          }}
        >
          <label htmlFor={`pages-${d.id}`} className="block text-sm font-medium">
            Pages to always scan
          </label>
          <textarea
            id={`pages-${d.id}`}
            rows={4}
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            placeholder={"/signup\n/checkout\n/contact"}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 font-mono text-sm"
          />
          <p className="text-xs text-muted">One per line. Sign-up, checkout, contact and careers pages are found automatically; add any we might miss.</p>
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" size="sm" disabled={busy}>
            Save pages
          </Button>
        </form>
      )}
    </li>
  );
}

export default function ClientDetailPage() {
  const { orgId, clientId } = useParams<{ orgId: string; clientId: string }>();
  const router = useRouter();
  const { me } = useSession();
  const canEdit = me?.memberships.find((m) => m.orgId === orgId)?.role !== "viewer";
  const [c, setC] = useState<ClientDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [hostname, setHostname] = useState("");
  const add = useApiForm();

  const load = useCallback(
    () =>
      api
        .get<ClientDetail>(`/v1/orgs/${orgId}/clients/${clientId}`)
        .then(setC)
        .catch((e) => e instanceof ApiError && e.status === 404 && setNotFound(true)),
    [orgId, clientId],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (notFound) return <EmptyState title="Client not found" body="It may have been removed, or the link is wrong." />;
  if (!c) return <PageSkeleton />;
  const editable = canEdit && !c.archivedAt;
  const ready = c.domains.length > 0 && c.domains.every((d) => d.authorisation?.current);

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/orgs/${orgId}/clients`} className="text-sm text-muted hover:text-text">
          Back to clients
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl tracking-tight">{c.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {SECTOR_LABEL[c.sector]} / {TIER_LABEL[c.ndpcTier]}
              {c.rcNumber && <span className="ml-2 font-mono">{c.rcNumber}</span>}
            </p>
          </div>
          <div className="text-right">
            {/* One reason, shown and announced: the hint describes the disabled button. */}
            <Button disabled aria-describedby="run-scan-hint">
              Run scan
            </Button>
            <p id="run-scan-hint" className="mt-1 text-xs text-muted">
              {ready ? "Scanning arrives in a later release." : "Add a domain and confirm engagement first."}
            </p>
          </div>
        </div>
        {c.archivedAt && (
          <Alert className="mt-4">Archived on {formatDate(c.archivedAt)}. Its history is kept; it can't be changed or scanned.</Alert>
        )}
      </div>

      <PageSection title="Websites" description="Each domain needs a confirmed engagement before its first scan.">
        {c.domains.length === 0 ? (
          <p className="text-sm text-muted">No websites yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {c.domains.map((d) => (
              <DomainRow key={d.id} orgId={orgId} d={d} canEdit={editable} reload={load} />
            ))}
          </ul>
        )}
        {editable && (
          <form
            className="mt-4 flex max-w-xl flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void add.run(async () => {
                setC(await api.post<ClientDetail>(`/v1/orgs/${orgId}/clients/${clientId}/domains`, { hostname }));
                setHostname("");
              });
            }}
          >
            <Field label="Add a website" className="min-w-64 flex-1" value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="harbourassurance.ng" spellCheck={false} autoComplete="off" error={add.fields.hostname} required />
            <Button type="submit" variant="secondary" disabled={add.busy}>
              Add website
            </Button>
          </form>
        )}
        {add.error && !add.fields.hostname && <Alert tone="error" className="mt-3">{add.error}</Alert>}
      </PageSection>

      <PageSection title="Contact">
        {c.contact.name || c.contact.email || c.contact.phone ? (
          <dl className="grid max-w-md grid-cols-[6rem_1fr] gap-y-1 text-sm">
            {c.contact.name && (
              <>
                <dt className="text-muted">Name</dt>
                <dd>{c.contact.name}</dd>
              </>
            )}
            {c.contact.email && (
              <>
                <dt className="text-muted">Email</dt>
                <dd>{c.contact.email}</dd>
              </>
            )}
            {c.contact.phone && (
              <>
                <dt className="text-muted">Phone</dt>
                <dd>{c.contact.phone}</dd>
              </>
            )}
          </dl>
        ) : (
          <p className="text-sm text-muted">No contact person recorded.</p>
        )}
        <p className="mt-3 text-xs text-muted">Added {formatDateTime(c.createdAt)}</p>
      </PageSection>

      {editable && (
        <PageSection title="Archive">
          <p className="mb-3 text-sm text-muted">Archiving keeps this client's history and packs, and stops new scans.</p>
          <Confirm
            trigger={<Button variant="secondary">Archive client</Button>}
            title={`Archive ${c.name}?`}
            body="Its scans and packs stay available. You won't be able to change or scan it."
            confirmLabel={`Archive ${c.name}`}
            onConfirm={async () => {
              await api.del(`/v1/orgs/${orgId}/clients/${clientId}`);
              router.push(`/orgs/${orgId}/clients`);
            }}
          />
        </PageSection>
      )}
    </div>
  );
}
