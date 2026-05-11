import { researchMulti, formatResultsForContext } from "./tools/researcher";
import {
  buildProspectPrompt,
  buildScorePrompt,
  buildResearchPrompt,
  buildVeillePrompt,
} from "./tools/prospector";
import {
  buildEmailUserPrompt,
  buildSequenceUserPrompts,
  EmailStage,
} from "./tools/emailWriter";
import { SYSTEM_PROMPT } from "./prompts/system";

export type ParsedCommand =
  | { kind: "prospect"; diffuseur: string }
  | { kind: "email"; diffuseur: string; nom: string; genre: "M" | "F"; persona: string; langue: "FR" | "NL"; stage: EmailStage }
  | { kind: "sequence"; diffuseur: string; nom: string; genre: "M" | "F"; persona: string; langue: "FR" | "NL" }
  | { kind: "research"; query: string }
  | { kind: "veille"; marche: string }
  | { kind: "score"; diffuseur: string }
  | { kind: "crm" }
  | { kind: "crm_update"; diffuseur: string; statut: string; nextStep: string }
  | { kind: "free"; text: string }
  | { kind: "error"; message: string };

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function tokenize(input: string): string[] {
  const out: string[] = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) out.push(m[1] ?? m[2]);
  return out;
}

export function parseCommand(raw: string): ParsedCommand {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "error", message: "Commande vide." };

  const first = stripAccents(trimmed.split(/\s+/)[0]!.toLowerCase());
  const tokens = tokenize(trimmed);

  // crm update [diffuseur] [statut] [next step]
  if (first === "crm" && tokens[1]?.toLowerCase() === "update") {
    if (tokens.length < 5) {
      return {
        kind: "error",
        message:
          'Usage : `crm update "Diffuseur" "Statut" "Next step"` — statuts : Cold, Contacté, En discussion, Deal, Perdu.',
      };
    }
    const diffuseur = tokens[2]!;
    const statut = tokens[3]!;
    const nextStep = tokens.slice(4).join(" ");
    return { kind: "crm_update", diffuseur, statut, nextStep };
  }

  if (first === "crm") return { kind: "crm" };

  if (first === "prospect") {
    const diffuseur = tokens.slice(1).join(" ");
    if (!diffuseur) return { kind: "error", message: "Usage : `prospect [diffuseur]`" };
    return { kind: "prospect", diffuseur };
  }

  if (first === "score") {
    const diffuseur = tokens.slice(1).join(" ");
    if (!diffuseur) return { kind: "error", message: "Usage : `score [diffuseur]`" };
    return { kind: "score", diffuseur };
  }

  if (first === "recherche" || first === "research") {
    const q = tokens.slice(1).join(" ");
    if (!q) return { kind: "error", message: "Usage : `recherche [diffuseur ou marché]`" };
    return { kind: "research", query: q };
  }

  if (first === "veille") {
    const m = tokens.slice(1).join(" ");
    if (!m) return { kind: "error", message: "Usage : `veille [marché]` (CSA, VRM, Mediakabel, ARCOM...)" };
    return { kind: "veille", marche: m };
  }

  if (first === "email") {
    // email [diffuseur] [Nom] [M/F] [persona] [FR/NL] [stage]
    if (tokens.length < 7) {
      return {
        kind: "error",
        message:
          'Usage : `email [diffuseur] [Nom] [M|F] [persona] [FR|NL] [cold|followup_7|followup_14|breakup]`',
      };
    }
    const [, diffuseur, nom, genreRaw, persona, langueRaw, stageRaw] = tokens;
    const genre = (genreRaw!.toUpperCase() === "F" ? "F" : "M") as "M" | "F";
    const langue = (langueRaw!.toUpperCase() === "NL" ? "NL" : "FR") as "FR" | "NL";
    const stage = stageRaw as EmailStage;
    if (!["cold", "followup_7", "followup_14", "breakup"].includes(stage)) {
      return {
        kind: "error",
        message: "Étape invalide. Valeurs : cold, followup_7, followup_14, breakup.",
      };
    }
    return { kind: "email", diffuseur: diffuseur!, nom: nom!, genre, persona: persona!, langue, stage };
  }

  if (first === "sequence" || first === "séquence") {
    if (tokens.length < 6) {
      return {
        kind: "error",
        message: "Usage : `séquence [diffuseur] [Nom] [M|F] [persona] [FR|NL]`",
      };
    }
    const [, diffuseur, nom, genreRaw, persona, langueRaw] = tokens;
    const genre = (genreRaw!.toUpperCase() === "F" ? "F" : "M") as "M" | "F";
    const langue = (langueRaw!.toUpperCase() === "NL" ? "NL" : "FR") as "FR" | "NL";
    return { kind: "sequence", diffuseur: diffuseur!, nom: nom!, genre, persona: persona!, langue };
  }

  return { kind: "free", text: trimmed };
}

