export type EmailStage = "cold" | "followup_7" | "followup_14" | "breakup";

export type EmailParams = {
  diffuseur: string;
  nom: string;
  genre: "M" | "F";
  persona: string;
  langue: "FR" | "NL";
  stage: EmailStage;
  webContext?: string;
};

const stageBriefFR: Record<EmailStage, string> = {
  cold: "Premier contact. Pain → Impact → Claim → Trigger. Court, direct, ancré dans leur réalité broadcast.",
  followup_7: "Relance J+7. Nouvel angle (un chiffre ou une référence concrète). Pas de 'je me permets de relancer'. 60-90 mots.",
  followup_14: "Relance J+14. Angle 'value' : un insight sectoriel court (réglementation ou coût) + remise du CTA. 60-90 mots.",
  breakup: "Email de rupture. Ton respectueux, ferme. Une seule phrase pour fermer la boucle + porte ouverte. 40-70 mots.",
};

const stageBriefNL: Record<EmailStage, string> = {
  cold: "Eerste contact. Pain → Impact → Claim → Trigger. Kort, direct, verankerd in hun broadcast-realiteit.",
  followup_7: "Opvolging dag 7. Nieuwe invalshoek (een cijfer of concrete referentie). Geen 'ik kom hierop terug'. 60-90 woorden.",
  followup_14: "Opvolging dag 14. 'Value' invalshoek : korte sectorinzicht (regelgeving of kost) + herhaling van de CTA. 60-90 woorden.",
  breakup: "Afsluitende mail. Respectvolle, vaste toon. Eén zin om de lus te sluiten + open deur. 40-70 woorden.",
};

export function buildEmailUserPrompt(p: EmailParams): string {
  const civilite =
    p.langue === "FR"
      ? p.genre === "F"
        ? "Bonjour Madame " + p.nom + ","
        : "Bonjour Monsieur " + p.nom + ","
      : p.genre === "F"
      ? "Geachte mevrouw " + p.nom + ","
      : "Geachte heer " + p.nom + ",";

  const brief = (p.langue === "NL" ? stageBriefNL : stageBriefFR)[p.stage];

  return `Génère un email de prospection DataRouter.

PARAMÈTRES
- Diffuseur : ${p.diffuseur}
- Destinataire : ${p.nom} (${p.genre === "F" ? "Madame" : "Monsieur"})
- Persona / fonction : ${p.persona}
- Langue de rédaction : ${p.langue === "FR" ? "français" : "néerlandais (nederlands)"}
- Étape : ${p.stage}

BRIEF ÉTAPE
${brief}

CONTRAINTES OBLIGATOIRES
- Première ligne EXACTEMENT : "${civilite}"
- Vouvoiement (FR) / "u" (NL)
- 90-140 mots (sauf breakup : 40-70)
- Structure P-I-C-T (Pain → Impact → Claim → Trigger)
- Un seul CTA : "30 minutes de démonstration sur vos propres flux" (FR) / "30 minuten demonstratie op uw eigen streams" (NL)
- Pas de lien, pas de pièce jointe
- Plain text uniquement
- Signature : "Camille — Équipe Broadteam"
- Mots interdits : IA, algorithme, révolutionnaire, innovant
- Objet : 3-6 mots, ancré dans leur réalité

${p.webContext ? "CONTEXTE WEB RÉCENT (à exploiter pour la personnalisation) :\n" + p.webContext + "\n" : ""}
FORMAT DE SORTIE (markdown) :
**Objet :** ...

\`\`\`
${civilite}

[corps de l'email]

Camille — Équipe Broadteam
\`\`\`

Puis une ligne :
*Mots :* [nombre] | *Étape :* ${p.stage} | *Langue :* ${p.langue}`;
}

export function buildSequenceUserPrompts(
  base: Omit<EmailParams, "stage" | "webContext">,
  webContext?: string,
): { stage: EmailStage; prompt: string }[] {
  const stages: EmailStage[] = ["cold", "followup_7", "followup_14", "breakup"];
  return stages.map((stage) => ({
    stage,
    prompt: buildEmailUserPrompt({ ...base, stage, webContext }),
  }));
}
