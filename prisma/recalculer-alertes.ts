import "dotenv/config";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { analyserAlerte } from "../src/lib/detection-alerte";
import { verifierBaseNonProtegee } from "./garde-prod";

// Relance la détection d'alerte une fois pour chaque étudiant.
//   npx tsx prisma/recalculer-alertes.ts            -> simulation (n'écrit rien)
//   npx tsx prisma/recalculer-alertes.ts --execute  -> écrit en base
// Ne supprime jamais d'alerte ; ne crée pas de doublon (même règle que l'API).
const execute = process.argv.includes("--execute");
if (execute) verifierBaseNonProtegee();

const prisma = new PrismaClient();

async function main() {
  const etudiants = await prisma.etudiant.findMany({
    select: { id: true, nom: true, prenom: true },
    orderBy: { nom: "asc" },
  });
  console.log(
    `${execute ? "EXÉCUTION" : "SIMULATION"} sur ${etudiants.length} étudiants\n`
  );

  const alertesCreees: string[] = [];
  let creees = 0;
  let misesAJour = 0;
  for (const etudiant of etudiants) {
    const detail = await analyserAlerte(etudiant.id, !execute);
    if (!detail) continue;
    if (detail.issue === "creee") {
      creees += 1;
      if (detail.alerteId) alertesCreees.push(detail.alerteId);
    }
    else misesAJour += 1;
    console.log(
      `${detail.issue === "creee" ? "CRÉER " : "MAJ   "} ${etudiant.prenom} ${etudiant.nom} (${etudiant.id}) : ${detail.periode} ${detail.anneeScolaire}, risque ${detail.niveauRisque}, ${detail.moyenneAvant.toFixed(2)} -> ${detail.moyenneApres.toFixed(2)} (-${detail.ecartPourcent.toFixed(1)} %)`
    );
  }

  if (execute) {
    // Sortie de secours : prisma/annuler-recalcul.ts lit ce fichier.
    writeFileSync("prisma/alertes-creees.json", JSON.stringify(alertesCreees, null, 2));
    console.log(`\nIds enregistrés dans prisma/alertes-creees.json`);
  }

  console.log(
    `\n${execute ? "Fait" : "À faire"} : ${creees} alerte(s) à créer, ${misesAJour} mise(s) à jour (moyen -> élevé).`
  );
}

main().finally(() => prisma.$disconnect());
