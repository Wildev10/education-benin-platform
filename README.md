# EduTech Bénin

**République du Bénin — Plateforme nationale de suivi scolaire**

> « Personne ne voit un décrochage venir avant qu'il soit acté.
> Notre plateforme le détecte automatiquement. »

🔗 **En ligne :** [education-benin-platform.vercel.app](https://education-benin-platform.vercel.app) — version anglaise : [/en](https://education-benin-platform.vercel.app/en)

Projet sélectionné dans le cadre du challenge du Ministère de la Transformation Digitale et de l’Innovation. EduTech Bénin est un projet indépendant : ce n'est pas un service officiel d'un ministère.

---

## En bref

**Le problème.** Les enseignants et les directeurs n'ont pas d'outil simple pour repérer les élèves en difficulté à temps. Aujourd'hui, l'alerte arrive après le décrochage, pas avant.

**La solution.** EduTech Bénin détecte automatiquement les baisses de résultats et les absences répétées, dès la saisie d'une note ou d'une absence. Les alertes remontent en temps réel jusqu'au niveau national, pour que les établissements et le pilotage national puissent agir pendant qu'il en est encore temps.

---

## Ce que fait la plateforme

### Détection automatique du décrochage

Les règles s'appliquent à chaque saisie de note ou d'absence. Elles sont simples et explicables : chaque alerte peut être justifiée devant un directeur ou un inspecteur.

| Signal | Condition | Niveau |
|---|---|---|
| Notes | Baisse de la moyenne ≥ 20 % **et** nouvelle moyenne < 10/20 | Élevé |
| Notes | Baisse de la moyenne ≥ 15 % | Moyen |
| Absences | 10 absences injustifiées ou plus | Élevé |
| Absences | 5 absences injustifiées ou plus | Moyen |

Une alerte active qui passe de Moyen à Élevé est mise à jour, sans créer de doublon.

### Notifications en temps réel

Une cloche, dans l'en-tête de l'admin et du directeur, signale les alertes **créées** ou **aggravées** (« Aggravée : Moyen → Élevé ») dans les 5 dernières minutes. Elle se met à jour toutes les 30 secondes et distingue les notifications lues des non lues : une aggravation redevient non lue, même si la création avait déjà été vue. Le directeur ne voit que son établissement.

### Tableaux de bord

- **Tableau de bord national** (admin) : chiffres clés, alertes à examiner, statistiques par établissement (tableau et graphique).
- **Tableau de bord de l'établissement** (directeur) : élèves, moyenne générale, alertes actives, absences injustifiées du mois, taux d'élèves en alerte, évolution de la moyenne par trimestre, moyenne par classe, élèves les plus à risque et dernières absences injustifiées.
- **Espace enseignant** : statistiques de son établissement et liste de ses élèves.

### Suivi des élèves

- **Fiche élève** : informations, notes par trimestre en accordéon (moyenne visible même replié, trimestre le plus récent ouvert), absences par période, historique des alertes, et graphique d'évolution de la moyenne dans l'espace admin.
- **Page Alertes** avec filtres avancés : recherche par nom, niveau de risque, type (notes ou absences), statut, établissement, dates de création.
- **Page Absences** : toutes les absences, filtrables par période, motif, année scolaire et établissement.
- **Listes paginées côté serveur** (20, 50 ou 100 par page), avec filtres et taille conservés dans l'adresse.
- Saisie des notes et des absences, import de notes par fichier CSV avec rapport d'erreurs.

### Exports

- **PDF** : fiche de suivi d'un élève, rapport des alertes actives groupé par établissement.
- **Excel** : fiche élève (4 feuilles), alertes (en respectant les filtres), liste des élèves d'un établissement.

Chaque export ne contient que ce que l'utilisateur a le droit de voir.

### Hors ligne (application installable)

La plateforme s'installe comme une application (PWA). Les pages et les données déjà consultées restent lisibles sans connexion ; un bandeau l'indique, et les actions d'écriture sont désactivées jusqu'au retour du réseau. Les exports et l'authentification ne sont jamais mis en cache, et le cache est vidé quand un autre compte se connecte sur l'appareil.

### Accessibilité et langues

- Contraste élevé, taille du texte ajustable, lecture à voix haute.
- Squelettes de chargement à la forme du contenu, respectant la réduction des animations et le contraste élevé.
- Affichage soigné de 375 px à 1440 px.
- **Accueil et connexion en français et en anglais** (`/en`, `/en/login`) : sélecteur FR/EN mémorisé, voix de lecture anglaise sur les pages anglaises. Après connexion, l'application est en français.
- Page 404 unique, avec retour vers l'espace de l'utilisateur.

### Administration

Gestion des comptes (création, modification, suppression), demandes de mot de passe oublié traitées par l'admin, historique des actions (journal d'audit), assistant en langage naturel (Google Gemini, avec un mode de secours sans IA).

