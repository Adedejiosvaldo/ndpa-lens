"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

interface Entry {
  id: string;
  action: string;
  actorName: string | null;
  targetType: string | null;
  ip: string | null;
  createdAt: string;
}

const ACTION_LABEL: Record<string, string> = {
  "org.created": "Organisation created",
  "org.updated": "Organisation details changed",
  "member.role_changed": "Member role changed",
  "member.removed": "Member removed",
  "member.left": "Member left",
  "invitation.created": "Invitation sent",
  "invitation.cancelled": "Invitation cancelled",
  "invitation.accepted": "Invitation accepted",
  "ownership.transfer_requested": "Ownership transfer requested",
  "ownership.transfer_accepted": "Ownership transferred",
  "ownership.transfer_cancelled": "Ownership transfer cancelled",
  "licence.submitted": "Licence submitted for checking",
  "branding.updated": "Branding changed",
  "branding.logo_uploaded": "Logo uploaded",
  "client.created": "Client added",
  "client.updated": "Client details changed",
  "client.archived": "Client archived",
  "domain.added": "Website added",
  "domain.updated": "Website pages changed",
  "domain.removed": "Website removed",
  "domain.authorised": "Engagement confirmed for a website",
};

/** Fallback for actions added later: "domain.added" → "Domain added". */
const humanise = (a: string) => a.replace(/[._]/g, " ").replace(/^./, (c) => c.toUpperCase());

export default function AuditLogPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [items, setItems] = useState<Entry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(after?: string) {
    setLoading(true);
    const r = await api.get<{ items: Entry[]; nextCursor: string | null }>(`/v1/orgs/${orgId}/audit-log?limit=50${after ? `&cursor=${after}` : ""}`);
    setItems((prev) => (after ? [...prev, ...r.items] : r.items));
    setCursor(r.nextCursor);
    setLoading(false);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-tight">Audit log</h1>
      <div>
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="py-2 font-medium">When</th>
              <th className="font-medium">What</th>
              <th className="font-medium">Who</th>
              <th className="font-medium">IP address</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="py-2 whitespace-nowrap">{formatDateTime(e.createdAt)}</td>
                <td>{ACTION_LABEL[e.action] ?? humanise(e.action)}</td>
                <td>{e.actorName ?? "System"}</td>
                <td>{e.ip ?? "Not recorded"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {cursor && (
          <Button variant="secondary" className="mt-4" disabled={loading} onClick={() => load(cursor)}>
            Show older entries
          </Button>
        )}
      </div>
    </div>
  );
}
