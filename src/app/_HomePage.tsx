import Image from "next/image";
import Link from "next/link";
import { BlocIdentite, MentionChallenge } from "@/components/IdentitePlateforme";
import { SelecteurLangue } from "@/components/SelecteurLangue";
import {
  IconeEtablissement,
  IconeEvolution,
  IconeRegles,
  IconeTableur,
  IconeVueEnsemble,
} from "@/components/ui/Icones";
import { CHEMINS, type Langue } from "@/lib/i18n/langue";
import { TEXTES } from "@/lib/i18n/textes";

/** Ordre d'affichage des espaces et leur icône (même jeu d'icônes que le reste du site). */
const espaces = [
  { cle: "etudiant", Icone: IconeEvolution },
  { cle: "enseignant", Icone: IconeTableur },
  { cle: "directeur", Icone: IconeEtablissement },
  { cle: "national", Icone: IconeVueEnsemble },
] as const;

const pointsAccessibilite = ["contraste", "police", "lecture", "langue"] as const;

/**
 * Page d'accueil publique (français ou anglais). Contenu entièrement visible
 * dès le chargement : aucune animation ne masque le texte.
 */
export default function HomePage({ langue }: { langue: Langue }) {
  const t = TEXTES[langue];
  const a = t.accueil;
  const connexion = CHEMINS.connexion[langue];
  return (
    <>
      {/* ── EN-TÊTE ── */}
      <header className="bg-ink">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl bg-white p-1">
              <Image src="/armoiries-benin.png" alt={t.commun.armoiriesAlt} height={36} width={36} priority />
            </div>
            <BlocIdentite langue={langue} />
          </div>
          <div className="flex items-center gap-3">
            <SelecteurLangue page="accueil" langue={langue} />
            <Link
              href={connexion}
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-ink transition hover:bg-brand-dark hover:text-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              {a.seConnecter}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── PRÉSENTATION ── */}
        <section className="bg-ink">
          <div className="mx-auto max-w-4xl px-5 py-20 text-center sm:px-8 sm:py-28">
            <h1 className="text-3xl font-bold leading-tight text-surface sm:text-4xl lg:text-5xl">
              {a.titreLigne1}
              <br className="hidden sm:block" /> {a.titreLigne2}
            </h1>
            <p className="mt-4 text-xl font-bold text-brand sm:text-2xl lg:text-3xl">{a.accroche}</p>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-surface/70">{a.presentation}</p>
            <Link
              href={connexion}
              className="mt-10 inline-flex h-12 items-center justify-center rounded-lg bg-brand px-8 text-base font-bold text-ink transition hover:bg-brand-dark hover:text-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              {a.acceder}
            </Link>
          </div>
        </section>

        {/* ── SEUILS D'ALERTE (règles réelles de détection) ── */}
        <section aria-labelledby="titre-seuils" className="bg-page">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <h2 id="titre-seuils" className="text-2xl font-bold text-ink sm:text-3xl">
              {a.titreSeuils}
            </h2>
            <p className="mt-2 max-w-2xl text-ink-secondary">{a.introSeuils}</p>
            <dl className="mt-10 grid gap-x-8 gap-y-6 border-t border-border pt-8 sm:grid-cols-2 lg:grid-cols-4">
              {a.seuils.map((s) => (
                <div key={s.description}>
                  <dt className="text-4xl font-bold tabular-nums text-brand-dark">{s.valeur}</dt>
                  <dd className="mt-2 text-sm font-medium leading-relaxed text-ink-secondary">{s.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── DE LA NOTE À L'ALERTE ── */}
        <section aria-labelledby="titre-etapes" className="bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <h2 id="titre-etapes" className="text-2xl font-bold text-ink sm:text-3xl">
              {a.titreEtapes}
            </h2>
            <ol className="mt-10 grid gap-8 lg:grid-cols-3">
              {a.etapes.map((etape, i) => (
                <li key={etape.titre} className="border-l-2 border-brand pl-5">
                  <p className="text-sm font-bold tabular-nums text-brand-dark">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-1 text-lg font-bold text-ink">{etape.titre}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{etape.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── CE QUE VOIT CHAQUE ACTEUR ── */}
        <section aria-labelledby="titre-espaces" className="bg-page">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <h2 id="titre-espaces" className="text-2xl font-bold text-ink sm:text-3xl">
              {a.titreEspaces}
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {espaces.map(({ cle, Icone }) => {
                const espace = a.espaces[cle];
                return (
                  <section key={cle} aria-labelledby={`espace-${cle}`} className="rounded-2xl border border-border bg-surface p-6">
                    <h3 id={`espace-${cle}`} className="flex items-center gap-2.5 text-lg font-bold text-ink">
                      <Icone className="text-brand-dark" />
                      {espace.titre}
                    </h3>
                    <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-ink-secondary">
                      {espace.capacites.map((c) => (
                        <li key={c} className="border-t border-border pt-2.5 first:border-0 first:pt-0">
                          {c}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── ACCESSIBILITÉ ── */}
        <section aria-labelledby="titre-accessibilite" className="bg-ink">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <h2 id="titre-accessibilite" className="text-2xl font-bold text-surface sm:text-3xl">
              {a.titreAccessibilite}
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {pointsAccessibilite.map((cle) => (
                <li key={cle} className="flex items-start gap-3 text-sm font-semibold text-surface/85">
                  <IconeRegles className="mt-0.5 text-brand" taille={18} />
                  {a.accessibilite[cle]}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      {/* ── PIED DE PAGE ── */}
      <footer className="border-t border-white/10 bg-ink">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-5 py-8 sm:flex-row sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-lg bg-white p-0.5">
              <Image src="/armoiries-benin.png" alt={t.commun.armoiriesAlt} height={24} width={24} />
            </div>
            <div className="text-sm text-surface/60">
              <p>{a.piedDePage}</p>
              <MentionChallenge langue={langue} className="mt-1 text-xs text-surface/50" />
            </div>
          </div>
          <Link
            href={connexion}
            className="text-sm font-semibold text-brand underline decoration-brand/30 underline-offset-2 transition hover:decoration-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {a.seConnecter}
          </Link>
        </div>
      </footer>
    </>
  );
}
