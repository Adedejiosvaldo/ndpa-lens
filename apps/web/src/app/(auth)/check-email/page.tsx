"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { api } from "@/lib/api";
import { readPendingEmail } from "@/lib/pending-email";

export default function CheckEmailPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => setEmail(readPendingEmail()), []);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl tracking-tight">Check your email</h1>
      <p className="text-sm text-muted">
        We've sent a link to <strong className="text-text">{email || "your inbox"}</strong>. Open it on this device to confirm your address and sign straight in. The link expires in 24 hours.
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
