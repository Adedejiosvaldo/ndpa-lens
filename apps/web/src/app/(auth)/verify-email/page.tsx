"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { landingFor, takeAfterVerify, useSession } from "@/lib/session";

function Verify() {
  const token = useSearchParams().get("token");
  const router = useRouter();
  const { refresh } = useSession();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api
      .post("/v1/auth/verify-email", { token })
      .then(refresh)
      .then((me) => router.replace(me ? landingFor(me, takeAfterVerify()) : "/login"))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Something went wrong."));
  }, [token, refresh, router]);

  if (!token || error)
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Confirm your email</h1>
        <Alert tone="error">{error ?? "This link is missing its token."}</Alert>
        <Link href="/login" className="text-sm text-accent underline">
          Go to sign in
        </Link>
      </div>
    );
  return <p className="text-muted">Confirming your email…</p>;
}

export default function VerifyPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
