export type CrmStatus = "Cold" | "Contacté" | "En discussion" | "Deal" | "Perdu";

export type CrmEntry = {
  diffuseur: string;
  statut: CrmStatus;
  nextStep: string;
  updatedAt: string;
};

const KEY = "datarouter_crm_v1";
const STATUSES: CrmStatus[] = ["Cold", "Contacté", "En discussion", "Deal", "Perdu"];

export function isCrmStatus(s: string): s is CrmStatus {
  return (STATUSES as string[]).includes(s);
}

export function loadCrm(): CrmEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as CrmEntry[];
  } catch {
    return [];
  }
}

export function saveCrm(entries: CrmEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(entries));
  window.dispatchEvent(new CustomEvent("crm:updated"));
}

export function upsertEntry(diffuseur: string, statut: CrmStatus, nextStep: string): CrmEntry {
  const entries = loadCrm();
  const idx = entries.findIndex(
    (e) => e.diffuseur.toLowerCase() === diffuseur.toLowerCase(),
  );
  const entry: CrmEntry = {
    diffuseur,
    statut,
    nextStep,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  saveCrm(entries);
  return entry;
}

export function renderCrmMarkdown(entries: CrmEntry[]): string {
  if (entries.length === 0) {
    return "**Pipeline vide.** Ajoute une entrée avec `crm update [diffuseur] [statut] [next step]`.";
  }
  const byStatus: Record<CrmStatus, CrmEntry[]> = {
    Cold: [],
    Contacté: [],
    "En discussion": [],
    Deal: [],
    Perdu: [],
  };
  for (const e of entries) {
    if (isCrmStatus(e.statut)) byStatus[e.statut].push(e);
  }
  const lines: string[] = ["## Pipeline CRM"];
  for (const s of STATUSES) {
    const list = byStatus[s];
    lines.push(`\n### ${s} — ${list.length}`);
    if (list.length === 0) {
      lines.push("_(vide)_");
    } else {
      for (const e of list) {
        const d = new Date(e.updatedAt);
        const date = isNaN(d.getTime()) ? e.updatedAt : d.toISOString().slice(0, 10);
        lines.push(`- **${e.diffuseur}** — ${e.nextStep} _(maj ${date})_`);
      }
    }
  }
  return lines.join("\n");
}
