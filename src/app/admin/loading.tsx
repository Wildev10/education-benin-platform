import {
  Bloc,
  Ligne,
  PageSquelette,
  SqueletteCarteAlerte,
  SqueletteCarteStat,
  SqueletteEntete,
  SqueletteGraphiqueBarres,
  SqueletteTableau,
  SqueletteTitreSection,
} from "@/components/ui/Squelette";

export default function AdminLoading() {
  return (
    <PageSquelette libelle="Chargement du tableau de bord">
      <SqueletteEntete largeurTitre="w-80" />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[false, false, false, true].map((sousTitre, i) => (
          <SqueletteCarteStat key={i} icone sousTitre={sousTitre} />
        ))}
      </div>

      {/* Alertes à examiner */}
      <div className="mt-10">
        <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
          <div>
            <Ligne largeur="w-36" />
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-3">
              <Ligne hauteur="h-8" largeur="w-56" />
              <Bloc className="h-[42px] w-48 rounded-lg" />
              <Bloc className="h-[42px] w-40 rounded-lg" />
            </div>
            <Ligne hauteur="h-6" largeur="w-[30rem]" className="mt-2" />
          </div>
          <div className="flex gap-2">
            {["w-20", "w-16", "w-20"].map((largeur, i) => (
              <Bloc key={i} className={`h-[38px] rounded-lg ${largeur}`} />
            ))}
          </div>
        </div>
        <div className="mt-6 grid gap-4">
          {[0, 1, 2].map((i) => (
            <SqueletteCarteAlerte key={i} colonnes={3} bouton />
          ))}
        </div>
      </div>

      {/* Établissements */}
      <div className="mt-14 border-t-2 border-border pt-10">
        <div className="border-b border-border pb-5">
          <SqueletteTitreSection largeur="w-40" />
          <Ligne hauteur="h-6" largeur="w-[30rem]" className="mt-2" />
        </div>
        <div className="mt-6">
          <SqueletteTableau colonnes={["w-40", "w-10", "w-10", "w-10", "w-16", "w-32", "w-28"]} lignes={6} hauteurLigne="h-[69px]" />
        </div>
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
          <Ligne hauteur="h-7" largeur="w-72" />
          <SqueletteGraphiqueBarres className="mt-4 h-64" />
        </div>
      </div>
    </PageSquelette>
  );
}
