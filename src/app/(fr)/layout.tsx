import { MiseEnPageRacine, metadataRacine, viewportRacine } from "../_MiseEnPageRacine";

export const metadata = metadataRacine;
export const viewport = viewportRacine;

/** Mise en page racine du site en français (tout sauf /en et /en/login). */
export default function RacineFrancais({ children }: { children: React.ReactNode }) {
  return <MiseEnPageRacine langue="fr">{children}</MiseEnPageRacine>;
}
