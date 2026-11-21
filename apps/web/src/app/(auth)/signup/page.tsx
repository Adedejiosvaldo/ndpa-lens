"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useApiForm } from "@/components/use-form";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/api";
import { passwordStrength } from "@/lib/password";
import { rememberAfterVerify } from "@/lib/session";

function StrengthMeter({ password }: { password: string }) {
  const { score, label } = passwordStrength(password);
  if (!password) return null;
  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className="h-1.5 flex-1 rounded" style={{ background: i <= score ? "var(--accent)" : "var(--border)" }} />
        ))}
      </div>
      <p className="text-xs text-muted">Password strength: {label}</p>
    </div>
  );
}

function Signup() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  // Invited colleagues join an existing organisation, so they don't create one.
  const invited = !!next?.startsWith("/invitations/");
  const { busy, error, fields, run } = useApiForm();
  const [f, setF] = useState({ name: "", email: "", password: "", legalName: "", tradingName: "", address: "", phone: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          const { legalName, tradingName, address, phone, ...account } = f;
          await api.post("/v1/auth/signup", invited ? account : { ...account, organisation: { legalName, tradingName, address, phone } });
          rememberAfterVerify(next);
          router.push(`/check-email?email=${encodeURIComponent(f.email)}`);
        });
      }}
    >
      <h1 className="text-xl font-semibold">{invited ? "Create your account" : "Set up your DPCO on NDPA Lens"}</h1>
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="Your name" autoComplete="name" required value={f.name} onChange={set("name")} error={fields.name} />
      <Field label="Work email" type="email" autoComplete="email" required value={f.email} onChange={set("email")} error={fields.email} />
      <Field
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        minLength={12}
        value={f.password}
        onChange={set("password")}
        error={fields.password}
        hint="At least 12 characters. We check it against known data breaches."
      />
      <StrengthMeter password={f.password} />
      {!invited && (
        <fieldset className="space-y-4 border-t border-border pt-4">
          <legend className="pt-2 text-sm font-semibold">Your organisation</legend>
          <Field label="Registered (legal) name" required value={f.legalName} onChange={set("legalName")} error={fields["organisation.legalName"]} />
          <Field label="Trading name" required value={f.tradingName} onChange={set("tradingName")} error={fields["organisation.tradingName"]} hint="Shown on your evidence packs." />
          <Field label="Address" required value={f.address} onChange={set("address")} error={fields["organisation.address"]} />
          <Field label="Phone" type="tel" autoComplete="tel" required value={f.phone} onChange={set("phone")} error={fields["organisation.phone"]} placeholder="+234 801 234 5678" />
        </fieldset>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-sm">
        Already have an account?{" "}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-accent underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <Signup />
    </Suspense>
  );
}
