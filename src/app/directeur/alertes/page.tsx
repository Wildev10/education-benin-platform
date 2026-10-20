import type { Metadata } from "next";
import { PageAlertes } from "@/components/alertes/PageAlertes";

export const metadata: Metadata = {
  title: "Alertes — EduTech Bénin",
};

export default function AlertesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PageAlertes chemin="/directeur/alertes" searchParams={searchParams} />;
}
