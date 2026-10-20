import { PageSquelette, SqueletteEntete, SqueletteRepertoireEleves } from "@/components/ui/Squelette";

export default function AdminEtudiantsLoading() {
  return (
    <PageSquelette libelle="Chargement de la liste des étudiants">
      <SqueletteEntete />
      <SqueletteRepertoireEleves admin />
    </PageSquelette>
  );
}
