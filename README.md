# DataRouter Sales Agent

Agent sales IA pour **Broadteam / DataRouter** — interface chat Next.js, recherche web DuckDuckGo, génération via Groq (Llama 3.3 70B), pipeline CRM en `localStorage`.

## Ce que fait l'outil

Une fenêtre de chat (gauche) + un pipeline CRM live (droite). Tu tapes une commande, l'agent répond en streaming markdown.

Commandes :

| Commande | Action |
|---|---|
| `prospect [diffuseur]` | Recherche web + fiche prospect complète + score /10 |
| `email [diffuseur] [Nom] [M\|F] [persona] [FR\|NL] [cold\|followup_7\|followup_14\|breakup]` | Email de prospection P-I-C-T |
| `séquence [diffuseur] [Nom] [M\|F] [persona] [FR\|NL]` | Les 4 emails (cold + J+7 + J+14 + J+21/breakup) |
| `recherche [diffuseur ou marché]` | Recherche web + résumé structuré |
| `veille [marché]` | Actualité réglementaire broadcast (CSA, VRM, Mediakabel, ARCOM) |
| `score [diffuseur]` | Scoring détaillé /10 |
| `crm` | Affiche le pipeline |
| `crm update "Diffuseur" "Statut" "Next step"` | Met à jour le pipeline (statuts : Cold, Contacté, En discussion, Deal, Perdu) |

Astuce : quote les arguments multi-mots avec des guillemets.

## Setup local

```bash
git clone <ton-repo>
cd datarouter-agent
npm install
cp .env.local.example .env.local
# édite .env.local et colle ta clé Groq
npm run dev
```

Puis ouvre http://localhost:3000.

## Clé Groq (gratuite)

1. Crée un compte sur https://console.groq.com
2. Va dans **API Keys** → **Create API Key**
3. Copie la clé (commence par `gsk_...`)
4. Colle-la dans `.env.local` :
   ```
   GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

Modèle utilisé : `llama-3.3-70b-versatile` (rapide, gratuit dans les quotas Groq).

## Déploiement Vercel

1. Push le repo sur GitHub.
2. Va sur https://vercel.com → **Add New** → **Project** → importe le repo.
3. Framework auto-détecté : Next.js. Laisse les paramètres par défaut.
4. Dans **Environment Variables**, ajoute :
   - `GROQ_API_KEY` = `gsk_...`
5. Clique **Deploy**.
6. Une fois déployé, Vercel te donne une URL `https://datarouter-agent-xxx.vercel.app`.

Note : le CRM est stocké dans le `localStorage` du navigateur — chaque utilisateur a son propre pipeline, pas de base partagée.

## Exemples de commandes

```
prospect RTBF
prospect "RTL Belgium"
score VRT
recherche "obligations sous-titrage direct Belgique"
veille VRM
veille ARCOM
email RTBF Dupont M "Directeur des opérations" FR cold
email NPO Janssen M CTO NL cold
email "DPG Media" Peeters F "Head of Broadcast Tech" NL followup_7
séquence BX1 Lefevre F "Directrice de l'antenne" FR
crm
crm update RTBF Contacté "Relance J+7 vendredi"
crm update NPO "En discussion" "Démo planifiée le 12/06"
```

## Stack

- **Next.js 14** (App Router, edge-friendly)
- **Tailwind CSS** — thème sombre, accent violet `#7c3aed`
- **Groq API** — `llama-3.3-70b-versatile`, streaming
- **DuckDuckGo HTML** — recherche web sans clé API
- **react-markdown + remark-gfm** — rendu des réponses agent
- **localStorage** — pipeline CRM côté client

## Arbo

```
datarouter-agent/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── chat/route.ts
│       └── search/route.ts
├── lib/
│   ├── agent.ts
│   ├── prompts/system.ts
│   └── tools/
│       ├── researcher.ts
│       ├── emailWriter.ts
│       ├── prospector.ts
│       └── crm.ts
└── components/
    ├── ChatWindow.tsx
    ├── MessageBubble.tsx
    ├── CommandInput.tsx
    └── CrmPanel.tsx
```
