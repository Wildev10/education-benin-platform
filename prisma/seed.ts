import "dotenv/config";
import { URL } from "node:url";
import bcrypt from "bcryptjs";
import { creerClientPrisma } from "../src/lib/prisma";
import { genererDonneesDemo, type RoleCompte } from "../src/lib/demo/generer";
import { verifierBaseNonProtegee } from "./garde-prod";

// Remplace TOUTES les données de démonstration (établissements, élèves,
// inscriptions, notes, absences, alertes, historique) par le jeu de
// src/lib/demo/generer.ts, calculé pour la date du jour.
//
//   npx tsx prisma/seed.ts                           -> simulation (n'écrit rien)
//   npx tsx prisma/seed.ts --execute --hote=<hôte>   -> écrit, en une seule transaction
//
// --hote doit reprendre l'hôte de DATABASE_URL affiché par la simulation.
// Comptes conservés (email, mot de passe, identifiant) : admin@, enseignant@,
// etudiant@edutech.bj et le compte directeur ; leurs nom, prénom et
// établissement sont remplacés. Les autres comptes étudiants sont supprimés.
// Tout autre compte bloque le script : à traiter à la main avant.

verifierBaseNonProtegee();

const execute = process.argv.includes("--execute");
const hoteConfirme = process.argv.find((a) => a.startsWith("--hote="))?.slice("--hote=".length);
const hote = new URL(process.env.DATABASE_URL!).hostname;

const EMAILS: Record<Exclude<RoleCompte, "directeur">, string> = {
  admin: "admin@edutech.bj",
  enseignant: "enseignant@edutech.bj",
  etudiant: "etudiant@edutech.bj",
};
const MOT_DE_PASSE_NOUVEAU_COMPTE = "password123"; // celui des comptes de démonstration du README

const prisma = creerClientPrisma();

const TAILLE_LOT = 2000;
async function parLots<T>(lignes: T[], creer: (lot: T[]) => Promise<unknown>) {
  for (let i = 0; i < lignes.length; i += TAILLE_LOT) await creer(lignes.slice(i, i + TAILLE_LOT));
}

