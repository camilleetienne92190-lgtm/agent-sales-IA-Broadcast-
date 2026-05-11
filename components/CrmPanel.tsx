"use client";

import { useEffect, useState } from "react";
import { CrmEntry, CrmStatus, loadCrm } from "@/lib/tools/crm";

const STATUSES: CrmStatus[] = ["Cold", "Contacté", "En discussion", "Deal", "Perdu"];

const STATUS_COLOR: Record<CrmStatus, string> = {
  Cold: "text-slate-300",
  Contacté: "text-blue-300",
  "En discussion": "text-yellow-300",
  Deal: "text-green-300",
  Perdu: "text-red-300",
};

export function CrmPanel() {
  const [entries, setEntries] = useState<CrmEntry[]>([]);

  useEffect(() => {
    const refresh = () => setEntries(loadCrm());
    refresh();
    window.addEventListener("crm:updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("crm:updated", refresh);
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

  return (
    <aside className="hidden h-full w-[30%] flex-col border-l border-border bg-bg lg:flex">
      <div className="px-6 py-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Pipeline CRM
        </h2>
        <p className="mt-1 text-xs text-muted">
          {entries.length} prospect{entries.length !== 1 ? "s" : ""} · stocké localement
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {STATUSES.map((s) => (
          <div key={s} className="mb-5">
            <div className={`mb-2 text-xs font-medium uppercase tracking-wider ${STATUS_COLOR[s]}`}>
              {s} · {grouped[s].length}
            </div>
            {grouped[s].length === 0 ? (
              <div className="text-xs text-muted/60 italic px-2">—</div>
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
      </div>
    </aside>
  );
}
