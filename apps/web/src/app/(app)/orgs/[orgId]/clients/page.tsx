"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageSkeleton } from "@/components/ui/card";
import { SelectField } from "@/components/ui/field";
import { api } from "@/lib/api";
import { type ClientRow, SECTOR_LABEL, SECTORS, TIER_LABEL, TIERS } from "@/lib/clients";
import { formatDate } from "@/lib/format";
import { useSession } from "@/lib/session";

/** CLI-05: find a client fast. */
export default function ClientsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { me } = useSession();
  const role = me?.memberships.find((m) => m.orgId === orgId)?.role;
  const canEdit = role !== "viewer";
  const [rows, setRows] = useState<ClientRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("");
  const [tier, setTier] = useState("");
  const [archived, setArchived] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams({ limit: "100", archived: String(archived) });
    if (search.trim()) q.set("search", search.trim());
    if (sector) q.set("sector", sector);
    if (tier) q.set("tier", tier);
    const t = setTimeout(() => void api.get<{ items: ClientRow[] }>(`/v1/orgs/${orgId}/clients?${q}`).then((r) => setRows(r.items)), 200);
    return () => clearTimeout(t);
  }, [orgId, search, sector, tier, archived]);

  const filtered = search || sector || tier || archived;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl tracking-tight">Clients</h1>
        {canEdit && (
          <Button asChild>
            <Link href={`/orgs/${orgId}/clients/new`}>Add client</Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1 space-y-1">
          <label htmlFor="client-search" className="block text-sm font-medium">
            Search
          </label>
          <input
            id="client-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, RC number or domain…"
            autoComplete="off"
            className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm"
          />
        </div>
        <SelectField label="Sector" value={sector} onChange={(e) => setSector(e.target.value)}>
          <option value="">All sectors</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>
              {SECTOR_LABEL[s]}
            </option>
          ))}
        </SelectField>
        <SelectField label="NDPC tier" value={tier} onChange={(e) => setTier(e.target.value)}>
          <option value="">All tiers</option>
          {TIERS.map((s) => (
            <option key={s} value={s}>
              {TIER_LABEL[s]}
            </option>
          ))}
        </SelectField>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Show archived
        </label>
      </div>

      {rows === null ? (
        <PageSkeleton rows={5} />
      ) : rows.length === 0 ? (
        filtered ? (
          <EmptyState title="No clients match" body="Try a different search or clear the filters." />
        ) : (
          <EmptyState
            title="No clients yet"
            body="Add the organisations you audit. You'll add their websites and confirm you're engaged before the first scan."
            action={
              canEdit ? (
                <Button asChild>
                  <Link href={`/orgs/${orgId}/clients/new`}>Add client</Link>
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2 font-medium">Client</th>
                <th className="font-medium">Sector</th>
                <th className="font-medium">NDPC tier</th>
                <th className="font-medium">Domains</th>
                <th className="font-medium">Last scan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-surface">
                  <td className="py-3">
                    <Link href={`/orgs/${orgId}/clients/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    {c.rcNumber && <span className="ml-2 font-mono text-xs text-muted">{c.rcNumber}</span>}
                  </td>
                  <td>{SECTOR_LABEL[c.sector]}</td>
                  <td>{TIER_LABEL[c.ndpcTier]}</td>
                  <td className="tabular">{c.domainCount}</td>
                  <td className="text-muted">{c.lastScanAt ? formatDate(c.lastScanAt) : "Not scanned yet"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
