"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cadre de défilement horizontal d'un tableau trop large pour l'écran : une ombre
 * au bord indique qu'il reste des colonnes à voir. Quand il défile, le cadre est
 * atteignable au clavier (flèches) et nommé pour les lecteurs d'écran. Il est
 * positionné, pour que les textes réservés aux lecteurs d'écran restent dedans.
 */
export function CadreDefilant({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [bords, setBords] = useState({ gauche: false, droite: false });

  useEffect(() => {
    const cadre = ref.current;
    if (!cadre) return;
    const mettreAJour = () =>
      setBords({
        gauche: cadre.scrollLeft > 1,
        droite: cadre.scrollLeft + cadre.clientWidth < cadre.scrollWidth - 1,
      });
    cadre.addEventListener("scroll", mettreAJour, { passive: true });
    // Appelé une première fois dès l'observation, puis à chaque changement de taille
    const observateur = new ResizeObserver(mettreAJour);
    observateur.observe(cadre);
    if (cadre.firstElementChild) observateur.observe(cadre.firstElementChild);
    return () => {
      cadre.removeEventListener("scroll", mettreAJour);
      observateur.disconnect();
    };
  }, []);

  const defile = bords.gauche || bords.droite;
  return (
    <div className="relative">
      <div
        ref={ref}
        className="relative overflow-x-auto focus-visible:outline-offset-[-3px]"
        role={defile ? "region" : undefined}
        aria-label={defile ? `${libelle} (faire défiler horizontalement)` : undefined}
        tabIndex={defile ? 0 : undefined}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className={`cadre-ombre pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-ink/20 to-transparent transition-opacity ${bords.gauche ? "opacity-100" : "opacity-0"}`}
      />
      <div
        aria-hidden="true"
        className={`cadre-ombre pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-ink/20 to-transparent transition-opacity ${bords.droite ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
