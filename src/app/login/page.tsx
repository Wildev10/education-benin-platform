import type { Metadata } from "next";
import LoginPageClient from "./_LoginPage";

export const metadata: Metadata = {
  title: "Connexion — EduTech Bénin",
  description: "Accédez à votre espace EduTech Bénin.",
};

export default function LoginPage() {
  return <LoginPageClient />;
}
