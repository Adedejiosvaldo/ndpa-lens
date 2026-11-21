import { readFileSync } from "node:fs";
import type { EvidenceBundle } from "@ndpa/scan-engine";
import { describe, expect, it } from "vitest";
import { ASSIST_PROMPT_VERSION, assistPolicy, CHECKS_01_10, CHECKS_11_20, openRouterClient, parseAssist, redact, runChecks } from "../src/index.js";

const c18: EvidenceBundle = JSON.parse(readFileSync(new URL("../golden/c18-fail.json", import.meta.url), "utf8"));
const meta = { model: "test-model", promptVersion: ASSIST_PROMPT_VERSION };
const reply = (items: object[]) => JSON.stringify({ items });
const C18 = CHECKS_11_20.find((c) => c.id === "C-18")!;
const C08 = CHECKS_01_10.find((c) => c.id === "C-08")!;

describe("LLM assist (PRD §5.2)", () => {
  it("a confident, quote-backed answer decides, and the finding is labelled assisted with llm_output evidence", () => {
    const assist = parseAssist(reply([{ id: "rights-channel", present: false, confidence: 0.9, quote: "" }]), c18.policy.text, meta);
    const [f] = runChecks(c18, { checks: [C18], assist });
    expect(f).toMatchObject({ status: "fail", assisted: { model: "test-model", promptVersion: ASSIST_PROMPT_VERSION } });
    expect(f!.evidence).toContainEqual({ kind: "llm_output", sha256: assist.rawSha256, pointer: "rights-channel" });
  });

  it("low confidence means needs-review, never a verdict", () => {
    const assist = parseAssist(reply([{ id: "rights-channel", present: false, confidence: 0.4, quote: "" }]), c18.policy.text, meta);
    expect(runChecks(c18, { checks: [C18], assist })[0]).toMatchObject({ status: "needs_review", assisted: { model: "test-model" } });
  });

  it("a 'present' answer whose quote isn't in the policy can't pass", () => {
    const assist = parseAssist(reply([{ id: "rights-channel", present: true, confidence: 0.99, quote: "Email rights@example.com to make a request." }]), c18.policy.text, meta);
    expect(assist.items[0]).toMatchObject({ quoteVerified: false, usable: false });
    expect(runChecks(c18, { checks: [C18], assist })[0]!.status).toBe("needs_review");
  });

  it("rules that find the clause outrank the model, and those results aren't labelled assisted", () => {
    const assist = parseAssist(reply([{ id: "retention-period", present: false, confidence: 0.99, quote: "" }]), c18.policy.text, meta);
    const f = runChecks(c18, { checks: [C08], assist }).find((x) => x.subId === "retention-period")!;
    expect(f.status).toBe("pass");
    expect(f.assisted).toBeUndefined();
  });

  it("malformed or unknown output is ignored item by item; the raw reply is still hashed for the record", () => {
    for (const raw of ["not json", "```json\n{\"items\": [{\"id\": \"made-up\", \"present\": true, \"confidence\": 1, \"quote\": \"x\"}]}\n```", reply([{ id: "dpo-contact", present: "yes" }])]) {
      const a = parseAssist(raw, c18.policy.text, meta);
      expect(a.items).toEqual([]);
      expect(a.rawSha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("assistPolicy calls the model once with the versioned prompt and returns null if the call fails", async () => {
    const calls: string[] = [];
    const ok = await assistPolicy(c18.policy.text, { model: "m", complete: async (r) => (calls.push(r.user), reply([{ id: "dpo-contact", present: true, confidence: 0.9, quote: "Contact the DPO at dpo@fixtures.test." }])) });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("rights-channel:");
    expect(ok).toMatchObject({ model: "m", promptVersion: ASSIST_PROMPT_VERSION });
    expect(ok!.items[0]).toMatchObject({ id: "dpo-contact", usable: true });
    expect(await assistPolicy(c18.policy.text, { model: "m", complete: async () => { throw new Error("timeout"); } })).toBeNull();
    expect(await assistPolicy("too short", { model: "m", complete: async () => "{}" })).toBeNull();
  });

  it("the OpenRouter client asks for strict JSON at temperature 0", async () => {
    let body: Record<string, unknown> = {};
    const client = openRouterClient({
      apiKey: "test-key",
      fetchImpl: (async (_u: string, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-key");
        return new Response(JSON.stringify({ choices: [{ message: { content: "{\"items\":[]}" } }] }));
      }) as typeof fetch,
    });
    expect(await client.complete({ system: "s", user: "u", schema: { type: "object" } })).toBe("{\"items\":[]}");
    expect(body).toMatchObject({ temperature: 0, response_format: { type: "json_schema", json_schema: { strict: true } } });
    const failing = openRouterClient({ apiKey: "k", fetchImpl: (async () => new Response("no", { status: 429 })) as typeof fetch });
    await expect(failing.complete({ system: "s", user: "u", schema: {} })).rejects.toThrow(/429/);
  });
});

describe("redaction", () => {
  it("strips emails, Nigerian phone numbers and hashes before a URL is stored in a finding", () => {
    const out = redact("https://www.facebook.com/tr?ev=Lead&em=ada.obi%40example.com&ph=08031234567&ud[em]=" + "a".repeat(64));
    expect(out).not.toMatch(/ada\.obi|08031234567|a{64}/);
    expect(out).toContain("[email]");
    expect(out).toContain("[phone]");
    expect(out).toContain("[hash]");
  });
});
