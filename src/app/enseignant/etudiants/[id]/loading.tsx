import {
  Bloc,
  Ligne,
  PageSquelette,
  SqueletteAccordeon,
  SqueletteCarteTrimestre,
  SqueletteChamp,
} from "@/components/ui/Squelette";

function TitreListe() {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
      <div>
        <Ligne largeur="w-24" />
        <Ligne hauteur="h-8" largeur="w-56" className="mt-1" />
      </div>
      <Bloc className="h-[30px] w-20 rounded-full" />
    </div>
  );
}

function Formulaire({ champs }: { champs: string[] }) {
  return (
    <div className="h-fit rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <Ligne largeur="w-24" />
      <Ligne hauteur="h-8" largeur="w-48" className="mt-1" />
      <Ligne largeur="w-44" className="mt-1" />
      <div className="mt-6 space-y-4">
        {champs.map((libelle, i) => (
          <SqueletteChamp key={i} libelle={libelle} />
        ))}
        <Bloc className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function StudentDetailLoading() {
  return (
    <PageSquelette libelle="Chargement de la fiche étudiant">
      <div className="mb-8 flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Ligne largeur="w-32" />
          <Ligne hauteur="h-9 sm:h-10" largeur="w-64" className="mt-2" />
          <div className="mt-4 flex flex-wrap gap-3">
            <Bloc className="h-[34px] w-48 rounded-full" />
            <Bloc className="h-[34px] w-28 rounded-full" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Bloc className="h-[42px] w-40 rounded-lg" />
          <Bloc className="h-[42px] w-40 rounded-lg" />
        </div>
      </div>

      <div className="space-y-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <div>
            <TitreListe />
            <div className="mt-5">
              <SqueletteAccordeon />
            </div>
          </div>
          <Formulaire champs={["w-16", "w-24", "w-16"]} />
        </div>
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <div>
            <TitreListe />
            <div className="mt-5 space-y-4">
              {[0, 1, 2].map((i) => (
                <SqueletteCarteTrimestre key={i} lignes={1} />
              ))}
            </div>
          </div>
          <Formulaire champs={["w-10", "w-12", "w-16"]} />
        </div>
      </div>
    </PageSquelette>
  );
}
