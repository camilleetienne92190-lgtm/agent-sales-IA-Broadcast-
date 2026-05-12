import { detectEntities } from "./entities";

export type EmailRecord = { broadcaster: string; type: string };

export type ProspectRecord = { broadcaster: string; score?: string };

export type SessionMemory = {
  prospectedBroadcasters: ProspectRecord[];
  generatedEmails: EmailRecord[];
  lastBroadcaster: string | null;
  lastPersona: string | null;
  lastLanguage: "FR" | "NL" | null;
};

const memory: SessionMemory = {
  prospectedBroadcasters: [],
  generatedEmails: [],
  lastBroadcaster: null,
  lastPersona: null,
  lastLanguage: null,
};

export function getSessionMemory(): SessionMemory {
  return memory;
}

export function resetSessionMemory(): void {
  memory.prospectedBroadcasters = [];
  memory.generatedEmails = [];
  memory.lastBroadcaster = null;
  memory.lastPersona = null;
  memory.lastLanguage = null;
}

function detectScore(text: string): string | null {
  const m = text.match(/Score\s*:\s*\*{0,2}(\d{1,2}\/10)/i);
  return m ? m[1]! : null;
}

function detectEmailStage(text: string): string | null {
  const m = text.match(
    /(?:Étape|Etape|Stage)\s*:\s*\*{0,2}\s*(cold|followup_7|followup_14|breakup)/i,
  );
  if (m) return m[1]!.toLowerCase();
  if (/\bemail\s+cold\b/i.test(text)) return "cold";
  if (/relance\s+J\+?7|followup\s*7/i.test(text)) return "followup_7";
  if (/relance\s+J\+?14|followup\s*14/i.test(text)) return "followup_14";
  if (/breakup|rupture/i.test(text)) return "breakup";
  return null;
}

function detectLanguage(text: string): "FR" | "NL" | null {
  if (/\b(NL|néerlandais|nederlands|flamand|vlaams|dutch)\b/i.test(text))
    return "NL";
  if (/\b(FR|français|francais|french)\b/i.test(text)) return "FR";
  return null;
}

const PERSONA_PATTERNS: string[] = [
  "CTO",
  "Chief Technology Officer",
  "Directeur Technique",
  "Directrice Technique",
  "Head of Technology",
  "Head of Broadcast Tech",
  "Technical Director",
  "Responsable Accessibilité",
  "Directeur des Opérations",
  "VP Engineering",
];

function detectPersona(text: string): string | null {
  for (const p of PERSONA_PATTERNS) {
    const re = new RegExp(`\\b${p.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (re.test(text)) return p;
  }
  return null;
}

function hasFiche(text: string): boolean {
  return /(^|\n)\s*\*{0,2}FICHE\s*—/i.test(text);
}

export function updateMemory(message: string, response: string): void {
  const combined = `${message}\n${response}`;
  const entsCombined = detectEntities(combined);
  const entsMsg = detectEntities(message);

  if (entsCombined.broadcasters.length > 0) {
    const focusBroadcaster =
      entsMsg.broadcasters[0] ?? entsCombined.broadcasters[0]!;
    memory.lastBroadcaster = focusBroadcaster;

    const score = detectScore(response);
    if (score || hasFiche(response)) {
      const existing = memory.prospectedBroadcasters.find(
        (x) => x.broadcaster.toLowerCase() === focusBroadcaster.toLowerCase(),
      );
      if (!existing) {
        memory.prospectedBroadcasters.push({
          broadcaster: focusBroadcaster,
          score: score ?? undefined,
        });
      } else if (score) {
        existing.score = score;
      }
    }
  }

  const stage = detectEmailStage(combined);
  const targetBroadcaster =
    entsMsg.broadcasters[0] ??
    entsCombined.broadcasters[0] ??
    memory.lastBroadcaster;
  if (stage && targetBroadcaster) {
    const last = memory.generatedEmails[memory.generatedEmails.length - 1];
    const next = { broadcaster: targetBroadcaster, type: stage };
    if (!last || last.broadcaster !== next.broadcaster || last.type !== next.type) {
      memory.generatedEmails.push(next);
    }
  }

  const lang = detectLanguage(message) ?? detectLanguage(response);
  if (lang) memory.lastLanguage = lang;

  const persona = detectPersona(message) ?? detectPersona(response);
  if (persona) memory.lastPersona = persona;
}

export function getMemoryContext(): string {
  const m = memory;
  const parts: string[] = [];

  if (m.prospectedBroadcasters.length > 0) {
    const items = m.prospectedBroadcasters
      .map((x) => (x.score ? `${x.broadcaster} (score ${x.score})` : x.broadcaster))
      .join(", ");
    parts.push(`Diffuseurs déjà prospectés : ${items}.`);
  }

  if (m.generatedEmails.length > 0) {
    const items = m.generatedEmails
      .slice(-6)
      .map((e) => `${e.broadcaster}/${e.type}`)
      .join(", ");
    parts.push(`Emails déjà générés : ${items}.`);
  }

  if (m.lastBroadcaster) parts.push(`Dernier diffuseur évoqué : ${m.lastBroadcaster}.`);
  if (m.lastPersona) parts.push(`Persona courant : ${m.lastPersona}.`);
  if (m.lastLanguage) parts.push(`Langue par défaut : ${m.lastLanguage}.`);

  if (parts.length === 0) return "";
  return `[MÉMOIRE DE SESSION]\n${parts.join("\n")}\n[/MÉMOIRE DE SESSION]`;
}
