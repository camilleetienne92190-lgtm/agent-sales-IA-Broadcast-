"use client";

import { useState, useRef, useEffect } from "react";

export function CommandInput({
  onSend,
  disabled,
}: {
  onSend: (value: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = Math.min(ref.current.scrollHeight, 180) + "px";
    }
  }, [value]);

  function submit() {
    const v = value.trim();
    if (!v || disabled) return;
    onSend(v);
    setValue("");
  }

  return (
    <div className="border-t border-border bg-bg px-6 py-4">
      <div className="flex items-end gap-3 rounded-2xl bg-panel px-4 py-3">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Tape une commande — prospect RTBF · email NPO Janssen M CTO NL cold · veille VRM · crm"
          className="flex-1 resize-none bg-transparent text-white placeholder-muted outline-none"
        />
        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accentHover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Envoyer
        </button>
      </div>
      <div className="mt-2 text-center text-xs text-muted">
        Entrée pour envoyer · Shift+Entrée pour saut de ligne
      </div>
    </div>
  );
}
