import { auth } from "@/auth";
import { redirect } from "next/navigation";
import HomePage from "./_HomePage";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    return <HomePage />;
  }

  switch (session.user.role) {
    case "admin":
      redirect("/admin");
    case "enseignant":
      redirect("/enseignant");
    case "directeur":
      redirect("/directeur");
    case "etudiant":
      redirect("/etudiant");
    default:
      redirect("/login");
  }
}
