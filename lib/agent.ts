import { researchMulti, formatResultsForContext } from "./tools/researcher";
import { SYSTEM_PROMPT } from "./prompts/system";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type CrmIntent =
  | { kind: "crm" }
  | { kind: "crm_update"; diffuseur: string; statut: string; nextStep: string };

function tokenize(input: string): string[] {
  const out: string[] = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) out.push(m[1] ?? m[2]);
  return out;
}

/**
 * Detect CRM-only commands that must be handled client-side (localStorage).
 * Returns null if the message is conversational (everything else).
 */
export function detectCrmIntent(raw: string): CrmIntent | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const tokens = tokenize(trimmed);
  const first = tokens[0]?.toLowerCase();
  if (first !== "crm") return null;
  if (tokens.length === 1) return { kind: "crm" };
  if (tokens[1]?.toLowerCase() === "update") {
    if (tokens.length < 5) {
      // Treat malformed crm update as conversational so the LLM can guide the user.
      return null;
    }
    return {
      kind: "crm_update",
      diffuseur: tokens[2]!,
      statut: tokens[3]!,
      nextStep: tokens.slice(4).join(" "),
    };
  }
  return null;
}

/* ---------- Entity detection ---------- */

const BROADCASTERS: string[] = [
  "RTBF",
  "RTL Belgium",
  "BX1",
  "Télé MB",
  "Tele MB",
  "TV Lux",
  "RTC Liège",
  "RTC Liege",
  "VRT",
  "Sporza",
  "VTM",
  "DPG Media NL",
  "DPG Media",
  "TVL",
  "WTV",
  "ROBtv",
  "NPO",
  "RTL Nederland",
  "Talpa",
  "BFM Régions",
  "BFM Regions",
  "BFM",
];

const MARKETS: string[] = [
  "CSA",
  "VRM",
  "Mediakabel",
  "ARCOM",
  "Belgique FR",
  "Belgique FL",
  "Belgique",
  "Wallonie",
  "Flandre",
  "flamand",
  "Pays-Bas",
  "Pays Bas",
  "Nederland",
  "France",
];

function dedupSubstrings(matches: string[]): string[] {
  const sorted = [...matches].sort((a, b) => b.length - a.length);
  const kept: string[] = [];
  for (const m of sorted) {
    if (!kept.some((k) => k.toLowerCase().includes(m.toLowerCase()))) {
      kept.push(m);
    }
  }
  return kept;
}

function findMatches(text: string, dict: string[]): string[] {
  const lower = text.toLowerCase();
  const hits = dict.filter((x) => lower.includes(x.toLowerCase()));
  return dedupSubstrings(hits);
}

export function detectEntities(text: string): {
  broadcasters: string[];
  markets: string[];
} {
  return {
    broadcasters: findMatches(text, BROADCASTERS),
    markets: findMatches(text, MARKETS),
  };
}

/* ---------- Conversational request builder ---------- */

function buildResearchQueries(entities: {
  broadcasters: string[];
  markets: string[];
}): string[] {
  const queries: string[] = [];
  for (const b of entities.broadcasters.slice(0, 2)) {
    queries.push(`${b} chaîne TV broadcaster actualité`);
    queries.push(`${b} sous-titrage direct accessibilité`);
    queries.push(`${b} CTO directeur technique`);
  }
  for (const m of entities.markets.slice(0, 1)) {
    if (!queries.some((q) => q.toLowerCase().includes(m.toLowerCase()))) {
      queries.push(`${m} obligation sous-titrage direct broadcast`);
      queries.push(`${m} accessibilité TV régulateur ${new Date().getFullYear()}`);
    }
  }
  return queries.slice(0, 6);
}

/**
 * Build the Groq payload for any conversational user message.
 * - Detects broadcasters / markets and injects fresh web context when found.
 * - Carries the last N turns of conversation history (already trimmed by the caller).
 */
export async function buildConversationalRequest(
  userMessage: string,
  history: ChatTurn[],
): Promise<{ system: string; messages: ChatTurn[] }> {
  const entities = detectEntities(userMessage);
  let webBlock = "";

  if (entities.broadcasters.length > 0 || entities.markets.length > 0) {
    const queries = buildResearchQueries(entities);
    try {
      const results = await researchMulti(queries, 4);
      if (results.length > 0) {
        const labelParts: string[] = [];
        if (entities.broadcasters.length) {
          labelParts.push(`diffuseurs : ${entities.broadcasters.join(", ")}`);
        }
        if (entities.markets.length) {
          labelParts.push(`marchés : ${entities.markets.join(", ")}`);
        }
        webBlock =
          `\n\n[CONTEXTE WEB RÉCENT — ${labelParts.join(" | ")}]\n` +
          formatResultsForContext(results) +
          `\n[/CONTEXTE WEB]`;
      }
    } catch {
      // research failure is non-fatal — continue without web context
    }
  }

  const augmentedUser = webBlock ? `${userMessage}${webBlock}` : userMessage;

  const messages: ChatTurn[] = [
    ...history.slice(-10),
    { role: "user", content: augmentedUser },
  ];

  return { system: SYSTEM_PROMPT, messages };
}