---

## Droits par rôle

| | Étudiant | Enseignant | Directeur | Admin (pilotage national) |
|---|---|---|---|---|
| Périmètre | Sa propre fiche | Son établissement | Son établissement | National |
| Tableau de bord | Ses résultats | Statistiques de l'école | Tableau de bord de l'établissement | Tableau de bord national |
| Fiches et listes d'élèves | Sa fiche | ✓ | ✓ | ✓ |
| Saisir des notes et des absences | — | ✓ | ✓ | — (consultation) |
| Supprimer une absence | — | ✓ | — | — |
| Importer des notes (CSV) | — | ✓ | — | ✓ |
| Pages Alertes et Absences | — | ✓ | ✓ | ✓ |
| Traiter une alerte | — | ✓ | — | ✓ |
| Cloche de notifications | — | — | ✓ | ✓ |
| Exports PDF et Excel | Sa fiche (Excel) | ✓ | ✓ | ✓ |
| Assistant | — | ✓ | ✓ | ✓ |
| Comptes, historique, mots de passe oubliés | — | — | — | ✓ |

Le tableau décrit ce que chaque rôle peut faire dans l'interface ; chaque route de l'API vérifie elle-même ces droits. Les comptes sont créés par l'administration : il n'y a pas d'inscription libre, ce qui empêche un utilisateur de s'attribuer un rôle sensible.

---

## Sécurité et protection des données

- **Droits vérifiés à deux niveaux.** Le proxy redirige selon le rôle, et chaque route de l'API contrôle elle-même les droits : c'est cette seconde vérification qui protège réellement les données.
- **Cloisonnement par établissement.** L'enseignant et le directeur n'accèdent qu'aux élèves de leur établissement. Le périmètre s'applique dans la requête elle-même, avant la pagination et les exports : un total ou un fichier ne compte que ce que l'utilisateur peut voir.
- **Aucune fuite d'existence.** Une fiche hors périmètre répond exactement comme une fiche inexistante (404), sans révéler qu'un élève existe. L'étudiant ne voit que ses propres données.
- **Limitation des tentatives de connexion.** Après 5 échecs en 10 minutes, l'adresse IP est bloquée 15 minutes.
- **Mots de passe hachés avec bcrypt**, mots de passe temporaires tirés au hasard de façon cryptographique, demande de mot de passe oublié sans fuite d'information.
- **Journal d'audit** des actions sensibles : notes, absences, alertes, comptes, mots de passe.
- **Garde-fou de production.** Les scripts d'écriture refusent de s'exécuter sur la base de production, ou si la liste des bases protégées est vide.
- **Dépendances à jour.** Next.js 16.4.2 et Prisma 7.10.1. La migration vers Prisma 7 a supprimé les 3 vulnérabilités de sa chaîne. `npm audit` signale encore 5 alertes, toutes dans les outils de vérification du code (`eslint-config-next`), qui ne font pas partie de l'application déployée.

---

## Qualité

- **443 tests unitaires** (Vitest) : règles de détection, périmètre des routes, notifications, pagination, exports, accessibilité, langues, connexion à la base.
- **207 vérifications navigateur** (6 scénarios de bout en bout, Google Chrome) : connexion et déconnexion des 4 rôles, limitation des tentatives, exports Excel, pagination, page 404, accordéon, squelettes, stabilité de la mise en page, notifications d'aggravation, version anglaise. Toutes à 375 px et à 1280 px.
- **ESLint : 0 erreur, 0 avertissement.** Build TypeScript strict.

---

## Choix assumés et limites

- **Règle d'alerte simple et explicable**, sans apprentissage automatique.
- **Notifications dans l'application uniquement**, sans SMS ni email.
- **Assistant avec mode de secours.** Le quota gratuit de Gemini est limité ; une fois dépassé, l'assistant répond sans IA, à partir de requêtes structurées.
- **Mot de passe oublié traité par l'admin.** Aucun serveur email n'est configuré : l'admin génère un mot de passe temporaire et le communique.
- **Données de démonstration fictives**, générées avec Faker.
- **Limitation des tentatives par instance de serveur** : le compteur est gardé en mémoire.
- **Site non référencé par les moteurs de recherche** (`noindex`) pendant la démonstration ; les balises `hreflang` et Open Graph sont prêtes.

---

## Comptes de démonstration

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin (pilotage national) | `admin@edutech.bj` | `password123` |
| Enseignant | `enseignant@edutech.bj` | `password123` |
| Étudiant | `etudiant@edutech.bj` | `password123` |
| Directeur | À créer depuis `/admin/utilisateurs` | — |

