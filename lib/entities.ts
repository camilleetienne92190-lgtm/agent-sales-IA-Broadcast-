export const BROADCASTERS: string[] = [
  "RTBF",
  "RTL Belgium",
  "BX1",
  "Télé MB",
  "Tele MB",
  "TV Lux",
  "RTC Liège",
  "RTC Liege",
  "VRT",
  "Sporza",
  "VTM",
  "DPG Media NL",
  "DPG Media",
  "TVL",
  "WTV",
  "ROBtv",
  "NPO",
  "RTL Nederland",
  "Talpa",
  "BFM Régions",
  "BFM Regions",
  "BFM",
];

export const MARKETS: string[] = [
  "CSA",
  "VRM",
  "Mediakabel",
  "ARCOM",
  "Belgique FR",
  "Belgique FL",
  "Belgique",
  "Wallonie",
  "Flandre",
  "flamand",
  "Pays-Bas",
  "Pays Bas",
  "Nederland",
  "France",
];

function dedupSubstrings(matches: string[]): string[] {
  const sorted = [...matches].sort((a, b) => b.length - a.length);
  const kept: string[] = [];
  for (const m of sorted) {
    if (!kept.some((k) => k.toLowerCase().includes(m.toLowerCase()))) {
      kept.push(m);
    }
  }
  return kept;
}

function findMatches(text: string, dict: string[]): string[] {
  const lower = text.toLowerCase();
  const hits = dict.filter((x) => lower.includes(x.toLowerCase()));
  return dedupSubstrings(hits);
}

export function detectEntities(text: string): {
  broadcasters: string[];
  markets: string[];
} {
  return {
    broadcasters: findMatches(text, BROADCASTERS),
    markets: findMatches(text, MARKETS),
  };
}
