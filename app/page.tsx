"use client";

import { useState } from "react";
import { ChatWindow } from "@/components/ChatWindow";
import { CommandInput } from "@/components/CommandInput";
import { CrmPanel } from "@/components/CrmPanel";
import { ChatMessage } from "@/components/MessageBubble";
import { parseCommand } from "@/lib/agent";
import { isCrmStatus, loadCrm, renderCrmMarkdown, upsertEntry } from "@/lib/tools/crm";

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);

  function pushUser(text: string) {
    setMessages((prev) => [...prev, { id: newId(), role: "user", content: text }]);
  }

  function pushAgent(content: string) {
    setMessages((prev) => [...prev, { id: newId(), role: "agent", content }]);
  }

  async function handleSend(input: string) {
    if (busy) return;
    pushUser(input);

    const cmd = parseCommand(input);

    if (cmd.kind === "error") {
      pushAgent(`❌ ${cmd.message}`);
      return;
    }

    if (cmd.kind === "crm") {
      pushAgent(renderCrmMarkdown(loadCrm()));
      return;
    }

    if (cmd.kind === "crm_update") {
      if (!isCrmStatus(cmd.statut)) {
        pushAgent(
          `❌ Statut invalide : **${cmd.statut}**. Valeurs : Cold, Contacté, En discussion, Deal, Perdu.`,
        );
        return;
      }
      const entry = upsertEntry(cmd.diffuseur, cmd.statut, cmd.nextStep);
      pushAgent(
        `✅ CRM mis à jour\n\n- **Diffuseur :** ${entry.diffuseur}\n- **Statut :** ${entry.statut}\n- **Next step :** ${entry.nextStep}`,
      );
      return;
    }

    // Streaming LLM call
    setBusy(true);
    const agentId = newId();
    setMessages((prev) => [
      ...prev,
      { id: agentId, role: "agent", content: "", streaming: true },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
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
        <ChatWindow messages={messages} onSuggestion={handleSend} />
        <CommandInput onSend={handleSend} disabled={busy} />
      </main>
      <CrmPanel />
    </div>
  );
}
