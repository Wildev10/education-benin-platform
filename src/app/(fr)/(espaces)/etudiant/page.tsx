import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ExportExcelButton } from "@/components/ExportPdfButton";
import { AccordeonTrimestres } from "@/components/notes/AccordeonTrimestres";
import { BlocAnnee } from "@/components/notes/BlocAnnee";
import { periodeScolaireAuBenin } from "@/lib/annee-scolaire";
import { formaterNombre, formaterPourcent } from "@/lib/format";
import {
  grouperNotesParAnnee,
  grouperParAnnee,
  libellePeriode,
  moyennesChronologiques,
  type PeriodeScolaire,
} from "@/lib/notes-trimestres";

type PointMoyenne = PeriodeScolaire & { moyenne: number };

function tendance(avant: PointMoyenne, apres: PointMoyenne): { titre: string; detail: string; tone: string } {
  const anciennesMoyenne = avant.moyenne;
  const derniereMoyenne = apres.moyenne;
  const difference = derniereMoyenne - anciennesMoyenne;
  const seuil = 0.1;
  // Les deux trimestres comparés, avec leur année : jamais deux « Trimestre 1 » confondus
  const detail = `Elle est passée de ${formaterNombre(anciennesMoyenne)}/20 (${libellePeriode(avant.periode, avant.anneeScolaire)}) à ${formaterNombre(derniereMoyenne)}/20 (${libellePeriode(apres.periode, apres.anneeScolaire)}).`;

  if (Math.abs(difference) <= seuil) {
    return {
      titre: "Ta moyenne est stable",
      detail,
      tone: "border-border bg-page text-ink-secondary",
    };
  }

  if (difference > 0) {
    return {
      titre: "Ta moyenne progresse",
      detail,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    };
  }

  const baisse = anciennesMoyenne === 0
    ? 0
    : ((anciennesMoyenne - derniereMoyenne) / anciennesMoyenne) * 100;

  return {
    titre: `Ta moyenne a baissé de ${formaterPourcent(baisse)}`,
    detail,
    tone: "border-amber-200 bg-amber-50 text-amber-950",
  };
}

