import { MiseEnPageRacine, metadataRacine, viewportRacine } from "../_MiseEnPageRacine";

export const metadata = metadataRacine;
export const viewport = viewportRacine;

/** Mise en page racine des pages publiques en anglais (/en et /en/login). */
export default function RacineAnglais({ children }: { children: React.ReactNode }) {
  return <MiseEnPageRacine langue="en">{children}</MiseEnPageRacine>;
}
