"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiError, type Me } from "./api";

interface SessionValue {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<Me | null>;
  /** Owners and Platform Admins must enrol MFA (AUTH-05). */
  mfaRequired: boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const m = await api.get<Me>("/v1/me");
      setMe(m);
      return m;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setMe(null);
        return null;
      }
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mfaRequired =
    !!me && !me.user.twoFactorEnabled && (me.user.isPlatformAdmin || me.memberships.some((m) => m.role === "owner"));

  return <SessionContext.Provider value={{ me, loading, refresh, mfaRequired }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}

/** Signed-in area: sends visitors to sign in, and Owners without MFA to enrol. */
export function useRequireAuth(): SessionValue {
  const s = useSession();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (s.loading) return;
    if (!s.me) router.replace(`/login?next=${encodeURIComponent(path)}`);
    else if (s.mfaRequired && path !== "/settings/security") router.replace("/settings/security?setup=1");
  }, [s.loading, s.me, s.mfaRequired, path, router]);
  return s;
}

/** After sign-in: where to go next. */
export function landingFor(me: Me, next?: string | null): string {
  const mustEnrol = !me.user.twoFactorEnabled && (me.user.isPlatformAdmin || me.memberships.some((m) => m.role === "owner"));
  if (mustEnrol) return "/settings/security?setup=1";
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  const first = me.memberships[0];
  return first ? `/orgs/${first.orgId}` : "/settings/security";
}

/**
 * Remember where to go after email verification. The verification link opens
 * from the inbox, often in a new tab, so this uses localStorage (per browser).
 */
const AFTER_VERIFY = "ndpa:after-verify";
export function rememberAfterVerify(next: string | null) {
  try {
    if (next) localStorage.setItem(AFTER_VERIFY, next);
    else localStorage.removeItem(AFTER_VERIFY);
  } catch {
    /* storage unavailable: fall back to the default landing */
  }
}
export function takeAfterVerify(): string | null {
  try {
    const v = localStorage.getItem(AFTER_VERIFY);
    localStorage.removeItem(AFTER_VERIFY);
    return v;
  } catch {
    return null;
  }
}
