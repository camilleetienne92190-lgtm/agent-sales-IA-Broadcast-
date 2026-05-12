export type SlideType =
  | "cover"
  | "sommaire"
  | "contexte"
  | "objectifs"
  | "cibles"
  | "concurrentiel"
  | "timeline"
  | "messages"
  | "stack"
  | "kpis"
  | "pipeline"
  | "template_email"
  | "cas_client"
  | "traction"
  | "business_model"
  | "equipe"
  | "risques"
  | "handover"
  | "closing"
  | "custom";

export type SlideLayout =
  | "full"
  | "two_col"
  | "grid"
  | "timeline"
  | "stats_row"
  | "cards"
  | "table"
  | "funnel";

export type SlidePlan = {
  id: string;
  type: SlideType;
  title: string;
  why?: string;
  content: any;
  layout?: SlideLayout;
  emphasis?: string[];
};

export type DeckPlan = {
  title: string;
  subtitle?: string;
  author?: string;
  audience: "interne" | "prospect" | "investisseur" | "management" | "equipe";
  tone: "corporate" | "startup" | "technique" | "commercial" | "pedagogique";
  colorScheme: "dark" | "light" | "mixed";
  accentColor: string;
  slides: SlidePlan[];
  designRationale: string;
};

export const PPTX_PLANNER_SYSTEM = `Tu es un expert en stratégie commerciale B2B et en communication visuelle pour Broadteam (Belgique), qui vend DataRouter.

PRODUIT — DataRouter
- SaaS de sous-titrage automatique en direct (ASR) pour broadcasters TV/radio
- Latence < 3s, WER < 5% sur FR/NL, EBU-TT-D natif, zéro CAPEX
- Pipeline : SDI/SRT/RTMP/NDI/HLS → moteur ASR → EBU-TT-D → injection playout
- Prix : Essentiel 590€/mois, Premium 990€/mois
- Marchés : Belgique FR (CSA), Belgique FL (VRM), Pays-Bas (Mediakabel), France (ARCOM)

RÈGLES ABSOLUES
- N'utilise JAMAIS : révolutionnaire, révolutionner, innovant, exponentiel, exponentielle, transformer, disruptif, disruptive, game-changer, IA, algorithme. Dis "moteur de transcription" ou "solution ASR".
- DataRouter = SaaS sous-titrage ASR live pour broadcasters TV/radio. Ne réécris pas ce que c'est.
- Prix officiels : 590€/mois Essentiel, 990€/mois Premium.
- Specs officielles : Latence < 3s, WER < 5%, EBU-TT-D natif, zéro CAPEX.
- Remplis le contenu UNIQUEMENT avec les vraies données issues du message utilisateur et de l'historique de conversation (fiches prospects, scores, emails déjà générés, chiffres mentionnés).
- Si une donnée n'est pas fournie, laisse le champ vide ("") ou mets "—". N'invente JAMAIS de chiffres.
- Tous les champs de "content" doivent être des chaînes, nombres, booléens ou des tableaux d'objets simples. JAMAIS d'objet imbriqué non sérialisable.

MÉTHODE
- QUI verra ce deck ? QUEL est l'objectif ? QUELLES données existent vraiment ?
- N'inclus un slide QUE s'il apporte de la valeur réelle (fourchette typique 5-9 slides percutants).
- Justifie chaque slide dans "why" (1 phrase).
- 2-4 éléments dans "emphasis" par slide.
- "accentColor" hex selon le ton : corporate=#0F4C81, startup=#7C3AED, technique=#00B4D8, commercial=#E11D48, pedagogique=#10B981 (dévie si pertinent).

SHAPES DE CONTENT EXACTES (respecte-les à la lettre — toute déviation cassera le rendu)
- cover         : { stats: [{ value: string, label: string }], subtitle: string }
- sommaire      : { sections: [{ number: string, title: string, description: string }] }
- contexte      : { market: { title: string, facts: [string] }, product: { title: string, facts: [string] } }
- objectifs     : { items: [{ number: string, label: string, sublabel: string }] }  // 2 à 4 items
- cibles        : { funnel: [{ label: string, count: string }], segments: [{ name: string, volume: string, channel: string, priority: string }] }
- concurrentiel : { criteria: [string], competitors: [{ name: string, scores: [boolean] }], differentiator: string }
- timeline      : { events: [{ date: string, action: string, detail: string }] }
- messages      : { segments: [{ name: string, pitch: string, hook: string, cta: string }] }
- stack         : { tools: [{ name: string, role: string, detail: string }] }
- kpis          : { metrics: [{ value: string, label: string, delta: string }], stages: [{ name: string, count: string }] }
- pipeline      : { stages: [{ name: string, count: string, note: string }] }
- template_email: { objet: string, corps: string }
- cas_client    : { client: string, probleme: string, solution: string, resultat: string }
- traction      : { metrics: [{ value: string, label: string, delta: string }] }
- business_model: { tiers: [{ name: string, price: string, features: [string] }] }
- equipe        : { members: [{ name: string, role: string, bio: string }] }
- risques       : { rows: [{ risque: string, probabilite: string, mitigation: string }] }
- handover      : { steps: [{ date: string, label: string }], livrables: [string] }
- closing       : { mainObjective: string, stack: [string] }
- custom        : { title: string, body: string, items: [string] }

Tous les "value", "count", "price" sont des STRINGS (ex. "500k€", "80k€", "x3", "12").

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans backticks, sans commentaire.

Schéma top-level :
{
  "title": string,
  "subtitle": string,
  "author": string,
  "audience": "interne" | "prospect" | "investisseur" | "management" | "equipe",
  "tone": "corporate" | "startup" | "technique" | "commercial" | "pedagogique",
  "colorScheme": "dark" | "light" | "mixed",
  "accentColor": "#RRGGBB",
  "slides": [ { "id": string, "type": string, "title": string, "why": string, "content": object, "layout": string, "emphasis": [string] } ],
  "designRationale": string
}`;

