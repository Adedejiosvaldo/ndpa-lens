"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useApiForm } from "@/components/use-form";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/api";
import { landingFor, useSession } from "@/lib/session";

function Login() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const { refresh } = useSession();
  const { busy, error, fields, run } = useApiForm();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          const r = await api.post<{ mfaRequired: boolean }>("/v1/auth/login", { email, password });
          if (r.mfaRequired) return router.push(`/login/mfa${next ? `?next=${encodeURIComponent(next)}` : ""}`);
          const me = await refresh();
          if (me) router.push(landingFor(me, next));
        });
      }}
    >
      <h1 className="font-display text-3xl tracking-tight">Welcome back</h1>
      <p className="text-sm text-muted">Sign in to your DPCO workspace.</p>
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} />
      <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} />
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="text-accent underline">
          Forgotten your password?
        </Link>
        <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-accent underline">
          Create an account
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
