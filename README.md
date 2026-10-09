# EduTech Bénin

> **Personne ne voit un décrochage venir avant qu'il soit acté. Notre plateforme le détecte automatiquement.**

EduTech Bénin est une plateforme de suivi scolaire pensée pour aider les établissements à agir plus tôt, avec des informations lisibles par les personnes qui accompagnent réellement l'élève.

## Le problème

Les enseignants et les établissements disposent rarement d'un outil simple pour repérer une baisse de résultats avant qu'elle ne devienne un décrochage scolaire acté. Une note isolée ne suffit pas toujours à alerter, mais l'évolution des moyennes sur plusieurs périodes — combinée au suivi des absences — peut révéler un signal important bien en amont.

## La solution

La plateforme relie les informations scolaires, les notes, les absences et les alertes autour de quatre espaces avec des permissions strictes par rôle :

- **Étudiant** : consulte sa fiche personnelle, ses notes par période et l'évolution de ses moyennes, dans un langage simple et sans jargon.
- **Enseignant** : limité à son établissement — consulte les étudiants, saisit les notes et les absences, voit les alertes déclenchées.
- **Directeur** : limité à son établissement, mêmes droits qu'un enseignant.
- **Admin / Ministère** : vue nationale complète — indicateurs agrégés, alertes actives, gestion de tous les comptes utilisateurs.

À chaque saisie, la plateforme applique deux règles de détection :

**Alerte sur les notes :**
- Risque élevé : baisse ≥ 20 % et moyenne après la baisse < 10/20.
- Risque moyen : baisse ≥ 15 %.

**Alerte sur les absences :**
- Risque élevé : 10 absences injustifiées ou plus.
- Risque moyen : 5 absences injustifiées ou plus.

Ces règles sont délibérément simples et explicables : on peut justifier chaque alerte devant un établissement ou un ministère.

## Fonctionnalités clés

- Détection automatique d'alerte de décrochage (notes ET absences)
- 4 espaces avec permissions strictes par rôle (étudiant, enseignant, directeur, admin)
- Enseignant et directeur limités à leur établissement — aucune visibilité inter-établissements
- Gestion des absences avec seuils d'alerte (5 injustifiées → risque moyen, 10 → risque élevé)
- Import de notes par fichier CSV avec rapport d'erreurs
- Assistant IA en langage naturel (Gemini API) avec mode de secours sans IA en cas de dépassement de quota
- Gestion complète des comptes utilisateurs depuis l'interface admin (création, modification, suppression)
- Page profil pour chaque utilisateur : modification du nom/prénom et changement de mot de passe sécurisé
- Accessibilité intégrée : contraste élevé, taille de police ajustable (3 niveaux), lecture vocale, langage simplifié
- Notifications SweetAlert2 (toasts en bas à droite + dialogues de confirmation avant actions destructives)
- Surveillance des erreurs en production avec Sentry
- 21 tests automatiques sur la logique de détection d'alertes
- Déployé et testable en ligne

## Plateforme en ligne

[Ouvrir EduTech Bénin](https://education-benin-platform.vercel.app)

## Stack technique

| Couche | Technologie |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) + TypeScript |
| Base de données | Prisma + PostgreSQL (Neon) |
| Authentification | Auth.js v5 (JWT, sessions 7 jours, rate limiting) |
| Style | Tailwind CSS v4 (tokens CSS `@theme`) |
| IA | Gemini API (mode de secours intégré) |
| Graphiques | Recharts (chargement lazy) |
| Notifications | SweetAlert2 v11 |
| Monitoring | Sentry |
| Tests | Vitest (21 tests) |
| Déploiement | Vercel |

## Comptes de démonstration

| Rôle | Email | Mot de passe |
| --- | --- | --- |
| Admin / Ministère | `admin@edutech.bj` | `password123` |
| Enseignant | `enseignant@edutech.bj` | `password123` |
| Étudiant | `etudiant@edutech.bj` | `password123` |
| Directeur | Créer depuis `/admin/utilisateurs` | — |

## Lancer le projet en local

### Prérequis

- Node.js 20 ou plus récent
- Une base PostgreSQL accessible

### Installation

```bash
git clone <url-du-depot>
cd education-benin-platform
npm install
```

Copiez `.env.example` en `.env` et remplissez les quatre variables nécessaires :

```env
DATABASE_URL=          # Chaîne de connexion PostgreSQL (branche dev Neon)
AUTH_SECRET=           # Secret Auth.js (générer avec : openssl rand -base64 32)
GEMINI_API_KEY=        # Clé API Google Gemini
NEXT_PUBLIC_SENTRY_DSN= # DSN Sentry (optionnel en local)
```

> **Important — deux bases distinctes :** utilisez toujours une branche Neon **"dev"** en local, jamais la base **"production"** utilisée par Vercel. La variable `PROTECTED_DB_HOSTS` liste les hôtes protégés ; tout script d'écriture est automatiquement bloqué si `DATABASE_URL` pointe vers l'un d'eux.

Initialisez la base puis lancez l'application :

```bash
npx prisma generate
npx prisma db push
npm run dev
```

Ouvrez ensuite [http://localhost:3000](http://localhost:3000).

## Lancer les tests

```bash
npm test
```

21 tests automatiques couvrent la logique de détection d'alertes (seuils notes et absences, cas limites, combinaisons de périodes).

## Choix assumés et limites

- **Pas de vrai ML** : une règle simple et explicable a été privilégiée — elle est défendable à l'oral et compréhensible par un directeur d'établissement.
- **Pas de notifications SMS ou email réelles** : les alertes apparaissent dans les dashboards Admin, Enseignant et Directeur.
- **Pas d'inscription libre** : les comptes sont créés par l'administration (modèle réaliste pour une plateforme institutionnelle), évitant qu'un utilisateur s'auto-attribue un rôle sensible.
- **Assistant IA avec mode de secours** : si le quota Gemini gratuit est dépassé, l'assistant bascule automatiquement sur une réponse structurée sans IA.
- **Données de démonstration fictives** : les noms des étudiants sont générés — aucune donnée réelle n'est utilisée.
