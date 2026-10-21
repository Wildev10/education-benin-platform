# Migration de la base et des fonctions vers l'Europe (plan, non appliqué)

**Statut : en attente.** Étude réalisée le 21 octobre 2026. Décision du 21 octobre 2026 : pas de migration pour le moment. Le gain (~100 ms par requête) ne justifie pas le risque avant la démonstration, et le choix de l'hébergement des données des élèves reviendra probablement au ministère.

Ce document garde les mesures et la procédure complète pour le jour où la migration serait décidée. **Aucun mot de passe ni identifiant d'hôte de production n'y figure** : les adresses sont des modèles à compléter, et les mots de passe sont remplacés par `***`.

## Situation actuelle

- Base Neon dans l'Ohio (`aws-us-east-2`).
- Fonctions Vercel à Cleveland (`cle1`, fichier `vercel.json`), à côté de la base.
- Depuis le Bénin, le trafic entre chez Vercel par **Paris (`cdg1`)** ou par **Le Cap (`cpt1`)**, selon le moment : le routage change sans intervention de notre part.

## Pourquoi le gain est limité

La fonction et la base restent côte à côte dans tous les scénarios étudiés. Les nombreux allers-retours d'une page vers la base (une dizaine de requêtes SQL) ne coûtent donc presque rien, aujourd'hui comme après une migration. Mesure : une route qui lit la base ne met que 10 à 17 ms de plus qu'une route qui ne la lit pas.

Le seul trajet raccourci est celui entre le point d'entrée Vercel et la fonction, **une fois par requête au serveur**.

## Mesures

Toutes les mesures ont été faites depuis le Bénin, le 20 et le 21 octobre 2026.

### Situation actuelle (production, lecture seule, médianes)

| Requête | Via Paris (21 oct.) | Via Le Cap (20 oct.) |
|---|---|---|
| Fichier statique servi par le point d'entrée | 148 ms | ~90 ms après la connexion |
| Route serveur sans base (`/api/auth/session`) | 262 ms | ~360 ms |
| Routes serveur avec base | 271–279 ms | ~360 ms |
| Trajet point d'entrée ↔ Cleveland | ~115–130 ms | ~280 ms |

### Temps aller-retour depuis le Bénin (connexion TCP, médianes)

Seules les comparaisons entre ces chiffres sont utilisables : le réseau de la machine de mesure ajoute un délai propre à TCP (vers Vercel : ~122 ms au ping, ~228 ms en TCP).

| Proxy Neon | Temps |
|---|---|
| Ohio (`aws-us-east-2`, actuel) | 198 ms |
| Francfort (`aws-eu-central-1`) | 136 ms |
| Londres (`aws-eu-west-2`) | 125 ms |
| Paris | n'existe pas chez Neon |

### Latence entre régions AWS

Chiffres publiés par economize.cloud, sans date de mesure indiquée.

| Le Cap (`af-south-1`) vers | Temps |
|---|---|
| Ohio (`us-east-2`) | ~237 ms |
| Francfort (`eu-central-1`) | ~155 ms |
| Londres (`eu-west-2`) | ~148 ms |
| Paris (`eu-west-3`) | ~146 ms |

### Gain estimé par requête au serveur

| Point d'entrée | Aujourd'hui (Cleveland) | Londres ou Francfort | Gain |
|---|---|---|---|
| Paris (`cdg1`) | ~265 ms | ~160–180 ms | **~90–110 ms** |
| Le Cap (`cpt1`) | ~360 ms | ~270–280 ms | **~80–90 ms** |

Gain par usage :

- **Une page :** une requête au serveur (le HTML), donc ~85–110 ms sur 430–850 ms, soit 10 à 20 %.
- **Navigation interne, action, cloche :** ~85–110 ms chacune.
- **Connexion d'un compte :** 3 requêtes à la suite, donc ~0,25–0,3 s.

### Options écartées

- **Paris :** Vercel a bien `cdg1`, mais Neon n'a pas Paris. La base serait à ~8 ms de la fonction, et cet écart se paierait à chacune des ~10 requêtes SQL d'une page.
- **Le Cap (`cpt1`) pour les fonctions :** aucune région Neon en Afrique. Chaque requête SQL ferait un aller-retour jusqu'en Europe (~150 ms), ce qui serait bien pire qu'aujourd'hui.

### Recommandation

**Londres** : Vercel `lhr1` et Neon `aws-eu-west-2`. Londres est un peu plus proche que Francfort via Le Cap (148 contre 155 ms) et depuis le Bénin (125 contre 136 ms). Les deux sont équivalents via Paris.

## Offre gratuite de Neon

État de la documentation de Neon au 21 octobre 2026 :

