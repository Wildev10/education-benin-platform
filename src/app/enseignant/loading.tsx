import {
  PageSquelette,
  SqueletteCarteStat,
  SqueletteEntete,
  SqueletteRepertoireEleves,
} from "@/components/ui/Squelette";

export default function EnseignantLoading() {
  return (
    <PageSquelette libelle="Chargement de la liste des élèves">
      <SqueletteEntete className="max-w-2xl" largeurTitre="w-64" />
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[false, false, false, true].map((sousTitre, i) => (
          <SqueletteCarteStat key={i} sousTitre={sousTitre} />
        ))}
      </div>
      <SqueletteRepertoireEleves />
    </PageSquelette>
  );
}
