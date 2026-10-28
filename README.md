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

Les règles s'appliquent à chaque saisie de note ou d'absence, et à l'import CSV (une fois par élève, après toutes ses lignes). Elles sont simples et explicables : chaque alerte peut être justifiée devant un directeur ou un inspecteur.

| Signal | Condition | Niveau |
|---|---|---|
| Notes | Baisse de la moyenne ≥ 20 % **et** nouvelle moyenne < 10/20 | Élevé |
| Notes | Baisse de la moyenne ≥ 15 % | Moyen |
| Absences | 10 absences injustifiées ou plus | Élevé |
| Absences | 5 absences injustifiées ou plus | Moyen |

- Les notes comparent la moyenne des **deux dernières périodes** de l'élève (trimestres, dans l'ordre des années scolaires), dès que la plus récente compte **au moins 2 notes**. Sans période précédente (nouvel élève), la fiche l'indique : « Pas encore de période de comparaison » ; les absences restent suivies.
- Les absences comptent les absences injustifiées de la période la plus récente.
- La saisie propose le trimestre et l'année scolaire du jour, au Bénin (année à partir de septembre ; trimestres septembre-décembre, janvier-mars, avril-août).
- Une alerte par élève, type (notes ou absences) et période. Si elle passe de Moyen à Élevé, elle est mise à jour, sans doublon, et rouverte (Nouvelle) si elle avait été résolue ; l'historique du suivi le note.
- Après chaque saisie, l'enseignant voit soit « Alerte déclenchée : niveau Élevé pour [élève] » (ou « Alerte aggravée : Moyen → Élevé »), soit « Note enregistrée » / « Absence enregistrée », sans alerte. Le rapport d'import liste les alertes déclenchées.

### Suivi des alertes

- **Trois statuts** : Nouvelle (aucune action), En cours de suivi, Résolue.
- **Une action et un commentaire à chaque étape** : entretien avec l'élève, parents convoqués, soutien scolaire ou autre action, avec un commentaire obligatoire (10 à 1 000 caractères). La résolution et la réouverture demandent aussi un commentaire.
- **Historique sur la fiche élève** : pour chaque étape, l'action, la personne, la date et l'heure (heure du Bénin), le commentaire et le changement de statut. Les étapes écrites par la détection (aggravation, réouverture automatique) sont signées « Système ».
- **Réouverture** d'une alerte résolue, à la main ou automatiquement si elle s'aggrave.
- **Suggestion de clôture**, jamais automatique : quand la moyenne du trimestre le plus récent ne déclencherait plus l'alerte par rapport à la moyenne de référence, ou quand un nouveau trimestre compte moins de 5 absences injustifiées.
- **Qui fait quoi** : l'enseignant et le directeur suivent les alertes des élèves de leur établissement ; l'administration consulte l'historique et pilote (alertes nouvelles, en cours de suivi, résolues dans l'année, délai moyen avant la première action) ; l'élève ne voit ni ses alertes, ni leur statut, ni les commentaires.
- Les listes d'alertes montrent le statut et la dernière action, et mènent au suivi sur la fiche. Les exports Excel et PDF reprennent le statut ; l'Excel des alertes, la dernière action.

### Notifications en temps réel

Une cloche, dans l'en-tête de l'admin, du directeur et de l'enseignant, liste les alertes actives **créées** ou **aggravées** (« Aggravée : Moyen → Élevé ») depuis 30 jours au plus. Les non lues sont celles arrivées depuis la dernière ouverture de la cloche, date enregistrée sur le serveur pour chaque utilisateur : ce qui est lu sur un appareil l'est sur les autres. Une aggravation redevient non lue, même si la création avait déjà été vue. Elle se met à jour toutes les 60 secondes tant que l'onglet est visible, et dès le retour sur l'onglet. Le directeur et l'enseignant ne voient que leur établissement.

### Tableaux de bord