- **Projets :** 100.
- **Stockage :** 1 Go par projet, 20 Go au total. La base de dev pèse 8,7 Mo.
- **Calcul :** 100 CU-heures par projet et par mois.
- **Branches :** 10 par projet.
- **Mise en veille :** après 5 min d'inactivité, impossible à désactiver sur cette offre. Le délai de réveil (~0,7 s mesuré) restera donc, quelle que soit la région.
- **Régions AWS :** Virginie, Ohio, Oregon, Francfort, Londres, Singapour, Sydney, São Paulo. Pas de Paris, rien en Afrique.
- **Changement de région :** impossible sur un projet existant. Il faut créer un nouveau projet dans la région voulue et y copier les données.
- **Outil d'import de Neon (Import Data Assistant) :** sa documentation couvre PostgreSQL 14 à 17. La base de dev est en **PostgreSQL 18.6**, donc l'outil risque de refuser. La procédure ci-dessous utilise `pg_dump` / `pg_restore` en **version 18**.

Base de dev au 21 octobre 2026 :
- seule extension : `plpgsql` ;
- propriétaire des tables : `neondb_owner` ;
- identifiants : tous des chaînes (`cuid`), donc aucune séquence à recaler ;
- 24 index dans le schéma `public`.

## Plan de migration

**Ordre :** d'abord le dev, en répétition générale, puis la production. Toute action sur la production est faite par le développeur, jamais par Claude.

