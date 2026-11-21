"use client";

import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/session";

/** Placeholder until the dashboard (Step 32). */
export default function OrgHome() {
  const { orgId } = useParams<{ orgId: string }>();
  const { me } = useSession();
  const org = me?.memberships.find((m) => m.orgId === orgId);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{org?.name}</h1>
      <Card>
        <p className="text-sm text-muted">Clients, scans and evidence packs will appear here.</p>
      </Card>
    </div>
  );
}