export default async function EtudiantPage() {
  const session = await auth();
  const etudiantId = session?.user?.etudiantId;

  if (!etudiantId) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
          <h1 className="text-2xl font-semibold">Fiche étudiant indisponible</h1>
          <p className="mt-2 text-lg">Aucun étudiant n&apos;est associé à ce compte. Contacte l&apos;administration pour mettre ton profil à jour.</p>
        </div>
      </main>
    );
  }

  const etudiant = await prisma.etudiant.findUnique({
    where: { id: etudiantId },
    select: {
      nom: true,
      prenom: true,
      niveau: true,
      etablissement: { select: { nom: true } },
      notes: {
        orderBy: [{ periode: "asc" }, { createdAt: "desc" }],
        select: { id: true, matiere: true, valeur: true, periode: true, anneeScolaire: true },
      },
      absences: {
        select: { periode: true, motif: true, anneeScolaire: true },
      },
    },
  });

  if (!etudiant) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
          <h1 className="text-2xl font-semibold">Fiche étudiant introuvable</h1>
          <p className="mt-2 text-lg">Ton compte est associé à une fiche qui n&apos;existe plus. Contacte l&apos;administration.</p>
        </div>
      </main>
    );
  }

  const enCours = periodeScolaireAuBenin(new Date());
  const annees = grouperNotesParAnnee(etudiant.notes, enCours.anneeScolaire);
  const absencesParAnnee = grouperParAnnee(etudiant.absences, enCours.anneeScolaire);
  // Les deux derniers trimestres qui ont des notes, dans l'ordre chronologique (années comprises)
  const points = moyennesChronologiques(etudiant.notes);
  const derniere = points.at(-1);
  const avantDerniere = points.at(-2);
  const resume = derniere && avantDerniere ? tendance(avantDerniere, derniere) : null;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">Mon suivi scolaire</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Bonjour, {etudiant.prenom}
        </h1>
        <p className="mt-3 text-lg leading-8 text-ink-secondary">Voici tes résultats par période.</p>
        <div className="mt-5">
          <ExportExcelButton
            href={`/api/etudiants/${etudiantId}/xlsx`}
            label="Télécharger ma fiche (Excel)"
            fichierParDefaut="ma-fiche.xlsx"
          />
        </div>
      </div>

      <section aria-labelledby="profile-title" className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 id="profile-title" className="text-xl font-semibold text-ink">Mes informations</h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-3">
          <div>
            <dt className="text-sm font-semibold text-ink-secondary">Nom et prénom</dt>
            <dd className="mt-1 text-lg font-semibold text-ink">{etudiant.nom} {etudiant.prenom}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-secondary">Établissement</dt>
            <dd className="mt-1 text-lg font-semibold text-ink">{etudiant.etablissement.nom}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-secondary">Niveau</dt>
            <dd className="mt-1 text-lg font-semibold text-ink">{etudiant.niveau}</dd>
          </div>
        </dl>
      </section>

      {resume && (
        <section aria-labelledby="trend-title" className={`mt-6 rounded-2xl border p-6 shadow-sm ${resume.tone}`}>
          <p className="text-sm font-semibold uppercase tracking-[0.14em]">Évolution</p>
          <h2 id="trend-title" className="mt-1 text-2xl font-semibold">{resume.titre}</h2>
          <p className="mt-2 text-lg">{resume.detail}</p>
        </section>
      )}

      <section aria-labelledby="absences-title" className="mt-8">
        <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">Présence</p>
            <h2 id="absences-title" className="mt-1 text-2xl font-semibold text-ink">Mes absences</h2>
          </div>
          <p className="text-sm text-ink-secondary">{etudiant.absences.length} absence{etudiant.absences.length > 1 ? "s" : ""} au total</p>
        </div>
        <div className="mt-5 space-y-8">
          {absencesParAnnee.map(({ anneeScolaire, trimestres }) => {
            const total = trimestres.reduce((n, t) => n + t.elements.length, 0);
            return (
              <BlocAnnee
                key={anneeScolaire}
                anneeScolaire={anneeScolaire}
                enCours={enCours.anneeScolaire}
                resume={`${total} absence${total > 1 ? "s" : ""}`}
              >
                <div className="grid gap-5 lg:grid-cols-3">
                  {trimestres.map((groupe) => {
                    const absPeriode = groupe.elements;
                    const injustifiees = absPeriode.filter((a) => a.motif === "injustifiee").length;
                    const justifiees = absPeriode.filter((a) => a.motif === "justifiee").length;
                    return (
                      <section key={groupe.periode} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
                        <div className="flex items-center justify-between gap-3 border-b border-border bg-ink px-5 py-4">
                          <h4 className="font-semibold text-surface">{groupe.periode}</h4>
                          <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-surface">
                            {absPeriode.length} absence{absPeriode.length > 1 ? "s" : ""}
                          </span>
                        </div>
                        {absPeriode.length > 0 ? (
                          <div className="divide-y divide-border">
                            <div className="flex items-center justify-between px-5 py-3">
                              <span className="text-sm font-medium text-ink-secondary">Injustifiées</span>
                              <span className="font-semibold text-ink">{injustifiees}</span>
                            </div>
                            <div className="flex items-center justify-between px-5 py-3">
                              <span className="text-sm font-medium text-ink-secondary">Justifiées</span>
                              <span className="font-semibold text-ink">{justifiees}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="px-5 py-5 text-ink-secondary">Aucune absence enregistrée.</p>
                        )}
                      </section>
                    );
                  })}
                </div>
              </BlocAnnee>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="grades-title" className="mt-8">
        <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">Résultats</p>
            <h2 id="grades-title" className="mt-1 text-2xl font-semibold text-ink">Mes notes</h2>
          </div>
          <p className="text-sm text-ink-secondary">{etudiant.notes.length} note{etudiant.notes.length > 1 ? "s" : ""}</p>
        </div>
        <div className="mt-5">
          <AccordeonTrimestres annees={annees} enCours={enCours} notesColorees={false} />
        </div>
      </section>
    </main>
  );
}
