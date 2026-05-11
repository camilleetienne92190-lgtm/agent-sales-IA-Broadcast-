import { NextRequest } from "next/server";
import { parseCommand, buildLlmRequest } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response("GROQ_API_KEY manquante (.env.local).", { status: 500 });
  }

  let body: { message?: string } = {};
  try {
    body = await req.json();
  } catch {
    return new Response("Body JSON invalide.", { status: 400 });
  }
  const message = (body.message ?? "").trim();
  if (!message) return new Response("Message vide.", { status: 400 });

  const cmd = parseCommand(message);

  if (cmd.kind === "error") {
    return new Response(`❌ ${cmd.message}`, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // CRM commands must be handled client-side (localStorage)
  if (cmd.kind === "crm" || cmd.kind === "crm_update") {
    return new Response("__CRM_CLIENT__", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const llm = await buildLlmRequest(cmd);
  if (!llm) {
    return new Response("Commande non reconnue.", { status: 200 });
  }

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
      messages: [
        { role: "system", content: llm.system },
        { role: "user", content: llm.user },
      ],
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
              if (delta) controller.enqueue(encoder.encode(delta));
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
