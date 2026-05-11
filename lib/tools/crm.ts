export type CrmStatus = "Cold" | "Contacté" | "En discussion" | "Deal" | "Perdu";

export type CrmEntry = {
  diffuseur: string;
  statut: CrmStatus;
  nextStep: string;
  updatedAt: string;
};

const KEY = "datarouter_crm_v1";
const FICHE_KEY = "datarouter_fiches_v1";
const STATUSES: CrmStatus[] = ["Cold", "Contacté", "En discussion", "Deal", "Perdu"];

export type FicheEntry = {
  broadcaster: string;
  content: string;
  savedAt: string;
};

export function getFiches(): FicheEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FICHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FicheEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveFiche(broadcaster: string, content: string): FicheEntry {
  const list = getFiches();
  const entry: FicheEntry = {
    broadcaster,
    content,
    savedAt: new Date().toISOString(),
  };
  const idx = list.findIndex(
    (f) => f.broadcaster.toLowerCase() === broadcaster.toLowerCase(),
  );
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  if (typeof window !== "undefined") {
    localStorage.setItem(FICHE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("fiches:updated"));
  }
  return entry;
}

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
