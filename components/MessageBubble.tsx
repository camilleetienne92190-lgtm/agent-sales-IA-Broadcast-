"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BROADCASTERS } from "@/lib/entities";

export type ChatRole = "user" | "agent";

export type PptxAttachment = {
  data: string;
  filename: string;
  slideCount: number;
  audience: string;
  tone: string;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  streaming?: boolean;
  pptx?: PptxAttachment;
};

type ApolloContact = {
  name: string;
  title: string;
  email: string;
  linkedin_url: string;
  company: string;
};

/* ---------- Detectors / extractors ---------- */

const EMAIL_HEADER_RE = /(^|\n)\s*\*{0,2}(Objet|Onderwerp)\s*:/i;
const FICHE_RE = /(^|\n)\s*\*{0,2}FICHE\s*—/i;

function isEmailMessage(content: string): boolean {
  return EMAIL_HEADER_RE.test(content);
}

function isFicheMessage(content: string): boolean {
  return FICHE_RE.test(content);
}

function extractBroadcasterFromFiche(content: string): string | null {
  const m = content.match(/FICHE\s*—\s*([^\n]+)/i);
  if (!m) return null;
  return m[1]!.replace(/\*+/g, "").trim();
}

function scanBroadcaster(content: string): string | null {
  const lower = content.toLowerCase();
  const hits = BROADCASTERS.filter((b) => lower.includes(b.toLowerCase()));
  if (hits.length === 0) return null;
  return [...hits].sort((a, b) => b.length - a.length)[0]!;
}

function extractEmailToCopy(content: string): string {
  const match = content.match(EMAIL_HEADER_RE);
  if (!match) return content.trim();
  const start = content.indexOf(match[0]) + (match[1] ? match[1].length : 0);
  let slice = content.slice(start);
  slice = slice.split(/\n\s*\*{0,2}Mots\s*:/i)[0]!;
  slice = slice.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "");
  slice = slice.replace(/\*\*(.*?)\*\*/g, "$1");
  slice = slice.replace(/\*(.*?)\*/g, "$1");
  return slice.trim();
}

function safeFilenameChunk(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "datarouter";
}

/* ---------- Component ---------- */

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const contentRef = useRef<HTMLDivElement>(null);

  const [copied, setCopied] = useState(false);
  const [contacts, setContacts] = useState<ApolloContact[] | null>(null);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const isEmail = !isUser && !message.streaming && isEmailMessage(message.content);
  const isFiche = !isUser && !message.streaming && isFicheMessage(message.content);
  const ficheBroadcaster = isFiche ? extractBroadcasterFromFiche(message.content) : null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(extractEmailToCopy(message.content));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silent
    }
  }

  async function handleFindContact() {
    if (!ficheBroadcaster || contactsLoading) return;
    setContactsLoading(true);
    setContactsError(null);
    setContacts(null);
    try {
      const res = await fetch("/api/apollo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: ficheBroadcaster }),
      });
      const data = (await res.json()) as { contacts?: ApolloContact[]; error?: string };
      setContacts(data.contacts ?? []);
      if (data.error) setContactsError(data.error);
    } catch (err) {
      setContactsError((err as Error).message);
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }

  async function handleExportPdf() {
    const el = contentRef.current;
    if (!el || exporting) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, jspdfMod] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const { jsPDF } = jspdfMod;

      const canvas = await html2canvas(el, {
        backgroundColor: "#161616",
        scale: 2,
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const headerH = 18;

      const drawHeader = () => {
        pdf.setFontSize(11);
        pdf.setTextColor(40);
        pdf.text("DataRouter Sales Agent — Broadteam", margin, 12);
        pdf.setFontSize(9);
        pdf.setTextColor(120);
        pdf.text(
          new Date().toISOString().slice(0, 10),
          pageWidth - margin,
          12,
          { align: "right" },
        );
        pdf.setDrawColor(200);
        pdf.line(margin, 15, pageWidth - margin, 15);
      };

      const imgWidth = pageWidth - 2 * margin;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const usableHeight = pageHeight - headerH - margin;

      drawHeader();
      pdf.addImage(imgData, "PNG", margin, headerH, imgWidth, imgHeight);

      let heightLeft = imgHeight - usableHeight;
      while (heightLeft > 0) {
        pdf.addPage();
        drawHeader();
        const yOffset = headerH - (imgHeight - heightLeft);
        pdf.addImage(imgData, "PNG", margin, yOffset, imgWidth, imgHeight);
        heightLeft -= usableHeight;
      }

      const kind = isFiche ? "fiche" : isEmail ? "email" : "export";
      const broadcaster =
        ficheBroadcaster ?? scanBroadcaster(message.content) ?? "datarouter";
      const date = new Date().toISOString().slice(0, 10);
      const filename = `${safeFilenameChunk(broadcaster)}_${kind}_${date}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error("PDF export failed", err);
    } finally {
      setExporting(false);
    }
  }

  const showActions = !isUser && !message.streaming && (isFiche || isEmail);

  function downloadPptx() {
    if (!message.pptx) return;
    try {
      const bin = atob(message.pptx.data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = message.pptx.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("PPTX download failed", e);
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
            <div
              ref={contentRef}
              className={`markdown ${message.streaming ? "blink" : ""}`}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content || " "}
              </ReactMarkdown>
            </div>

            {showActions && (
              <div className="mt-3 flex flex-wrap gap-2">
                {isEmail && (
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-white/80 transition hover:border-accent hover:text-white"
                  >
                    {copied ? "✓ Copié" : "Copier l'email"}
                  </button>
                )}
                {isFiche && ficheBroadcaster && (
                  <button
                    onClick={handleFindContact}
                    disabled={contactsLoading}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-white/80 transition hover:border-accent hover:text-white disabled:opacity-50"
                  >
                    {contactsLoading ? "Recherche…" : "🔍 Trouver le contact"}
                  </button>
                )}
                <button
                  onClick={handleExportPdf}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-white/80 transition hover:border-accent hover:text-white disabled:opacity-50"
                >
                  {exporting ? "Export…" : "📄 Exporter PDF"}
                </button>
              </div>
            )}

            {message.pptx && !message.streaming && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={downloadPptx}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accentHover"
                >
                  ⬇ Télécharger {message.pptx.filename}
                </button>
                <div className="mt-1.5 text-xs text-muted">
                  {message.pptx.slideCount} slides · {message.pptx.audience} ·{" "}
                  {message.pptx.tone}
                </div>
              </div>
            )}

            {contacts !== null && (
              <div className="mt-3 space-y-2">
                {contacts.length === 0 ? (
                  <div className="rounded-lg border border-border bg-bg px-3 py-2 text-xs text-muted">
                    Aucun contact trouvé — essaie LinkedIn
                    {contactsError ? ` (${contactsError})` : ""}.
                  </div>
                ) : (
                  contacts.map((c, i) => (
                    <div
                      key={(c.email || c.linkedin_url || c.name) + i}
                      className="rounded-lg border border-border bg-bg px-3 py-2 text-xs"
                    >
                      <div className="text-sm font-medium text-white">
                        {c.name || "(nom inconnu)"}
                      </div>
                      <div className="text-muted">{c.title || "(titre inconnu)"}</div>
                      <div className="mt-1 text-white/80">
                        {c.email ? c.email : <span className="italic text-muted">email non public</span>}
                      </div>
                      {c.linkedin_url && (
                        <a
                          href={c.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-block text-accent underline"
                        >
                          LinkedIn ↗
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
