import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("password123", 10);

  // Admin/ministère
  await prisma.user.upsert({
    where: { email: "admin@edutech.bj" },
    update: {},
    create: {
      email: "admin@edutech.bj",
      passwordHash: password,
      nom: "Ministère",
      prenom: "Admin",
      role: "admin",
    },
  });

  // Enseignant
  await prisma.user.upsert({
    where: { email: "enseignant@edutech.bj" },
    update: {},
    create: {
      email: "enseignant@edutech.bj",
      passwordHash: password,
      nom: "Test",
      prenom: "Prof",
      role: "enseignant",
    },
  });

  // Étudiant — lié au premier étudiant existant dans la base
  const premierEtudiant = await prisma.etudiant.findFirst();
  if (premierEtudiant) {
    await prisma.user.upsert({
      where: { email: "etudiant@edutech.bj" },
      update: {},
      create: {
        email: "etudiant@edutech.bj",
        passwordHash: password,
        nom: premierEtudiant.nom,
        prenom: premierEtudiant.prenom,
        role: "etudiant",
        etudiantId: premierEtudiant.id,
      },
    });
  }

  console.log("✅ Comptes de test créés :");
  console.log("   admin@edutech.bj / password123");
  console.log("   enseignant@edutech.bj / password123");
  console.log("   etudiant@edutech.bj / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });