import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { peutAccederEtudiant } from "@/lib/perimetre";
import AdminStudentDetail from "./AdminStudentDetail";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminStudentPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Lecture directe en base : plus d'appel HTTP à /api/etudiants/[id] depuis le serveur
  const etudiant = await prisma.etudiant.findUnique({
    where: { id },
    select: {
      id: true,
      nom: true,
      prenom: true,
      dateNaissance: true,
      sexe: true,
      niveau: true,
      etablissementId: true,
      etablissement: { select: { nom: true, departement: true, commune: true } },
      notes: { select: { id: true, matiere: true, valeur: true, periode: true, anneeScolaire: true, createdAt: true } },
      alertes: {
        select: {
          id: true,
          niveauRisque: true,
          periode: true,
          moyenneAvant: true,
          moyenneApres: true,
          ecartPourcent: true,
          statut: true,
          createdAt: true,
        },
      },
      absences: {
        select: { id: true, date: true, motif: true, periode: true, anneeScolaire: true },
        orderBy: { date: "desc" },
      },
    },
  });

  // Hors périmètre : même page que si l'élève n'existait pas
  if (!etudiant || !peutAccederEtudiant(session.user, etudiant)) notFound();

  const student = {
    ...etudiant,
    dateNaissance: etudiant.dateNaissance.toISOString(),
    notes: etudiant.notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
    alertes: etudiant.alertes.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    absences: etudiant.absences.map((a) => ({ ...a, date: a.date.toISOString() })),
  };
  return <AdminStudentDetail student={student} />;
}
