import {
  Ligne,
  PageSquelette,
  SqueletteCarteStat,
  SqueletteEntete,
  SqueletteGraphiqueBarres,
  SqueletteGraphiqueLigne,
} from "@/components/ui/Squelette";

function CarteSection({ children, sansDescription = false }: { children: React.ReactNode; sansDescription?: boolean }) {
  return (
    <div className="min-w-0 rounded-[14px] border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="border-b border-border pb-4">
        <Ligne largeur="w-24" />
        <Ligne hauteur="h-7" largeur="w-56" className="mt-1" />
        {!sansDescription && <Ligne largeur="w-72" className="mt-1.5" />}
      </div>
      {children}
    </div>
  );
}

function ListeEleves() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-3">
          <div>
            <Ligne hauteur="h-6" largeur="w-40" />
            <Ligne largeur="w-28" className="mt-0.5" />
          </div>
          <Ligne largeur="w-20" />
        </div>
      ))}
    </div>
  );
}

export default function DirecteurLoading() {
  return (
    <PageSquelette libelle="Chargement du tableau de bord">
      <SqueletteEntete bouton />

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={i === 4 ? "col-span-2 lg:col-span-1" : ""}>
            <SqueletteCarteStat sousTitre />
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <CarteSection>
          <SqueletteGraphiqueLigne className="mt-5 h-64" />
        </CarteSection>
        <CarteSection>
          <SqueletteGraphiqueBarres className="mt-5 h-64" barres={4} />
        </CarteSection>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <CarteSection>
          <ListeEleves />
        </CarteSection>
        <CarteSection sansDescription>
          <ListeEleves />
        </CarteSection>
      </div>
    </PageSquelette>
  );
}
