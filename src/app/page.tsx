import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  switch (session.user.role) {
    case "admin":
      redirect("/admin");
    case "enseignant":
      redirect("/enseignant");
    case "etudiant":
      redirect("/etudiant");
    default:
      redirect("/login");
  }
}