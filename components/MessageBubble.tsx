"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type ChatRole = "user" | "agent";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  streaming?: boolean;
};

const EMAIL_HEADER_RE = /(^|\n)\s*\*{0,2}(Objet|Onderwerp)\s*:/i;

function isEmailMessage(content: string): boolean {
  return EMAIL_HEADER_RE.test(content);
}

function extractEmailToCopy(content: string): string {
  const match = content.match(EMAIL_HEADER_RE);
  if (!match) return content.trim();
  const start = content.indexOf(match[0]) + (match[1] ? match[1].length : 0);
  let slice = content.slice(start);

  // Drop trailing metadata line (e.g. "*Mots :* 124 | *Étape :* cold | *Langue :* FR")
  slice = slice.split(/\n\s*\*{0,2}Mots\s*:/i)[0]!;

  // Remove markdown code fences and bold markers, keep plain text.
  slice = slice.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "");
  slice = slice.replace(/\*\*(.*?)\*\*/g, "$1");
  slice = slice.replace(/\*(.*?)\*/g, "$1");

  return slice.trim();
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const showCopy = !isUser && !message.streaming && isEmailMessage(message.content);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(extractEmailToCopy(message.content));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — silent fail
    }
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} w-full`}>
      <div
        className={`max-w-[88%] rounded-2xl px-4 py-3 text-[0.95rem] ${
          isUser ? "bg-accent text-white" : "bg-panel text-white/95"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
        ) : (
          <>
            <div className={`markdown ${message.streaming ? "blink" : ""}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content || " "}
              </ReactMarkdown>
            </div>
            {showCopy && (
              <button
                onClick={handleCopy}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-white/80 transition hover:border-accent hover:text-white"
              >
                {copied ? "✓ Copié" : "Copier l'email"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
