import {
  Bloc,
  Ligne,
  PageSquelette,
  SqueletteAccordeon,
  SqueletteCarteTrimestre,
  SqueletteGraphiqueLigne,
  SqueletteTitreSection,
} from "@/components/ui/Squelette";

export default function AdminStudentDetailLoading() {
  return (
    <PageSquelette libelle="Chargement de la fiche étudiant">
      <Bloc className="h-[38px] w-48 rounded-lg" />

      <div className="mt-6 border-b border-border pb-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Ligne largeur="w-32" />
            <Ligne hauteur="h-9 sm:h-10" largeur="w-72" className="mt-2" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Bloc className="h-[42px] w-40 rounded-lg" />
            <Bloc className="h-[42px] w-40 rounded-lg" />
          </div>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {["w-48", "w-28", "w-32", "w-12"].map((largeur, i) => (
            <div key={i}>
              <Ligne largeur="w-28" />
              <Ligne hauteur="h-7" largeur={largeur} className="mt-1" />
            </div>
          ))}
        </div>
        <Ligne largeur="w-48" className="mt-4" />
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <SqueletteTitreSection />
        <Ligne largeur="w-64" className="mt-2" />
        <SqueletteGraphiqueLigne className="mt-6 h-72" />
      </div>

      <div className="mt-10">
        <SqueletteTitreSection largeur="w-80" />
        <div className="mt-5">
          <SqueletteAccordeon />
        </div>
      </div>

      <div className="mt-10">
        <SqueletteTitreSection />
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SqueletteCarteTrimestre key={i} />
          ))}
        </div>
      </div>
    </PageSquelette>
  );
}
