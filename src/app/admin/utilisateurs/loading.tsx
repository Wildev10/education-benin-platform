import { Bloc, Ligne, PageSquelette, SquelettePagination, SqueletteTableau } from "@/components/ui/Squelette";

export default function UtilisateursLoading() {
  return (
    <PageSquelette libelle="Chargement des comptes">
      <div className="flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Ligne largeur="w-36" />
          <Ligne hauteur="h-9 sm:h-10" largeur="w-96" className="mt-2" />
          <Ligne hauteur="h-6" largeur="w-48" className="mt-2" />
        </div>
        <Bloc className="h-[42px] w-44 rounded-lg" />
      </div>
      <div className="mt-8">
        <SqueletteTableau
          colonnes={[
            "w-36",
            { largeur: "w-48", cellule: "hidden sm:block" },
            "w-28",
            { largeur: "w-24", cellule: "hidden lg:block" },
            "ml-auto w-32",
          ]}
          lignes={10}
          hauteurLigne="h-[69px]"
        />
        <SquelettePagination />
      </div>
    </PageSquelette>
  );
}
