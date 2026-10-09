import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProfilClient from "./_ProfilClient";

export default async function ProfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      nom: true,
      prenom: true,
      email: true,
      role: true,
      createdAt: true,
      etablissement: {
        select: { nom: true, departement: true },
      },
      etudiant: {
        select: {
          nom: true,
          prenom: true,
          niveau: true,
          etablissement: { select: { nom: true } },
        },
      },
    },
  });

  if (!user) redirect("/login");

  return <ProfilClient initialData={user} />;
}