---

## Partie technique

### Stack

| Catégorie | Technologie |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Langage | TypeScript (ESM) |
| Base de données | PostgreSQL (Neon) |
| ORM | Prisma 7, driver adapter `pg` |
| Authentification | Auth.js v5 (sessions JWT de 7 jours) |
| Style | Tailwind CSS 4 |
| Graphiques | Recharts |
| Exports | @react-pdf/renderer (PDF), ExcelJS (Excel) |
| IA | Google Gemini API |
| Interface | SweetAlert2 |
| Monitoring | Sentry |
| Tests | Vitest (unitaires), Playwright (navigateur) |
| Déploiement | Vercel, Node.js 24 |

### Base de données et connexions

- **Prisma 7.** Le client est généré dans `src/generated/prisma` et importé depuis `@/generated/prisma/client`. Il se connecte via `src/lib/prisma.ts`, avec le driver `pg` et le pooler Neon.
- **Connexions fiabilisées** :
  - délai de connexion de 15 s, comme le recommande Neon pour le réveil d'une base en veille ;
  - 2 s par adresse IP au lieu des 250 ms de Node, utile sur un réseau lent ;
  - une nouvelle tentative pour les **lectures** uniquement, en cas d'erreur de connexion. Une écriture n'est jamais rejouée, pour ne pas risquer de doublon.
- **Évolution de schéma d'octobre 2026.** Colonne `Alerte.niveauModifieLe` (date de la dernière aggravation, nullable), ajoutée de façon purement additive : l'ancien code reste compatible.

### Lancer en local

**Prérequis** : Node.js 24, un compte [Neon](https://neon.tech) avec une branche **dev**, une clé API Google Gemini, un compte Sentry (facultatif en local).

```bash
git clone https://github.com/Wildev10/education-benin-platform
cd education-benin-platform
npm install
```

Créez un fichier `.env` à partir de `.env.example` :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | Connexion à la branche **dev** sur Neon (jamais la production). `sslmode=verify-full` est conseillé : `pg` traite déjà `require` comme `verify-full`, mais `require` deviendra moins strict avec `pg` v9 |
| `AUTH_SECRET` | À générer avec `openssl rand -base64 32` |
| `GEMINI_API_KEY` | Depuis [aistudio.google.com](https://aistudio.google.com) |
| `PROTECTED_DB_HOSTS` | Hôte(s) de la base de production, séparés par des virgules (garde-fou) |
| `NEXT_PUBLIC_SENTRY_DSN` | Depuis sentry.io (facultatif en local) |

```bash
npx prisma generate                # client dans src/generated/prisma (aussi lancé par npm install)
npx prisma db push                 # crée les tables (ne régénère plus le client depuis Prisma 7)
npx prisma db seed                 # établissements, élèves, notes de démonstration
npx tsx prisma/seed-users.ts       # comptes de démonstration (admin, enseignant, étudiant)
npm run dev
```

L'application est disponible sur [http://localhost:3000](http://localhost:3000).

> ⚠️ **Utilisez toujours une branche Neon « dev », jamais la production.**
> Le garde-fou `prisma/garde-prod.ts` bloque les scripts d'écriture (seed, recalcul des alertes) si `DATABASE_URL` pointe vers un hôte listé dans `PROTECTED_DB_HOSTS`, ou si cette variable est vide. Les commandes Prisma (`db push`…) n'y passent pas : vérifiez l'hôte vous-même avant de les lancer.

### Lancer les tests

```bash
npm test          # 443 tests unitaires
npm run lint      # ESLint : 0 erreur, 0 avertissement attendus
npm run build     # vérification TypeScript et build complet
npm run e2e       # tests navigateur : connexions, excel, pagination, finitions, notifications, langues
```

`npm run e2e` fait le build, lance `next start` sur le port 3100, exécute les scénarios de `e2e/` avec Google Chrome, puis arrête le serveur. Il refuse de démarrer si la base du `.env` figure dans `PROTECTED_DB_HOSTS`.

- Le scénario `notifications` crée dans la base de dev un élève de test (nommé `E2E-Aggravation`), ses notes et son alerte, puis les supprime à la fin, même en cas d'échec.
- Pour inclure le rôle directeur, copiez `.env.e2e.example` en `.env.e2e.local` (ignoré par git) et renseignez `E2E_DIRECTEUR_EMAIL` et `E2E_DIRECTEUR_MOT_DE_PASSE` avec un compte directeur de la base de dev ; sans eux, ces étapes sont ignorées.
- Options : `npm run e2e -- pagination` pour un seul scénario, `npm run e2e -- --sans-build` pour réutiliser le build existant.
