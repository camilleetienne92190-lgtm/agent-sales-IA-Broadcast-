import type { ChatTurn } from "./agent";
import {
  PPTX_PLANNER_SYSTEM,
  safeParseDeckPlan,
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
        temperature: 0.5,
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
    return { ok: false, error: "Plan JSON invalide ou inutilisable." };
  }

  console.log("📊 Plan deck:", JSON.stringify(plan, null, 2));

  let buffer: Buffer;
  try {
    buffer = await generatePptx(plan);
  } catch (e) {
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
