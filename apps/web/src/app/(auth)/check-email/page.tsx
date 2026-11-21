"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { api } from "@/lib/api";

function CheckEmail() {
  const email = useSearchParams().get("email") ?? "";
  const [sent, setSent] = useState(false);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Check your email</h1>
      <p className="text-sm text-muted">
        We've sent a link to <strong className="text-text">{email || "your inbox"}</strong>. Open it to confirm your address and sign in.
      </p>
      {sent && <Alert tone="ok">If that address needs confirming, a new link is on its way.</Alert>}
      {email && (
        <Button variant="secondary" onClick={() => api.post("/v1/auth/verify-email/resend", { email }).then(() => setSent(true))}>
          Send the link again
        </Button>
      )}
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense>
      <CheckEmail />
    </Suspense>
  );
}
