import { researchMulti, formatResultsForContext } from "./tools/researcher";
import {
  searchPeople,
  formatContactsForContext,
  DEFAULT_DECISION_MAKER_TITLES,
} from "./tools/apollo";
import { SYSTEM_PROMPT } from "./prompts/system";
import { detectEntities } from "./entities";
import { getMemoryContext } from "./session";

export { detectEntities } from "./entities";

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

export function detectCrmIntent(raw: string): CrmIntent | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const tokens = tokenize(trimmed);
  const first = tokens[0]?.toLowerCase();
  if (first !== "crm") return null;
  if (tokens.length === 1) return { kind: "crm" };
  if (tokens[1]?.toLowerCase() === "update") {
    if (tokens.length < 5) return null;
    return {
      kind: "crm_update",
      diffuseur: tokens[2]!,
      statut: tokens[3]!,
      nextStep: tokens.slice(4).join(" "),
    };
  }
  return null;
}

/* ---------- PPTX intent ---------- */

const PPT_INTENT_RE = /\b(decks?|ppt|pptx|powerpoint|pr[ée]sentation|slides?|pitch)\b/i;

export function isPptxIntent(text: string): boolean {
  return PPT_INTENT_RE.test(text);
}

/* ---------- Triggers ---------- */

const CONTACT_INTENT_RE =
  /\b(contact|contacts|décideur|decideur|d[ée]cideurs|CTO|email|e-mail|courriel|LinkedIn|directeur technique|directrice technique|head of|VP|responsable accessibilit|chief technology)/i;

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
 * - Detects broadcasters / markets and injects fresh web context.
 * - Triggers Apollo people search when contact-related keywords are present.
 * - Injects session memory so the model can reference prior turns in this session.
 * - Carries the last N turns of conversation history.
 */
export async function buildConversationalRequest(
  userMessage: string,
  history: ChatTurn[],
): Promise<{ system: string; messages: ChatTurn[] }> {
  const entities = detectEntities(userMessage);
  const contextBlocks: string[] = [];

  // Web research
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
        contextBlocks.push(
          `[CONTEXTE WEB RÉCENT — ${labelParts.join(" | ")}]\n` +
            formatResultsForContext(results) +
            `\n[/CONTEXTE WEB]`,
        );
      }
    } catch {
      // research failure is non-fatal
    }
  }

  // Apollo enrichment — only when a broadcaster is in scope AND the user asked
  // for contact-level info. Non-blocking : a failure leaves contextBlocks alone.
  if (entities.broadcasters.length > 0 && CONTACT_INTENT_RE.test(userMessage)) {
    try {
      const company = entities.broadcasters[0]!;
      const contacts = await searchPeople(company, DEFAULT_DECISION_MAKER_TITLES);
      if (contacts.length > 0) {
        contextBlocks.push(
          `[APOLLO — décideurs trouvés chez ${company}]\n` +
            formatContactsForContext(contacts) +
            `\n[/APOLLO]`,
        );
      }
    } catch {
      // apollo failure is non-fatal
    }
  }

  // Session memory
  const mem = getMemoryContext();
  if (mem) contextBlocks.push(mem);

  const augmentedUser =
    contextBlocks.length > 0
      ? `${userMessage}\n\n${contextBlocks.join("\n\n")}`
      : userMessage;

  const messages: ChatTurn[] = [
    ...history.slice(-10),
    { role: "user", content: augmentedUser },
  ];

  return { system: SYSTEM_PROMPT, messages };
}
