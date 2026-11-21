import type { ErrorCode } from "@ndpa/schema";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** A problem+json error from the API (RFC 9457 with a stable `code`). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | "network_error",
    title: string,
    readonly detail?: string,
    readonly errors: { path: string; message: string }[] = [],
  ) {
    super(title);
  }

  /** Field → message, for forms. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.errors.map((e) => [e.path, e.message]));
  }
}

let csrf: Promise<string> | null = null;

function csrfToken(force = false): Promise<string> {
  if (!csrf || force) {
    csrf = fetch(`${API_URL}/v1/auth/csrf`, { credentials: "include", cache: "no-store" })
      .then((r) => r.json() as Promise<{ csrfToken: string }>)
      .then((b) => b.csrfToken)
      .catch((e) => {
        csrf = null;
        throw e;
      });
  }
  return csrf;
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function call<T>(method: Method, path: string, body?: unknown, retried = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["X-CSRF-Token"] = await csrfToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      credentials: "include",
      cache: "no-store",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "network_error", "Can't reach NDPA Lens", "Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A stale CSRF token (e.g. cookie expired): refresh once and retry.
    if (data.code === "csrf_invalid" && !retried) {
      await csrfToken(true);
      return call<T>(method, path, body, true);
    }
    throw new ApiError(res.status, data.code ?? "internal_error", data.title ?? "Something went wrong", data.detail, data.errors);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => call<T>("GET", path),
  post: <T>(path: string, body?: unknown) => call<T>("POST", path, body ?? {}),
  patch: <T>(path: string, body: unknown) => call<T>("PATCH", path, body),
  del: <T = void>(path: string) => call<T>("DELETE", path),
};

// ---- response shapes used by the shell ----

export type Role = "owner" | "admin" | "analyst" | "viewer";

export interface Me {
  user: { id: string; name: string; email: string; emailVerified: boolean; twoFactorEnabled: boolean; isPlatformAdmin: boolean };
  memberships: { orgId: string; name: string; role: Role }[];
}

export interface Org {
  id: string;
  name: string;
  legalName: string | null;
  address: string | null;
  phone: string | null;
  dpcoLicenceNo: string | null;
  licenceStatus: "unsubmitted" | "pending" | "verified" | "rejected";
  createdAt: string;
}