Les adresses s'écrivent `postgresql://neondb_owner:***@<hôte>/neondb?sslmode=require` :
- **adresse directe**, sans pooler : pour la copie ;
- **adresse avec pooler** (`-pooler` dans l'hôte) : pour l'application.

Les deux se trouvent dans Neon → Connect, case « Connection pooling ».

### Étape A : préparation (développeur, ~15 min)

1. Dans l'éditeur SQL de Neon (projet de production), lancer `SHOW server_version;` et noter le résultat.
2. Créer deux projets Neon dans **AWS Europe (London)** :
   - même version de PostgreSQL que la production ;
   - base `neondb` ;
   - noms suggérés : `edutech-prod-eu` et `edutech-dev-eu`.
3. Installer les outils PostgreSQL 18, au choix :
   - `sudo apt install postgresql-client-18`, après avoir ajouté le dépôt `apt.postgresql.org` ;
   - ou Docker : `docker run --rm -v "$PWD":/w -w /w postgres:18 pg_dump …`.
4. Dans le `.env` local, **avant toute autre modification**, ajouter l'identifiant du nouveau projet de production à la liste protégée, en gardant l'ancien jusqu'à la suppression de l'ancien projet :
   ```
   PROTECTED_DB_HOSTS=<identifiant-ancien-projet-prod>,<identifiant-nouveau-projet-prod>
   ```

### Étape B : dev, répétition générale (Claude, après feu vert, ~20 min)

Le développeur remplace `DATABASE_URL` dans `.env` par la nouvelle adresse de dev, avec pooler. Ensuite, Claude :

1. vérifie que l'hôte de `DATABASE_URL` n'est pas dans `PROTECTED_DB_HOSTS` ;
2. copie l'ancienne base de dev vers la nouvelle avec `pg_dump` / `pg_restore`, par les adresses directes (mêmes commandes qu'à l'étape C.2) ;
3. lance les requêtes de vérification de l'étape C.3 sur les deux bases et compare les résultats ;
4. lance `npm run e2e` ;
5. note le temps réel de chaque étape, pour planifier la production.

### Étape C : production (développeur)

À faire à une heure creuse, en prévenant les utilisateurs.

**1. Geler les écritures sur l'ancienne base.** Les lectures continuent ; une écriture affiche une erreur à l'utilisateur. Dans l'éditeur SQL de l'ancien projet de production :

```sql
ALTER DATABASE neondb SET default_transaction_read_only = on;
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'neondb' AND pid <> pg_backend_pid();
```

**2. Copier les données** (quelques secondes pour quelques Mo) :

```sh
pg_dump -Fc --no-owner --no-acl -d "postgresql://neondb_owner:***@<hôte-direct-ancien-prod>/neondb?sslmode=require" -f prod-avant-migration.dump
pg_restore --no-owner --no-acl -d "postgresql://neondb_owner:***@<hôte-direct-nouveau-prod>/neondb?sslmode=require" prod-avant-migration.dump
```

Garder `prod-avant-migration.dump` : c'est la sauvegarde. Il contient des données réelles, donc il ne doit jamais aller dans le dépôt.

**3. Vérifier que les deux bases sont identiques.** Lancer ces requêtes sur **les deux** bases ; les résultats doivent être identiques.

Lignes et empreinte du contenu, table par table :

```sql
SELECT 'Absence' t, count(*) n, md5(string_agg(x::text, '|' ORDER BY x.id)) e FROM "Absence" x UNION ALL SELECT 'ActionLog', count(*), md5(string_agg(x::text, '|' ORDER BY x.id)) FROM "ActionLog" x UNION ALL SELECT 'Alerte', count(*), md5(string_agg(x::text, '|' ORDER BY x.id)) FROM "Alerte" x UNION ALL SELECT 'Etablissement', count(*), md5(string_agg(x::text, '|' ORDER BY x.id)) FROM "Etablissement" x UNION ALL SELECT 'Etudiant', count(*), md5(string_agg(x::text, '|' ORDER BY x.id)) FROM "Etudiant" x UNION ALL SELECT 'Inscription', count(*), md5(string_agg(x::text, '|' ORDER BY x.id)) FROM "Inscription" x UNION ALL SELECT 'Note', count(*), md5(string_agg(x::text, '|' ORDER BY x.id)) FROM "Note" x UNION ALL SELECT 'ResetRequest', count(*), md5(string_agg(x::text, '|' ORDER BY x.id)) FROM "ResetRequest" x UNION ALL SELECT 'User', count(*), md5(string_agg(x::text, '|' ORDER BY x.id)) FROM "User" x;
```

Index : même nombre et même empreinte des deux côtés :

```sql
SELECT count(*) AS index, md5(string_agg(indexname || ':' || indexdef, '|' ORDER BY indexname)) AS empreinte FROM pg_indexes WHERE schemaname = 'public';
```

Colonne de la cloche (attendu : `niveauModifieLe`, `timestamp without time zone`, `YES`) :

```sql
SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'Alerte' AND column_name = 'niveauModifieLe';
```

**4. Basculer.**

- Dans Vercel → Settings → Environment Variables, remplacer `DATABASE_URL` (Production) par la **nouvelle adresse avec pooler**, sans redéployer.
- Pousser le commit qui passe `vercel.json` à `{"regions": ["lhr1"]}` et met à jour le README et CLAUDE.md. Ce déploiement applique la nouvelle base et la nouvelle région en même temps.

**5. Contrôler.**

- Déploiement Vercel réussi : `gh api repos/Wildev10/education-benin-platform/commits/<sha>/status`.
- L'en-tête `x-vercel-id` d'une route API contient `::lhr1::`.
- Connexion des 4 rôles et pages principales, en lecture seule.
- Une écriture test faite par le développeur, par exemple traiter une alerte de démonstration.
- Mesures avant/après.

**6. Après une semaine sans problème :** supprimer l'ancien projet de production, et retirer son identifiant de `PROTECTED_DB_HOSTS`.

### Durée d'interruption

- **Écritures :** bloquées ~10 à 15 min (le gel, la copie en moins d'une minute, les vérifications, puis le déploiement de ~2–3 min).
- **Lectures :** jamais interrompues. L'ancienne base les sert jusqu'à la fin du déploiement.

## Retour arrière

**Si un problème apparaît avant toute écriture sur la nouvelle base :**

1. Dans Vercel → Deployments, lancer **Instant Rollback** vers le déploiement précédent. Un changement de variable d'environnement ne s'applique qu'aux nouveaux déploiements : l'ancien déploiement garde l'ancienne base et la région `cle1`.
2. Rouvrir les écritures sur l'ancienne base :
   ```sql
   ALTER DATABASE neondb SET default_transaction_read_only = off;
   ```
3. Remettre l'ancienne `DATABASE_URL` dans Vercel, et annuler le commit de région (`git revert`), pour que le déploiement suivant ne rebascule pas.

**Si des écritures ont déjà eu lieu sur la nouvelle base :** il faut en plus recopier la nouvelle base vers l'ancienne, par le même `pg_dump` / `pg_restore` en sens inverse, avant de rouvrir l'ancienne. Il vaut donc mieux décider dans la première heure qui suit la bascule.

## Hébergement des données des élèves

La migration ferait passer l'hébergement des données des élèves (identité, notes, absences, alertes) des **États-Unis** au **Royaume-Uni**. Dans les deux cas, les données sont hébergées hors du Bénin.

Le choix du pays d'hébergement relève probablement du ministère et des règles béninoises sur les données personnelles. Si un avis, une déclaration ou une autorisation a été demandé pour l'hébergement actuel, il faut vérifier qu'un changement de pays d'hébergement ne remet rien en cause. Ce point doit être tranché avant toute migration, qu'elle vise Londres, Francfort ou une autre région.

## Sources

- Latence AWS : [Le Cap ↔ Ohio](https://www.economize.cloud/resources/aws/latency/af-south-1-vs-us-east-2/), [Le Cap ↔ Francfort](https://www.economize.cloud/resources/aws/latency/af-south-1-vs-eu-central-1/), [Le Cap ↔ Londres](https://www.economize.cloud/resources/aws/latency/af-south-1-vs-eu-west-2/)
- Neon : [offres](https://neon.com/docs/introduction/plans), [régions](https://neon.com/docs/introduction/regions), [copie entre projets Neon](https://neon.com/docs/import/migrate-from-neon), [outil d'import](https://neon.com/docs/import/import-data-assistant)
- Vercel : [régions des fonctions](https://vercel.com/docs/functions/configuring-functions/region)
