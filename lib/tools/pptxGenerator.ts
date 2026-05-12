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

function hx(c?: string): string {
  if (!c) return "00B4D8";
  return c.replace(/^#/, "").toUpperCase();
}

function isDark(p: Palette): boolean {
  return p.bg === PAL_DARK.bg;
}

function paletteFor(plan: DeckPlan, slide: SlidePlan, idx: number): Palette {
  if (plan.colorScheme === "dark") return PAL_DARK;
  if (plan.colorScheme === "light") return PAL_LIGHT;
  const isCover = slide.type === "cover" || idx === 0;
  const isClosing = slide.type === "closing" || idx === plan.slides.length - 1;
  return isCover || isClosing ? PAL_DARK : PAL_LIGHT;
}

function addTitle(slide: pptxgen.Slide, title: string, palette: Palette) {
  slide.addText(title || "", {
    x: M,
    y: TITLE_Y,
    w: W - 2 * M,
    h: TITLE_H,
    fontFace: "Calibri",
    fontSize: 32,
    bold: true,
    color: palette.text,
    align: "left",
    valign: "middle",
  });
}

function asStringArray(v: any): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  if (typeof v === "string") return [v];
  return [];
}

function asArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

function genericFallback(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette) {
  const lines: string[] = [];
  const c = slidePlan.content ?? {};
  for (const [k, v] of Object.entries(c)) {
    if (typeof v === "string") lines.push(`${k} : ${v}`);
    else if (Array.isArray(v)) {
      lines.push(`${k} :`);
      for (const item of v) {
        if (typeof item === "string") lines.push(`  • ${item}`);
        else lines.push(`  • ${JSON.stringify(item)}`);
      }
    } else if (v && typeof v === "object") {
      lines.push(`${k} : ${JSON.stringify(v)}`);
    }
  }
  slide.addText(lines.join("\n") || slidePlan.why || "", {
    x: M,
    y: CONTENT_Y,
    w: W - 2 * M,
    h: CONTENT_H,
    fontFace: "Calibri",
    fontSize: 14,
    color: palette.text,
    valign: "top",
  });
}

/* ---------- Renderers ---------- */

function renderCover(slide: pptxgen.Slide, plan: DeckPlan, palette: Palette, accent: string) {
  slide.addShape("rect", {
    x: 0,
    y: H - 0.1,
    w: W,
    h: 0.1,
    fill: { color: accent },
    line: { color: accent },
  });
  slide.addShape("rect", {
    x: M,
    y: 2.5,
    w: 1.0,
    h: 0.08,
    fill: { color: accent },
    line: { color: accent },
  });
  slide.addText(plan.title, {
    x: M,
    y: 2.7,
    w: W - 2 * M,
    h: 1.6,
    fontFace: "Calibri",
    fontSize: 44,
    bold: true,
    color: palette.text,
  });
  if (plan.subtitle) {
    slide.addText(plan.subtitle, {
      x: M,
      y: 4.4,
      w: W - 2 * M,
      h: 0.6,
      fontFace: "Calibri",
      fontSize: 18,
      color: palette.secondary,
    });
  }
  const stats = asArray<{ label?: string; value?: string }>((plan.slides[0]?.content as any)?.stats);
  if (stats.length > 0) {
    const colW = (W - 2 * M) / Math.max(1, stats.length);
    stats.forEach((s, i) => {
      slide.addText(String(s.value ?? ""), {
        x: M + i * colW,
        y: 5.5,
        w: colW,
        h: 0.6,
        fontFace: "Calibri",
        fontSize: 24,
        bold: true,
        color: accent,
      });
      slide.addText(String(s.label ?? ""), {
        x: M + i * colW,
        y: 6.1,
        w: colW,
        h: 0.4,
        fontFace: "Calibri",
        fontSize: 11,
        color: palette.secondary,
      });
    });
  }
  if (plan.author) {
    slide.addText(plan.author, {
      x: M,
      y: 6.85,
      w: W - 2 * M,
      h: 0.4,
      fontFace: "Calibri",
      fontSize: 11,
      color: palette.secondary,
    });
  }
}

