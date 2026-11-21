"use client";

import { useState } from "react";
import { useApiForm } from "@/components/use-form";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/api";

export default function ForgotPage() {
  const { busy, error, run } = useApiForm();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          await api.post("/v1/auth/password/forgot", { email });
          setDone(true);
        });
      }}
    >
      <h1 className="text-xl font-semibold">Reset your password</h1>
      {done ? (
        <Alert tone="ok">If an account uses {email}, we've sent a reset link. It expires in 30 minutes.</Alert>
      ) : (
        <>
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" className="w-full" disabled={busy}>
            Send reset link
          </Button>
        </>
      )}
    </form>
  );
}
