"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useApiForm } from "@/components/use-form";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/api";
import { landingFor, useSession } from "@/lib/session";

function Mfa() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const { refresh } = useSession();
  const { busy, error, fields, run } = useApiForm();
  const [recovery, setRecovery] = useState(false);
  const [value, setValue] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          await api.post("/v1/auth/mfa/verify", recovery ? { recoveryCode: value } : { code: value });
          const me = await refresh();
          if (me) router.push(landingFor(me, next));
        });
      }}
    >
      <h1 className="text-xl font-semibold">Two-factor authentication</h1>
      <p className="text-sm text-muted">
        {recovery ? "Enter one of your recovery codes. Each code works once." : "Enter the 6-digit code from your authenticator app."}
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      <Field
        label={recovery ? "Recovery code" : "Code"}
        inputMode={recovery ? "text" : "numeric"}
        autoComplete="one-time-code"
        pattern={recovery ? undefined : "[0-9]{6}"}
        maxLength={recovery ? 64 : 6}
        required
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value.trim())}
        error={fields.code ?? fields.recoveryCode}
      />
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Checking…" : "Continue"}
      </Button>
      <button type="button" className="text-sm text-accent underline" onClick={() => (setRecovery(!recovery), setValue(""))}>
        {recovery ? "Use your authenticator app instead" : "Use a recovery code instead"}
      </button>
    </form>
  );
}

export default function MfaPage() {
  return (
    <Suspense>
      <Mfa />
    </Suspense>
  );
}
