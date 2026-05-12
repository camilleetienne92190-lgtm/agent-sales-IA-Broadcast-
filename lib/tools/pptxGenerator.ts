import pptxgen from "pptxgenjs";
import type { DeckPlan, SlidePlan, SlideType } from "./pptxPlanner";

type Palette = {
  bg: string;
  text: string;
  secondary: string;
  card: string;
};

const PAL_DARK: Palette = {
  bg: "0F1923",
  text: "FFFFFF",
  secondary: "94A3B8",
  card: "1E2D3D",
};
const PAL_LIGHT: Palette = {
  bg: "FFFFFF",
  text: "1E293B",
  secondary: "64748B",
  card: "F1F5F9",
};

const W = 13.333;
const H = 7.5;
const M = 0.5;
const TITLE_Y = 0.5;
const TITLE_H = 0.7;
const CONTENT_Y = 1.45;
const CONTENT_H = H - CONTENT_Y - M;

const GREEN_OK = "16A34A";
const RED_KO = "DC2626";

/* ---------- Safe primitives ---------- */

function hx(c?: string): string {
  if (!c) return "00B4D8";
  const cleaned = c.replace(/^#/, "").toUpperCase();
  return /^[0-9A-F]{6}$/.test(cleaned) ? cleaned : "00B4D8";
}

/** Never returns an object — always a string. Objects → fallback. */
function txt(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    const parts = v.map((x) => txt(x, "")).filter(Boolean);
    return parts.length ? parts.join(", ") : fallback;
  }
  return fallback;
}

function arr<T = any>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function strArr(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => txt(x, "")).filter((s) => s.length > 0);
  }
  if (typeof v === "string" && v.length > 0) return [v];
  return [];
}

function isDark(p: Palette): boolean {
  return p.bg === PAL_DARK.bg;
}

function paletteFor(plan: DeckPlan, slide: SlidePlan, idx: number): Palette {
  // Cover and closing are ALWAYS dark regardless of colorScheme.
  if (slide.type === "cover") return PAL_DARK;
  if (slide.type === "closing") return PAL_DARK;
  if (plan.colorScheme === "dark") return PAL_DARK;
  if (plan.colorScheme === "light") return PAL_LIGHT;
  // mixed: everything else light
  return PAL_LIGHT;
}

function addTitle(slide: pptxgen.Slide, title: string, palette: Palette, size = 32) {
  slide.addText(txt(title), {
    x: M,
    y: TITLE_Y,
    w: W - 2 * M,
    h: TITLE_H,
    fontFace: "Calibri",
    fontSize: size,
    bold: true,
    color: palette.text,
    align: "left",
    valign: "middle",
  });
}

/* ---------- Renderers (new content shapes) ---------- */

function renderCover(slide: pptxgen.Slide, slidePlan: SlidePlan, plan: DeckPlan, palette: Palette, accent: string) {
  // bg already set to palette.bg (dark forced for cover)
  // Accent strip bottom
  slide.addShape("rect", {
    x: 0,
    y: H - 0.12,
    w: W,
    h: 0.12,
    fill: { color: accent },
    line: { color: accent },
  });

  // Title — 40pt blanc bold centré y=15% (~1.13")
  slide.addText(txt(plan.title, "Présentation"), {
    x: M,
    y: H * 0.15,
    w: W - 2 * M,
    h: 1.6,
    fontFace: "Calibri",
    fontSize: 40,
    bold: true,
    color: palette.text,
    align: "center",
    valign: "middle",
  });

  // Subtitle 16pt secondary y=30% (~2.25")
  const subtitle = txt(slidePlan.content?.subtitle) || txt(plan.subtitle);
  if (subtitle) {
    slide.addText(subtitle, {
      x: M,
      y: H * 0.30,
      w: W - 2 * M,
      h: 0.8,
      fontFace: "Calibri",
      fontSize: 16,
      color: palette.secondary,
      align: "center",
    });
  }

  // Stats row y=55% (~4.13"), 3 columns
  const stats = arr<{ value?: unknown; label?: unknown }>(slidePlan.content?.stats);
  if (stats.length > 0) {
    const n = Math.min(stats.length, 4);
    const colW = (W - 2 * M) / n;
    const sy = H * 0.55;
    for (let i = 0; i < n; i++) {
      const s = stats[i]!;
      const x = M + i * colW;
      slide.addText(txt(s.value), {
        x,
        y: sy,
        w: colW,
        h: 1.0,
        fontFace: "Calibri",
        fontSize: 48,
        bold: true,
        color: palette.text,
        align: "center",
      });
      slide.addText(txt(s.label), {
        x,
        y: sy + 1.05,
        w: colW,
        h: 0.5,
        fontFace: "Calibri",
        fontSize: 12,
        color: palette.secondary,
        align: "center",
      });
    }
  }

  // Author y=88%
  const author = txt(plan.author);
  if (author) {
    slide.addText(author, {
      x: M,
      y: H * 0.88,
      w: W - 2 * M,
      h: 0.4,
      fontFace: "Calibri",
      fontSize: 11,
      color: palette.secondary,
      align: "center",
    });
  }
}

