export type SearchResult = { title: string; url: string; snippet: string };

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

function unwrapDuckUrl(href: string): string {
  try {
    if (href.startsWith("//")) href = "https:" + href;
    if (href.includes("/l/?") || href.includes("uddg=")) {
      const u = new URL(href, "https://duckduckgo.com");
      const uddg = u.searchParams.get("uddg");
      if (uddg) return decodeURIComponent(uddg);
    }
    return href;
  } catch {
    return href;
  }
}

export async function searchWeb(query: string, max = 6): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `q=${encodeURIComponent(query)}`,
    cache: "no-store",
  });
  if (!res.ok) return [];
  const html = await res.text();

  const results: SearchResult[] = [];
  const blockRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) && results.length < max) {
    const rawUrl = m[1];
    const title = decodeHtml(stripTags(m[2]));
    const snippet = decodeHtml(stripTags(m[3]));
    const finalUrl = unwrapDuckUrl(rawUrl);
    if (title && finalUrl) results.push({ title, url: finalUrl, snippet });
  }
  return results;
}

export async function researchMulti(queries: string[], perQuery = 4): Promise<SearchResult[]> {
  const all: SearchResult[] = [];
  const seen = new Set<string>();
  for (const q of queries) {
    try {
      const r = await searchWeb(q, perQuery);
      for (const item of r) {
        if (!seen.has(item.url)) {
          seen.add(item.url);
          all.push(item);
        }
      }
    } catch {
      // ignore single-query failures
    }
  }
  return all.slice(0, 12);
}

export function formatResultsForContext(results: SearchResult[]): string {
  if (results.length === 0) return "Aucun résultat web exploitable.";
  return results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`)
    .join("\n\n");
}
