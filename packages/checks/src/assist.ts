import { createHash } from "node:crypto";

/**
 * LLM-assisted policy reading (PRD §5.1 step 8, §5.2). The model is asked
 * once per scan; its raw reply is stored as evidence and replayed by the
 * checks, so findings stay reproducible without calling the model again.
 * Every finding that relies on it is labelled "assisted".
 */
export const ASSIST_PROMPT_VERSION = "policy-disclosures@1";
export const DEFAULT_ASSIST_MODEL = "anthropic/claude-haiku-5.5";
/** Below this, or with a quote we can't find in the policy, the item needs review. */
export const ASSIST_MIN_CONFIDENCE = 0.7;
const MAX_POLICY_CHARS = 48_000;

export const ASSIST_ITEMS = [
  { id: "controller-dpo", question: "Does the policy identify the data controller (the organisation responsible), with contact details?" },
  { id: "purpose-lawful-basis", question: "Does it state the purposes of processing and the lawful basis for them?" },
  { id: "retention-period", question: "Does it state how long personal data is kept, or the criteria used to decide?" },
  { id: "data-subject-rights", question: "Does it list the data subject's rights (access, rectification, erasure, portability, objection, withdrawing consent)?" },
  { id: "cross-border-transfer", question: "Does it say whether personal data is transferred outside Nigeria, and on what basis or safeguard?" },
  { id: "ndpc-complaint-right", question: "Does it tell people they can complain to the Nigeria Data Protection Commission (NDPC)?" },
  { id: "dpo-contact", question: "Does it give a way to contact a Data Protection Officer (an email, phone number or form)?" },
  { id: "rights-channel", question: "Does it tell people how to make a rights request (an email, form, portal or address to send it to)?" },
] as const;
export type AssistItemId = (typeof ASSIST_ITEMS)[number]["id"];

export interface AssistItem {
  id: AssistItemId;
  present: boolean;
  confidence: number;
  quote: string;
  /** The quote was found verbatim (ignoring case and spacing) in the policy. */
  quoteVerified: boolean;
  /** Confident and, when present, backed by a verified quote. */
  usable: boolean;
}

export interface PolicyAssist {
  model: string;
  promptVersion: string;
  /** The model's reply exactly as received; stored as llm_output evidence. */
  raw: string;
  rawSha256: string;
  items: AssistItem[];
}

export interface LlmRequest {
  system: string;
  user: string;
  schema: Record<string, unknown>;
}

export interface LlmClient {
  model: string;
  /** Returns the model's reply text (JSON). */
  complete(req: LlmRequest): Promise<string>;
}

export function buildAssistPrompt(policyText: string): LlmRequest {
  return {
    system:
      "You are a Nigerian data protection analyst reading a website privacy policy against the Nigeria Data Protection Act 2023. Answer only from the policy text. For each question, say whether the policy covers it, how confident you are (0 to 1), and quote the shortest exact sentence from the policy that supports a yes. Use an empty quote for a no. Never invent text.",
    user: `Questions:\n${ASSIST_ITEMS.map((q) => `- ${q.id}: ${q.question}`).join("\n")}\n\nPrivacy policy text:\n"""\n${policyText.slice(0, MAX_POLICY_CHARS)}\n"""`,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["items"],
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "present", "confidence", "quote"],
            properties: {
              id: { type: "string", enum: ASSIST_ITEMS.map((q) => q.id) },
              present: { type: "boolean" },
              confidence: { type: "number" },
              quote: { type: "string" },
            },
          },
        },
      },
    },
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

/**
 * Parse a stored reply against the policy it was asked about. Pure, so the
 * same raw output always yields the same items. Missing or malformed items
 * are dropped (the checks then fall back to rules or needs-review).
 */
export function parseAssist(raw: string, policyText: string, meta: { model: string; promptVersion: string }): PolicyAssist {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    parsed = null;
  }
  const known = new Set<string>(ASSIST_ITEMS.map((q) => q.id));
  const policy = norm(policyText);
  const items: AssistItem[] = [];
  const list = (parsed as { items?: unknown })?.items;
  if (Array.isArray(list)) {
    for (const it of list) {
      const { id, present, confidence, quote } = (it ?? {}) as Record<string, unknown>;
      if (typeof id !== "string" || !known.has(id) || typeof present !== "boolean" || typeof confidence !== "number") continue;
      if (items.some((x) => x.id === id)) continue;
      const q = typeof quote === "string" ? quote.trim() : "";
      const quoteVerified = q.length >= 8 && policy.includes(norm(q));
      const c = Math.max(0, Math.min(1, confidence));
      items.push({ id: id as AssistItemId, present, confidence: c, quote: q, quoteVerified, usable: c >= ASSIST_MIN_CONFIDENCE && (!present || quoteVerified) });
    }
  }
  return { model: meta.model, promptVersion: meta.promptVersion, raw, rawSha256: createHash("sha256").update(raw, "utf8").digest("hex"), items };
}

/** Ask the model once. Returns null (rules only) if the call fails. */
export async function assistPolicy(policyText: string, client: LlmClient): Promise<PolicyAssist | null> {
  if (policyText.trim().length < 200) return null;
  try {
    const raw = await client.complete(buildAssistPrompt(policyText));
    return parseAssist(raw, policyText, { model: client.model, promptVersion: ASSIST_PROMPT_VERSION });
  } catch {
    return null;
  }
}

/** OpenRouter chat completions with a strict JSON schema (the provider the legacy scanner already uses). */
export function openRouterClient(opts: { apiKey: string; model?: string; timeoutMs?: number; fetchImpl?: typeof fetch }): LlmClient {
  const model = opts.model ?? DEFAULT_ASSIST_MODEL;
  const f = opts.fetchImpl ?? fetch;
  return {
    model,
    async complete(req) {
      const res = await f("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(opts.timeoutMs ?? 35_000),
        headers: { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
          response_format: { type: "json_schema", json_schema: { name: "policy_disclosures", strict: true, schema: req.schema } },
          provider: { require_parameters: true },
        }),
      });
      if (!res.ok) throw new Error(`LLM request failed (${res.status})`);
      const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("LLM reply had no content");
      return content;
    },
  };
}
