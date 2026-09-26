import { headers } from "next/headers";
import { notFound } from "next/navigation";
import AdminStudentDetail from "./AdminStudentDetail";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminStudentPage({ params }: PageProps) {
  const { id } = await params;
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  if (!host) {
    throw new Error("Impossible de déterminer l’origine de la requête.");
  }

  const response = await fetch(`${protocol}://${host}/api/etudiants/${id}`, {
    headers: { cookie: requestHeaders.get("cookie") ?? "" },
    cache: "no-store",
  });

  if (response.status === 404) notFound();
  if (!response.ok) {
    throw new Error("Impossible de récupérer la fiche étudiant.");
  }

  const student = await response.json();
  return <AdminStudentDetail student={student} />;
}
