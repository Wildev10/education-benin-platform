import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { verifierBaseNonProtegee } from "./garde-prod";

// Sortie de secours : supprime UNIQUEMENT les alertes listées dans
// prisma/alertes-creees.json (créées par recalculer-alertes.ts --execute).
//   npx tsx prisma/annuler-recalcul.ts            -> simulation (n'écrit rien)
//   npx tsx prisma/annuler-recalcul.ts --execute  -> supprime
const execute = process.argv.includes("--execute");
if (execute) verifierBaseNonProtegee();

const prisma = new PrismaClient();

async function main() {
  const ids: string[] = JSON.parse(readFileSync("prisma/alertes-creees.json", "utf8"));
  const existantes = await prisma.alerte.findMany({
    where: { id: { in: ids } },
    include: { etudiant: { select: { nom: true, prenom: true } } },
  });
  console.log(`${execute ? "EXÉCUTION" : "SIMULATION"} : ${existantes.length}/${ids.length} alerte(s) trouvée(s)\n`);
  for (const a of existantes) {
    console.log(`SUPPRIMER ${a.id} : ${a.etudiant.prenom} ${a.etudiant.nom}, ${a.periode}, risque ${a.niveauRisque}, ${a.statut}`);
  }
  if (execute) {
    const { count } = await prisma.alerte.deleteMany({ where: { id: { in: ids } } });
    console.log(`\n${count} alerte(s) supprimée(s).`);
  }
}

main().finally(() => prisma.$disconnect());