function renderSommaire(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  // Title "SOMMAIRE"
  slide.addText("SOMMAIRE", {
    x: W * 0.08,
    y: H * 0.08,
    w: W * 0.84,
    h: 0.7,
    fontFace: "Calibri",
    fontSize: 28,
    bold: true,
    color: palette.text,
  });
  // Accent bar
  slide.addShape("rect", {
    x: W * 0.08,
    y: H * 0.18,
    w: W * 0.10,
    h: 0.06,
    fill: { color: accent },
    line: { color: accent },
  });

  const sections = arr<{ number?: unknown; title?: unknown; description?: unknown }>(
    slidePlan.content?.sections ?? slidePlan.content?.items,
  );
  const startY = H * 0.28;
  const availH = H - startY - M;
  const rowH = sections.length > 0 ? Math.min(0.95, availH / sections.length) : 0.6;

  sections.forEach((s, i) => {
    const y = startY + i * rowH;
    slide.addText(txt(s.number) || String(i + 1).padStart(2, "0"), {
      x: M,
      y,
      w: 1.0,
      h: rowH,
      fontFace: "Calibri",
      fontSize: 22,
      bold: true,
      color: accent,
      valign: "middle",
    });
    slide.addText(txt(s.title), {
      x: M + 1.1,
      y,
      w: W - 2 * M - 1.1,
      h: rowH * 0.5,
      fontFace: "Calibri",
      fontSize: 16,
      bold: true,
      color: palette.text,
      valign: "middle",
    });
    const desc = txt(s.description);
    if (desc) {
      slide.addText(desc, {
        x: M + 1.1,
        y: y + rowH * 0.5,
        w: W - 2 * M - 1.1,
        h: rowH * 0.5,
        fontFace: "Calibri",
        fontSize: 12,
        color: palette.secondary,
        italic: true,
      });
    }
  });
}

function renderContexte(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Contexte", palette);
  const market = slidePlan.content?.market ?? {};
  const product = slidePlan.content?.product ?? slidePlan.content?.produit ?? {};
  const colGap = 0.4;
  const colW = (W - 2 * M - colGap) / 2;

  function renderColumn(x: number, header: string, facts: string[]) {
    slide.addShape("rect", {
      x,
      y: CONTENT_Y,
      w: colW,
      h: CONTENT_H,
      fill: { color: palette.card },
      line: { color: palette.card },
    });
    slide.addText(header, {
      x: x + 0.3,
      y: CONTENT_Y + 0.25,
      w: colW - 0.6,
      h: 0.5,
      fontFace: "Calibri",
      fontSize: 16,
      bold: true,
      color: accent,
    });
    if (facts.length > 0) {
      slide.addText(
        facts.map((f) => ({ text: f, options: { bullet: { code: "25CF" } } })),
        {
          x: x + 0.3,
          y: CONTENT_Y + 0.9,
          w: colW - 0.6,
          h: CONTENT_H - 1.1,
          fontFace: "Calibri",
          fontSize: 13,
          color: palette.text,
          paraSpaceAfter: 8,
        },
      );
    }
  }

  renderColumn(M, txt((market as any).title, "Marché"), strArr((market as any).facts ?? slidePlan.content?.marche));
  renderColumn(
    M + colW + colGap,
    txt((product as any).title, "Produit"),
    strArr((product as any).facts ?? slidePlan.content?.produit),
  );
}

function renderObjectifs(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Objectifs", palette);
  const items = arr<{ number?: unknown; label?: unknown; sublabel?: unknown; detail?: unknown }>(
    slidePlan.content?.items,
  ).slice(0, 4);
  if (items.length === 0) return;

  // 2x2 grid (or 1x1, 1x2, etc.)
  const cols = items.length <= 2 ? items.length : 2;
  const rows = Math.ceil(items.length / cols);
  const gap = 0.3;
  const cardW = (W - 2 * M - gap * (cols - 1)) / cols;
  const cardH = (CONTENT_H - gap * (rows - 1)) / Math.max(1, rows);

  items.forEach((it, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = M + c * (cardW + gap);
    const y = CONTENT_Y + r * (cardH + gap);

    // Rounded rectangle with accent 20% opacity
    slide.addShape("roundRect", {
      x,
      y,
      w: cardW,
      h: cardH,
      fill: { color: accent, transparency: 80 },
      line: { color: accent, width: 1 },
      rectRadius: 0.15,
    });
    // Number 32pt accent bold
    slide.addText(txt(it.number) || String(i + 1), {
      x: x + 0.3,
      y: y + 0.25,
      w: 1.5,
      h: 0.8,
      fontFace: "Calibri",
      fontSize: 32,
      bold: true,
      color: accent,
    });
    // Label 15pt bold
    slide.addText(txt(it.label), {
      x: x + 0.3,
      y: y + 1.1,
      w: cardW - 0.6,
      h: 0.6,
      fontFace: "Calibri",
      fontSize: 15,
      bold: true,
      color: palette.text,
    });
    // Sublabel 12pt grey
    const sub = txt(it.sublabel) || txt(it.detail);
    if (sub) {
      slide.addText(sub, {
        x: x + 0.3,
        y: y + 1.75,
        w: cardW - 0.6,
        h: cardH - 2.0,
        fontFace: "Calibri",
        fontSize: 12,
        color: palette.secondary,
        valign: "top",
      });
    }
  });
}

