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

function logPlan(plan: DeckPlan) {
  console.log("📊 Plan deck:", JSON.stringify(plan, null, 2));
  console.log(`📊 ${plan.slides.length} slides — ${plan.tone} / ${plan.audience} / ${plan.colorScheme}`);
  plan.slides.forEach((s, i) => {
    const keys = Object.keys(s.content ?? {}).join(", ") || "(vide)";
    console.log(`   ${i + 1}. ${s.type.padEnd(16)} title="${s.title}" content keys: ${keys}`);
  });
  const forbidden = containsForbiddenWords(JSON.stringify(plan));
  if (forbidden.length > 0) {
    console.warn("⚠️ Mots interdits détectés (post-scrub) :", forbidden);
  }
}

export async function runPptxFlow(
  apiKey: string,
  userMessage: string,
  history: ChatTurn[],
): Promise<PptxFlowResult> {
  let planRes: Response;
  try {
    planRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        stream: false,
        temperature: 0.4,
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PPTX_PLANNER_SYSTEM },
          ...history.slice(-10),
          { role: "user", content: userMessage },
        ],
      }),
    });
  } catch (e) {
    return { ok: false, error: `Erreur réseau Groq : ${(e as Error).message}` };
  }
  if (!planRes.ok) {
    const t = await planRes.text().catch(() => "");
    return { ok: false, error: `Erreur Groq (${planRes.status}) ${t.slice(0, 200)}` };
  }
  const payload = await planRes.json().catch(() => null);
  const raw: string = payload?.choices?.[0]?.message?.content ?? "";
  const plan: DeckPlan | null = safeParseDeckPlan(raw);
  if (!plan) {
    console.error("❌ Plan JSON non parsable. Raw :", raw.slice(0, 500));
    return { ok: false, error: "Plan JSON invalide ou inutilisable." };
  }

  const validationError = validatePlan(plan);
  if (validationError) {
    console.error("❌ Plan invalide :", validationError);
    return { ok: false, error: `Plan invalide : ${validationError}` };
  }

  logPlan(plan);

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