async function main() {
  const maintenant = new Date();
  const d = genererDonneesDemo(maintenant);

  console.log(`${execute ? "EXÉCUTION" : "SIMULATION"} sur l'hôte ${hote}`);
  console.log(`Période en cours : ${d.enCours.periode} ${d.enCours.anneeScolaire}\n`);
  for (const a of d.avertissements) console.log(`⚠️  ${a}\n`);

  // ── Comptes ──
  const utilisateurs = await prisma.user.findMany({
    select: { id: true, email: true, role: true, nom: true, prenom: true },
    orderBy: { email: "asc" },
  });
  const parEmail = new Map(utilisateurs.map((u) => [u.email, u]));
  const directeurs = utilisateurs.filter((u) => u.role === "directeur");
  const conserves = new Map<RoleCompte, (typeof utilisateurs)[number]>();
  for (const [role, email] of Object.entries(EMAILS) as [Exclude<RoleCompte, "directeur">, string][]) {
    const u = parEmail.get(email);
    if (u && u.role !== role) throw new Error(`${email} a le rôle « ${u.role} » au lieu de « ${role} » : script arrêté.`);
    if (u) conserves.set(role, u);
  }
  if (directeurs.length > 1) {
    throw new Error(`${directeurs.length} comptes directeur (${directeurs.map((u) => u.email).join(", ")}) : un seul est attendu, script arrêté.`);
  }
  if (directeurs[0]) conserves.set("directeur", directeurs[0]);

  const idsConserves = new Set([...conserves.values()].map((u) => u.id));
  const autres = utilisateurs.filter((u) => !idsConserves.has(u.id));
  const bloquants = autres.filter((u) => u.role !== "etudiant");
  if (bloquants.length > 0) {
    throw new Error(
      `Comptes inattendus, à traiter à la main avant de relancer (rien n'a été modifié) :\n` +
        bloquants.map((u) => `  - ${u.email} (${u.role}, ${u.prenom} ${u.nom})`).join("\n")
    );
  }
  const etudiantsASupprimer = autres; // tous de rôle « etudiant »

  // ── Ce qui sera supprimé ──
  const [etablissements, etudiants, inscriptions, notes, absences, alertes, journal, demandes, suivis] = await Promise.all([
    prisma.etablissement.count(),
    prisma.etudiant.count(),
    prisma.inscription.count(),
    prisma.note.count(),
    prisma.absence.count(),
    prisma.alerte.count(),
    prisma.actionLog.count(),
    prisma.resetRequest.count({ where: { userId: { in: etudiantsASupprimer.map((u) => u.id) } } }),
    prisma.suiviAlerte.count(),
  ]);
  console.log("SUPPRIMÉ :");
  console.log(`  ${etablissements} établissement(s), ${etudiants} élève(s), ${inscriptions} inscription(s)`);
  console.log(`  ${notes} note(s), ${absences} absence(s), ${alertes} alerte(s) avec ${suivis} étape(s) de suivi`);
  console.log(`  ${journal} entrée(s) de l'historique (tout l'historique des actions)`);
  console.log(`  ${etudiantsASupprimer.length} compte(s) étudiant autres que ${EMAILS.etudiant}, avec ${demandes} demande(s) de mot de passe :`);
  for (const u of etudiantsASupprimer) console.log(`    - ${u.email} (${u.prenom} ${u.nom})`);

  // ── Ce qui sera créé ou modifié ──
  console.log("\nCRÉÉ :");
  console.log(`  ${d.etablissements.length} établissements, ${d.etudiants.length} élèves, ${d.inscriptions.length} inscriptions`);
  console.log(`  ${d.notes.length} notes, ${d.absences.length} absences, ${d.alertes.length} alertes, ${d.journal.length} entrées d'historique`);
  const resolues = d.alertes.filter((a) => a.statut === "traitee").length;
  const enSuivi = d.alertes.filter((a) => a.statut === "active" && a.suiviDepuis).length;
  console.log(`  Suivi : ${enSuivi} alerte(s) en cours de suivi, ${resolues} résolue(s), ${d.suivis.length} étape(s)`);
  for (const e of d.etablissements) {
    console.log(`    - ${e.nom} (${e.statut}, ${e.commune}, ${e.departement}) : ${d.etudiants.filter((x) => x.etablissementId === e.id).length} élèves`);
  }

  console.log("\nCOMPTES (email, mot de passe et identifiant conservés) :");
  const nomEtab = (id: string | null) => d.etablissements.find((e) => e.id === id)?.nom ?? "aucun établissement";
  for (const role of ["admin", "enseignant", "directeur", "etudiant"] as RoleCompte[]) {
    const u = conserves.get(role);
    const c = d.comptes[role];
    const avant = u ? `${u.email} (${u.prenom} ${u.nom})` : role === "directeur" ? "aucun compte directeur : ignoré" : `${EMAILS[role as keyof typeof EMAILS]} absent : créé (mot de passe ${MOT_DE_PASSE_NOUVEAU_COMPTE})`;
    console.log(`  ${role.padEnd(10)} ${avant} -> ${c.prenom} ${c.nom}, ${nomEtab(c.etablissementId)}`);
  }

  console.log("\nCAS DE LA DÉMO (CEG Zopah) :");
  const libelle = (id: string) =>
    d.alertes.filter((a) => a.etudiantId === id).map((a) => `alerte ${a.type === "absences" ? "absences" : "notes"} ${a.niveauRisque}`).join(", ") || "aucune alerte";
  for (const [cle, e] of Object.entries(d.cas)) {
    console.log(`  ${cle.padEnd(15)} ${e.prenom} ${e.nom}, ${e.niveau} : ${libelle(e.id)}`);
  }

  if (!execute) {
    console.log(`\nSimulation : rien n'a été écrit. Pour exécuter : --execute --hote=${hote}`);
    return;
  }
  if (hoteConfirme !== hote) {
    throw new Error(`--hote=${hoteConfirme ?? ""} ne correspond pas à l'hôte de DATABASE_URL (${hote}) : rien n'a été écrit.`);
  }

  const motDePasse = await bcrypt.hash(MOT_DE_PASSE_NOUVEAU_COMPTE, 10);
  const debut = Date.now();
  await prisma.$transaction(
    async (tx) => {
      // 1. Suppressions (l'ordre suit les clés étrangères)
      await tx.actionLog.deleteMany();
      await tx.alerte.deleteMany();
      await tx.note.deleteMany();
      await tx.absence.deleteMany();
      await tx.inscription.deleteMany();
      await tx.user.deleteMany({ where: { id: { in: etudiantsASupprimer.map((u) => u.id) } } });
      await tx.user.updateMany({ data: { etudiantId: null, etablissementId: null } });
      await tx.etudiant.deleteMany();
      await tx.etablissement.deleteMany();

      // 2. Nouvelles données
      await tx.etablissement.createMany({ data: d.etablissements.map(({ id, nom, departement, commune }) => ({ id, nom, departement, commune })) });
      await tx.etudiant.createMany({ data: d.etudiants });
      await parLots(d.inscriptions, (lot) => tx.inscription.createMany({ data: lot }));
      await parLots(d.notes, (lot) => tx.note.createMany({ data: lot }));
      await parLots(d.absences, (lot) => tx.absence.createMany({ data: lot }));
      await tx.alerte.createMany({ data: d.alertes });

      // 3. Comptes : noms des deux champs, établissement, élève ; cloche lue
      const ids = {} as Partial<Record<RoleCompte, string>>;
      for (const role of ["admin", "enseignant", "directeur", "etudiant"] as RoleCompte[]) {
        const c = d.comptes[role];
        const data = { nom: c.nom, prenom: c.prenom, etablissementId: c.etablissementId, etudiantId: c.etudiantId, notificationsVuesLe: maintenant };
        const u = conserves.get(role);
        if (u) {
          await tx.user.update({ where: { id: u.id }, data });
          ids[role] = u.id;
        } else if (role !== "directeur") {
          const cree = await tx.user.create({ data: { ...data, email: EMAILS[role], passwordHash: motDePasse, role } });
          ids[role] = cree.id;
        }
      }

      // 4. Historique des saisies, au nom de l'enseignant
      await parLots(d.journal, (lot) => tx.actionLog.createMany({ data: lot.map((j) => ({ ...j, userId: ids.enseignant! })) }));

      // 5. Suivi des alertes : auteur relié au compte de démonstration quand il existe
      await tx.suiviAlerte.createMany({
        data: d.suivis.map(({ auteur, ...etape }) => ({ ...etape, auteurId: auteur ? (ids[auteur] ?? null) : null })),
      });
    },
    { maxWait: 30_000, timeout: 300_000 }
  );

  console.log(`\nFait en ${Math.round((Date.now() - debut) / 1000)} s.`);
  console.log("Reconnectez chaque compte de démonstration : la session garde l'ancien établissement jusqu'à la reconnexion.");
}

main()
  .catch((e) => {
    console.error(`\n⛔  ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
