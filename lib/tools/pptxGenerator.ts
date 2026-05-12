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
  // Bottom anchor strip at y=96%
  slide.addShape("rect", {
    x: 0,
    y: H * 0.96,
    w: W,
    h: H * 0.04,
    fill: { color: accent },
    line: { color: accent },
  });

  slide.addText(txt(plan.title, "Présentation"), {
    x: M,
    y: H * 0.13,
    w: W - 2 * M,
    h: 1.6,
    fontFace: "Calibri",
    fontSize: 40,
    bold: true,
    color: palette.text,
    align: "center",
    valign: "middle",
  });

  const subtitle = txt(slidePlan.content?.subtitle) || txt(plan.subtitle);
  if (subtitle) {
    const twoLines = subtitle.length > 60;
    slide.addText(subtitle, {
      x: M,
      y: H * 0.28,
      w: W - 2 * M,
      h: twoLines ? 1.2 : 0.7,
      fontFace: "Calibri",
      fontSize: 16,
      color: palette.secondary,
      align: "center",
      valign: "top",
    });
  }

  // Stats row — up to 5 columns
  const stats = arr<{ value?: unknown; label?: unknown }>(slidePlan.content?.stats);
  if (stats.length > 0) {
    const n = Math.min(stats.length, 5);
    const colW = (W - 2 * M) / n;
    const sy = H * 0.50;
    for (let i = 0; i < n; i++) {
      const s = stats[i]!;
      const x = M + i * colW;
      slide.addText(txt(s.value), {
        x,
        y: sy,
        w: colW,
        h: 1.4,
        fontFace: "Calibri",
        fontSize: n >= 5 ? 42 : 48,
        bold: true,
        color: palette.text,
        align: "center",
        valign: "middle",
      });
      slide.addText(txt(s.label), {
        x,
        y: sy + 1.45,
        w: colW,
        h: 0.5,
        fontFace: "Calibri",
        fontSize: 12,
        color: palette.secondary,
        align: "center",
      });
    }
  }

  const author = txt(plan.author);
  if (author) {
    slide.addText(author, {
      x: M,
      y: H * 0.86,
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
  if (sections.length === 0) return;

  const startY = H * 0.26;
  const endY = H - M - 0.2;
  const availH = endY - startY;
  const rowH = availH / sections.length;

  sections.forEach((s, i) => {
    const y = startY + i * rowH;
    const numText = txt(s.number) || String(i + 1).padStart(2, "0");

    slide.addText(numText, {
      x: M,
      y,
      w: 1.0,
      h: rowH,
      fontFace: "Calibri",
      fontSize: 20,
      bold: true,
      color: accent,
      valign: "middle",
    });
    slide.addText(txt(s.title), {
      x: M + 1.1,
      y,
      w: 5.4,
      h: rowH,
      fontFace: "Calibri",
      fontSize: 16,
      bold: true,
      color: palette.text,
      valign: "middle",
    });
    const desc = txt(s.description);
    if (desc) {
      slide.addText(desc, {
        x: M + 6.6,
        y,
        w: W - M - (M + 6.6),
        h: rowH,
        fontFace: "Calibri",
        fontSize: 12,
        color: palette.secondary,
        italic: true,
        valign: "middle",
      });
    }
  });
}

function renderContexte(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Contexte", palette);

  // Prefer new shape: content.blocks = [{title, facts: [string]}]
  const rawBlocks = arr<{ title?: unknown; facts?: unknown }>(slidePlan.content?.blocks);
  let blocks: { title: string; facts: string[] }[] = rawBlocks.map((b) => ({
    title: txt(b.title, "—"),
    facts: strArr(b.facts),
  }));

  if (blocks.length === 0) {
    const market = (slidePlan.content?.market ?? {}) as any;
    const product = (slidePlan.content?.product ?? slidePlan.content?.produit ?? {}) as any;
    blocks = [
      {
        title: txt(market.title, "Marché"),
        facts: strArr(market.facts ?? slidePlan.content?.marche),
      },
      {
        title: txt(product.title, "Produit"),
        facts: strArr(product.facts ?? slidePlan.content?.produit),
      },
    ];
  }

  const n = Math.max(1, Math.min(3, blocks.length));
  const colGap = 0.3;
  const colW = (W - 2 * M - colGap * (n - 1)) / n;

  blocks.slice(0, n).forEach((b, i) => {
    const x = M + i * (colW + colGap);
    slide.addShape("rect", {
      x,
      y: CONTENT_Y,
      w: colW,
      h: CONTENT_H,
      fill: { color: palette.card },
      line: { color: palette.card },
    });
    slide.addText(b.title, {
      x: x + 0.3,
      y: CONTENT_Y + 0.25,
      w: colW - 0.6,
      h: 0.5,
      fontFace: "Calibri",
      fontSize: 15,
      bold: true,
      color: accent,
    });
    if (b.facts.length > 0) {
      slide.addText(
        b.facts.map((f) => `—  ${f}`).join("\n"),
        {
          x: x + 0.3,
          y: CONTENT_Y + 0.9,
          w: colW - 0.6,
          h: CONTENT_H - 1.1,
          fontFace: "Calibri",
          fontSize: 12,
          color: palette.text,
          valign: "top",
          paraSpaceAfter: 6,
        },
      );
    }
  });
}

function renderObjectifs(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Objectifs", palette);
  const raw = arr<{ number?: unknown; label?: unknown; sublabel?: unknown; detail?: unknown }>(
    slidePlan.content?.items,
  ).slice(0, 4);
  // Always 4 cards — pad with empty placeholders
  const items: { number: string; label: string; sublabel: string }[] = [];
  for (let i = 0; i < 4; i++) {
    const it = raw[i];
    items.push({
      number: txt(it?.number) || String(i + 1).padStart(2, "0"),
      label: txt(it?.label),
      sublabel: txt(it?.sublabel) || txt(it?.detail),
    });
  }

  const cols = 2;
  const rows = 2;
  const gap = 0.3;
  const cardW = (W - 2 * M - gap * (cols - 1)) / cols;
  const cardH = (CONTENT_H - gap * (rows - 1)) / rows;

  items.forEach((it, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = M + c * (cardW + gap);
    const y = CONTENT_Y + r * (cardH + gap);

    slide.addShape("roundRect", {
      x,
      y,
      w: cardW,
      h: cardH,
      fill: { color: accent, transparency: 80 },
      line: { color: accent, width: 1 },
      rectRadius: 0.15,
    });
    slide.addText(it.number, {
      x: x + 0.3,
      y: y + 0.25,
      w: 1.8,
      h: 0.9,
      fontFace: "Calibri",
      fontSize: 36,
      bold: true,
      color: accent,
    });
    if (it.label) {
      slide.addText(it.label, {
        x: x + 0.3,
        y: y + 1.2,
        w: cardW - 0.6,
        h: 0.6,
        fontFace: "Calibri",
        fontSize: 15,
        bold: true,
        color: palette.text,
      });
    }
    if (it.sublabel) {
      slide.addText(it.sublabel, {
        x: x + 0.3,
        y: y + 1.85,
        w: cardW - 0.6,
        h: cardH - 2.0,
        fontFace: "Calibri",
        fontSize: 11,
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
    comment?: unknown;
  }>(slidePlan.content?.segments);
  const topProspects = arr<{ name?: unknown; stand?: unknown; justification?: unknown }>(
    slidePlan.content?.topProspects,
  );

  // Funnel (top section)
  const fy = CONTENT_Y;
  const fh = 1.4;
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

  let cursorY = fy + fh + 0.3;

  // Segments table
  if (segments.length > 0) {
    const headerCells: pptxgen.TableRow = [
      { text: "Segment", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
      { text: "Volume", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
      { text: "Canal", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
      { text: "Commentaire", options: { bold: true, color: "FFFFFF", fill: { color: accent } } },
    ];
    const body = segments.map((s, i) => {
      const alt = i % 2 === 0 ? palette.card : palette.bg;
      const commentValue = txt(s.comment) || txt(s.priority);
      return [
        { text: txt(s.name), options: { color: palette.text, bold: true, fill: { color: alt } } },
        { text: txt(s.volume), options: { color: palette.text, fill: { color: alt } } },
        { text: txt(s.channel), options: { color: palette.text, fill: { color: alt } } },
        { text: commentValue, options: { color: palette.text, fill: { color: alt } } },
      ];
    });
    slide.addTable([headerCells, ...body], {
      x: M,
      y: cursorY,
      w: W - 2 * M,
      fontFace: "Calibri",
      fontSize: 11,
      border: { type: "solid", color: palette.card, pt: 1 },
    });
    cursorY += 0.45 + segments.length * 0.35;
  }

  // TOP PROSPECTS (2 cols)
  if (topProspects.length > 0 && cursorY < H - M - 0.8) {
    slide.addText("TOP PROSPECTS", {
      x: M,
      y: cursorY,
      w: W - 2 * M,
      h: 0.35,
      fontFace: "Calibri",
      fontSize: 11,
      bold: true,
      color: accent,
    });
    const listY = cursorY + 0.4;
    const colW = (W - 2 * M - 0.3) / 2;
    const rowsAvail = H - M - listY;
    const perCol = Math.ceil(topProspects.length / 2);
    const rowH = Math.min(0.55, rowsAvail / Math.max(1, perCol));
    topProspects.forEach((p, i) => {
      const col = Math.floor(i / perCol);
      const row = i % perCol;
      const x = M + col * (colW + 0.3);
      const y = listY + row * rowH;
      slide.addText(
        [
          { text: txt(p.name), options: { bold: true, color: palette.text } },
          {
            text: txt(p.stand) ? `  ${txt(p.stand)}` : "",
            options: { color: accent, bold: true },
          },
          {
            text: txt(p.justification) ? `  · ${txt(p.justification)}` : "",
            options: { color: palette.secondary, italic: true },
          },
        ],
        {
          x,
          y,
          w: colW,
          h: rowH,
          fontFace: "Calibri",
          fontSize: 11,
          valign: "middle",
        },
      );
    });
  }
}

function threatColor(threat: string): string {
  const norm = threat
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
  if (norm.includes("ELEVE")) return RED_KO;
  if (norm.includes("MOYEN")) return "F59E0B";
  if (norm.includes("FAIBLE")) return GREEN_OK;
  return "64748B";
}

function renderConcurrentiel(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Positionnement", palette);
  const competitors = arr<{ name?: unknown; threat?: unknown; description?: unknown; scores?: unknown }>(
    slidePlan.content?.competitors,
  );
  const criteria = strArr(slidePlan.content?.criteria);
  const differentiator = txt(slidePlan.content?.differentiator);

  // New shape : list with threat levels
  const hasThreatShape = competitors.some(
    (c) => typeof c.threat === "string" || typeof c.description === "string",
  );

  let usedH = 0;

  if (hasThreatShape) {
    const startY = CONTENT_Y;
    const rowH = Math.min(0.7, (CONTENT_H - 1.2) / Math.max(1, competitors.length));
    competitors.forEach((c, i) => {
      const y = startY + i * rowH;
      slide.addShape("rect", {
        x: M,
        y,
        w: W - 2 * M,
        h: rowH - 0.08,
        fill: { color: palette.card },
        line: { color: palette.card },
      });
      slide.addText(txt(c.name), {
        x: M + 0.25,
        y,
        w: 3.0,
        h: rowH - 0.08,
        fontFace: "Calibri",
        fontSize: 13,
        bold: true,
        color: palette.text,
        valign: "middle",
      });
      const threat = txt(c.threat);
      slide.addText(threat.toUpperCase(), {
        x: M + 3.3,
        y,
        w: 1.6,
        h: rowH - 0.08,
        fontFace: "Calibri",
        fontSize: 11,
        bold: true,
        color: threatColor(threat),
        valign: "middle",
      });
      slide.addText(txt(c.description), {
        x: M + 5.0,
        y,
        w: W - 2 * M - 5.0 - 0.2,
        h: rowH - 0.08,
        fontFace: "Calibri",
        fontSize: 11,
        color: palette.secondary,
        valign: "middle",
      });
    });
    usedH = competitors.length * rowH + 0.2;
  } else if (criteria.length > 0 && competitors.length > 0) {
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
            options: { color: v ? GREEN_OK : RED_KO, bold: true, align: "center" },
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
    usedH = (criteria.length + 1) * 0.35 + 0.2;
  }

  // "DataRouter :" differentiator band at bottom
  if (differentiator) {
    const bandH = 1.0;
    const bandY = H - M - bandH;
    slide.addShape("rect", {
      x: M,
      y: bandY,
      w: W - 2 * M,
      h: bandH,
      fill: { color: accent, transparency: 85 },
      line: { color: accent, width: 2 },
    });
    slide.addText("DataRouter :", {
      x: M + 0.3,
      y: bandY + 0.1,
      w: 2.5,
      h: 0.35,
      fontFace: "Calibri",
      fontSize: 12,
      bold: true,
      color: accent,
    });
    slide.addText(differentiator, {
      x: M + 0.3,
      y: bandY + 0.45,
      w: W - 2 * M - 0.6,
      h: bandH - 0.5,
      fontFace: "Calibri",
      fontSize: 13,
      bold: true,
      italic: true,
      color: accent,
      valign: "top",
    });
  }
}

function renderTimeline(slide: pptxgen.Slide, slidePlan: SlidePlan, palette: Palette, accent: string) {
  addTitle(slide, slidePlan.title || "Timeline", palette);

  // New shape: periods as vertical columns with action bullets
  const periods = arr<{ label?: unknown; actions?: unknown }>(slidePlan.content?.periods);

  if (periods.length > 0) {
    const cols = Math.min(periods.length, 4);
    const gap = 0.25;
    const colW = (W - 2 * M - gap * (cols - 1)) / cols;
    for (let i = 0; i < cols; i++) {
      const p = periods[i]!;
      const x = M + i * (colW + gap);
      // Card
      slide.addShape("rect", {
        x,
        y: CONTENT_Y,
        w: colW,
        h: CONTENT_H,
        fill: { color: palette.card },
        line: { color: palette.card },
      });
      // Header bar accent
      slide.addShape("rect", {
        x,
        y: CONTENT_Y,
        w: colW,
        h: 0.5,
        fill: { color: accent },
        line: { color: accent },
      });
      slide.addText(txt(p.label), {
        x: x + 0.15,
        y: CONTENT_Y,
        w: colW - 0.3,
        h: 0.5,
        fontFace: "Calibri",
        fontSize: 13,
        bold: true,
        color: "FFFFFF",
        valign: "middle",
      });
      const actions = strArr(p.actions);
      if (actions.length > 0) {
        slide.addText(
          actions.map((a) => ({ text: a, options: { bullet: { code: "25CF" } } })),
          {
            x: x + 0.2,
            y: CONTENT_Y + 0.7,
            w: colW - 0.4,
            h: CONTENT_H - 0.9,
            fontFace: "Calibri",
            fontSize: 11,
            color: palette.text,
            paraSpaceAfter: 5,
            valign: "top",
          },
        );
      }
    }
    return;
  }

  // Fallback : horizontal events timeline
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
  const headerH = 0.5;

  segments.forEach((s, i) => {
    const y = CONTENT_Y + i * (cardH + gap);

    // Card body
    slide.addShape("rect", {
      x: M,
      y: y + headerH,
      w: W - 2 * M,
      h: cardH - headerH,
      fill: { color: palette.card },
      line: { color: palette.card },
    });
    // Header banner — accent 20% opacity
    slide.addShape("rect", {
      x: M,
      y,
      w: W - 2 * M,
      h: headerH,
      fill: { color: accent, transparency: 80 },
      line: { color: accent, transparency: 80 },
    });
    slide.addText(txt(s.name), {
      x: M + 0.25,
      y,
      w: W - 2 * M - 0.5,
      h: headerH,
      fontFace: "Calibri",
      fontSize: 16,
      bold: true,
      color: palette.text,
      valign: "middle",
    });

    // Rows : PITCH / HOOK / CTA
    type Row = { label: string; v: string; italic?: boolean; ctaStyle?: boolean };
    const rows: Row[] = [
      { label: "PITCH", v: txt(s.pitch) },
      { label: "HOOK", v: txt(s.hook), italic: true },
      { label: "CTA", v: txt(s.cta), ctaStyle: true },
    ];
    const bodyTop = y + headerH + 0.1;
    const rowH = (cardH - headerH - 0.15) / rows.length;
    rows.forEach((r, ri) => {
      const ry = bodyTop + ri * rowH;
      slide.addText(r.label, {
        x: M + 0.25,
        y: ry,
        w: 1.0,
        h: rowH,
        fontFace: "Calibri",
        fontSize: 10,
        bold: true,
        color: palette.secondary,
        valign: "top",
      });
      slide.addText(r.v, {
        x: M + 1.3,
        y: ry,
        w: W - M - (M + 1.3) - 0.2,
        h: rowH,
        fontFace: "Calibri",
        fontSize: 13,
        color: r.ctaStyle ? accent : palette.text,
        bold: !!r.ctaStyle,
        italic: !!r.italic,
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
  const trackingTools = strArr(slidePlan.content?.trackingTools);

  // Top half : up to 5 metrics
  if (metrics.length > 0) {
    const n = Math.max(1, Math.min(5, metrics.length));
    const colW = (W - 2 * M) / n;
    const metricsTop = CONTENT_Y;
    const metricsH = (CONTENT_H - 0.4) / 2;
    metrics.slice(0, n).forEach((m, i) => {
      const x = M + i * colW;
      slide.addText(txt(m.value), {
        x,
        y: metricsTop,
        w: colW,
        h: metricsH * 0.6,
        fontFace: "Calibri",
        fontSize: n >= 5 ? 44 : 52,
        bold: true,
        color: accent,
        align: "center",
        valign: "middle",
      });
      slide.addText(txt(m.label), {
        x,
        y: metricsTop + metricsH * 0.62,
        w: colW,
        h: metricsH * 0.2,
        fontFace: "Calibri",
        fontSize: 12,
        color: palette.secondary,
        align: "center",
      });
      const delta = txt(m.delta);
      if (delta) {
        slide.addText(delta, {
          x,
          y: metricsTop + metricsH * 0.82,
          w: colW,
          h: metricsH * 0.18,
          fontFace: "Calibri",
          fontSize: 11,
          bold: true,
          color: GREEN_OK,
          align: "center",
        });
      }
    });
  }

  // Bottom half : pipeline stages with right-arrow connectors
  if (stages.length > 0) {
    const py = CONTENT_Y + (CONTENT_H - 0.4) / 2 + 0.2;
    const ph = (CONTENT_H - 0.4) / 2 - 0.4;
    const arrowW = 0.35;
    const total = W - 2 * M;
    const stageW = (total - arrowW * (stages.length - 1)) / stages.length;
    stages.forEach((s, i) => {
      const x = M + i * (stageW + arrowW);
      slide.addShape("rect", {
        x,
        y: py,
        w: stageW,
        h: ph,
        fill: { color: accent, transparency: 85 },
        line: { color: accent, width: 1 },
      });
      slide.addText(txt(s.count), {
        x,
        y: py + 0.1,
        w: stageW,
        h: ph * 0.55,
        fontFace: "Calibri",
        fontSize: 22,
        bold: true,
        color: accent,
        align: "center",
        valign: "middle",
      });
      slide.addText(txt(s.name), {
        x,
        y: py + ph * 0.6,
        w: stageW,
        h: ph * 0.35,
        fontFace: "Calibri",
        fontSize: 11,
        bold: true,
        color: palette.text,
        align: "center",
      });
      if (i < stages.length - 1) {
        slide.addShape("rightArrow", {
          x: x + stageW + 0.02,
          y: py + ph / 2 - 0.18,
          w: arrowW - 0.04,
          h: 0.36,
          fill: { color: accent },
          line: { color: accent },
        });
      }
    });
  }

  // Footer : tracking tools inline
  if (trackingTools.length > 0) {
    slide.addText(`OUTILS DE TRACKING — ${trackingTools.join(" — ")}`, {
      x: M,
      y: H - 0.8,
      w: W - 2 * M,
      h: 0.35,
      fontFace: "Calibri",
      fontSize: 10,
      bold: true,
      color: palette.secondary,
      align: "center",
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
  const livrablesRaw = arr<unknown>(slidePlan.content?.livrables);

  // Top timeline (alternating above/below labels)
  const lineY = CONTENT_Y + 0.95;
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
      const above = i % 2 === 0;
      slide.addText(txt(s.date), {
        x: cx - 1.3,
        y: above ? lineY - 0.75 : lineY + 0.55,
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
        y: above ? lineY - 0.4 : lineY + 0.2,
        w: 2.6,
        h: 0.4,
        fontFace: "Calibri",
        fontSize: 11,
        color: palette.text,
        align: "center",
      });
    });
  }

  // Livrables — 2 cols, max 6, supports string[] or {title, description}[]
  type Liv = { title: string; description: string };
  const livrables: Liv[] = livrablesRaw.slice(0, 6).map((l) => {
    if (typeof l === "string") return { title: l, description: "" };
    if (l && typeof l === "object") {
      const obj = l as any;
      return { title: txt(obj.title) || txt(obj.label), description: txt(obj.description) };
    }
    return { title: "", description: "" };
  });

  if (livrables.length > 0) {
    const livY = lineY + 1.5;
    slide.addText("LIVRABLES", {
      x: M,
      y: livY,
      w: W - 2 * M,
      h: 0.35,
      fontFace: "Calibri",
      fontSize: 11,
      bold: true,
      color: accent,
    });
    const listTop = livY + 0.4;
    const colGap = 0.4;
    const colW = (W - 2 * M - colGap) / 2;
    const perCol = Math.ceil(livrables.length / 2);
    const rowsAvail = H - M - listTop;
    const rowH = Math.min(0.85, rowsAvail / Math.max(1, perCol));
    livrables.forEach((l, i) => {
      const col = Math.floor(i / perCol);
      const row = i % perCol;
      const x = M + col * (colW + colGap);
      const y = listTop + row * rowH;
      slide.addText(String(i + 1).padStart(2, "0"), {
        x,
        y,
        w: 0.55,
        h: rowH,
        fontFace: "Calibri",
        fontSize: 14,
        bold: true,
        color: accent,
        valign: "top",
      });
      slide.addText(l.title, {
        x: x + 0.65,
        y,
        w: colW - 0.65,
        h: rowH * 0.45,
        fontFace: "Calibri",
        fontSize: 12,
        bold: true,
        color: palette.text,
        valign: "top",
      });
      if (l.description) {
        slide.addText(l.description, {
          x: x + 0.65,
          y: y + rowH * 0.45,
          w: colW - 0.65,
          h: rowH * 0.55,
          fontFace: "Calibri",
          fontSize: 11,
          color: palette.secondary,
          valign: "top",
        });
      }
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