function renderSommaire(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Sommaire", palette);
  const items = asArray<{ section?: string; description?: string }>(slidePlan.content?.items);
  const top = CONTENT_Y;
  const rowH = Math.min(0.9, (CONTENT_H - 0.2) / Math.max(1, items.length));
  items.forEach((it, i) => {
    const y = top + i * rowH;
    slide.addText(String(i + 1).padStart(2, "0"), {
      x: M,
      y,
      w: 0.8,
      h: rowH,
      fontFace: "Calibri",
      fontSize: 22,
      bold: true,
      color: accent,
      valign: "middle",
    });
    slide.addText(String(it.section ?? ""), {
      x: M + 0.9,
      y,
      w: 5.5,
      h: rowH * 0.55,
      fontFace: "Calibri",
      fontSize: 16,
      bold: true,
      color: palette.text,
      valign: "middle",
    });
    if (it.description) {
      slide.addText(String(it.description), {
        x: M + 0.9,
        y: y + rowH * 0.5,
        w: W - M - 0.9 - M,
        h: rowH * 0.45,
        fontFace: "Calibri",
        fontSize: 12,
        italic: true,
        color: palette.secondary,
      });
    }
  });
}

function renderContexte(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Contexte", palette);
  const marche = asStringArray(slidePlan.content?.marche);
  const produit = asStringArray(slidePlan.content?.produit);
  const colW = (W - 2 * M - 0.4) / 2;
  // Left: marché
  slide.addShape("rect", {
    x: M,
    y: CONTENT_Y,
    w: colW,
    h: CONTENT_H,
    fill: { color: palette.card },
    line: { color: palette.card },
  });
  slide.addText("Marché", {
    x: M + 0.3,
    y: CONTENT_Y + 0.2,
    w: colW - 0.6,
    h: 0.4,
    fontFace: "Calibri",
    fontSize: 14,
    bold: true,
    color: accent,
  });
  slide.addText(marche.map((m) => ({ text: m, options: { bullet: { code: "25CF" } } })), {
    x: M + 0.3,
    y: CONTENT_Y + 0.8,
    w: colW - 0.6,
    h: CONTENT_H - 1.0,
    fontFace: "Calibri",
    fontSize: 13,
    color: palette.text,
    paraSpaceAfter: 6,
  });
  // Right: produit
  const xR = M + colW + 0.4;
  slide.addShape("rect", {
    x: xR,
    y: CONTENT_Y,
    w: colW,
    h: CONTENT_H,
    fill: { color: palette.card },
    line: { color: palette.card },
  });
  slide.addText("Produit", {
    x: xR + 0.3,
    y: CONTENT_Y + 0.2,
    w: colW - 0.6,
    h: 0.4,
    fontFace: "Calibri",
    fontSize: 14,
    bold: true,
    color: accent,
  });
  slide.addText(produit.map((p) => ({ text: p, options: { bullet: { code: "25CF" } } })), {
    x: xR + 0.3,
    y: CONTENT_Y + 0.8,
    w: colW - 0.6,
    h: CONTENT_H - 1.0,
    fontFace: "Calibri",
    fontSize: 13,
    color: palette.text,
    paraSpaceAfter: 6,
  });
}

