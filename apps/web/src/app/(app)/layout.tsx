"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useRequireAuth } from "@/lib/session";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { me, loading, refresh, mfaRequired } = useRequireAuth();
  const params = useParams<{ orgId?: string }>();
  const path = usePathname();
  const router = useRouter();
  if (loading || !me)
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <PageSkeleton />
      </div>
    );

  const org = me.memberships.find((m) => m.orgId === params.orgId) ?? me.memberships[0];
  const canAdmin = org && (org.role === "owner" || org.role === "admin");
  const nav = org
    ? [
        { href: `/orgs/${org.orgId}`, label: "Overview" },
        { href: `/orgs/${org.orgId}/clients`, label: "Clients" },
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
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
          <Brand href={org ? `/orgs/${org.orgId}` : "/settings/security"} />
          {org && <span className="hidden border-l border-border pl-4 text-sm text-muted sm:inline">{org.name}</span>}
          <nav aria-label="Main" className="flex gap-1">
            {!mfaRequired &&
              nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={path === n.href ? "page" : undefined}
                  className={cn("rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text", path === n.href && "bg-surface-2 font-medium text-text")}
                >
                  {n.label}
                </Link>
              ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/settings/security" className="text-sm text-muted transition-colors hover:text-text" title="Security settings">
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
              <Icon name="logout-2-linear" />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
