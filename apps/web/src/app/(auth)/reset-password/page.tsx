"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useApiForm } from "@/components/use-form";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/api";

function Reset() {
  const token = useSearchParams().get("token") ?? "";
  const { busy, error, fields, run } = useApiForm();
  const [pw, setPw] = useState("");
  const [done, setDone] = useState(false);
  if (done)
    return (
      <div className="space-y-4">
        <Alert tone="ok">Your password has been changed and you've been signed out everywhere.</Alert>
        <Link href="/login" className="text-sm text-accent underline">
          Sign in
        </Link>
      </div>
    );
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          await api.post("/v1/auth/password/reset", { token, newPassword: pw });
          setDone(true);
        });
      }}
    >
      <h1 className="font-display text-3xl tracking-tight">Choose a new password</h1>
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="New password" type="password" autoComplete="new-password" minLength={12} required value={pw} onChange={(e) => setPw(e.target.value)} error={fields.newPassword} hint="At least 12 characters." />
      <Button type="submit" className="w-full" disabled={busy}>
        Change password
      </Button>
    </form>
  );
}

export default function ResetPage() {
  return (
    <Suspense>
      <Reset />
    </Suspense>
  );
}
