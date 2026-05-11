export function buildProspectPrompt(diffuseur: string, webContext: string): string {
  return `Génère une FICHE PROSPECT complète pour le diffuseur : **${diffuseur}**.

Tu DOIS respecter EXACTEMENT le format FICHE PROSPECT défini dans le system prompt.

CONTEXTE WEB RÉCENT
${webContext}

CONSIGNES
- Calcule chaque sous-score /2 selon la grille (Volume, Réglementation, Maturité, Décideur, Timing) et justifie en 1 phrase concrète.
- Score total = somme des 5 sous-scores (/10). Priorité : 8-10=🔴 / 5-7=🟡 / <5=🟢.
- Marché : déduis-le (Belgique FR / Belgique FL / Pays-Bas / France).
- Si une info manque, mets "à confirmer" — n'invente JAMAIS un email ou un nom non sourcé.
- Angle email : objet 3-6 mots + accroche 1 phrase ancrée dans leur réalité.
- Next step : action concrète + date (J+1, J+3...).

Sors uniquement la fiche, en markdown propre, rien d'autre.`;
}

export function buildScorePrompt(diffuseur: string, webContext: string): string {
  return `Score détaillé /10 pour **${diffuseur}**.

CONTEXTE WEB
${webContext}

FORMAT DE SORTIE :
**${diffuseur}** — Score : **[X/10]** — Priorité : [🔴/🟡/🟢]

| Critère | Note | Justification |
|---|---|---|
| Volume broadcasts live/sem | X/2 | ... |
| Exposition réglementaire | X/2 | ... |
| Maturité tech/budget | X/2 | ... |
| Décideur identifié | X/2 | ... |
| Signal timing | X/2 | ... |

**Recommandation :** [1-2 phrases : que faire maintenant]`;
}

export function buildResearchPrompt(query: string, webContext: string): string {
  return `Recherche structurée sur : **${query}**.

CONTEXTE WEB
${webContext}

FORMAT DE SORTIE (markdown) :
## ${query}

**TL;DR** — 2 phrases.

### Profil
- Type : (chaîne nationale / régionale / groupe / régulateur...)
- Pays / marché :
- Site officiel :

### Pertinence DataRouter
- Volume live estimé :
- Exposition sous-titrage live :
- Maturité tech :

### Signaux récents
- [signal 1 + source]
- [signal 2 + source]

### Décideurs probables
- Fonction → Nom (si trouvé) → source

### Actions recommandées
- 1.
- 2.

Cite les sources en [n] référant aux résultats numérotés.`;
}

export function buildVeillePrompt(marche: string, webContext: string): string {
  return `Veille réglementaire broadcast — marché : **${marche}**.

CONTEXTE WEB
${webContext}

FORMAT (markdown) :
## Veille ${marche} — ${new Date().toISOString().slice(0, 10)}

### 🏛️ Régulateur & cadre
- Autorité : (CSA / VRM / Mediakabel / ARCOM...)
- Texte clé en vigueur :

### 📅 Échéances & obligations sous-titrage live
- [obligation + date + sanction si applicable]

### 📰 Actualité récente (3 derniers mois)
- [titre + source + impact prospection]

### 🎯 Implications outreach DataRouter
- Diffuseurs prioritaires à activer :
- Angle email à privilégier :`;
}
