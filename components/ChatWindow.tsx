"use client";

import { useEffect, useRef } from "react";
import { MessageBubble, ChatMessage } from "./MessageBubble";

const SUGGESTIONS = [
  "prospect RTBF",
  "email NPO Janssen M CTO NL cold",
  "veille VRM",
  "crm",
];

export function ChatWindow({
  messages,
  onSuggestion,
}: {
  messages: ChatMessage[];
  onSuggestion: (s: string) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      {messages.length === 0 ? (
        <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
          <div className="mb-3 text-2xl font-semibold">DataRouter Sales Agent</div>
          <p className="mb-8 text-sm text-muted">
            Prospection broadcast — fiches, scoring, emails P-I-C-T, veille réglementaire.
          </p>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onSuggestion(s)}
                className="rounded-xl border border-border bg-panel px-4 py-3 text-left text-sm text-white/90 transition hover:border-accent hover:bg-panel/80"
              >
                <span className="font-mono text-accent">›</span> {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
