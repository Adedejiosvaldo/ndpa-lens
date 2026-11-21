"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { useSession } from "@/lib/session";

/** Placeholder until clients (Step 13) and the dashboard (Step 32). */
export default function OrgHome() {
  const { orgId } = useParams<{ orgId: string }>();
  const { me } = useSession();
  const org = me?.memberships.find((m) => m.orgId === orgId);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-tight">{org?.name}</h1>
      <EmptyState
        title="No clients yet"
        body="Add the organisations you audit and their websites. Scans and evidence packs arrive in the next releases."
        action={
          org && org.role !== "viewer" ? (
            <Button asChild>
              <Link href={`/orgs/${orgId}/clients/new`}>Add client</Link>
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
