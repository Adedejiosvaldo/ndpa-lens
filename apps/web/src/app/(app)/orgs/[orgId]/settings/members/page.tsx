"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useApiForm } from "@/components/use-form";
import { Button } from "@/components/ui/button";
import { Alert, Card, PageSection } from "@/components/ui/card";
import { Confirm } from "@/components/ui/confirm";
import { Field, SelectField } from "@/components/ui/field";
import { api, ApiError, type Role } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useSession } from "@/lib/session";

interface Member {
  userId: string;
  name: string;
  email: string;
  role: Role;
  since: string;
}
interface Invitation {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
}

const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", analyst: "Analyst", viewer: "Viewer" };

export default function MembersPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { me } = useSession();
  const myRole = me?.memberships.find((m) => m.orgId === orgId)?.role;
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const invite = useApiForm();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<Role, "owner">>("analyst");

  const load = useCallback(async () => {
    const [m, i] = await Promise.all([
      api.get<{ items: Member[] }>(`/v1/orgs/${orgId}/members`),
      api.get<{ items: Invitation[] }>(`/v1/orgs/${orgId}/invitations`),
    ]);
    setMembers(m.items);
    setInvites(i.items);
  }, [orgId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      setNotice({ tone: "ok", text: ok });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof ApiError ? `${e.message}${e.detail ? `. ${e.detail}` : ""}` : "Something went wrong." });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-tight">Members</h1>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      <Card>
        <h2 className="font-semibold">Invite a colleague</h2>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void invite.run(async () => {
              await api.post(`/v1/orgs/${orgId}/invitations`, { email, role });
              setNotice({ tone: "ok", text: `Invitation sent to ${email}. It expires in 7 days.` });
              setEmail("");
              await load();
            });
          }}
        >
          <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-64 flex-1" error={invite.fields.email} />
          <SelectField label="Role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            <option value="admin">Admin</option>
            <option value="analyst">Analyst</option>
            <option value="viewer">Viewer</option>
          </SelectField>
          <Button type="submit" disabled={invite.busy}>
            Send invitation
          </Button>
        </form>
        {invite.error && <Alert tone="error" className="mt-3">{invite.error}</Alert>}
      </Card>

      <PageSection title="People">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="py-2 font-medium">Name</th>
              <th className="font-medium">Email</th>
              <th className="font-medium">Role</th>
              <th className="font-medium">Since</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const editable = m.role !== "owner" || myRole === "owner";
              return (
                <tr key={m.userId} className="border-t border-border">
                  <td className="py-2">{m.name}</td>
                  <td>{m.email}</td>
                  <td>
                    {m.role === "owner" || !editable ? (
                      ROLE_LABEL[m.role]
                    ) : (
                      <select
                        aria-label={`Role for ${m.name}`}
                        className="h-8 rounded border border-border bg-bg px-2"
                        value={m.role}
                        onChange={(e) => act(() => api.patch(`/v1/orgs/${orgId}/members/${m.userId}`, { role: e.target.value }), `${m.name} is now ${ROLE_LABEL[e.target.value as Role]}.`)}
                      >
                        <option value="admin">Admin</option>
                        <option value="analyst">Analyst</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    )}
                  </td>
                  <td>{formatDate(m.since)}</td>
                  <td className="space-x-2 text-right">
                    {myRole === "owner" && m.role !== "owner" && (
                      <Confirm
                        trigger={<Button variant="secondary" size="sm">Make Owner</Button>}
                        title={`Transfer ownership to ${m.name}?`}
                        body={`${m.name} will be asked to accept. When they do, they become Owner and you become Admin.`}
                        confirmLabel="Send transfer request"
                        onConfirm={() => act(() => api.post(`/v1/orgs/${orgId}/ownership-transfer`, { userId: m.userId }), `Transfer request sent to ${m.name}.`)}
                      />
                    )}
                    {editable && m.userId !== me?.user.id && (
                      <Confirm
                        trigger={<Button variant="secondary" size="sm">Remove</Button>}
                        title={`Remove ${m.name}?`}
                        body={`${m.name} (${m.email}) will lose access to this organisation straight away.`}
                        confirmLabel={`Remove ${m.name}`}
                        onConfirm={() => act(() => api.del(`/v1/orgs/${orgId}/members/${m.userId}`), `${m.name} has been removed.`)}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </PageSection>

      {invites.length > 0 && (
        <PageSection title="Pending invitations">
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2 font-medium">Email</th>
                <th className="font-medium">Role</th>
                <th className="font-medium">Expires</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id} className="border-t border-border">
                  <td className="py-2">{i.email}</td>
                  <td>{ROLE_LABEL[i.role]}</td>
                  <td>{formatDate(i.expiresAt)}</td>
                  <td className="text-right">
                  <Confirm
                    trigger={<Button variant="ghost" size="sm">Cancel</Button>}
                    title={`Cancel the invitation to ${i.email}?`}
                    body="The link in their email will stop working."
                    confirmLabel="Cancel invitation"
                    onConfirm={() => act(() => api.del(`/v1/orgs/${orgId}/invitations/${i.id}`), `Invitation to ${i.email} cancelled.`)}
                  />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PageSection>
      )}
    </div>
  );
}
