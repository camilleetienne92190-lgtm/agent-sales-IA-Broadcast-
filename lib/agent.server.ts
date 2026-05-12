import type { ChatTurn } from "./agent";
import {
  PPTX_PLANNER_SYSTEM,
  safeParseDeckPlan,
  containsForbiddenWords,
  DeckPlan,
} from "./tools/pptxPlanner";
import { generatePptx } from "./tools/pptxGenerator";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const MIN_SLIDES = 8;

function safeFilename(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "deck"
  );
}

export type PptxFlowResult =
  | {
      ok: true;
      messageText: string;
      pptxData: string;
      filename: string;
      slideCount: number;
      audience: string;
      tone: string;
    }
  | { ok: false; error: string };

function validatePlan(plan: DeckPlan): string | null {
  if (!plan || typeof plan !== "object") return "Plan absent";
  if (!Array.isArray(plan.slides) || plan.slides.length === 0) return "Aucun slide planifié";
  for (let i = 0; i < plan.slides.length; i++) {
    const s = plan.slides[i]!;
    if (typeof s.type !== "string") return `Slide ${i + 1} : type invalide`;
    if (s.content == null || typeof s.content !== "object" || Array.isArray(s.content)) {
      return `Slide ${i + 1} (${s.type}) : content doit être un objet`;
    }
  }
  return null;
}

function logPlan(plan: DeckPlan, label = "Plan deck") {
  console.log(`📊 ${label} : ${plan.slides.length} slides — ${plan.tone} / ${plan.audience} / ${plan.colorScheme}`);
  plan.slides.forEach((s, i) => {
    const keys = Object.keys(s.content ?? {}).join(", ") || "(vide)";
    console.log(`   ${i + 1}. ${s.type.padEnd(16)} title="${s.title}" content keys: ${keys}`);
  });
  if (plan.slides[0]) {
    console.log("📊 Premier slide content :", JSON.stringify(plan.slides[0].content, null, 2));
  }
  const forbidden = containsForbiddenWords(JSON.stringify(plan));
  if (forbidden.length > 0) {
    console.warn("⚠️ Mots interdits détectés (post-scrub) :", forbidden);
  }
}

type PlannerMessage = { role: "system" | "user" | "assistant"; content: string };

async function callPlanner(
  apiKey: string,
  messages: PlannerMessage[],
): Promise<{ raw: string; status: number } | { error: string }> {
  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        stream: false,
        temperature: 0.6,
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages,
      }),
    });
  } catch (e) {
    return { error: `Erreur réseau Groq : ${(e as Error).message}` };
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { error: `Erreur Groq (${res.status}) ${t.slice(0, 200)}` };
  }
  const payload = await res.json().catch(() => null);
  const raw: string = payload?.choices?.[0]?.message?.content ?? "";
  return { raw, status: res.status };
}

export async function runPptxFlow(
  apiKey: string,
  userMessage: string,
  history: ChatTurn[],
): Promise<PptxFlowResult> {
  const messages: PlannerMessage[] = [
    { role: "system", content: PPTX_PLANNER_SYSTEM },
    ...history.slice(-10),
    { role: "user", content: userMessage },
  ];

  // Première passe
  const first = await callPlanner(apiKey, messages);
  if ("error" in first) return { ok: false, error: first.error };

  let plan = safeParseDeckPlan(first.raw);
  if (!plan) {
    console.error("❌ Plan JSON non parsable. Raw :", first.raw.slice(0, 500));
    return { ok: false, error: "Plan JSON invalide ou inutilisable." };
  }

  logPlan(plan, "Plan deck (1ère passe)");

  // Relance si < 8 slides
  if (plan.slides.length < MIN_SLIDES) {
    console.warn(`⚠️ Seulement ${plan.slides.length} slides — relance avec consigne renforcée…`);
    const followup: PlannerMessage[] = [
      ...messages,
      { role: "assistant", content: first.raw },
      {
        role: "user",
        content: `ATTENTION : tu as généré seulement ${plan.slides.length} slides. C'est insuffisant. Régénère avec MINIMUM 10 slides, chaque slide ultra-détaillé avec 80-100 mots de contenu utile, et toutes les listes remplies (3-4 items minimum). Respecte les SHAPES DE CONTENT EXACTES. Réponds en JSON valide uniquement.`,
      },
    ];
    const second = await callPlanner(apiKey, followup);
    if (!("error" in second)) {
      const retryPlan = safeParseDeckPlan(second.raw);
      if (retryPlan && retryPlan.slides.length > plan.slides.length) {
        plan = retryPlan;
        logPlan(plan, "Plan deck (2ème passe)");
      } else if (retryPlan) {
        console.warn(`⚠️ 2ème passe = ${retryPlan.slides.length} slides, on garde la 1ère`);
      }
    }
  }

  const validationError = validatePlan(plan);
  if (validationError) {
    console.error("❌ Plan invalide :", validationError);
    return { ok: false, error: `Plan invalide : ${validationError}` };
  }

  let buffer: Buffer;
  try {
    buffer = await generatePptx(plan);
  } catch (e) {
    console.error("❌ Erreur génération PPTX :", e);
    return { ok: false, error: `Erreur génération PPTX : ${(e as Error).message}` };
  }

  const date = new Date().toISOString().slice(0, 10);
  const filename = `${safeFilename(plan.title)}_${date}.pptx`;
  const messageText =
    `Deck généré ✓\n\n**${plan.title}**\n${plan.slides.length} slides · audience: ${plan.audience} · ton: ${plan.tone}` +
    (plan.designRationale ? `\n\n_${plan.designRationale}_` : "");

  return {
    ok: true,
    messageText,
    pptxData: buffer.toString("base64"),
    filename,
    slideCount: plan.slides.length,
    audience: plan.audience,
    tone: plan.tone,
  };
}