- **Tableau de bord national** (admin) : chiffres clés, alertes à examiner avec accès directs à la page Alertes déjà filtrée (risque élevé, absences répétées, 7 derniers jours, chacun avec son nombre d'alertes), statistiques par établissement (tableau et graphique).
- **Tableau de bord de l'établissement** (directeur) : élèves, moyenne générale, alertes actives, absences injustifiées du mois, taux d'élèves en alerte, évolution de la moyenne par trimestre, moyenne par classe, élèves les plus à risque et dernières absences injustifiées.
- **Espace enseignant** : statistiques de son établissement et liste de ses élèves.

### Suivi des élèves

- **Fiche élève** : informations, notes par année scolaire (la plus récente d'abord, avec sa moyenne annuelle) puis par trimestre, en accordéon (moyenne visible même replié, seul le trimestre en cours ouvert), absences par année et par trimestre, historique des alertes, et graphique d'évolution de la moyenne dans l'espace admin.
- **Page Alertes** avec filtres avancés : recherche par nom, niveau de risque, type (notes ou absences), statut (ouvertes, nouvelles, en cours de suivi, résolues, toutes), établissement, dates de création.
- **Page Absences** : toutes les absences, filtrables par période, motif, année scolaire et établissement.
- **Listes paginées côté serveur** (20, 50 ou 100 par page), avec filtres et taille conservés dans l'adresse.
- Saisie des notes et des absences, import de notes par fichier CSV avec rapport d'erreurs.

### Exports

- **PDF** : fiche de suivi d'un élève, rapport des alertes ouvertes groupé par établissement.
- **Excel** : fiche élève (4 feuilles ; 3 pour l'élève lui-même, sans ses alertes), alertes (en respectant les filtres, avec le statut de suivi et la dernière action), liste des élèves d'un établissement.
- La fiche élève (PDF et Excel) porte sur l'année scolaire en cours au Bénin. Sans note ou sans absence cette année, elle l'indique (« Aucune note pour l'année 2026-2027 pour l'instant ») puis donne le récapitulatif de l'année précédente, avec son année. Partout (listes, tableaux de bord, cloche, exports), la période d'une alerte est suivie de son année.

Chaque export ne contient que ce que l'utilisateur a le droit de voir.

### Hors ligne (application installable)

La plateforme s'installe comme une application (PWA). Les pages et les données déjà consultées restent lisibles sans connexion ; un bandeau l'indique, et les actions d'écriture sont désactivées jusqu'au retour du réseau. Les exports et l'authentification ne sont jamais mis en cache, et le cache est vidé quand un autre compte se connecte sur l'appareil.

### Accessibilité et langues

- Contraste élevé (niveau AAA : fond clair, textes à 7:1 au moins, couleurs d'état assombries et toujours doublées d'un libellé, bordures de 2 px, repère de focus épais), taille du texte ajustable, lecture à voix haute, sur toutes les pages (y compris la 404). Le mode « couleurs forcées » de Windows est respecté à part. Sur téléphone et tablette, ces commandes sont dans le menu utilisateur.
- Squelettes de chargement à la forme du contenu, respectant la réduction des animations et le contraste élevé.
- **Responsive vérifié de 320 px à 1920 px** (téléphones, tablettes, ordinateurs, téléphone en paysage), au zoom de 200 % et avec la plus grande taille de texte : pas de défilement horizontal, tableaux qui défilent dans leur cadre (ombre au bord quand des colonnes restent à voir), zones à toucher d'au moins 44 × 44 px sur écran tactile.
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
| Suivre une alerte (actions, résolution, réouverture) | — | ✓ | ✓ | — (consultation et pilotage) |
| Cloche de notifications | — | ✓ | ✓ | ✓ |
| Exports PDF et Excel | Sa fiche (Excel) | ✓ | ✓ | ✓ |
| Assistant | — | ✓ | ✓ | ✓ |
| Comptes, historique, mots de passe oubliés | — | — | — | ✓ |

Le tableau décrit ce que chaque rôle peut faire dans l'interface ; chaque route de l'API vérifie elle-même ces droits, et l'interface n'affiche une action qu'aux rôles que l'API autorise. Les comptes sont créés par l'administration : il n'y a pas d'inscription libre, ce qui empêche un utilisateur de s'attribuer un rôle sensible.

---

## Sécurité et protection des données

- **Droits vérifiés à deux niveaux.** Le proxy redirige selon le rôle, et chaque route de l'API contrôle elle-même les droits : c'est cette seconde vérification qui protège réellement les données.
- **Cloisonnement par établissement.** L'enseignant et le directeur n'accèdent qu'aux élèves de leur établissement. Le périmètre s'applique dans la requête elle-même, avant la pagination et les exports : un total ou un fichier ne compte que ce que l'utilisateur peut voir.
- **Aucune fuite d'existence.** Une fiche hors périmètre répond exactement comme une fiche inexistante (404), sans révéler qu'un élève existe. L'étudiant ne voit que ses propres données.
- **Limitation des tentatives de connexion.** Après 5 échecs en 10 minutes, l'adresse IP est bloquée 15 minutes.
- **Mots de passe hachés avec bcrypt**, mots de passe temporaires tirés au hasard de façon cryptographique, demande de mot de passe oublié sans fuite d'information.
- **Assistant sans données d'élèves envoyées à l'IA.** Gemini ne reçoit que la question et la liste des établissements, communes et niveaux du périmètre de l'utilisateur ; il renvoie un filtre, vérifié contre cette liste, et la recherche se fait dans la base, bornée au périmètre. Les résultats ne contiennent que le nom, le niveau et l'établissement. L'écran demande de n'indiquer aucun nom d'élève dans la question.
- **Journal d'audit** des actions sensibles : notes, absences, alertes, comptes, mots de passe.
- **Garde-fou de production.** Les scripts d'écriture refusent de s'exécuter sur la base de production, ou si la liste des bases protégées est vide.
- **Dépendances à jour.** Next.js 16.4.2 et Prisma 7.10.1. La migration vers Prisma 7 a supprimé les 3 vulnérabilités de sa chaîne. `npm audit` signale encore 5 alertes, toutes dans les outils de vérification du code (`eslint-config-next`), qui ne font pas partie de l'application déployée.

---

## Qualité

- **648 tests unitaires** (Vitest) : règles de détection (dont la concordance des seuils affichés sur l'accueil avec le code), suivi des alertes (transitions, saisie obligatoire, suggestion de clôture, réouverture automatique), périmètre des routes (dont l'assistant et le suivi), droits affichés par rôle, notifications, pagination, exports, accessibilité, langues, fuseau horaire des dates (rendu identique en UTC et à New York), connexion à la base, données de démonstration (cas de la démo à chaque trimestre), format français des nombres et libellé des périodes.
- **2 110 vérifications navigateur** (11 scénarios de bout en bout, Google Chrome) : connexion et déconnexion des 4 rôles, limitation des tentatives, exports Excel, pagination, page 404, accordéon, squelettes, stabilité de la mise en page, alertes de bout en bout (message après saisie, cloche de l'enseignant et de l'admin, lu sur un appareil puis l'autre, suivi depuis la fiche, résolution puis réouverture automatique, import CSV), version anglaise, dates identiques avec un navigateur en UTC ou à New York (fuseau du Bénin), aucun nombre décimal au format anglais ni période « Trimestre 1 2026-2027 » sur les pages principales de chaque rôle, cloche comprise, responsive (21 pages principales à 12 largeurs, zoom 200 %, grand texte, liste des comptes en cartes sur téléphone), mode contraste élevé sur les pages des 4 rôles (textes à 7:1, couleurs d'état, focus, cloche, fenêtres, graphiques, couleurs forcées de Windows), et pour chaque rôle, absence des actions qu'il n'a pas le droit de faire ; ni emoji ni pictogramme décoratif, icônes accessibles, contraste vérifié. À 375 px et à 1280 px.
- **ESLint : 0 erreur, 0 avertissement.** Build TypeScript strict.

---

## Choix assumés et limites

- **Règle d'alerte simple et explicable**, sans apprentissage automatique.
- **Notifications dans l'application uniquement**, sans SMS ni email.
- **Assistant avec mode de secours.** Le quota gratuit de Gemini est limité ; une fois dépassé, l'assistant répond sans IA, à partir de requêtes structurées. `ASSISTANT_SANS_IA=true` coupe complètement l'appel à Gemini.
- **Mot de passe oublié traité par l'admin.** Aucun serveur email n'est configuré : l'admin génère un mot de passe temporaire et le communique.
- **Données de démonstration fictives** : 9 établissements aux noms inventés (aucun établissement connu ne les porte), environ 300 élèves aux noms béninois, notes et absences de l'année scolaire précédente et de l'année en cours jusqu'au jour du seed. Les alertes suivent les règles de l'application. Générées par `src/lib/demo/generer.ts`.
- **Limitation des tentatives par instance de serveur** : le compteur est gardé en mémoire.
- **Site non référencé par les moteurs de recherche** (`noindex`) pendant la démonstration ; les balises `hreflang` et Open Graph sont prêtes.

---

## Comptes de démonstration

| Rôle | Nom | Email | Mot de passe |
|---|---|---|---|
| Admin (pilotage national) | Arsène Kpadonou | `admin@edutech.bj` | `password123` |
| Enseignant, CEG Zopah | Fulbert Gbaguidi | `enseignant@edutech.bj` | `password123` |
| Étudiant, CEG Zopah | Prudence Ahouansou (Terminale D) | `etudiant@edutech.bj` | `password123` |
| Directeur, CEG Zopah | Bernadette Sossou | à créer depuis `/admin/utilisateurs`, puis relancer le seed | — |

### Cas préparés pour la démonstration (CEG Zopah)

| Élève | Classe | Situation |
|---|---|---|
| Rodrigue Agossou | Première D | moyenne de 12,75 à 7,5 : alerte notes **Élevé**, en cours de suivi (entretien par l'enseignant, parents convoqués par la directrice) |
| Adéola Akanni | Terminale C | moyenne de 14,5 à 12 : alerte notes **Moyen**, nouvelle (pour montrer une première action) |
| Inoussa Maïga | 3ème | 7 absences injustifiées ce trimestre, surtout le lundi : alerte absences **Moyen**, en cours de suivi (parents convoqués) |
| Sèna Dossou | Seconde D | 6 notes à 11 de moyenne contre 13,5 : alerte **Moyen**, qui s'aggrave pendant la démo |
| Nafissatou Gounou | 6ème | arrivée ce trimestre : « Pas encore de période de comparaison » |

Pour Sèna Dossou, saisir deux notes dans le trimestre proposé, par exemple **6 puis 6** (ou 5 puis 7). La première affiche « Note enregistrée » ; la seconde, « Alerte aggravée : Moyen → Élevé ». Règle : première note d'au moins 4, et les deux font moins de 14. Les autres élèves du CEG Zopah n'ont aucune alerte. Dans les autres établissements, quelques alertes sont en cours de suivi ou résolues, pour le pilotage de l'admin. Le seed calcule les périodes à partir du jour où il est lancé : le relancer la veille de la démo.

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
| Déploiement | Vercel (fonctions en région `cle1`, Cleveland, à côté de la base Neon `us-east-2`), Node.js 24 |

### Base de données et connexions

- **Prisma 7.** Le client est généré dans `src/generated/prisma` et importé depuis `@/generated/prisma/client`. Il se connecte via `src/lib/prisma.ts`, avec le driver `pg` et le pooler Neon.
- **Connexions fiabilisées** :
  - délai de connexion de 15 s, comme le recommande Neon pour le réveil d'une base en veille ;
  - 2 s par adresse IP au lieu des 250 ms de Node, utile sur un réseau lent ;
  - une nouvelle tentative pour les **lectures** uniquement, en cas d'erreur de connexion. Une écriture n'est jamais rejouée, pour ne pas risquer de doublon.
- **Pool de connexions** créé une fois par instance, connexions inactives fermées après 30 s. Avec Fluid compute, `attachDatabasePool` (`@vercel/functions`) garde l'instance active le temps de les fermer, au lieu de la mettre en veille avec des connexions ouvertes.
- **Index** sur les colonnes de jointure et de tri : `etudiantId` (notes, absences, alertes, inscriptions), `Etudiant.etablissementId`, `Etudiant (nom, prenom)`, `Alerte (statut, createdAt)`, `Alerte.niveauModifieLe`, `Absence.date`.
- **Vitesse** :
  - l'accueil et la connexion, en français comme en anglais, sont des pages **statiques** servies depuis le cache de Vercel. Deux mises en page racines fixent la langue (`src/app/(fr)` et `src/app/en`), et c'est le proxy qui envoie une personne connectée vers son espace ;
  - SweetAlert2 n'est téléchargé qu'au premier message affiché ;
  - côté navigateur, Sentry ne remonte que les erreurs : ni Session Replay, ni envoi d'une session à chaque page.
- **Région.** La base Neon est dans l'Ohio (`us-east-2`) et les fonctions Vercel à Cleveland (`cle1`). Une migration vers l'Europe a été étudiée puis reportée (gain d'environ 100 ms par requête, hébergement des données à décider) : mesures et procédure complète dans [docs/migration-region.md](docs/migration-region.md).
- **Évolutions de schéma d'octobre 2026.** Colonnes `Alerte.niveauModifieLe` (date de la dernière aggravation) et `User.notificationsVuesLe` (dernière ouverture de la cloche), nullables, ajoutées de façon purement additive : l'ancien code reste compatible.
- **Suivi des alertes (fin octobre 2026).** Colonnes `Alerte.suiviDepuis` et `Alerte.resolueLe` (nullables) et table `SuiviAlerte` (une ligne par étape). Purement additif, sans donnée à migrer : le statut affiché se déduit de `statut` (« active » ou « traitee », inchangé) et de `suiviDepuis`. À appliquer en production avant de déployer le code, et avant de relancer le seed (qui écrit l'historique de démonstration).

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
| `ASSISTANT_SANS_IA` | `true` pour ne jamais appeler Gemini : l'assistant répond seulement avec l'analyseur local. Vide ou absente (par défaut) : Gemini d'abord, analyseur local en secours |
| `PROTECTED_DB_HOSTS` | Hôte(s) de la base de production, séparés par des virgules (garde-fou) |
| `NEXT_PUBLIC_SENTRY_DSN` | Depuis sentry.io (facultatif en local) |

```bash
npx prisma generate                # client dans src/generated/prisma (aussi lancé par npm install)
npx prisma db push                 # crée les tables (ne régénère plus le client depuis Prisma 7)
npx tsx prisma/seed.ts             # simulation : affiche ce qui sera supprimé et créé
npx tsx prisma/seed.ts --execute --hote=<hôte affiché>   # données et comptes de démonstration
npm run dev
```

L'application est disponible sur [http://localhost:3000](http://localhost:3000).

> ⚠️ **Utilisez toujours une branche Neon « dev », jamais la production.**
> Le garde-fou `prisma/garde-prod.ts` bloque les scripts d'écriture (seed, recalcul des alertes) si `DATABASE_URL` pointe vers un hôte listé dans `PROTECTED_DB_HOSTS`, ou si cette variable est vide. Les commandes Prisma (`db push`…) n'y passent pas : vérifiez l'hôte vous-même avant de les lancer.

### Lancer les tests

```bash
npm test          # 648 tests unitaires
npm run lint      # ESLint : 0 erreur, 0 avertissement attendus
npm run build     # vérification TypeScript et build complet
npm run e2e       # tests navigateur : connexions, excel, pagination, finitions, notifications, langues, droits, fuseaux, nombres, responsive, contraste
```

`npm run e2e` fait le build, lance `next start` sur le port 3100, exécute les scénarios de `e2e/` avec Google Chrome, puis arrête le serveur. Il refuse de démarrer si la base du `.env` figure dans `PROTECTED_DB_HOSTS`.

- Le scénario `notifications` crée dans la base de dev deux élèves de test (nommés `E2E-Alertes`), leurs notes, absences et alertes, un compte élève pour l'import, et rétablit à la fin la date de consultation de la cloche des comptes de démonstration ; le scénario `droits` crée une absence temporaire. Les deux les suppriment à la fin, même en cas d'échec.
- Pour inclure le rôle directeur, copiez `.env.e2e.example` en `.env.e2e.local` (ignoré par git) et renseignez `E2E_DIRECTEUR_EMAIL` et `E2E_DIRECTEUR_MOT_DE_PASSE` avec un compte directeur de la base de dev ; sans eux, ces étapes sont ignorées.
- Options : `npm run e2e -- pagination` pour un seul scénario, `npm run e2e -- --sans-build` pour réutiliser le build existant.
