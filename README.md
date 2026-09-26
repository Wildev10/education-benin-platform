# EduTech Bénin

> **Personne ne voit un décrochage venir avant qu'il soit acté. Notre plateforme le détecte automatiquement.**

EduTech Bénin est une plateforme de suivi scolaire pensée pour aider les établissements à agir plus tôt, avec des informations lisibles par les personnes qui accompagnent réellement l'élève.

## Le problème

Les enseignants et les établissements disposent rarement d'un outil simple pour repérer une baisse de résultats avant qu'elle ne devienne un décrochage scolaire acté. Une note isolée ne suffit pas toujours à alerter, mais l'évolution des moyennes sur plusieurs périodes peut révéler un signal important.

## La solution

La plateforme relie les informations scolaires, les notes et les alertes autour de trois espaces :

- **Étudiant** : consulte sa fiche, ses notes par période et l'évolution de ses moyennes, dans un langage simple et sans jargon d'alerte.
- **Enseignant** : consulte les étudiants, filtre par établissement ou niveau, saisit les notes et voit immédiatement si une alerte est déclenchée.
- **Admin / Ministère** : suit les indicateurs nationaux, les alertes actives et leur niveau de risque, puis marque les alertes traitées.

À chaque saisie de note, la plateforme compare la moyenne de la période avec la période précédente :

- **Risque élevé** : baisse supérieure ou égale à 20 % et moyenne après la baisse inférieure à 10/20.
- **Risque moyen** : baisse supérieure ou égale à 15 %.

Cette règle a été choisie délibérément : elle est simple, explicable et défendable devant un établissement ou un ministère. Le projet ne prétend pas faire une prédiction opaque : une règle claire permet de comprendre pourquoi une alerte apparaît et d'agir dessus.

## Fonctionnalités clés

- Détection automatique d'alerte de décrochage à la saisie d'une note.
- Trois espaces avec des permissions strictes selon le rôle.
- Assistant IA en langage naturel pour interroger les étudiants et les alertes.
- Accessibilité intégrée : contraste élevé, taille de police ajustable, lecture vocale et langage simplifié.
- Interface déployée et testable en ligne.

## Plateforme en ligne

[Ouvrir EduTech Bénin](https://education-benin-platform.vercel.app)

## Stack technique

- Next.js 16 avec App Router et TypeScript
- Prisma et PostgreSQL (Neon)
- Auth.js v5
- Tailwind CSS
- Gemini API
- Recharts
- Déploiement Vercel

## Comptes de démonstration

| Espace | Identifiant | Mot de passe |
| --- | --- | --- |
| Admin / Ministère | `admin@edutech.bj` | `password123` |
| Enseignant | `enseignant@edutech.bj` | `password123` |
| Étudiant | `etudiant@edutech.bj` | `password123` |

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

Créez un fichier `.env` à la racine avec ces trois variables :

```dotenv
DATABASE_URL="<url-de-connexion-postgresql>"
AUTH_SECRET="<secret-authjs>"
GEMINI_API_KEY="<cle-api-gemini>"
```

Initialisez la base puis lancez l'application :

```bash
npx prisma generate
npx prisma db push
npm run dev
```

Ouvrez ensuite [http://localhost:3000](http://localhost:3000).

## Choix assumés et limites

- **Pas de vrai ML ou de prédiction** : une règle simple et explicable a été privilégiée, car elle suffit pour démontrer le signal et reste plus défendable à l'oral.
- **Pas de notifications SMS ou email réelles** : l'alerte apparaît dans les dashboards Admin et Enseignant.
- **Un seul niveau de permission Admin** : l'Admin voit l'ensemble des établissements et des étudiants ; il n'y a pas encore de granularité fine par établissement.

Ces limites sont volontaires pour garder le prototype centré sur sa promesse : détecter tôt, expliquer clairement et donner aux équipes un point de départ concret pour agir.
