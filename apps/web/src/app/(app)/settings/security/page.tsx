"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useApiForm } from "@/components/use-form";
import { Button } from "@/components/ui/button";
import { Alert, Card, PageSection } from "@/components/ui/card";
import { Confirm } from "@/components/ui/confirm";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/api";
import { compactIp, describeDevice } from "@/lib/device";
import { formatDateTime } from "@/lib/format";
import { useSession } from "@/lib/session";

interface Enrolment {
  otpauthUri: string;
  manualKey: string;
  recoveryCodes: string[];
}

function downloadCodes(codes: string[], email: string) {
  const body = `NDPA Lens recovery codes for ${email}\nEach code works once. Keep them somewhere safe.\n\n${codes.join("\n")}\n`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
  a.download = "ndpa-lens-recovery-codes.txt";
  a.click();
  URL.revokeObjectURL(a.href);
}

function Mfa() {
  const { me, refresh, mfaRequired } = useSession();
  const setup = useSearchParams().get("setup");
  const enrolForm = useApiForm();
  const confirmForm = useApiForm();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The QR library only loads once someone starts enrolment.
    if (enrolment) void import("qrcode").then((q) => q.toDataURL(enrolment.otpauthUri, { margin: 1, width: 192 })).then(setQr);
  }, [enrolment]);

  if (!me) return null;
  if (me.user.twoFactorEnabled)
    return (
      <Card>
        <h2 className="font-semibold">Two-factor authentication</h2>
        {done && enrolment && (
          <Alert tone="ok" className="mt-3">
            Two-factor authentication is on. Download your recovery codes if you haven't yet.
          </Alert>
        )}
        <p className="mt-2 text-sm text-muted">On. Each sign-in asks for a code from your authenticator app.</p>
        {done && enrolment && (
          <Button variant="secondary" className="mt-4" onClick={() => downloadCodes(enrolment.recoveryCodes, me.user.email)}>
            Download recovery codes
          </Button>
        )}
      </Card>
    );

  return (
    <Card className="space-y-4">
      <h2 className="font-semibold">Two-factor authentication</h2>
      {(mfaRequired || setup) && (
        <Alert>Owners must use two-factor authentication. Set it up to continue to your organisation.</Alert>
      )}
      {!enrolment ? (
        <form
          className="max-w-sm space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void enrolForm.run(async () => setEnrolment(await api.post<Enrolment>("/v1/auth/mfa/enrol", { password })));
          }}
        >
          {enrolForm.error && <Alert tone="error">{enrolForm.error}</Alert>}
          <Field label="Confirm your password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" disabled={enrolForm.busy}>
            Set up authenticator app
          </Button>
        </form>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm">1. Scan this QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…).</p>
            {qr && <img src={qr} alt="QR code for your authenticator app" width={192} height={192} className="rounded border border-border bg-white p-2" />}
            <p className="text-sm text-muted">Can't scan? Enter this key:</p>
            <code data-testid="manual-key" className="block rounded bg-surface-2 px-2 py-1 font-mono text-sm break-all">
              {enrolment.manualKey}
            </code>
          </div>
          <div className="space-y-3">
            <p className="text-sm">2. Save your recovery codes. Each works once if you lose your phone.</p>
            <ul className="grid grid-cols-2 gap-1 rounded bg-surface-2 p-3 font-mono text-sm" data-testid="recovery-codes">
              {enrolment.recoveryCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <Button variant="secondary" onClick={() => downloadCodes(enrolment.recoveryCodes, me.user.email)}>
              Download recovery codes
            </Button>
            <form
              className="space-y-3 pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                void confirmForm.run(async () => {
                  await api.post("/v1/auth/mfa/confirm", { code });
                  setDone(true);
                  await refresh();
                });
              }}
            >
              <p className="text-sm">3. Enter the 6-digit code your app shows.</p>
              {confirmForm.error && <Alert tone="error">{confirmForm.error}</Alert>}
              <Field label="Code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.trim())} />
              <Button type="submit" disabled={confirmForm.busy}>
                Turn on two-factor authentication
              </Button>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}

interface SessionRow {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

function Sessions() {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const load = useCallback(() => api.get<{ items: SessionRow[] }>("/v1/me/sessions").then((r) => setRows(r.items)), []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <PageSection title="Where you're signed in" description="Sessions end after 12 hours without activity, and after 7 days at most.">
      <table className="w-full text-sm">
        <thead className="text-left text-muted">
          <tr>
            <th className="py-2 font-medium">Device</th>
            <th className="font-medium">IP address</th>
            <th className="font-medium">Last active</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows?.map((s) => (
            <tr key={s.id} className="border-t border-border">
              <td className="max-w-xs truncate py-2" title={s.userAgent ?? ""}>
                {describeDevice(s.userAgent)} {s.current && <span className="ml-1 text-xs text-ok">(this device)</span>}
              </td>
              <td>{compactIp(s.ipAddress)}</td>
              <td>{formatDateTime(s.lastSeenAt)}</td>
              <td className="text-right">
                {!s.current && (
                  <Confirm
                    trigger={<Button variant="secondary" size="sm">Sign out</Button>}
                    title="Sign out this session?"
                    body={`${describeDevice(s.userAgent)} (${compactIp(s.ipAddress)}) will be signed out straight away.`}
                    confirmLabel="Sign out session"
                    onConfirm={async () => {
                      await api.del(`/v1/me/sessions/${s.id}`);
                      await load();
                    }}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageSection>
  );
}

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-tight">Security</h1>
      <Suspense>
        <Mfa />
      </Suspense>
      <Sessions />
    </div>
  );
}
