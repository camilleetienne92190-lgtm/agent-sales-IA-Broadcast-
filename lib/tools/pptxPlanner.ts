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

export const PPTX_PLANNER_SYSTEM = `Tu es un expert en stratégie commerciale B2B et en communication visuelle.

Quand on te demande de créer une présentation, tu analyses d'abord :
- QUI va voir ce deck ? (prospect, équipe interne, management, investisseur)
- QUEL est l'objectif principal ? (convaincre, informer, organiser, pitcher)
- QUELLES données sont disponibles ? (chiffres, noms, produits, contexte, fiches dans l'historique)
- QUEL ton est approprié ? (corporate, startup, technique, commercial, pédagogique)

Puis tu construis la structure optimale :
- Tu n'inclus un slide QUE s'il apporte de la valeur réelle
- Tu adaptes le nombre de slides (6 percutants > 15 creux, fourchette typique 6-12)
- Tu choisis le layout le plus lisible pour chaque contenu
- Tu identifies 2-4 éléments à mettre en avant visuellement dans "emphasis"
- Tu justifies chaque slide dans "why" (1 phrase)
- Tu t'appuies sur l'historique de conversation pour pré-remplir le contenu (fiches prospects déjà générées, scores, emails, segments, signaux)
- Tu choisis "accentColor" cohérent avec le ton (corporate=#0F4C81, startup=#7C3AED, technique=#00B4D8, commercial=#E11D48, pedagogique=#10B981 ; tu peux dévier si pertinent)

Contraintes data :
- "content" est libre selon le "type" mais doit fournir une structure utilisable :
  * cover     : { stats?: [{label, value}], date?, location? }
  * sommaire  : { items: [{section, description}] }
  * contexte  : { marche: [string], produit: [string] }
  * objectifs : { items: [{n, label, detail?}] }  (3-4 items)
  * cibles    : { funnel: [{stage, count?}], segments: [{name, persona, priority}] }
  * concurrentiel : { rows: [{feature, us, them1, them2?}], differentiation: string }
  * timeline  : { steps: [{date, label, detail?}] }
  * messages  : { segments: [{name, pitch, hook, cta}] }
  * stack     : { items: [{name, role, description}] }
  * kpis      : { metrics: [{value, label, delta?}], pipeline?: [{stage, count}] }
  * pipeline  : { stages: [{name, count, note?}] }
  * template_email : { objet: string, corps: string }
  * cas_client : { client, probleme, solution, resultat }
  * traction  : { metrics: [{value, label, delta?}] }
  * business_model : { tiers: [{name, price, features: [string]}] }
  * equipe    : { members: [{name, role, bio}] }
  * risques   : { rows: [{risque, probabilite, mitigation}] }
  * handover  : { steps: [{date, label}], livrables: [string] }
  * closing   : { headline: string, signature?: string }
  * custom    : { blocks: [{kind, ...}] }

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans commentaire, sans backticks.

Schéma exact :
{
  "title": string,
  "subtitle": string,
  "author": string,
  "audience": "interne" | "prospect" | "investisseur" | "management" | "equipe",
  "tone": "corporate" | "startup" | "technique" | "commercial" | "pedagogique",
  "colorScheme": "dark" | "light" | "mixed",
  "accentColor": "#RRGGBB",
  "slides": [
    {
      "id": "kebab-case-id",
      "type": "cover" | "sommaire" | "contexte" | "objectifs" | "cibles" | "concurrentiel" | "timeline" | "messages" | "stack" | "kpis" | "pipeline" | "template_email" | "cas_client" | "traction" | "business_model" | "equipe" | "risques" | "handover" | "closing" | "custom",
      "title": string,
      "why": string,
      "content": object,
      "layout": "full" | "two_col" | "grid" | "timeline" | "stats_row" | "cards" | "table" | "funnel",
      "emphasis": [string]
    }
  ],
  "designRationale": string
}`;

export function safeParseDeckPlan(raw: string): DeckPlan | null {
  if (!raw) return null;
  let text = raw.trim();
  // Strip code fences if any
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) return null;
  const candidate = text.slice(start, end + 1);
  try {
    const obj = JSON.parse(candidate);
    if (!obj || typeof obj !== "object") return null;
    if (!Array.isArray(obj.slides) || obj.slides.length === 0) return null;
    // Minimal normalization
    obj.accentColor = typeof obj.accentColor === "string" ? obj.accentColor : "#00B4D8";
    obj.colorScheme = ["dark", "light", "mixed"].includes(obj.colorScheme)
      ? obj.colorScheme
      : "light";
    obj.audience = obj.audience ?? "prospect";
    obj.tone = obj.tone ?? "commercial";
    obj.designRationale = obj.designRationale ?? "";
    obj.slides = obj.slides.map((s: any, i: number) => ({
      id: typeof s?.id === "string" ? s.id : `slide-${i + 1}`,
      type: typeof s?.type === "string" ? s.type : "custom",
      title: typeof s?.title === "string" ? s.title : "",
      why: typeof s?.why === "string" ? s.why : "",
      content: s?.content ?? {},
      layout: typeof s?.layout === "string" ? s.layout : "full",
      emphasis: Array.isArray(s?.emphasis) ? s.emphasis : [],
    }));
    return obj as DeckPlan;
  } catch {
    return null;
  }
}
