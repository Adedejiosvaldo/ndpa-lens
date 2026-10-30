import * as cheerio from "cheerio";
import type {
  AISettings,
  ClauseStatus,
  PolicyAnalysis,
  PolicyClause,
} from "@/types/audit";

interface ClauseRule {
  id: string;
  title: string;
  description: string;
  legalReference: string;
  strongPatterns: RegExp[];
  partialPatterns: RegExp[];
}

export const NDPA_CLAUSE_RULES: ClauseRule[] = [
  {
    id: "controller-dpo",
    title: "Data Controller Identity & DPO Contact",
    description:
      "Discloses the identity of the data controller and contact details for the Data Protection Officer (DPO) or privacy inquiries.",
    legalReference: "NDPA 2023 ss. 27(1)(a), 32",
    strongPatterns: [
      /data\s+protection\s+officer/i,
      /\bdpo\b.*(@|contact|email|reach)/i,
      /(privacy|dpo|dataprotection)@[a-z0-9.-]+\.[a-z]{2,}/i,
      /data\s+controller\s+(is|means|refers)/i,
    ],
    partialPatterns: [
      /contact\s+us.*privacy/i,
      /privacy\s+(team|office|inquir|officer|contact)/i,
      /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
    ],
  },
  {
    id: "data-categories",
    title: "Categories of Personal Data Collected",
    description:
      "Specifies the types of personal data collected directly, automatically, or from third parties.",
    legalReference: "GAID 2025 Art. 27(3)(c)",
    strongPatterns: [
      /(categories|types)\s+of\s+(personal\s+)?(data|information)\s+(we\s+)?collect/i,
      /information\s+we\s+collect\s+(includes|about\s+you|from\s+you)/i,
      /personal\s+(data|information)\s+collected/i,
    ],
    partialPatterns: [
      /we\s+collect\s+(your\s+)?(name|email|phone|ip\s+address|device)/i,
      /information\s+you\s+provide/i,
    ],
  },
  {
    id: "purpose-lawful-basis",
    title: "Purpose & Lawful Basis for Processing",
    description:
      "Explains specific purposes for processing and maps them to lawful bases under NDPA (consent, contract, legal obligation, legitimate interest, vital interest, or public interest).",
    legalReference: "NDPA 2023 ss. 25(1), 27(1)(b)",
    strongPatterns: [
      /lawful\s+bas(is|es)\s+(for|of)\s+processing/i,
      /legal\s+bas(is|es)\s+(for|to)\s+process/i,
      /(legitimate\s+interest|performance\s+of\s+a\s+contract|legal\s+obligation)[\s\S]*consent/i,
    ],
    partialPatterns: [
      /how\s+we\s+use\s+(your\s+)?(personal\s+)?(data|information)/i,
      /purposes?\s+(for\s+which|of)\s+(we\s+)?(process|use|collect)/i,
    ],
  },
  {
    id: "data-subject-rights",
    title: "Data Subject Rights (Access, Correction, Erasure, Objection)",
    description:
      "Informs Nigerian data subjects of their rights to access, rectify, erase, restrict processing, data portability, and withdraw consent.",
    legalReference: "NDPA 2023 Part VI (ss. 34–38)",
    strongPatterns: [
      /right\s+to\s+(access|rectification|erasure|delete|correct)[\s\S]*right\s+to\s+(object|portability|withdraw)/i,
      /(your\s+(data\s+protection|privacy)\s+rights|rights\s+as\s+a\s+data\s+subject)/i,
      /withdraw\s+(your\s+)?consent\s+at\s+any\s+time/i,
      /rights?\s+of\s+(the\s+)?data\s+subjects?/i,
      /data\s+subjects?['’]?\s+rights/i,
    ],
    partialPatterns: [
      /\bright\s+to\s+(access|rectif|correct|eras|delet|object|portab|restrict)/i,
      /request\s+(access\s+to|deletion\s+of|correction\s+of)\s+your\s+(personal\s+)?(data|information)/i,
      /opt[- ]out\s+of/i,
    ],
  },
  {
    id: "third-party-sharing",
    title: "Recipients & Third-Party Disclosures",
    description:
      "Identifies third parties, processors, service providers, or categories of recipients with whom personal data is shared.",
    legalReference: "NDPA 2023 s. 27(1)(c)",
    strongPatterns: [
      /(sharing|disclosure)\s+of\s+(your\s+)?(personal\s+)?(data|information)/i,
      /(who\s+we\s+share|third[- ]party\s+(service\s+providers|recipients|processors))/i,
    ],
    partialPatterns: [
      /share\s+(your\s+)?(information|data)\s+with\s+(third\s+parties|partners|vendors|affiliates)/i,
      /service\s+providers\s+who\s+assist/i,
    ],
  },
  {
    id: "cross-border-transfer",
    title: "Cross-Border Data Transfers & Safeguards",
    description:
      "Addresses transfers of personal data outside Nigeria and the adequacy or appropriate safeguard mechanisms used.",
    legalReference: "NDPA 2023 Part VIII (ss. 41–43)",
    strongPatterns: [
      /(international|cross[- ]border)\s+(data\s+)?transfers?/i,
      /transfer.*outside\s+(of\s+)?(nigeria|your\s+country|the\s+jurisdiction)/i,
      /standard\s+contractual\s+clauses|adequacy\s+decision|appropriate\s+safeguards/i,
    ],
    partialPatterns: [
      /processed\s+in\s+countries\s+other\s+than/i,
      /servers\s+located\s+(outside|in)/i,
    ],
  },
  {
    id: "retention-period",
    title: "Data Retention Period or Criteria",
    description:
      "States how long personal data will be stored or the criteria used to determine retention periods.",
    legalReference: "NDPA 2023 ss. 24(1)(d), 27(1)(e)",
    strongPatterns: [
      /data\s+retention/i,
      /retain\s+(your\s+)?(personal\s+)?(data|information)\s+for\s+as\s+long\s+as/i,
      /retention\s+period/i,
    ],
    partialPatterns: [
      /how\s+long\s+we\s+keep\s+(your\s+)?(data|information)/i,
      /delete\s+or\s+anonymi[sz]e\s+your\s+(data|information)\s+when\s+no\s+longer/i,
    ],
  },
  {
    id: "ndpc-complaint-right",
    title: "Right to Lodge a Complaint with the NDPC",
    description:
      "Explicitly informs data subjects of their right to complain to the Nigeria Data Protection Commission (NDPC) or supervisory authority.",
    legalReference: "NDPA 2023 ss. 27(1)(f), 46",
    // Only naming the NDPC itself counts. Mentioning the Act is a separate check.
    strongPatterns: [/nigeria\s+data\s+protection\s+commission/i, /\bndpc\b/i],
    partialPatterns: [
      /lodge\s+a\s+complaint\s+with\s+(a\s+|the\s+)?(supervisory|data\s+protection)\s+(authority|commission|regulator)/i,
      /supervisory\s+authority/i,
      /nigeria(n)?\s+data\s+protection\s+bureau|\bndpb\b/i,
    ],
  },
  {
    id: "nigeria-law-reference",
    title: "Written for Nigerian Law (NDPA)",
    description:
      "Refers to the Nigeria Data Protection Act 2023 rather than only GDPR or another country's law.",
    legalReference: "NDPA 2023 s. 27; GAID 2025",
    strongPatterns: [
      /nigeria(n)?\s+data\s+protection\s+act/i,
      /\bNDPA\b/,
      /general\s+application\s+and\s+implementation\s+directive|\bGAID\b/,
    ],
    partialPatterns: [/nigeria(n)?\s+data\s+protection\s+regulation|\bNDPR\b/, /\bnigeria(n)?\b/i],
  },
  {
    id: "automated-decision-making",
    title: "Automated Decision-Making & Profiling Disclosure",
    description:
      "Discloses the existence of automated decision-making or profiling and the right to human intervention.",
    legalReference: "NDPA 2023 ss. 27(1)(g), 37",
    strongPatterns: [
      /automated\s+(decision[- ]making|processing)/i,
      /solely\s+automated.*(profiling|decision)/i,
    ],
    partialPatterns: [
      /\bprofiling\b/i,
      /algorithmic\s+decision/i,
    ],
  },
];

function extractSnippet(text: string, regex: RegExp): string | undefined {
  const match = regex.exec(text);
  if (!match || match.index === undefined) return undefined;
  const start = Math.max(0, match.index - 70);
  const end = Math.min(text.length, match.index + match[0].length + 130);
  const snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "..." : ""}${snippet}${end < text.length ? "..." : ""}`;
}

/** "Last updated: 3 March 2025" and similar, as written in the policy. */
export function findLastUpdated(text: string): string | undefined {
  const m = text.match(
    /(last\s+(updated|revised|modified|reviewed)|effective\s+(date|from|as\s+of)|date\s+of\s+last\s+revision)\s*(on|:|-|–)?\s*([A-Za-z]{3,9}\.?\s+\d{1,2}(st|nd|rd|th)?,?\s+\d{4}|\d{1,2}(st|nd|rd|th)?\s+(of\s+)?[A-Za-z]{3,9},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}[\/.]\d{1,2}[\/.]\d{4})/i
  );
  return m ? m[5].trim() : undefined;
}

export function extractReadablePolicyText(html: string): {
  title: string;
  text: string;
} {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, nav, footer, header, iframe").remove();
  const title =
    $("h1").first().text().trim() ||
    $("title").first().text().trim() ||
    "Privacy Policy";
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return { title, text };
}

export function evaluatePolicyClausesByRules(
  policyText: string,
  policyFound: boolean
): PolicyClause[] {
  if (!policyFound || policyText.trim().length < 120) {
    return NDPA_CLAUSE_RULES.map((rule) => ({
      id: rule.id,
      title: rule.title,
      status: "unavailable" as ClauseStatus,
      description: rule.description,
      legalReference: rule.legalReference,
    }));
  }

  return NDPA_CLAUSE_RULES.map((rule) => {
    for (const pattern of rule.strongPatterns) {
      const snippet = extractSnippet(policyText, pattern);
      if (snippet) {
        return {
          id: rule.id,
          title: rule.title,
          status: "found" as ClauseStatus,
          description: rule.description,
          legalReference: rule.legalReference,
          evidence: snippet,
        };
      }
    }

    for (const pattern of rule.partialPatterns) {
      const snippet = extractSnippet(policyText, pattern);
      if (snippet) {
        return {
          id: rule.id,
          title: rule.title,
          status: "partial" as ClauseStatus,
          description: rule.description,
          legalReference: rule.legalReference,
          evidence: snippet,
        };
      }
    }

    return {
      id: rule.id,
      title: rule.title,
      status: "missing" as ClauseStatus,
      description: rule.description,
      legalReference: rule.legalReference,
    };
  });
}

interface AIReviewPayload {
  summary?: string;
  clauses?: Array<{
    id: string;
    status?: ClauseStatus;
    note?: string;
    evidence?: string;
  }>;
}

export const DEFAULT_AI_MODEL = "anthropic/claude-haiku-5.5";

function resolveAISettings(ai?: AISettings): { apiKey: string; model: string } | null {
  // The API route passes the server's OpenRouter key only when the visitor
  // still has their free review for the day.
  const apiKey = (ai?.apiKey || "").trim();
  if (!apiKey) return null;
  return { apiKey, model: (ai?.model || DEFAULT_AI_MODEL).trim() };
}

async function runAIContextualReview(
  policyText: string,
  clauses: PolicyClause[],
  settings: { apiKey: string; model: string }
): Promise<AIReviewPayload> {
  // Long policies put retention, transfers and complaint routes near the end,
  // so send as much as a small model handles comfortably.
  const truncatedText = policyText.slice(0, 48000);
  const clauseList = clauses.map((c) => ({
    id: c.id,
    title: c.title,
    legalReference: c.legalReference,
    ruleStatus: c.status,
  }));

  const prompt = `You are a Nigerian data protection legal analyst auditing a website Privacy Policy against the Nigeria Data Protection Act (NDPA) 2023.
Review the policy text and evaluate each clause ID below.
Return strictly valid JSON with this structure:
{
  "summary": "2-3 sentence executive assessment of the policy's compliance with NDPA 2023, noting Nigeria/NDPC specificity and key gaps.",
  "clauses": [
    {
      "id": "clause-id",
      "status": "found" | "partial" | "missing",
      "note": "1 concise sentence explaining why it passes, is partial, or is missing under NDPA 2023."
    }
  ]
}

Clauses to evaluate:
${JSON.stringify(clauseList, null, 2)}

Privacy Policy Text:
"""
${truncatedText}
"""`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40000);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
        "X-Title": "NDPA Lens",
      },
      body: JSON.stringify({
        model: settings.model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an NDPA 2023 legal compliance auditor. Always respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        // Caps the cost of each review.
        max_tokens: 1500,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`OpenRouter API returned HTTP ${res.status}`);
    }
    const data = await res.json();
    const rawJsonText: string = data?.choices?.[0]?.message?.content || "";

    const cleaned = rawJsonText
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error("AI response did not contain valid JSON");
    }

    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as AIReviewPayload;
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzePrivacyPolicy(params: {
  found: boolean;
  url?: string;
  html?: string;
  /** Rendered text from the browser, preferred over parsing the HTML. */
  text?: string;
  ai?: AISettings;
}): Promise<PolicyAnalysis> {
  if (!params.found || !params.html) {
    return {
      found: false,
      url: params.url,
      contentLength: 0,
      clauses: evaluatePolicyClausesByRules("", false),
      source: "rules",
    };
  }

  const parsed = extractReadablePolicyText(params.html);
  const title = parsed.title;
  const text = params.text && params.text.length > parsed.text.length ? params.text : parsed.text;
  const baseClauses = evaluatePolicyClausesByRules(text, true);
  const resolvedAI = resolveAISettings(params.ai);
  const lastUpdated = findLastUpdated(text);

  if (!resolvedAI || text.length < 150) {
    return {
      found: true,
      url: params.url,
      title,
      contentLength: text.length,
      lastUpdated,
      clauses: baseClauses,
      source: "rules",
    };
  }

  try {
    const aiReview = await runAIContextualReview(text, baseClauses, resolvedAI);
    const aiMap = new Map(
      (aiReview.clauses || []).map((item) => [item.id, item])
    );

    const mergedClauses: PolicyClause[] = baseClauses.map((clause) => {
      const aiClause = aiMap.get(clause.id);
      if (!aiClause) return clause;
      const validStatuses: ClauseStatus[] = ["found", "partial", "missing"];
      const nextStatus =
        aiClause.status && validStatuses.includes(aiClause.status)
          ? aiClause.status
          : clause.status;

      return {
        ...clause,
        status: nextStatus,
        aiNote: aiClause.note || clause.aiNote,
        evidence: clause.evidence || aiClause.evidence,
      };
    });

    return {
      found: true,
      url: params.url,
      title,
      contentLength: text.length,
      lastUpdated,
      clauses: mergedClauses,
      source: "rules+ai",
      aiSummary: aiReview.summary,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AI contextual review failed";
    return {
      found: true,
      url: params.url,
      title,
      contentLength: text.length,
      lastUpdated,
      clauses: baseClauses,
      source: "rules",
      aiError: message,
    };
  }
}
