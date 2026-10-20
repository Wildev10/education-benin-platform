import { Bloc, Ligne, SqueletteChamp } from "@/components/ui/Squelette";

export default function NouveauCompteLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8" aria-busy="true">
      <p role="status" className="sr-only">Chargement du formulaire…</p>
      <Bloc className="h-[38px] w-52 rounded-lg" />
      <div className="mt-6">
        <Ligne largeur="w-36" />
        <Ligne hauteur="h-9" largeur="w-64" className="mt-2" />
        <Ligne hauteur="h-6" largeur="w-full" className="mt-2" />
      </div>
      <div className="mt-8 space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="grid gap-5 sm:grid-cols-2">
          <SqueletteChamp libelle="w-16" />
          <SqueletteChamp libelle="w-12" />
        </div>
        <SqueletteChamp libelle="w-12" />
        <SqueletteChamp libelle="w-10" />
        <Bloc className="h-12 w-full rounded-lg" />
      </div>
    </main>
  );
}
