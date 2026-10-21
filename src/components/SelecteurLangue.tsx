import { LANGUES, lienChangementLangue, type Langue, type PagePublique } from "@/lib/i18n/langue";
import { TEXTES } from "@/lib/i18n/textes";

/**
 * Sélecteur FR / EN des pages publiques. De simples liens (sans JavaScript) :
 * le proxy enregistre le choix dans un cookie, puis redirige vers la page dans
 * la langue choisie. Balises <a> et non <Link>, pour qu'aucun préchargement
 * ne modifie le cookie à l'insu de l'utilisateur.
 */
export function SelecteurLangue({
  page,
  langue,
  variante = "sombre",
}: {
  page: PagePublique;
  langue: Langue;
  variante?: "sombre" | "clair";
}) {
  const t = TEXTES[langue].selecteurLangue;
  const sombre = variante === "sombre";
  return (
    <nav aria-label={t.libelle} data-selecteur-langue="">
      <ul className={`flex rounded-lg border p-0.5 text-xs font-bold ${sombre ? "border-white/20" : "border-border bg-surface"}`}>
        {LANGUES.map((l) => {
          const active = l === langue;
          return (
            <li key={l}>
              <a
                href={lienChangementLangue(page, l)}
                hrefLang={l}
                lang={l}
                aria-current={active ? "true" : undefined}
                className={`flex min-h-9 min-w-10 items-center tactile:min-h-11 tactile:min-w-11 justify-center rounded-md px-2.5 uppercase tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark ${
                  active
                    ? sombre
                      ? "bg-white/15 text-surface"
                      : "bg-ink text-surface"
                    : sombre
                      ? "text-surface/60 hover:text-surface"
                      : "text-ink-secondary hover:text-ink"
                }`}
              >
                {l.toUpperCase()}
                <span className="sr-only"> — {TEXTES[langue].selecteurLangue[l]}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
