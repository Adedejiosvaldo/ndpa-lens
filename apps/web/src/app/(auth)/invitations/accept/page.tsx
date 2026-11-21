"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";

function Accept() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const { me, loading, refresh } = useSession();
  const [error, setError] = useState<string | null>(null);
  const here = `/invitations/accept?token=${encodeURIComponent(token)}`;

  if (loading) return <p className="text-muted">Loading…</p>;
  if (!me)
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">You've been invited to NDPA Lens</h1>
        <p className="text-sm text-muted">Sign in, or create an account with the email address the invitation was sent to.</p>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/signup?next=${encodeURIComponent(here)}`}>Create an account</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/login?next=${encodeURIComponent(here)}`}>Sign in</Link>
          </Button>
        </div>
      </div>
    );
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Join the organisation</h1>
      <p className="text-sm text-muted">You're signed in as {me.user.email}.</p>
      {error && <Alert tone="error">{error}</Alert>}
      <Button
        onClick={async () => {
          try {
            const r = await api.post<{ orgId: string }>(`/v1/invitations/${encodeURIComponent(token)}/accept`);
            await refresh();
            router.push(`/orgs/${r.orgId}`);
          } catch (e) {
            setError(e instanceof ApiError ? `${e.message}. ${e.detail ?? ""}` : "Something went wrong.");
          }
        }}
      >
        Accept invitation
      </Button>
    </div>
  );
}

export default function AcceptPage() {
  return (
    <Suspense>
      <Accept />
    </Suspense>
  );
}
