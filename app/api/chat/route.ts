import { NextRequest } from "next/server";
import {
  buildConversationalRequest,
  detectCrmIntent,
  isPptxIntent,
  ChatTurn,
} from "@/lib/agent";
import { runPptxFlow } from "@/lib/agent.server";
import { updateMemory } from "@/lib/session";
// Apollo lives behind buildConversationalRequest and is invoked non-blockingly;
// importing the module here keeps it bundled with the route for clarity.
import "@/lib/tools/apollo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

function sanitizeHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatTurn[] = [];
  for (const t of raw) {
    if (
      t &&
      typeof t === "object" &&
      (t as { role?: unknown }).role &&
      typeof (t as { content?: unknown }).content === "string"
    ) {
      const role = (t as { role: string }).role;
      if (role === "user" || role === "assistant") {
        out.push({ role, content: (t as { content: string }).content });
      }
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response("GROQ_API_KEY manquante (.env.local).", { status: 500 });
  }

  let body: { message?: string; history?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return new Response("Body JSON invalide.", { status: 400 });
  }
  const message = (body.message ?? "").trim();
  if (!message) return new Response("Message vide.", { status: 400 });

  // CRM commands stay client-side (localStorage).
  if (detectCrmIntent(message)) {
    return new Response("__CRM_CLIENT__", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const history = sanitizeHistory(body.history);

  // PPTX flow — non-streaming, returns JSON with base64 attachment.
  if (isPptxIntent(message)) {
    const result = await runPptxFlow(apiKey, message, history);
    if (result.ok) {
      try {
        updateMemory(message, result.messageText);
      } catch {
        // best-effort
      }
      return Response.json({
        kind: "pptx",
        message: result.messageText,
        pptxData: result.pptxData,
        filename: result.filename,
        slideCount: result.slideCount,
        audience: result.audience,
        tone: result.tone,
      });
    }
    return Response.json(
      { kind: "error", message: `❌ ${result.error}` },
      { status: 200 },
    );
  }

  const { system, messages } = await buildConversationalRequest(message, history);

  const upstream = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      temperature: 0.5,
      max_tokens: 2048,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return new Response(
      `Erreur Groq (${upstream.status}). ${text.slice(0, 300)}`,
      { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buf = "";
      let full = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                full += delta;
                controller.enqueue(encoder.encode(delta));
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }
      } catch (err) {
        controller.enqueue(
          new TextEncoder().encode(
            `\n\n_Erreur stream : ${(err as Error).message}_`,
          ),
        );
      } finally {
        try {
          if (full) updateMemory(message, full);
        } catch {
          // memory update is best-effort
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
