"use client";

import { useEffect, useMemo, useState } from "react";
import { ChatWindow } from "@/components/ChatWindow";
import { CommandInput } from "@/components/CommandInput";
import { CrmPanel } from "@/components/CrmPanel";
import { ChatMessage } from "@/components/MessageBubble";
import { detectCrmIntent, ChatTurn } from "@/lib/agent";
import {
  isCrmStatus,
  loadCrm,
  renderCrmMarkdown,
  saveFiche,
  upsertEntry,
} from "@/lib/tools/crm";

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function toHistory(messages: ChatMessage[]): ChatTurn[] {
  return messages
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }))
    .slice(-10);
}

/* ---------- Content classifiers ---------- */

const FICHE_RE = /(^|\n)\s*\*{0,2}FICHE\s*—|(^|\n)\s*\*{0,2}Score\s*:/i;
const COLD_EMAIL_RE = /\*{0,2}Étape\s*:\*{0,2}\s*cold\b/i;
const VEILLE_RE = /Veille\b|Régulateur|Échéances?|obligation/i;
const EMAIL_RE = /(^|\n)\s*\*{0,2}(Objet|Onderwerp)\s*:/i;

function detectFiche(content: string): boolean {
  return FICHE_RE.test(content);
}

function extractBroadcasterFromFiche(content: string): string | null {
  const m = content.match(/FICHE\s*—\s*([^\n]+)/i);
  if (m) return m[1]!.replace(/\*+/g, "").trim();
  return null;
}

function classifyAgent(content: string):
  | "fiche"
  | "cold_email"
  | "email"
  | "veille"
  | "other" {
  if (detectFiche(content)) return "fiche";
  if (COLD_EMAIL_RE.test(content)) return "cold_email";
  if (EMAIL_RE.test(content)) return "email";
  if (VEILLE_RE.test(content)) return "veille";
  return "other";
}

const DECK_GENERATED_RE = /Deck g[ée]n[ée]r[ée]/i;

function buildDynamicSuggestions(content: string): string[] {
  const kind = classifyAgent(content);
  if (DECK_GENERATED_RE.test(content)) {
    return ["Exporte la fiche prospect en slide", "Génère un deck de campagne outreach"];
  }
  if (kind === "fiche") {
    const b = extractBroadcasterFromFiche(content) ?? "ce diffuseur";
    return [
      `Génère l'email cold pour ${b}`,
      `crm update "${b}" Cold "À contacter"`,
      `Génère un deck de prospection pour ${b}`,
    ];
  }
  if (kind === "cold_email") {
    return [
      "Génère la séquence complète des 4 emails",
      "Génère la relance J+7",
      "Crée un deck de campagne outreach",
    ];
  }
  if (kind === "email") {
    return [
      "Génère la relance J+7",
      "Génère la version néerlandaise",
      "Crée un deck de campagne outreach",
    ];
  }
  if (kind === "veille") {
    return [
      "Suggère un diffuseur prioritaire à prospecter sur ce marché",
      "Donne-moi l'angle email à privilégier",
    ];
  }
  return ["prospect RTBF", "veille VRM"];
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);

  /* Auto-save fiches whenever a non-streaming agent message looks like a fiche. */
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "agent" || last.streaming) return;
    if (!detectFiche(last.content)) return;
    const broadcaster = extractBroadcasterFromFiche(last.content);
    if (!broadcaster) return;
    saveFiche(broadcaster, last.content);
  }, [messages]);

  /* Listen for "show this saved fiche" events from the sidebar. */
  useEffect(() => {
    function onShow(e: Event) {
      const detail = (e as CustomEvent<{ broadcaster: string; content: string }>).detail;
      if (!detail) return;
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "agent",
          content: `📁 **Fiche sauvegardée — ${detail.broadcaster}**\n\n${detail.content}`,
        },
      ]);
    }
    window.addEventListener("fiche:show", onShow);
    return () => window.removeEventListener("fiche:show", onShow);
  }, []);

  /* Market shortcut buttons in the sidebar fire this event. */
  useEffect(() => {
    function onMarket(e: Event) {
      const detail = (e as CustomEvent<{ market: string }>).detail;
      if (!detail?.market) return;
      handleSend(
        `Donne-moi les 3 diffuseurs prioritaires à prospecter sur le marché ${detail.market} avec leur score et l'angle email recommandé pour chacun.`,
      );
    }
    window.addEventListener("market:selected", onMarket);
    return () => window.removeEventListener("market:selected", onMarket);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  const dynamicSuggestions = useMemo(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "agent" || last.streaming) return [];
    if (!last.content.trim()) return [];
    return buildDynamicSuggestions(last.content);
  }, [messages]);

  function pushUser(text: string) {
    setMessages((prev) => [...prev, { id: newId(), role: "user", content: text }]);
  }

  function pushAgent(content: string) {
    setMessages((prev) => [...prev, { id: newId(), role: "agent", content }]);
  }

  async function handleSend(input: string) {
    if (busy) return;
    pushUser(input);

    const crm = detectCrmIntent(input);

    if (crm?.kind === "crm") {
      pushAgent(renderCrmMarkdown(loadCrm()));
      return;
    }

    if (crm?.kind === "crm_update") {
      if (!isCrmStatus(crm.statut)) {
        pushAgent(
          `❌ Statut invalide : **${crm.statut}**. Valeurs : Cold, Contacté, En discussion, Deal, Perdu.`,
        );
        return;
      }
      const entry = upsertEntry(crm.diffuseur, crm.statut, crm.nextStep);
      pushAgent(
        `✅ CRM mis à jour\n\n- **Diffuseur :** ${entry.diffuseur}\n- **Statut :** ${entry.statut}\n- **Next step :** ${entry.nextStep}`,
      );
      return;
    }

    setBusy(true);
    const history = toHistory(messages);
    const agentId = newId();
    setMessages((prev) => [
      ...prev,
      { id: agentId, role: "agent", content: "", streaming: true },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, history }),
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentId
              ? { ...m, content: `❌ Erreur : ${text || res.statusText}`, streaming: false }
              : m,
          ),
        );
        return;
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = await res.json().catch(() => null);
        if (data?.kind === "pptx") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === agentId
                ? {
                    ...m,
                    content: data.message ?? "Deck généré ✓",
                    streaming: false,
                    pptx: {
                      data: data.pptxData,
                      filename: data.filename,
                      slideCount: data.slideCount,
                      audience: data.audience,
                      tone: data.tone,
                    },
                  }
                : m,
            ),
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === agentId
                ? {
                    ...m,
                    content: data?.message ?? "❌ Erreur inconnue",
                    streaming: false,
                  }
                : m,
            ),
          );
        }
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        acc += chunk;
        setMessages((prev) =>
          prev.map((m) => (m.id === agentId ? { ...m, content: acc } : m)),
        );
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === agentId ? { ...m, streaming: false } : m)),
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentId
            ? {
                ...m,
                content: `❌ Erreur réseau : ${(err as Error).message}`,
                streaming: false,
              }
            : m,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <main className="flex h-full flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-accent" />
            <div>
              <div className="text-sm font-semibold">DataRouter Sales Agent</div>
              <div className="text-xs text-muted">Broadteam · prospection broadcast</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-green-700/40 bg-green-900/20 px-3 py-1 text-xs text-green-300">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            Groq · Llama 3.3 70B
          </span>
        </header>
        <ChatWindow
          messages={messages}
          onSuggestion={handleSend}
          dynamicSuggestions={dynamicSuggestions}
        />
        <CommandInput onSend={handleSend} disabled={busy} />
      </main>
      <CrmPanel />
    </div>
  );
}