function renderCibles(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Cibles", palette);

  const funnel = arr<{ label?: unknown; count?: unknown; stage?: unknown }>(slidePlan.content?.funnel);
  const segments = arr<{
    name?: unknown;
    volume?: unknown;
    channel?: unknown;
    priority?: unknown;
    persona?: unknown;
  }>(slidePlan.content?.segments);

  // Horizontal funnel
  const fy = CONTENT_Y;
  const fh = 1.6;
  const fullW = W - 2 * M;
  const n = Math.max(1, funnel.length);
  for (let i = 0; i < n; i++) {
    const f = funnel[i]!;
    const segW = fullW / n;
    const inset = (i / n) * 0.4;
    const x = M + i * segW;
    slide.addShape("rect", {
      x: x + inset / 2,
      y: fy + (fh * (i / (n * 2))),
      w: segW - inset,
      h: fh - fh * (i / n) * 0.5,
      fill: { color: accent, transparency: Math.min(60, i * 10) },
      line: { color: accent },
    });
    const label = txt(f.label) || txt(f.stage);
    const count = txt(f.count);
    slide.addText(label + (count ? `\n${count}` : ""), {
      x,
      y: fy,
      w: segW,
      h: fh,
      fontFace: "Calibri",
      fontSize: 13,
      bold: true,
      color: "FFFFFF",
      align: "center",
      valign: "middle",
    });
  }

  if (segments.length === 0) return;

  // Segments table
  const tableY = fy + fh + 0.4;
  const headerCells: pptxgen.TableRow = [
    { text: "Segment", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
    { text: "Volume", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
    { text: "Canal", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
    { text: "Priorité", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
  ];
  const body = segments.map((s, i) => {
    const alt = i % 2 === 0 ? palette.card : palette.bg;
    return [
      { text: txt(s.name), options: { color: palette.text, bold: true, fill: { color: alt } } },
      { text: txt(s.volume), options: { color: palette.text, fill: { color: alt } } },
      { text: txt(s.channel), options: { color: palette.text, fill: { color: alt } } },
      { text: txt(s.priority), options: { color: palette.text, bold: true, fill: { color: alt } } },
    ];
  });

  slide.addTable([headerCells, ...body], {
    x: M,
    y: tableY,
    w: W - 2 * M,
    fontFace: "Calibri",
    fontSize: 12,
    border: { type: "solid", color: palette.card, pt: 1 },
  });
}

function renderConcurrentiel(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Positionnement", palette);
  const criteria = strArr(slidePlan.content?.criteria);
  const competitors = arr<{ name?: unknown; scores?: unknown }>(slidePlan.content?.competitors);
  const differentiator = txt(slidePlan.content?.differentiator);

  if (criteria.length > 0 && competitors.length > 0) {
    const header: pptxgen.TableRow = [
      { text: "Critère", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
      ...competitors.map((c) => ({
        text: txt(c.name),
        options: { bold: true, color: "FFFFFF", fill: { color: accent }, align: "center" as const },
      })),
    ];
    const body: pptxgen.TableRow[] = criteria.map((crit, ci) => {
      const row: pptxgen.TableRow = [
        { text: crit, options: { color: palette.text, bold: true } },
      ];
      for (const c of competitors) {
        const scores = Array.isArray(c.scores) ? (c.scores as unknown[]) : [];
        const v = scores[ci];
        if (typeof v === "boolean") {
          row.push({
            text: v ? "✓" : "✗",
            options: {
              color: v ? GREEN_OK : RED_KO,
              bold: true,
              align: "center",
            },
          });
        } else {
          row.push({ text: txt(v, "—"), options: { color: palette.text, align: "center" } });
        }
      }
      return row;
    });
    slide.addTable([header, ...body], {
      x: M,
      y: CONTENT_Y,
      w: W - 2 * M,
      fontFace: "Calibri",
      fontSize: 12,
      border: { type: "solid", color: palette.card, pt: 1 },
    });
  }

  if (differentiator) {
    slide.addShape("rect", {
      x: M,
      y: H - 1.6,
      w: W - 2 * M,
      h: 1.0,
      fill: { color: accent, transparency: 85 },
      line: { color: accent, width: 2 },
    });
    slide.addText("Notre différenciation", {
      x: M + 0.3,
      y: H - 1.5,
      w: W - 2 * M - 0.6,
      h: 0.4,
      fontFace: "Calibri",
      fontSize: 11,
      bold: true,
      color: accent,
    });
    slide.addText(differentiator, {
      x: M + 0.3,
      y: H - 1.1,
      w: W - 2 * M - 0.6,
      h: 0.5,
      fontFace: "Calibri",
      fontSize: 14,
      bold: true,
      color: palette.text,
      valign: "middle",
    });
  }
}

function renderTimeline(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Timeline", palette);
  const events = arr<{ date?: unknown; action?: unknown; detail?: unknown; label?: unknown }>(
    slidePlan.content?.events ?? slidePlan.content?.steps,
  );
  if (events.length === 0) return;

  const lineY = CONTENT_Y + CONTENT_H / 2;
  slide.addShape("line", {
    x: M + 0.5,
    y: lineY,
    w: W - 2 * M - 1.0,
    h: 0,
    line: { color: accent, width: 3 },
  });

  const n = events.length;
  events.forEach((e, i) => {
    const cx = M + 0.5 + ((i + 0.5) / n) * (W - 2 * M - 1.0);
    slide.addShape("ellipse", {
      x: cx - 0.18,
      y: lineY - 0.18,
      w: 0.36,
      h: 0.36,
      fill: { color: accent },
      line: { color: accent },
    });
    const above = i % 2 === 0;
    const boxY = above ? lineY - 1.7 : lineY + 0.4;
    slide.addText(txt(e.date), {
      x: cx - 1.5,
      y: boxY,
      w: 3.0,
      h: 0.35,
      fontFace: "Calibri",
      fontSize: 11,
      bold: true,
      color: accent,
      align: "center",
    });
    slide.addText(txt(e.action) || txt(e.label), {
      x: cx - 1.5,
      y: boxY + 0.4,
      w: 3.0,
      h: 0.5,
      fontFace: "Calibri",
      fontSize: 13,
      bold: true,
      color: palette.text,
      align: "center",
    });
    const det = txt(e.detail);
    if (det) {
      slide.addText(det, {
        x: cx - 1.5,
        y: boxY + 0.95,
        w: 3.0,
        h: 0.5,
        fontFace: "Calibri",
        fontSize: 10,
        color: palette.secondary,
        align: "center",
      });
    }
  });
}

function renderMessages(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Messages clés", palette);
  const segments = arr<{ name?: unknown; pitch?: unknown; hook?: unknown; cta?: unknown }>(
    slidePlan.content?.segments,
  );
  if (segments.length === 0) return;

  const gap = 0.2;
  const cardH = (CONTENT_H - gap * (segments.length - 1)) / Math.max(1, segments.length);
  segments.forEach((s, i) => {
    const y = CONTENT_Y + i * (cardH + gap);
    // Card background
    slide.addShape("rect", {
      x: M,
      y,
      w: W - 2 * M,
      h: cardH,
      fill: { color: palette.card },
      line: { color: palette.card },
    });
    // Left accent border
    slide.addShape("rect", {
      x: M,
      y,
      w: 0.08,
      h: cardH,
      fill: { color: accent },
      line: { color: accent },
    });
    // Name
    slide.addText(txt(s.name), {
      x: M + 0.3,
      y: y + 0.15,
      w: 3.0,
      h: cardH - 0.3,
      fontFace: "Calibri",
      fontSize: 14,
      bold: true,
      color: accent,
      valign: "middle",
    });
    // PITCH / HOOK / CTA columns
    const cols: { label: string; v: string }[] = [
      { label: "PITCH", v: txt(s.pitch) },
      { label: "HOOK", v: txt(s.hook) },
      { label: "CTA", v: txt(s.cta) },
    ];
    const colsStart = M + 3.4;
    const colsW = W - M - colsStart;
    const colW = colsW / cols.length;
    cols.forEach((c, j) => {
      const cx = colsStart + j * colW;
      slide.addText(c.label, {
        x: cx,
        y: y + 0.15,
        w: colW - 0.15,
        h: 0.3,
        fontFace: "Calibri",
        fontSize: 9,
        bold: true,
        color: palette.secondary,
      });
      slide.addText(c.v, {
        x: cx,
        y: y + 0.45,
        w: colW - 0.15,
        h: cardH - 0.55,
        fontFace: "Calibri",
        fontSize: 11,
        color: palette.text,
        valign: "top",
      });
    });
  });
}

function renderStack(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Stack", palette);
  const tools = arr<{ name?: unknown; role?: unknown; detail?: unknown; description?: unknown }>(
    slidePlan.content?.tools ?? slidePlan.content?.items,
  );
  if (tools.length === 0) return;

  const cols = 3;
  const rows = Math.ceil(tools.length / cols);
  const gap = 0.25;
  const cardW = (W - 2 * M - gap * (cols - 1)) / cols;
  const cardH = (CONTENT_H - gap * (rows - 1)) / Math.max(1, rows);

  tools.forEach((t, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = M + c * (cardW + gap);
    const y = CONTENT_Y + r * (cardH + gap);
    slide.addShape("rect", {
      x,
      y,
      w: cardW,
      h: cardH,
      fill: { color: palette.card },
      line: { color: palette.card },
    });
    slide.addText(txt(t.name), {
      x: x + 0.25,
      y: y + 0.2,
      w: cardW - 0.5,
      h: 0.45,
      fontFace: "Calibri",
      fontSize: 14,
      bold: true,
      color: accent,
    });
    slide.addText(txt(t.role), {
      x: x + 0.25,
      y: y + 0.7,
      w: cardW - 0.5,
      h: 0.35,
      fontFace: "Calibri",
      fontSize: 12,
      bold: true,
      color: palette.text,
    });
    const detail = txt(t.detail) || txt(t.description);
    if (detail) {
      slide.addText(detail, {
        x: x + 0.25,
        y: y + 1.1,
        w: cardW - 0.5,
        h: cardH - 1.25,
        fontFace: "Calibri",
        fontSize: 11,
        color: palette.secondary,
        valign: "top",
      });
    }
  });
}

function renderKpis(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "KPIs", palette);
  const metrics = arr<{ value?: unknown; label?: unknown; delta?: unknown }>(slidePlan.content?.metrics);
  const stages = arr<{ name?: unknown; count?: unknown }>(slidePlan.content?.stages ?? slidePlan.content?.pipeline);

  // Metrics row
  if (metrics.length > 0) {
    const n = Math.max(1, Math.min(4, metrics.length));
    const colW = (W - 2 * M) / n;
    metrics.forEach((m, i) => {
      const x = M + i * colW;
      slide.addText(txt(m.value), {
        x,
        y: CONTENT_Y,
        w: colW,
        h: 1.5,
        fontFace: "Calibri",
        fontSize: 52,
        bold: true,
        color: accent,
        align: "center",
        valign: "middle",
      });
      slide.addText(txt(m.label), {
        x,
        y: CONTENT_Y + 1.55,
        w: colW,
        h: 0.4,
        fontFace: "Calibri",
        fontSize: 12,
        color: palette.secondary,
        align: "center",
      });
      const delta = txt(m.delta);
      if (delta) {
        slide.addText(delta, {
          x,
          y: CONTENT_Y + 1.95,
          w: colW,
          h: 0.4,
          fontFace: "Calibri",
          fontSize: 12,
          bold: true,
          color: GREEN_OK,
          align: "center",
        });
      }
    });
  }

  // Pipeline stages — connected rectangles
  if (stages.length > 0) {
    const py = CONTENT_Y + 3.0;
    const total = W - 2 * M;
    const segW = total / stages.length;
    stages.forEach((s, i) => {
      const x = M + i * segW;
      slide.addShape("rect", {
        x: x + 0.05,
        y: py,
        w: segW - 0.1,
        h: 1.2,
        fill: { color: palette.card },
        line: { color: palette.card },
      });
      slide.addText(txt(s.count), {
        x,
        y: py + 0.15,
        w: segW,
        h: 0.6,
        fontFace: "Calibri",
        fontSize: 24,
        bold: true,
        color: accent,
        align: "center",
      });
      slide.addText(txt(s.name), {
        x,
        y: py + 0.75,
        w: segW,
        h: 0.4,
        fontFace: "Calibri",
        fontSize: 11,
        color: palette.secondary,
        align: "center",
      });
    });
  }
}

function renderPipeline(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Pipeline", palette);
  const stages = arr<{ name?: unknown; count?: unknown; note?: unknown }>(
    slidePlan.content?.stages ?? slidePlan.content?.pipeline,
  );
  if (stages.length === 0) return;
  const total = W - 2 * M;
  const yMid = CONTENT_Y + 2.0;
  const n = stages.length;
  stages.forEach((s, i) => {
    const segW = total / n;
    const scale = Math.max(0.4, 1 - i * (0.6 / Math.max(1, n)));
    const h = 2.0 * scale;
    const y = yMid - h / 2;
    slide.addShape("rect", {
      x: M + i * segW + 0.1,
      y,
      w: segW - 0.2,
      h,
      fill: { color: accent, transparency: Math.min(60, i * 10) },
      line: { color: accent },
    });
    slide.addText(txt(s.count), {
      x: M + i * segW,
      y,
      w: segW,
      h: h * 0.5,
      fontFace: "Calibri",
      fontSize: 22,
      bold: true,
      color: "FFFFFF",
      align: "center",
      valign: "middle",
    });
    slide.addText(txt(s.name), {
      x: M + i * segW,
      y: y + h * 0.5,
      w: segW,
      h: h * 0.5,
      fontFace: "Calibri",
      fontSize: 11,
      color: "FFFFFF",
      align: "center",
      valign: "middle",
    });
    const note = txt(s.note);
    if (note) {
      slide.addText(note, {
        x: M + i * segW,
        y: yMid + 1.2,
        w: segW,
        h: 0.5,
        fontFace: "Calibri",
        fontSize: 10,
        italic: true,
        color: palette.secondary,
        align: "center",
      });
    }
  });
}

function renderTemplateEmail(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Template email", palette);
  const objet = txt(slidePlan.content?.objet) || txt(slidePlan.content?.subject);
  const corps = txt(slidePlan.content?.corps) || txt(slidePlan.content?.body);
  slide.addShape("rect", {
    x: M,
    y: CONTENT_Y,
    w: W - 2 * M,
    h: CONTENT_H,
    fill: { color: palette.card },
    line: { color: palette.card },
  });
  slide.addText("OBJET", {
    x: M + 0.4,
    y: CONTENT_Y + 0.25,
    w: 2.0,
    h: 0.3,
    fontFace: "Calibri",
    fontSize: 10,
    bold: true,
    color: accent,
  });
  slide.addText(objet, {
    x: M + 0.4,
    y: CONTENT_Y + 0.55,
    w: W - 2 * M - 0.8,
    h: 0.5,
    fontFace: "Calibri",
    fontSize: 18,
    bold: true,
    color: palette.text,
  });
  slide.addShape("line", {
    x: M + 0.4,
    y: CONTENT_Y + 1.2,
    w: W - 2 * M - 0.8,
    h: 0,
    line: { color: palette.secondary, width: 1 },
  });
  slide.addText(corps, {
    x: M + 0.4,
    y: CONTENT_Y + 1.4,
    w: W - 2 * M - 0.8,
    h: CONTENT_H - 1.6,
    fontFace: "Consolas",
    fontSize: 12,
    color: palette.text,
    valign: "top",
  });
}

function renderCasClient(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Cas client", palette);
  const c = slidePlan.content ?? {};
  const client = txt((c as any).client);
  if (client) {
    slide.addText(client, {
      x: M,
      y: CONTENT_Y,
      w: W - 2 * M,
      h: 0.6,
      fontFace: "Calibri",
      fontSize: 22,
      bold: true,
      color: accent,
    });
  }
  const blocks: { label: string; v: string; emphasis?: boolean }[] = [
    { label: "Problème", v: txt((c as any).probleme ?? (c as any).problem) },
    { label: "Solution", v: txt((c as any).solution) },
    { label: "Résultat", v: txt((c as any).resultat ?? (c as any).result), emphasis: true },
  ];
  const gap = 0.3;
  const cardW = (W - 2 * M - gap * 2) / 3;
  const cardH = CONTENT_H - 1.0;
  blocks.forEach((b, i) => {
    const x = M + i * (cardW + gap);
    const y = CONTENT_Y + 0.9;
    slide.addShape("rect", {
      x,
      y,
      w: cardW,
      h: cardH,
      fill: { color: palette.card },
      line: { color: palette.card },
    });
    slide.addText(b.label.toUpperCase(), {
      x: x + 0.25,
      y: y + 0.2,
      w: cardW - 0.5,
      h: 0.35,
      fontFace: "Calibri",
      fontSize: 11,
      bold: true,
      color: accent,
    });
    slide.addText(b.v, {
      x: x + 0.25,
      y: y + 0.6,
      w: cardW - 0.5,
      h: cardH - 0.8,
      fontFace: "Calibri",
      fontSize: b.emphasis ? 18 : 13,
      bold: !!b.emphasis,
      color: palette.text,
      valign: "top",
    });
  });
}

function renderTraction(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Traction", palette);
  const metrics = arr<{ value?: unknown; label?: unknown; delta?: unknown }>(slidePlan.content?.metrics);
  if (metrics.length === 0) return;
  const n = Math.max(1, Math.min(4, metrics.length));
  const colW = (W - 2 * M) / n;
  metrics.forEach((m, i) => {
    const x = M + i * colW;
    slide.addText(txt(m.value), {
      x,
      y: CONTENT_Y + 0.4,
      w: colW,
      h: 1.8,
      fontFace: "Calibri",
      fontSize: 56,
      bold: true,
      color: accent,
      align: "center",
      valign: "middle",
    });
    slide.addText(txt(m.label), {
      x,
      y: CONTENT_Y + 2.3,
      w: colW,
      h: 0.5,
      fontFace: "Calibri",
      fontSize: 13,
      color: palette.text,
      align: "center",
    });
    const d = txt(m.delta);
    if (d) {
      slide.addText(d, {
        x,
        y: CONTENT_Y + 2.85,
        w: colW,
        h: 0.5,
        fontFace: "Calibri",
        fontSize: 13,
        bold: true,
        color: GREEN_OK,
        align: "center",
      });
    }
  });
}

function renderBusinessModel(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Business model", palette);
  const tiers = arr<{ name?: unknown; price?: unknown; features?: unknown }>(slidePlan.content?.tiers);
  if (tiers.length === 0) return;
  const cols = tiers.length;
  const gap = 0.3;
  const cardW = (W - 2 * M - gap * (cols - 1)) / cols;
  tiers.forEach((t, i) => {
    const x = M + i * (cardW + gap);
    slide.addShape("rect", {
      x,
      y: CONTENT_Y,
      w: cardW,
      h: CONTENT_H - 0.2,
      fill: { color: palette.card },
      line: { color: palette.card },
    });
    slide.addText(txt(t.name), {
      x: x + 0.3,
      y: CONTENT_Y + 0.25,
      w: cardW - 0.6,
      h: 0.45,
      fontFace: "Calibri",
      fontSize: 18,
      bold: true,
      color: palette.text,
    });
    slide.addText(txt(t.price), {
      x: x + 0.3,
      y: CONTENT_Y + 0.8,
      w: cardW - 0.6,
      h: 0.8,
      fontFace: "Calibri",
      fontSize: 28,
      bold: true,
      color: accent,
    });
    const feats = strArr(t.features);
    if (feats.length > 0) {
      slide.addText(
        feats.map((f) => ({ text: f, options: { bullet: { code: "2713" } } })),
        {
          x: x + 0.3,
          y: CONTENT_Y + 1.7,
          w: cardW - 0.6,
          h: CONTENT_H - 2.0,
          fontFace: "Calibri",
          fontSize: 12,
          color: palette.text,
          paraSpaceAfter: 6,
        },
      );
    }
  });
}

function renderEquipe(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Équipe", palette);
  const members = arr<{ name?: unknown; role?: unknown; bio?: unknown }>(slidePlan.content?.members);
  if (members.length === 0) return;
  const cols = Math.min(4, Math.max(1, members.length));
  const rows = Math.ceil(members.length / cols);
  const gap = 0.25;
  const cardW = (W - 2 * M - gap * (cols - 1)) / cols;
  const cardH = (CONTENT_H - gap * (rows - 1)) / Math.max(1, rows);
  members.forEach((m, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = M + c * (cardW + gap);
    const y = CONTENT_Y + r * (cardH + gap);
    slide.addShape("rect", {
      x,
      y,
      w: cardW,
      h: cardH,
      fill: { color: palette.card },
      line: { color: palette.card },
    });
    slide.addShape("ellipse", {
      x: x + cardW / 2 - 0.45,
      y: y + 0.3,
      w: 0.9,
      h: 0.9,
      fill: { color: accent },
      line: { color: accent },
    });
    slide.addText(txt(m.name), {
      x: x + 0.2,
      y: y + 1.3,
      w: cardW - 0.4,
      h: 0.4,
      fontFace: "Calibri",
      fontSize: 14,
      bold: true,
      color: palette.text,
      align: "center",
    });
    slide.addText(txt(m.role), {
      x: x + 0.2,
      y: y + 1.7,
      w: cardW - 0.4,
      h: 0.3,
      fontFace: "Calibri",
      fontSize: 10,
      color: accent,
      align: "center",
    });
    slide.addText(txt(m.bio), {
      x: x + 0.2,
      y: y + 2.05,
      w: cardW - 0.4,
      h: cardH - 2.2,
      fontFace: "Calibri",
      fontSize: 11,
      color: palette.secondary,
      align: "center",
      valign: "top",
    });
  });
}

function renderRisques(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Risques", palette);
  const rows = arr<{ risque?: unknown; probabilite?: unknown; mitigation?: unknown }>(slidePlan.content?.rows);
  if (rows.length === 0) return;
  const header: pptxgen.TableRow = [
    { text: "Risque", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
    { text: "Probabilité", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
    { text: "Mitigation", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
  ];
  const body = rows.map((r) => [
    { text: txt(r.risque), options: { color: palette.text, bold: true } },
    { text: txt(r.probabilite), options: { color: palette.text } },
    { text: txt(r.mitigation), options: { color: palette.text } },
  ]);
  slide.addTable([header, ...body], {
    x: M,
    y: CONTENT_Y,
    w: W - 2 * M,
    colW: [3.5, 2.0, W - 2 * M - 5.5],
    fontFace: "Calibri",
    fontSize: 12,
    border: { type: "solid", color: palette.card, pt: 1 },
  });
}

function renderHandover(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Passation", palette);
  const steps = arr<{ date?: unknown; label?: unknown }>(slidePlan.content?.steps);
  const livrables = strArr(slidePlan.content?.livrables);
  const lineY = CONTENT_Y + 0.9;
  if (steps.length > 0) {
    slide.addShape("line", {
      x: M + 0.4,
      y: lineY,
      w: W - 2 * M - 0.8,
      h: 0,
      line: { color: accent, width: 2 },
    });
    const n = steps.length;
    steps.forEach((s, i) => {
      const cx = M + 0.4 + ((i + 0.5) / n) * (W - 2 * M - 0.8);
      slide.addShape("ellipse", {
        x: cx - 0.14,
        y: lineY - 0.14,
        w: 0.28,
        h: 0.28,
        fill: { color: accent },
        line: { color: accent },
      });
      slide.addText(txt(s.date), {
        x: cx - 1.3,
        y: lineY - 0.65,
        w: 2.6,
        h: 0.3,
        fontFace: "Calibri",
        fontSize: 10,
        bold: true,
        color: accent,
        align: "center",
      });
      slide.addText(txt(s.label), {
        x: cx - 1.3,
        y: lineY + 0.2,
        w: 2.6,
        h: 0.5,
        fontFace: "Calibri",
        fontSize: 12,
        color: palette.text,
        align: "center",
      });
    });
  }
  if (livrables.length > 0) {
    slide.addText("Livrables", {
      x: M,
      y: CONTENT_Y + 2.6,
      w: W - 2 * M,
      h: 0.4,
      fontFace: "Calibri",
      fontSize: 16,
      bold: true,
      color: palette.text,
    });
    livrables.forEach((l, i) => {
      const y = CONTENT_Y + 3.1 + i * 0.45;
      slide.addText(String(i + 1).padStart(2, "0"), {
        x: M,
        y,
        w: 0.6,
        h: 0.4,
        fontFace: "Calibri",
        fontSize: 14,
        bold: true,
        color: accent,
      });
      slide.addText(l, {
        x: M + 0.7,
        y,
        w: W - 2 * M - 0.7,
        h: 0.4,
        fontFace: "Calibri",
        fontSize: 13,
        color: palette.text,
        valign: "middle",
      });
    });
  }
}

function renderClosing(slide: pptxgen.Slide, slidePlan: SlidePlan, plan: DeckPlan, palette: Palette, accent: string) {
  // bg forced dark
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: W,
    h: 0.12,
    fill: { color: accent },
    line: { color: accent },
  });
  const main = txt(slidePlan.content?.mainObjective) || txt(slidePlan.content?.headline) || txt(slidePlan.title);
  slide.addText(main, {
    x: M,
    y: H * 0.30,
    w: W - 2 * M,
    h: 2.4,
    fontFace: "Calibri",
    fontSize: 36,
    bold: true,
    color: palette.text,
    align: "center",
    valign: "middle",
  });
  const stack = strArr(slidePlan.content?.stack);
  if (stack.length > 0) {
    slide.addText(stack.join("  ·  "), {
      x: M,
      y: H * 0.70,
      w: W - 2 * M,
      h: 0.5,
      fontFace: "Calibri",
      fontSize: 12,
      color: palette.secondary,
      align: "center",
    });
  }
  const footer: string[] = [];
  if (plan.author) footer.push(txt(plan.author));
  footer.push(new Date().toISOString().slice(0, 10));
  slide.addText(footer.join("  ·  "), {
    x: M,
    y: H - 0.6,
    w: W - 2 * M,
    h: 0.4,
    fontFace: "Calibri",
    fontSize: 11,
    color: palette.secondary,
    align: "center",
  });
}

function renderCustom(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  const customTitle = txt(slidePlan.content?.title) || txt(slidePlan.title);
  slide.addText(customTitle, {
    x: M,
    y: TITLE_Y,
    w: W - 2 * M,
    h: TITLE_H,
    fontFace: "Calibri",
    fontSize: 24,
    bold: true,
    color: palette.text,
  });
  const body = txt(slidePlan.content?.body);
  const items = strArr(slidePlan.content?.items);
  let y = CONTENT_Y;
  if (body) {
    slide.addText(body, {
      x: M,
      y,
      w: W - 2 * M,
      h: 2.0,
      fontFace: "Calibri",
      fontSize: 14,
      color: palette.text,
      valign: "top",
    });
    y += 2.1;
  }
  if (items.length > 0) {
    slide.addText(
      items.map((it) => ({ text: it, options: { bullet: { code: "25CF" } } })),
      {
        x: M,
        y,
        w: W - 2 * M,
        h: H - y - M,
        fontFace: "Calibri",
        fontSize: 13,
        color: palette.text,
        paraSpaceAfter: 6,
      },
    );
  }
}

/* ---------- Dispatcher ---------- */

function renderSlide(
  slide: pptxgen.Slide,
  slidePlan: SlidePlan,
  plan: DeckPlan,
  palette: Palette,
  accent: string,
  idx: number,
) {
  const t = slidePlan.type as SlideType;
  try {
    switch (t) {
      case "cover":
        return renderCover(slide, slidePlan, plan, palette, accent);
      case "sommaire":
        return renderSommaire(slide, slidePlan, palette, accent);
      case "contexte":
        return renderContexte(slide, slidePlan, palette, accent);
      case "objectifs":
        return renderObjectifs(slide, slidePlan, palette, accent);
      case "cibles":
        return renderCibles(slide, slidePlan, palette, accent);
      case "concurrentiel":
        return renderConcurrentiel(slide, slidePlan, palette, accent);
      case "timeline":
        return renderTimeline(slide, slidePlan, palette, accent);
      case "messages":
        return renderMessages(slide, slidePlan, palette, accent);
      case "stack":
        return renderStack(slide, slidePlan, palette, accent);
      case "kpis":
        return renderKpis(slide, slidePlan, palette, accent);
      case "pipeline":
        return renderPipeline(slide, slidePlan, palette, accent);
      case "template_email":
        return renderTemplateEmail(slide, slidePlan, palette, accent);
      case "cas_client":
        return renderCasClient(slide, slidePlan, palette, accent);
      case "traction":
        return renderTraction(slide, slidePlan, palette, accent);
      case "business_model":
        return renderBusinessModel(slide, slidePlan, palette, accent);
      case "equipe":
        return renderEquipe(slide, slidePlan, palette, accent);
      case "risques":
        return renderRisques(slide, slidePlan, palette, accent);
      case "handover":
        return renderHandover(slide, slidePlan, palette, accent);
      case "closing":
        return renderClosing(slide, slidePlan, plan, palette, accent);
      case "custom":
      default:
        return renderCustom(slide, slidePlan, palette, accent);
    }
  } catch (err) {
    console.warn(`Renderer ${t} failed:`, (err as Error).message);
    // Defensive fallback: title only, no JSON dump.
    addTitle(slide, slidePlan.title || "Slide", palette);
    slide.addText("Contenu indisponible.", {
      x: M,
      y: CONTENT_Y,
      w: W - 2 * M,
      h: 0.5,
      fontFace: "Calibri",
      fontSize: 13,
      italic: true,
      color: palette.secondary,
    });
  }
}

/* ---------- Main entry ---------- */

export async function generatePptx(plan: DeckPlan): Promise<Buffer> {
  if (!plan || !Array.isArray(plan.slides) || plan.slides.length === 0) {
    throw new Error("Plan invalide : aucun slide à générer");
  }
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.title = plan.title || "DataRouter Deck";
  pres.author = plan.author || "Broadteam";
  pres.company = "Broadteam";

  const accent = hx(plan.accentColor);

  plan.slides.forEach((slidePlan, idx) => {
    const palette = paletteFor(plan, slidePlan, idx);
    const slide = pres.addSlide();
    slide.background = { color: palette.bg };
    renderSlide(slide, slidePlan, plan, palette, accent, idx);

    if (slidePlan.type !== "cover" && slidePlan.type !== "closing") {
      slide.addText(`${idx + 1} / ${plan.slides.length}`, {
        x: W - M - 1,
        y: H - 0.4,
        w: 1,
        h: 0.3,
        fontFace: "Calibri",
        fontSize: 9,
        color: palette.secondary,
        align: "right",
      });
    }
  });

  const data = (await pres.write({ outputType: "nodebuffer" })) as Buffer;
  return data;
}