function renderObjectifs(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Objectifs", palette);
  const items = asArray<{ n?: string | number; label?: string; detail?: string }>(slidePlan.content?.items).slice(0, 4);
  const cols = Math.max(1, items.length);
  const gap = 0.3;
  const cardW = (W - 2 * M - gap * (cols - 1)) / cols;
  const cardH = Math.min(4.2, CONTENT_H - 0.2);
  items.forEach((it, i) => {
    const x = M + i * (cardW + gap);
    slide.addShape("rect", {
      x,
      y: CONTENT_Y,
      w: cardW,
      h: cardH,
      fill: { color: palette.card },
      line: { color: palette.card },
    });
    slide.addShape("ellipse", {
      x: x + 0.4,
      y: CONTENT_Y + 0.4,
      w: 0.9,
      h: 0.9,
      fill: { color: accent },
      line: { color: accent },
    });
    slide.addText(String(it.n ?? i + 1), {
      x: x + 0.4,
      y: CONTENT_Y + 0.4,
      w: 0.9,
      h: 0.9,
      fontFace: "Calibri",
      fontSize: 22,
      bold: true,
      color: "FFFFFF",
      align: "center",
      valign: "middle",
    });
    slide.addText(String(it.label ?? ""), {
      x: x + 0.3,
      y: CONTENT_Y + 1.5,
      w: cardW - 0.6,
      h: 0.8,
      fontFace: "Calibri",
      fontSize: 16,
      bold: true,
      color: palette.text,
    });
    if (it.detail) {
      slide.addText(String(it.detail), {
        x: x + 0.3,
        y: CONTENT_Y + 2.3,
        w: cardW - 0.6,
        h: cardH - 2.5,
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
  const funnel = asArray<{ stage?: string; count?: number | string }>(slidePlan.content?.funnel);
  const segments = asArray<{ name?: string; persona?: string; priority?: string }>(slidePlan.content?.segments);
  // Horizontal funnel
  const fY = CONTENT_Y;
  const fH = 1.4;
  const fullW = W - 2 * M;
  const n = Math.max(1, funnel.length);
  for (let i = 0; i < n; i++) {
    const segW = fullW / n;
    const inset = (i / n) * 0.5;
    slide.addShape("rect", {
      x: M + i * segW + inset / 2,
      y: fY + (fH * (i / n)) / 2,
      w: segW - inset,
      h: fH - fH * (i / n),
      fill: { color: accent, transparency: i * 8 },
      line: { color: accent },
    });
    const f = funnel[i]!;
    slide.addText(`${f.stage ?? ""}${f.count != null ? `\n${f.count}` : ""}`, {
      x: M + i * segW,
      y: fY,
      w: segW,
      h: fH,
      fontFace: "Calibri",
      fontSize: 12,
      bold: true,
      color: "FFFFFF",
      align: "center",
      valign: "middle",
    });
  }
  // Table
  const rows: pptxgen.TableRow[] = [
    [
      { text: "Segment", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
      { text: "Persona", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
      { text: "Priorité", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
    ],
    ...segments.map((s) => [
      { text: String(s.name ?? ""), options: { color: palette.text } },
      { text: String(s.persona ?? ""), options: { color: palette.text } },
      { text: String(s.priority ?? ""), options: { color: palette.text, bold: true } },
    ]),
  ];
  slide.addTable(rows, {
    x: M,
    y: fY + fH + 0.4,
    w: W - 2 * M,
    fontFace: "Calibri",
    fontSize: 12,
    border: { type: "solid", color: palette.card, pt: 1 },
  });
}

function renderConcurrentiel(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Positionnement", palette);
  const rows = asArray<{ feature?: string; us?: any; them1?: any; them2?: any }>(slidePlan.content?.rows);
  const diff = String(slidePlan.content?.differentiation ?? "");
  const header: pptxgen.TableRow = [
    { text: "Critère", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
    { text: "Nous", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
    { text: "Concurrent A", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
    { text: "Concurrent B", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
  ];
  function mark(v: any) {
    if (typeof v === "boolean") {
      return v
        ? { text: "✓", options: { color: "10B981", bold: true, align: "center" as const } }
        : { text: "✗", options: { color: "E11D48", bold: true, align: "center" as const } };
    }
    return { text: String(v ?? "—"), options: { color: palette.text } };
  }
  const body = rows.map((r) => [
    { text: String(r.feature ?? ""), options: { color: palette.text, bold: true } },
    mark(r.us),
    mark(r.them1),
    mark(r.them2),
  ]);
  slide.addTable([header, ...body], {
    x: M,
    y: CONTENT_Y,
    w: W - 2 * M,
    fontFace: "Calibri",
    fontSize: 12,
    border: { type: "solid", color: palette.card, pt: 1 },
  });
  if (diff) {
    slide.addShape("rect", {
      x: M,
      y: H - 1.6,
      w: W - 2 * M,
      h: 0.9,
      fill: { color: palette.card },
      line: { color: accent, width: 2 },
    });
    slide.addText(diff, {
      x: M + 0.2,
      y: H - 1.55,
      w: W - 2 * M - 0.4,
      h: 0.8,
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
  const steps = asArray<{ date?: string; label?: string; detail?: string }>(slidePlan.content?.steps);
  const lineY = CONTENT_Y + 2.5;
  slide.addShape("line", {
    x: M,
    y: lineY,
    w: W - 2 * M,
    h: 0,
    line: { color: accent, width: 2 },
  });
  const n = Math.max(1, steps.length);
  steps.forEach((s, i) => {
    const cx = M + ((i + 0.5) / n) * (W - 2 * M);
    slide.addShape("ellipse", {
      x: cx - 0.15,
      y: lineY - 0.15,
      w: 0.3,
      h: 0.3,
      fill: { color: accent },
      line: { color: accent },
    });
    const above = i % 2 === 0;
    const boxY = above ? lineY - 1.7 : lineY + 0.4;
    slide.addText(String(s.date ?? ""), {
      x: cx - 1.4,
      y: boxY,
      w: 2.8,
      h: 0.35,
      fontFace: "Calibri",
      fontSize: 11,
      color: accent,
      bold: true,
      align: "center",
    });
    slide.addText(String(s.label ?? ""), {
      x: cx - 1.4,
      y: boxY + 0.4,
      w: 2.8,
      h: 0.45,
      fontFace: "Calibri",
      fontSize: 13,
      bold: true,
      color: palette.text,
      align: "center",
    });
    if (s.detail) {
      slide.addText(String(s.detail), {
        x: cx - 1.4,
        y: boxY + 0.9,
        w: 2.8,
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
  const segments = asArray<{ name?: string; pitch?: string; hook?: string; cta?: string }>(slidePlan.content?.segments);
  const cols = Math.min(3, Math.max(1, segments.length));
  const rows = Math.ceil(segments.length / cols);
  const gap = 0.25;
  const cardW = (W - 2 * M - gap * (cols - 1)) / cols;
  const cardH = (CONTENT_H - gap * (rows - 1)) / rows;
  segments.forEach((seg, i) => {
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
    slide.addShape("rect", {
      x,
      y,
      w: 0.08,
      h: cardH,
      fill: { color: accent },
      line: { color: accent },
    });
    slide.addText(String(seg.name ?? ""), {
      x: x + 0.25,
      y: y + 0.15,
      w: cardW - 0.4,
      h: 0.4,
      fontFace: "Calibri",
      fontSize: 14,
      bold: true,
      color: accent,
    });
    const blocks: { label: string; v?: string }[] = [
      { label: "PITCH", v: seg.pitch },
      { label: "HOOK", v: seg.hook },
      { label: "CTA", v: seg.cta },
    ];
    const blockH = (cardH - 0.7) / blocks.length;
    blocks.forEach((b, j) => {
      const by = y + 0.6 + j * blockH;
      slide.addText(b.label, {
        x: x + 0.25,
        y: by,
        w: cardW - 0.4,
        h: 0.25,
        fontFace: "Calibri",
        fontSize: 9,
        bold: true,
        color: palette.secondary,
      });
      slide.addText(String(b.v ?? ""), {
        x: x + 0.25,
        y: by + 0.25,
        w: cardW - 0.4,
        h: blockH - 0.3,
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
  const items = asArray<{ name?: string; role?: string; description?: string }>(slidePlan.content?.items);
  const cols = 3;
  const rows = Math.ceil(items.length / cols);
  const gap = 0.25;
  const cardW = (W - 2 * M - gap * (cols - 1)) / cols;
  const cardH = (CONTENT_H - gap * (rows - 1)) / Math.max(1, rows);
  items.forEach((it, i) => {
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
    slide.addText(String(it.name ?? ""), {
      x: x + 0.25,
      y: y + 0.2,
      w: cardW - 0.4,
      h: 0.5,
      fontFace: "Calibri",
      fontSize: 16,
      bold: true,
      color: palette.text,
    });
    slide.addText(String(it.role ?? ""), {
      x: x + 0.25,
      y: y + 0.7,
      w: cardW - 0.4,
      h: 0.3,
      fontFace: "Calibri",
      fontSize: 10,
      bold: true,
      color: accent,
    });
    slide.addText(String(it.description ?? ""), {
      x: x + 0.25,
      y: y + 1.05,
      w: cardW - 0.4,
      h: cardH - 1.2,
      fontFace: "Calibri",
      fontSize: 11,
      color: palette.secondary,
      valign: "top",
    });
  });
}

function renderKpis(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "KPIs", palette);
  const metrics = asArray<{ value?: string | number; label?: string; delta?: string }>(slidePlan.content?.metrics);
  const pipeline = asArray<{ stage?: string; count?: number | string }>(slidePlan.content?.pipeline);
  const cols = Math.max(1, Math.min(4, metrics.length));
  const colW = (W - 2 * M) / cols;
  metrics.forEach((m, i) => {
    const x = M + i * colW;
    slide.addText(String(m.value ?? ""), {
      x,
      y: CONTENT_Y,
      w: colW,
      h: 1.6,
      fontFace: "Calibri",
      fontSize: 60,
      bold: true,
      color: accent,
      align: "center",
    });
    slide.addText(String(m.label ?? ""), {
      x,
      y: CONTENT_Y + 1.6,
      w: colW,
      h: 0.4,
      fontFace: "Calibri",
      fontSize: 12,
      color: palette.secondary,
      align: "center",
    });
    if (m.delta) {
      slide.addText(String(m.delta), {
        x,
        y: CONTENT_Y + 2.0,
        w: colW,
        h: 0.35,
        fontFace: "Calibri",
        fontSize: 11,
        bold: true,
        color: "10B981",
        align: "center",
      });
    }
  });
  if (pipeline.length > 0) {
    const py = CONTENT_Y + 2.7;
    const segW = (W - 2 * M) / pipeline.length;
    pipeline.forEach((p, i) => {
      const x = M + i * segW;
      slide.addShape("rect", {
        x: x + 0.05,
        y: py,
        w: segW - 0.1,
        h: 1.0,
        fill: { color: palette.card },
        line: { color: palette.card },
      });
      slide.addText(`${p.count ?? ""}`, {
        x,
        y: py + 0.1,
        w: segW,
        h: 0.5,
        fontFace: "Calibri",
        fontSize: 22,
        bold: true,
        color: accent,
        align: "center",
      });
      slide.addText(`${p.stage ?? ""}`, {
        x,
        y: py + 0.6,
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
  const stages = asArray<{ name?: string; count?: number | string; note?: string }>(slidePlan.content?.stages);
  const n = Math.max(1, stages.length);
  const total = W - 2 * M;
  const yMid = CONTENT_Y + 2.0;
  for (let i = 0; i < n; i++) {
    const s = stages[i]!;
    const segW = total / n;
    const scale = 1 - i * (0.7 / Math.max(1, n));
    const h = 2.0 * scale;
    const y = yMid - h / 2;
    slide.addShape("rect", {
      x: M + i * segW + 0.1,
      y,
      w: segW - 0.2,
      h,
      fill: { color: accent, transparency: i * 10 },
      line: { color: accent },
    });
    slide.addText(`${s.count ?? ""}`, {
      x: M + i * segW,
      y,
      w: segW,
      h: h * 0.5,
      fontFace: "Calibri",
      fontSize: 24,
      bold: true,
      color: "FFFFFF",
      align: "center",
      valign: "middle",
    });
    slide.addText(String(s.name ?? ""), {
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
    if (s.note) {
      slide.addText(String(s.note), {
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
  }
}

function renderTemplateEmail(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Template email", palette);
  const objet = String(slidePlan.content?.objet ?? "");
  const corps = String(slidePlan.content?.corps ?? "");
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
    w: 2,
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
    y: CONTENT_Y + 1.15,
    w: W - 2 * M - 0.8,
    h: 0,
    line: { color: palette.secondary, width: 1 },
  });
  slide.addText(corps, {
    x: M + 0.4,
    y: CONTENT_Y + 1.3,
    w: W - 2 * M - 0.8,
    h: CONTENT_H - 1.5,
    fontFace: "Consolas",
    fontSize: 12,
    color: palette.text,
    valign: "top",
  });
}

function renderCasClient(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Cas client", palette);
  const c = slidePlan.content ?? {};
  slide.addText(String(c.client ?? ""), {
    x: M,
    y: CONTENT_Y,
    w: W - 2 * M,
    h: 0.6,
    fontFace: "Calibri",
    fontSize: 22,
    bold: true,
    color: accent,
  });
  const blocks: { label: string; v: string }[] = [
    { label: "Problème", v: String(c.probleme ?? "") },
    { label: "Solution", v: String(c.solution ?? "") },
    { label: "Résultat", v: String(c.resultat ?? "") },
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
      fontSize: i === 2 ? 18 : 13,
      bold: i === 2,
      color: palette.text,
      valign: "top",
    });
  });
}

function renderTraction(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Traction", palette);
  const metrics = asArray<{ value?: string | number; label?: string; delta?: string }>(slidePlan.content?.metrics);
  const cols = Math.max(1, Math.min(4, metrics.length));
  const colW = (W - 2 * M) / cols;
  metrics.forEach((m, i) => {
    const x = M + i * colW;
    slide.addText(String(m.value ?? ""), {
      x,
      y: CONTENT_Y + 0.4,
      w: colW,
      h: 1.8,
      fontFace: "Calibri",
      fontSize: 60,
      bold: true,
      color: accent,
      align: "center",
    });
    slide.addText(String(m.label ?? ""), {
      x,
      y: CONTENT_Y + 2.3,
      w: colW,
      h: 0.4,
      fontFace: "Calibri",
      fontSize: 13,
      color: palette.text,
      align: "center",
    });
    if (m.delta) {
      slide.addText(String(m.delta), {
        x,
        y: CONTENT_Y + 2.8,
        w: colW,
        h: 0.4,
        fontFace: "Calibri",
        fontSize: 13,
        bold: true,
        color: "10B981",
        align: "center",
      });
    }
  });
}

function renderBusinessModel(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Business model", palette);
  const tiers = asArray<{ name?: string; price?: string; features?: string[] }>(slidePlan.content?.tiers);
  const cols = Math.max(1, tiers.length);
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
    slide.addText(String(t.name ?? ""), {
      x: x + 0.3,
      y: CONTENT_Y + 0.25,
      w: cardW - 0.6,
      h: 0.45,
      fontFace: "Calibri",
      fontSize: 18,
      bold: true,
      color: palette.text,
    });
    slide.addText(String(t.price ?? ""), {
      x: x + 0.3,
      y: CONTENT_Y + 0.8,
      w: cardW - 0.6,
      h: 0.7,
      fontFace: "Calibri",
      fontSize: 28,
      bold: true,
      color: accent,
    });
    const feats = (t.features ?? []).map((f) => ({
      text: String(f),
      options: { bullet: { code: "2713" } },
    }));
    slide.addText(feats, {
      x: x + 0.3,
      y: CONTENT_Y + 1.6,
      w: cardW - 0.6,
      h: CONTENT_H - 2.0,
      fontFace: "Calibri",
      fontSize: 12,
      color: palette.text,
      paraSpaceAfter: 6,
    });
  });
}

function renderEquipe(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Équipe", palette);
  const members = asArray<{ name?: string; role?: string; bio?: string }>(slidePlan.content?.members);
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
    slide.addText(String(m.name ?? ""), {
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
    slide.addText(String(m.role ?? ""), {
      x: x + 0.2,
      y: y + 1.7,
      w: cardW - 0.4,
      h: 0.3,
      fontFace: "Calibri",
      fontSize: 10,
      color: accent,
      align: "center",
    });
    slide.addText(String(m.bio ?? ""), {
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
  const rows = asArray<{ risque?: string; probabilite?: string; mitigation?: string }>(slidePlan.content?.rows);
  const header: pptxgen.TableRow = [
    { text: "Risque", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
    { text: "Probabilité", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
    { text: "Mitigation", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
  ];
  const body = rows.map((r) => [
    { text: String(r.risque ?? ""), options: { color: palette.text, bold: true } },
    { text: String(r.probabilite ?? ""), options: { color: palette.text } },
    { text: String(r.mitigation ?? ""), options: { color: palette.text } },
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
  const steps = asArray<{ date?: string; label?: string }>(slidePlan.content?.steps);
  const livrables = asStringArray(slidePlan.content?.livrables);
  // Top: timeline
  const lineY = CONTENT_Y + 0.8;
  slide.addShape("line", {
    x: M,
    y: lineY,
    w: W - 2 * M,
    h: 0,
    line: { color: accent, width: 2 },
  });
  const n = Math.max(1, steps.length);
  steps.forEach((s, i) => {
    const cx = M + ((i + 0.5) / n) * (W - 2 * M);
    slide.addShape("ellipse", {
      x: cx - 0.12,
      y: lineY - 0.12,
      w: 0.24,
      h: 0.24,
      fill: { color: accent },
      line: { color: accent },
    });
    slide.addText(String(s.date ?? ""), {
      x: cx - 1.2,
      y: lineY - 0.7,
      w: 2.4,
      h: 0.3,
      fontFace: "Calibri",
      fontSize: 10,
      bold: true,
      color: accent,
      align: "center",
    });
    slide.addText(String(s.label ?? ""), {
      x: cx - 1.2,
      y: lineY + 0.2,
      w: 2.4,
      h: 0.5,
      fontFace: "Calibri",
      fontSize: 12,
      color: palette.text,
      align: "center",
    });
  });
  // Bottom: livrables numbered
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

function renderClosing(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  const headline = String(slidePlan.content?.headline ?? slidePlan.title ?? "");
  const signature = String(slidePlan.content?.signature ?? "");
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: W,
    h: 0.1,
    fill: { color: accent },
    line: { color: accent },
  });
  slide.addText(headline, {
    x: M,
    y: 2.8,
    w: W - 2 * M,
    h: 2.0,
    fontFace: "Calibri",
    fontSize: 48,
    bold: true,
    color: palette.text,
    align: "center",
    valign: "middle",
  });
  if (signature) {
    slide.addText(signature, {
      x: M,
      y: 5.5,
      w: W - 2 * M,
      h: 0.5,
      fontFace: "Calibri",
      fontSize: 14,
      color: palette.secondary,
      align: "center",
    });
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
        return renderCover(slide, plan, palette, accent);
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
        return renderClosing(slide, slidePlan, palette, accent);
      default:
        addTitle(slide, slidePlan.title, palette);
        return genericFallback(slide, slidePlan, palette);
    }
  } catch (err) {
    // Defensive: if a renderer fails on bad shape, fall back to text dump.
    addTitle(slide, slidePlan.title, palette);
    genericFallback(slide, slidePlan, palette);
  }
}

/* ---------- Main entry ---------- */

export async function generatePptx(plan: DeckPlan): Promise<Buffer> {
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

    // page number footer (skip cover/closing)
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
