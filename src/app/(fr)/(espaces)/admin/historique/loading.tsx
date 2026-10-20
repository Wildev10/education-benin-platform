import {
  Ligne,
  PageSquelette,
  SquelettePagination,
  SqueletteChamp,
  SqueletteTableau,
} from "@/components/ui/Squelette";

export default function HistoriqueLoading() {
  return (
    <PageSquelette libelle="Chargement de l'historique">
      <div className="border-b border-border pb-7">
        <Ligne largeur="w-36" />
        <Ligne hauteur="h-9 sm:h-10" largeur="w-96" className="mt-2" />
        <Ligne hauteur="h-6" largeur="w-[28rem]" className="mt-2" />
      </div>
      <div className="mt-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
          <SqueletteChamp libelle="w-28" className="flex flex-col" />
          <SqueletteChamp libelle="w-24" className="flex flex-col" />
        </div>
        <div className="mt-6">
          <SqueletteTableau colonnes={["w-36", "w-44", "w-28", "w-64"]} lignes={10} />
        </div>
        <SquelettePagination />
      </div>
    </PageSquelette>
  );
}
