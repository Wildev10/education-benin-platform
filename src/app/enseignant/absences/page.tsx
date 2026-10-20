import type { Metadata } from "next";
import { PageAbsences } from "@/components/absences/PageAbsences";

export const metadata: Metadata = {
  title: "Absences — EduTech Bénin",
};

export default function AbsencesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PageAbsences chemin="/enseignant/absences" searchParams={searchParams} />;
}