/**
 * Prepare a Groq-ready { system, user } pair for any command that needs the LLM.
 * Performs web research when relevant.
 */
export async function buildLlmRequest(cmd: ParsedCommand): Promise<{
  system: string;
  user: string;
} | null> {
  if (cmd.kind === "crm" || cmd.kind === "crm_update" || cmd.kind === "error") return null;

  if (cmd.kind === "prospect") {
    const results = await researchMulti(
      [
        `${cmd.diffuseur} chaîne TV diffuseur`,
        `${cmd.diffuseur} sous-titrage direct accessibilité`,
        `${cmd.diffuseur} CTO directeur technique broadcast`,
      ],
      4,
    );
    return {
      system: SYSTEM_PROMPT,
      user: buildProspectPrompt(cmd.diffuseur, formatResultsForContext(results)),
    };
  }

  if (cmd.kind === "score") {
    const results = await researchMulti(
      [
        `${cmd.diffuseur} programmation live volume`,
        `${cmd.diffuseur} obligation sous-titrage régulateur`,
        `${cmd.diffuseur} directeur technologique broadcast`,
      ],
      3,
    );
    return {
      system: SYSTEM_PROMPT,
      user: buildScorePrompt(cmd.diffuseur, formatResultsForContext(results)),
    };
  }

  if (cmd.kind === "research") {
    const results = await researchMulti(
      [
        cmd.query,
        `${cmd.query} broadcast TV`,
        `${cmd.query} sous-titrage accessibilité réglementation`,
      ],
      4,
    );
    return {
      system: SYSTEM_PROMPT,
      user: buildResearchPrompt(cmd.query, formatResultsForContext(results)),
    };
  }

  if (cmd.kind === "veille") {
    const results = await researchMulti(
      [
        `${cmd.marche} sous-titrage direct obligation broadcast`,
        `${cmd.marche} accessibilité TV régulateur ${new Date().getFullYear()}`,
        `${cmd.marche} CSA VRM Mediakabel ARCOM décision`,
      ],
      4,
    );
    return {
      system: SYSTEM_PROMPT,
      user: buildVeillePrompt(cmd.marche, formatResultsForContext(results)),
    };
  }

  if (cmd.kind === "email") {
    const results = await researchMulti(
      [
        `${cmd.diffuseur} actualité ${new Date().getFullYear()}`,
        `${cmd.diffuseur} sous-titrage direct`,
      ],
      3,
    );
    return {
      system: SYSTEM_PROMPT,
      user: buildEmailUserPrompt({
        diffuseur: cmd.diffuseur,
        nom: cmd.nom,
        genre: cmd.genre,
        persona: cmd.persona,
        langue: cmd.langue,
        stage: cmd.stage,
        webContext: formatResultsForContext(results),
      }),
    };
  }

  if (cmd.kind === "sequence") {
    const results = await researchMulti(
      [
        `${cmd.diffuseur} actualité ${new Date().getFullYear()}`,
        `${cmd.diffuseur} sous-titrage accessibilité`,
      ],
      3,
    );
    const ctx = formatResultsForContext(results);
    const prompts = buildSequenceUserPrompts(
      {
        diffuseur: cmd.diffuseur,
        nom: cmd.nom,
        genre: cmd.genre,
        persona: cmd.persona,
        langue: cmd.langue,
      },
      ctx,
    );
    const joined = prompts
      .map(
        (p, i) =>
          `### Email ${i + 1} — étape : ${p.stage}\n\n${p.prompt}\n\n---`,
      )
      .join("\n\n");
    return {
      system: SYSTEM_PROMPT,
      user: `Génère LES 4 EMAILS d'une séquence de prospection pour ${cmd.diffuseur} / ${cmd.nom}.

Pour chaque email, respecte STRICTEMENT son brief individuel ci-dessous. Sépare clairement chaque email par un titre markdown \`## Email N — [stage]\`.

${joined}`,
    };
  }

  return null;
}