/* ---------- Sanitization ---------- */

const FORBIDDEN_RE =
  /\b(r[ée]volutionnaire|r[ée]volutionner|innovant|innovante|exponentiel|exponentielle|disruptif|disruptive|game-?changer|\bIA\b|algorithme)\b/gi;

function scrubForbidden(s: string): string {
  return s
    .replace(/r[ée]volutionnaire|r[ée]volutionner/gi, "structurant")
    .replace(/exponentielle?/gi, "rapide")
    .replace(/innovante?/gi, "spécialisée")
    .replace(/disruptive?/gi, "différenciante")
    .replace(/game-?changer/gi, "levier")
    .replace(/\bIA\b/gi, "moteur ASR")
    .replace(/algorithme/gi, "moteur de transcription");
}

/**
 * Deep clean : keeps strings/numbers/booleans, arrays of cleaned items,
 * and plain objects with cleaned values. Drops functions/symbols, scrubs
 * forbidden marketing words from every string.
 */
function deepClean(v: unknown): unknown {
  if (v == null) return v;
  if (typeof v === "string") return scrubForbidden(v);
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) {
    return v.map(deepClean).filter((x) => x !== undefined);
  }
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      const cleaned = deepClean(val);
      if (cleaned === undefined) continue;
      out[k] = cleaned;
    }
    return out;
  }
  return undefined;
}

export function safeParseDeckPlan(raw: string): DeckPlan | null {
  if (!raw) return null;
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) return null;
  const candidate = text.slice(start, end + 1);

  let parsed: any;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) return null;

  // Top-level normalization + scrub
  parsed.title = scrubForbidden(typeof parsed.title === "string" ? parsed.title : "Présentation");
  parsed.subtitle = scrubForbidden(typeof parsed.subtitle === "string" ? parsed.subtitle : "");
  parsed.author = typeof parsed.author === "string" ? parsed.author : "Camille — Broadteam";
  parsed.audience = ["interne", "prospect", "investisseur", "management", "equipe"].includes(parsed.audience)
    ? parsed.audience
    : "prospect";
  parsed.tone = ["corporate", "startup", "technique", "commercial", "pedagogique"].includes(parsed.tone)
    ? parsed.tone
    : "commercial";
  parsed.colorScheme = ["dark", "light", "mixed"].includes(parsed.colorScheme) ? parsed.colorScheme : "light";
  parsed.accentColor =
    typeof parsed.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(parsed.accentColor)
      ? parsed.accentColor
      : "#00B4D8";
  parsed.designRationale = scrubForbidden(
    typeof parsed.designRationale === "string" ? parsed.designRationale : "",
  );

  // Slides normalization + deep clean of content
  parsed.slides = parsed.slides.map((s: any, i: number) => {
    const cleanedContent = deepClean(s?.content);
    const content = cleanedContent && typeof cleanedContent === "object" && !Array.isArray(cleanedContent)
      ? cleanedContent
      : {};
    return {
      id: typeof s?.id === "string" ? s.id : `slide-${i + 1}`,
      type: typeof s?.type === "string" ? s.type : "custom",
      title: scrubForbidden(typeof s?.title === "string" ? s.title : ""),
      why: scrubForbidden(typeof s?.why === "string" ? s.why : ""),
      content,
      layout: typeof s?.layout === "string" ? s.layout : "full",
      emphasis: Array.isArray(s?.emphasis)
        ? s.emphasis.filter((x: unknown) => typeof x === "string").map((x: string) => scrubForbidden(x))
        : [],
    };
  });

  return parsed as DeckPlan;
}

export function containsForbiddenWords(text: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(FORBIDDEN_RE.source, "gi");
  while ((m = re.exec(text))) found.add(m[0].toLowerCase());
  return Array.from(found);
}
