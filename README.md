# EduTech Bénin — Plateforme de suivi scolaire national

> « Personne ne voit un décrochage venir avant qu'il soit acté.
> Notre plateforme le détecte automatiquement. »

🔗 **En ligne :** [https://education-benin-platform.vercel.app](https://education-benin-platform.vercel.app)

---

## Le problème

Les enseignants et les directeurs n'ont pas d'outil simple pour repérer les élèves en difficulté avant qu'il soit trop tard. Aujourd'hui, l'alerte arrive après le décrochage, pas avant.

## La solution

EduTech Bénin détecte automatiquement les baisses de résultats et les absences excessives. Les alertes remontent en temps réel jusqu'au niveau national, pour que l'établissement et le ministère puissent agir pendant qu'il en est encore temps.

---

## Fonctionnalités

### Espaces et permissions

Quatre espaces, avec des permissions strictes par rôle :

| Rôle | Périmètre | Ce qu'il peut faire |
|---|---|---|
| **Étudiant** | Sa propre fiche | Consulter ses notes, ses moyennes et leur évolution |
| **Enseignant** | Son établissement | Consulter les élèves, saisir notes et absences, importer des notes (CSV), traiter les alertes |
| **Directeur** | Son établissement | Consulter les élèves, saisir notes et absences |
| **Admin / Ministère** | National | Vue complète, gestion des comptes, historique, statistiques, exports |

### Détection automatique du décrochage

Les règles s'appliquent à chaque saisie de note ou d'absence :

| Signal | Condition | Niveau |
|---|---|---|
| Notes | Baisse de la moyenne ≥ 20 % **et** nouvelle moyenne < 10/20 | Élevé |
| Notes | Baisse de la moyenne ≥ 15 % | Moyen |
| Absences | 10 absences injustifiées ou plus | Élevé |
| Absences | 5 absences injustifiées ou plus | Moyen |

### Liste complète

- Page d'accueil publique institutionnelle
- Détection automatique des alertes de décrochage (notes et absences)
- Gestion des absences par période (justifiées / injustifiées)
- Import de notes par fichier CSV, avec rapport d'erreurs
- Recherche d'élève par nom ou prénom
- Mini-dashboard enseignant : statistiques de son établissement
- Dashboard admin : chiffres clés, alertes à examiner, statistiques par établissement (tableau et graphique)
- Export PDF : fiche de suivi d'un élève, rapport des alertes actives groupé par établissement
- Assistant IA en langage naturel (Google Gemini), avec mode de secours sans IA
- Gestion des utilisateurs : création, modification, suppression
- Page profil : modification des informations et changement de mot de passe
- Mot de passe oublié : demande transmise à l'admin, qui réinitialise le compte
- Historique des actions (journal d'audit)
- Notifications SweetAlert2 : toasts et confirmations avant les actions irréversibles
- Accessibilité WCAG AA : contraste élevé, taille de police ajustable, lecture vocale
- Responsive sur tous les appareils (de 375 px à 1440 px)
- Surveillance des erreurs en production avec Sentry
- 21 tests automatisés (logique de détection et route API des notes)
- Armoiries du Bénin intégrées

---

## Stack technique

| Catégorie | Technologie |
|---|---|
| Framework | Next.js 16 (App Router) |
| Langage | TypeScript |
| Base de données | PostgreSQL (Neon) |
| ORM | Prisma 6 |
| Authentification | Auth.js v5 (sessions JWT) |
| Style | Tailwind CSS 4 |
| IA | Google Gemini API |
| Graphiques | Recharts |
| PDF | @react-pdf/renderer |
| Alertes UI | SweetAlert2 |
| Monitoring | Sentry |
| Tests | Vitest |
| Déploiement | Vercel |

---

## Comptes de démonstration

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin / Ministère | `admin@edutech.bj` | `password123` |
| Enseignant | `enseignant@edutech.bj` | `password123` |
| Étudiant | `etudiant@edutech.bj` | `password123` |
| Directeur | À créer depuis `/admin/utilisateurs` | — |

---

## Lancer en local

### Prérequis

- Node.js 20.9 ou plus récent (exigé par Next.js 16)
- Un compte [Neon](https://neon.tech) avec une branche **dev**
- Une clé API Google Gemini
- Un compte Sentry (facultatif en local)

### Installation

```bash
git clone https://github.com/Wildev10/education-benin-platform
cd education-benin-platform
npm install
```

Créez un fichier `.env` à partir de `.env.example` :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | Connexion à la branche **dev** sur Neon (jamais la production) |
| `AUTH_SECRET` | À générer avec `openssl rand -base64 32` |
| `GEMINI_API_KEY` | Depuis [aistudio.google.com](https://aistudio.google.com) |
| `PROTECTED_DB_HOSTS` | Hôte(s) de la base de production, séparés par des virgules (garde-fou) |
| `NEXT_PUBLIC_SENTRY_DSN` | Depuis sentry.io (facultatif en local) |

### Base de données et démarrage

```bash
npx prisma generate
npx prisma db push                 # crée les tables
npx prisma db seed                 # établissements, élèves, notes de démonstration
npx tsx prisma/seed-users.ts       # comptes de démonstration (admin, enseignant, étudiant)
npm run dev
```

L'application est disponible sur [http://localhost:3000](http://localhost:3000).

> ⚠️ **Utilisez toujours une branche Neon « dev », jamais la production.**
> Le garde-fou `prisma/garde-prod.ts` bloque les scripts d'écriture (seed, recalcul des alertes) si `DATABASE_URL` pointe vers un hôte listé dans `PROTECTED_DB_HOSTS`.

---

## Lancer les tests

```bash
npm test          # 21 tests automatisés
npm run build     # vérification TypeScript et build complet
npm run e2e       # tests navigateur (connexions, exports Excel, pagination, finitions visuelles)
```

`npm run e2e` fait le build, lance `next start` sur le port 3100, exécute les scénarios de `e2e/` avec Google Chrome, puis arrête le serveur ; il refuse de démarrer si la base du `.env` figure dans `PROTECTED_DB_HOSTS`. Pour inclure le rôle directeur, copiez `.env.e2e.example` en `.env.e2e.local` (ignoré par git) et renseignez `E2E_DIRECTEUR_EMAIL` et `E2E_DIRECTEUR_MOT_DE_PASSE` avec un compte directeur de la base de dev ; sans eux, ces étapes sont ignorées. Options : `npm run e2e -- pagination` pour un seul scénario, `npm run e2e -- --sans-build` pour réutiliser le build existant.

---

## Choix assumés et limites

- **Règle d'alerte simple et explicable, sans machine learning.** Chaque alerte peut être justifiée devant un directeur ou un inspecteur.
- **Pas de notifications SMS ni email automatiques.** Les alertes s'affichent dans les dashboards.
- **Pas d'inscription libre.** Les comptes sont créés par l'administration, ce qui empêche un utilisateur de s'attribuer un rôle sensible.
- **Assistant IA avec mode de secours.** Le quota gratuit de Gemini est limité. Une fois dépassé, l'assistant répond sans IA, à partir de requêtes structurées.
- **Données de démonstration fictives.** Les noms sont générés avec Faker, aucune donnée réelle n'est utilisée.
- **Mot de passe oublié géré manuellement par l'admin.** Aucun serveur email n'est configuré : l'admin génère un mot de passe temporaire et le communique à l'utilisateur.

---

## Architecture de sécurité

- **Permissions vérifiées à deux niveaux.** Le proxy redirige selon le rôle, et chaque route API contrôle elle-même les droits. Cette seconde vérification est la vraie protection côté serveur.
- **Cloisonnement par établissement.** L'enseignant et le directeur n'accèdent qu'aux élèves de leur établissement : listes, fiches, exports PDF.
- **L'étudiant ne voit que ses propres données.**
- **Garde-fou de production.** Les scripts d'écriture refusent de s'exécuter sur une base protégée.
- **Limitation des tentatives de connexion.** Après 5 échecs en 10 minutes, l'adresse IP est bloquée 15 minutes. Le compteur est conservé en mémoire, par instance de serveur.
- **Mots de passe hachés avec bcrypt.** Les mots de passe temporaires sont générés avec un générateur aléatoire cryptographique.
- **Mot de passe oublié sans fuite d'information.** La réponse est identique, que le compte existe ou non.
- **Journal d'audit.** Les actions sensibles sont historisées : notes, absences, alertes, comptes, mots de passe.
