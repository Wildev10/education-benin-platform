import {
  Ligne,
  PageSquelette,
  SqueletteAccordeon,
  SqueletteCarteTrimestre,
  SqueletteEntete,
} from "@/components/ui/Squelette";

function TitreSection() {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
      <div>
        <Ligne largeur="w-24" />
        <Ligne hauteur="h-8" largeur="w-40" className="mt-1" />
      </div>
      <Ligne largeur="w-28" />
    </div>
  );
}

export default function EtudiantLoading() {
  return (
    <PageSquelette libelle="Chargement de ton suivi">
      <SqueletteEntete largeurTitre="w-64" bouton />

      <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <Ligne hauteur="h-7" largeur="w-40" />
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          {["w-32", "w-48", "w-28"].map((largeur, i) => (
            <div key={i}>
              <Ligne largeur="w-24" />
              <Ligne hauteur="h-7" largeur={largeur} className="mt-1" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <Ligne largeur="w-24" />
        <Ligne hauteur="h-8" largeur="w-64" className="mt-1" />
        <Ligne hauteur="h-7" largeur="w-80" className="mt-2" />
      </div>

      <div className="mt-8">
        <TitreSection />
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SqueletteCarteTrimestre key={i} />
          ))}
        </div>
      </div>

      <div className="mt-8">
        <TitreSection />
        <div className="mt-5">
          <SqueletteAccordeon />
        </div>
      </div>
    </PageSquelette>
  );
}
