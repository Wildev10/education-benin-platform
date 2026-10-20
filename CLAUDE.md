@AGENTS.md

# EduTech Bénin — consignes pour Claude Code

Plateforme de suivi scolaire pour le Ministère de l'Éducation du Bénin : notes, absences, alertes de décrochage, quatre espaces (admin, directeur, enseignant, étudiant).
Stack : Next.js 16 (App Router), Prisma 7 (driver adapter `pg`), PostgreSQL Neon, Auth.js v5, Tailwind 4, Node 24, déployé sur Vercel.
Le détail (fonctionnalités, installation, comptes de démo, options de `npm run e2e`) est dans le README : s'y reporter plutôt que de le recopier ici.

## Sécurité : règles absolues

- Ne jamais afficher un mot de passe, une clé ou une chaîne de connexion complète : masquer avec `***` (n'afficher au plus que l'hôte d'une base de dev).
- Ne jamais écrire de secret dans un fichier suivi par git. Avant chaque commit, relire `git diff --cached` : aucun `.env*` (sauf les `.example`), cookie ou jeton.
- Ne jamais lancer de script ni de commande Prisma (`db push`, `migrate`, `db seed`, `tsx prisma/…`) sur la base de production.
- Avant toute commande sur une base, vérifier que l'hôte de `DATABASE_URL` ne figure pas dans `PROTECTED_DB_HOSTS`. Les scripts d'écriture passent par `verifierBaseNonProtegee()` de `prisma/garde-prod.ts`, qui bloque aussi si `PROTECTED_DB_HOSTS` est vide ou absente. Attention : les commandes Prisma CLI n'y passent pas : la vérification manuelle reste obligatoire. Ne jamais utiliser `--autoriser-prod`.
- Une mise à jour du schéma en production est faite par le développeur lui-même, jamais par Claude.

## Périmètre des données

- Toute route qui reçoit l'identifiant d'un élève ou d'un établissement (ou d'une note, absence, alerte) vérifie l'accès avec `src/lib/perimetre.ts` (`peutAccederEtudiant`, `peutAccederEtablissement`, `filtreEtudiantsAccessibles`).
- Hors périmètre, répondre 404 avec `introuvable()` (pages : `notFound()`), exactement comme pour une ressource inexistante, sans jamais révéler qu'elle existe.
- Le périmètre s'applique dans la requête, avant la pagination et les exports (PDF, Excel) : un total ou un fichier ne compte que ce que l'utilisateur peut voir.
- Seules exceptions : les routes réservées à l'admin par `requireRole(["admin"])` (`api/admin/…`).

## Façon de travailler

- Répondre en français simple.
- Avant tout commit : `npm test`, `npx tsc --noEmit`, `npm run lint` (0 erreur, 0 avertissement ; un `eslint-disable` seulement local et avec un commentaire qui explique pourquoi, jamais de règle désactivée dans la configuration), `npm run build`.
- Tout changement visible : `npm run e2e` et vérification à 375 px et à 1280 px.
- Données de test créées dans la base de dev : les supprimer à la fin. Serveurs lancés (`next dev`, `next start`) : les arrêter à la fin.
- `git add`, `git commit` et `git push` : trois commandes séparées, jamais enchaînées avec `&&`, lancées depuis la racine du projet (sans `cd …` ni `git -C`). Lancer `node` sans variable d'environnement en préfixe (pas de `VAR=… node`). Ainsi elles correspondent aux autorisations de `.claude/settings.local.json` (fichier local, non suivi) et ne demandent pas de permission.
- Après un push sur main, vérifier que le déploiement Vercel réussit (statut du commit : `gh api repos/Wildev10/education-benin-platform/commits/<sha>/status`).
- Dépendances : version exacte, sans `^` ni `~`, pour toute dépendance ajoutée ou mise à jour. Jamais de `npm audit fix --force`.
- Next 16 diffère des versions connues : lire le guide concerné dans `node_modules/next/dist/docs/` avant d'écrire du code (voir AGENTS.md).
- Prisma 7 : importer `PrismaClient` et le type `Prisma` depuis `@/generated/prisma/client` (jamais `@prisma/client`) ; utiliser le client de `src/lib/prisma.ts`. Après `npx prisma db push` sur la base de dev, lancer `npx prisma generate` : `db push` ne régénère plus le client.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement (port 3000) |
| `npm test` | tests unitaires (Vitest) |
| `npm run e2e` | build, `next start` sur le port 3100, scénarios navigateur de `e2e/` ; refuse une base protégée |
| `npm run build` | build de production et vérification TypeScript |

## Fichiers clés

- `src/auth.ts` : Auth.js (connexion, session JWT, rôle et établissement de l'utilisateur)
- `src/lib/prisma.ts` : client Prisma unique (adaptateur `pg`, délai de connexion 15 s, 2 s par adresse IP au lieu des 250 ms de Node, une nouvelle tentative pour les lectures seulement, sur erreur de connexion)
- `src/proxy.ts` : redirections selon le rôle (première barrière, pas la seule)
- `src/lib/perimetre.ts` : règles d'accès aux élèves et établissements
- `src/lib/detection-alerte.ts` : règles de détection du décrochage (notes, absences)
- `prisma/garde-prod.ts` : garde-fou contre l'écriture sur la base de production
- `public/sw.js` (et `public/sw-strategie.js`) : service worker de la PWA, consultation hors ligne
- `e2e/commun.mjs` : outils des tests navigateur, dont leur propre garde de base
