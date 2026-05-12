"use client";

import { useEffect, useState } from "react";
import {
  CrmEntry,
  CrmStatus,
  FicheEntry,
  getFiches,
  loadCrm,
} from "@/lib/tools/crm";

const STATUSES: CrmStatus[] = ["Cold", "Contacté", "En discussion", "Deal", "Perdu"];

const MARKETS: { label: string; flag: string }[] = [
  { label: "Belgique FR", flag: "🇧🇪" },
  { label: "Belgique FL", flag: "🇧🇪" },
  { label: "Pays-Bas", flag: "🇳🇱" },
  { label: "France", flag: "🇫🇷" },
];

function selectMarket(label: string) {
  window.dispatchEvent(
    new CustomEvent("market:selected", { detail: { market: label } }),
  );
}

const STATUS_COLOR: Record<CrmStatus, string> = {
  Cold: "text-slate-300",
  Contacté: "text-blue-300",
  "En discussion": "text-yellow-300",
  Deal: "text-green-300",
  Perdu: "text-red-300",
};

export function CrmPanel() {
  const [entries, setEntries] = useState<CrmEntry[]>([]);
  const [fiches, setFiches] = useState<FicheEntry[]>([]);

  useEffect(() => {
    const refresh = () => {
      setEntries(loadCrm());
      setFiches(getFiches());
    };
    refresh();
    window.addEventListener("crm:updated", refresh);
    window.addEventListener("fiches:updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("crm:updated", refresh);
      window.removeEventListener("fiches:updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const grouped: Record<CrmStatus, CrmEntry[]> = {
    Cold: [],
    Contacté: [],
    "En discussion": [],
    Deal: [],
    Perdu: [],
  };
  for (const e of entries) {
    if (STATUSES.includes(e.statut)) grouped[e.statut].push(e);
  }

  function showFiche(f: FicheEntry) {
    window.dispatchEvent(
      new CustomEvent("fiche:show", { detail: { broadcaster: f.broadcaster, content: f.content } }),
    );
  }

  return (
    <aside className="hidden h-full w-[30%] flex-col border-l border-border bg-bg lg:flex">
      <div className="px-6 pb-2 pt-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Marchés
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {MARKETS.map((m) => (
            <button
              key={m.label}
              onClick={() => selectMarket(m.label)}
              className="rounded-lg border border-border bg-panel px-3 py-2 text-left text-xs text-white/85 transition hover:border-accent hover:text-white"
            >
              <span className="mr-1">{m.flag}</span> {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="border-t border-border px-6 pb-2 pt-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Pipeline CRM
        </h2>
        <p className="mt-1 text-xs text-muted">
          {entries.length} prospect{entries.length !== 1 ? "s" : ""} · stocké localement
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3">
        {STATUSES.map((s) => (
          <div key={s} className="mb-5">
            <div className={`mb-2 text-xs font-medium uppercase tracking-wider ${STATUS_COLOR[s]}`}>
              {s} · {grouped[s].length}
            </div>
            {grouped[s].length === 0 ? (
              <div className="px-2 text-xs italic text-muted/60">—</div>
            ) : (
              <ul className="space-y-1.5">
                {grouped[s].map((e) => (
                  <li
                    key={e.diffuseur}
                    className="rounded-lg bg-panel px-3 py-2 text-sm"
                  >
                    <div className="font-medium text-white">{e.diffuseur}</div>
                    <div className="mt-0.5 text-xs text-muted">{e.nextStep}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        <div className="mt-2 border-t border-border pt-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Fiches
            </h3>
            <span className="text-xs text-muted">{fiches.length}</span>
          </div>
          {fiches.length === 0 ? (
            <div className="px-2 text-xs italic text-muted/60">
              Aucune fiche sauvegardée.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {fiches
                .slice()
                .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
                .map((f) => {
                  const d = new Date(f.savedAt);
                  const date = isNaN(d.getTime())
                    ? f.savedAt
                    : d.toISOString().slice(0, 10);
                  return (
                    <li key={f.broadcaster + f.savedAt}>
                      <button
                        onClick={() => showFiche(f)}
                        className="w-full rounded-lg bg-panel px-3 py-2 text-left text-sm transition hover:bg-panel/60"
                      >
                        <div className="font-medium text-white">{f.broadcaster}</div>
                        <div className="mt-0.5 text-xs text-muted">{date}</div>
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
