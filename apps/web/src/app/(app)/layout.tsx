"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useRequireAuth } from "@/lib/session";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { me, loading, refresh, mfaRequired } = useRequireAuth();
  const params = useParams<{ orgId?: string }>();
  const path = usePathname();
  const router = useRouter();
  if (loading || !me) return <p className="p-8 text-muted">Loading…</p>;

  const org = me.memberships.find((m) => m.orgId === params.orgId) ?? me.memberships[0];
  const canAdmin = org && (org.role === "owner" || org.role === "admin");
  const nav = org
    ? [
        { href: `/orgs/${org.orgId}`, label: "Overview" },
        { href: `/orgs/${org.orgId}/settings`, label: "Organisation" },
        ...(canAdmin
          ? [
              { href: `/orgs/${org.orgId}/settings/members`, label: "Members" },
              { href: `/orgs/${org.orgId}/settings/audit-log`, label: "Audit log" },
            ]
          : []),
      ]
    : [];

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-bg">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
          <Link href="/" className="font-semibold text-accent">
            NDPA Lens
          </Link>
          {org && <span className="text-sm text-muted">{org.name}</span>}
          <nav aria-label="Main" className="flex gap-1">
            {!mfaRequired &&
              nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={path === n.href ? "page" : undefined}
                  className={cn("rounded-md px-3 py-1.5 text-sm hover:bg-surface-2", path === n.href && "bg-surface-2 font-medium")}
                >
                  {n.label}
                </Link>
              ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/settings/security" className="text-sm hover:underline">
              {me.user.name}
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await api.post("/v1/auth/logout");
                await refresh();
                router.push("/login");
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
