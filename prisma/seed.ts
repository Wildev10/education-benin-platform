import { PrismaClient } from "../src/generated/prisma/client.ts";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

const ETABLISSEMENTS = [
  { nom: "Lycée Mathieu Bouké", departement: "Atlantique", commune: "Abomey-Calavi" },
  { nom: "Collège Sainte-Rita", departement: "Atlantique", commune: "Ouidah" },
  { nom: "Lycée Coulibaly", departement: "Littoral", commune: "Cotonou" },
  { nom: "Collège Notre-Dame", departement: "Ouémé", commune: "Porto-Novo" },
];

const NIVEAUX = ["Seconde C", "Première D", "Terminale D"];
const MATIERES = ["Mathématiques", "Physique-Chimie", "SVT", "Français", "Anglais", "Histoire-Géo"];
const PERIODES = ["Trimestre 1", "Trimestre 2", "Trimestre 3"];
const ANNEE = "2025-2026";

// Génère une moyenne réaliste entre min et max
function noteAleatoire(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

async function main() {
  console.log("🧹 Nettoyage de la base...");
  await prisma.alerte.deleteMany();
  await prisma.note.deleteMany();
  await prisma.inscription.deleteMany();
  await prisma.etudiant.deleteMany();
  await prisma.etablissement.deleteMany();

  console.log("🏫 Création des établissements...");
  const etablissements = [];
  for (const e of ETABLISSEMENTS) {
    const etab = await prisma.etablissement.create({ data: e });
    etablissements.push(etab);
  }

  console.log("👩‍🎓 Création des étudiants...");
  const NB_ETUDIANTS = 70;
  const NB_EN_BAISSE = 9; // parmi les 70, ceux qui auront une baisse construite

  const etudiantsCrees = [];

  for (let i = 0; i < NB_ETUDIANTS; i++) {
    const etablissement = faker.helpers.arrayElement(etablissements);
    const niveau = faker.helpers.arrayElement(NIVEAUX);

    const etudiant = await prisma.etudiant.create({
      data: {
        nom: faker.person.lastName(),
        prenom: faker.person.firstName(),
        dateNaissance: faker.date.birthdate({ min: 15, max: 19, mode: "age" }),
        sexe: faker.helpers.arrayElement(["M", "F"]),
        etablissementId: etablissement.id,
        niveau,
      },
    });

    await prisma.inscription.create({
      data: {
        etudiantId: etudiant.id,
        anneeScolaire: ANNEE,
        niveau,
        statut: "active",
      },
    });

    etudiantsCrees.push(etudiant);
  }

  console.log("📝 Création des notes (avec baisses construites pour les alertes)...");

  // On choisit au hasard 9 étudiants qui auront une vraie baisse
  const etudiantsEnBaisse = faker.helpers.arrayElements(etudiantsCrees, NB_EN_BAISSE);
  const idsEnBaisse = new Set(etudiantsEnBaisse.map((e) => e.id));

  for (const etudiant of etudiantsCrees) {
    const enBaisse = idsEnBaisse.has(etudiant.id);

    // Moyenne de base "normale" pour cet étudiant (entre 9 et 17)
    const moyenneBase = noteAleatoire(9, 17);

    for (let p = 0; p < PERIODES.length; p++) {
      let moyennePeriode: number;

      if (enBaisse && p === PERIODES.length - 1) {
        // Dernière période : baisse forte et volontaire (25 à 40%)
        const baisse = noteAleatoire(0.25, 0.4);
        moyennePeriode = Math.max(2, moyenneBase * (1 - baisse));
      } else if (enBaisse && p === PERIODES.length - 2) {
        // Avant-dernière période : encore normale, légère variation
        moyennePeriode = moyenneBase + noteAleatoire(-1, 1);
      } else {
        // Étudiants normaux : petite variation aléatoire autour de leur moyenne
        moyennePeriode = Math.max(2, Math.min(20, moyenneBase + noteAleatoire(-1.5, 1.5)));
      }

      // Génère une note par matière pour cette période, centrée sur moyennePeriode
      for (const matiere of MATIERES) {
        const valeur = Math.max(
          0,
          Math.min(20, noteAleatoire(moyennePeriode - 2, moyennePeriode + 2))
        );

        await prisma.note.create({
          data: {
            etudiantId: etudiant.id,
            matiere,
            valeur,
            periode: PERIODES[p],
            anneeScolaire: ANNEE,
          },
        });
      }
    }
  }

  console.log(`✅ Seed terminé : ${NB_ETUDIANTS} étudiants, ${etablissements.length} établissements.`);
  console.log(`📉 ${NB_EN_BAISSE} étudiants ont une baisse construite pour déclencher des alertes.`);
  console.log("⚠️  N'oublie pas de lancer le calcul des alertes après ce seed (fonction de détection à écrire ensuite).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });