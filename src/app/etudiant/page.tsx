import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Note = {
  id: string;
  matiere: string;
  valeur: number;
  periode: string;
};

const periodes = ["Trimestre 1", "Trimestre 2", "Trimestre 3"];

function moyenne(notes: Note[]) {
  if (notes.length === 0) return null;
  return notes.reduce((total, note) => total + note.valeur, 0) / notes.length;
}

function tendance(
  anciennesMoyenne: number,
  derniereMoyenne: number
): { titre: string; detail: string; tone: string } {
  const difference = derniereMoyenne - anciennesMoyenne;
  const seuil = 0.1;

  if (Math.abs(difference) <= seuil) {
    return {
      titre: "Ta moyenne est stable",
      detail: `Elle est passée de ${anciennesMoyenne.toFixed(1)}/20 à ${derniereMoyenne.toFixed(1)}/20.`,
      tone: "border-slate-200 bg-slate-100 text-slate-800",
    };
  }

  if (difference > 0) {
    return {
      titre: "Ta moyenne progresse",
      detail: `Elle est passée de ${anciennesMoyenne.toFixed(1)}/20 à ${derniereMoyenne.toFixed(1)}/20.`,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    };
  }

  const baisse = anciennesMoyenne === 0
    ? 0
    : ((anciennesMoyenne - derniereMoyenne) / anciennesMoyenne) * 100;

  return {
    titre: `Ta moyenne a baissé de ${baisse.toFixed(1)}%`,
    detail: `Elle est passée de ${anciennesMoyenne.toFixed(1)}/20 à ${derniereMoyenne.toFixed(1)}/20.`,
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
          <h1 className="text-2xl font-bold">Fiche étudiant indisponible</h1>
          <p className="mt-2 text-lg">Aucun étudiant n’est associé à ce compte. Contacte l’administration pour mettre ton profil à jour.</p>
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
        select: { id: true, matiere: true, valeur: true, periode: true },
      },
    },
  });

  if (!etudiant) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
          <h1 className="text-2xl font-bold">Fiche étudiant introuvable</h1>
          <p className="mt-2 text-lg">Ton compte est associé à une fiche qui n’existe plus. Contacte l’administration.</p>
        </div>
      </main>
    );
  }

  const groupes = periodes.map((periode) => {
    const notes = etudiant.notes.filter((note) => note.periode === periode);
    return { periode, notes, moyenne: moyenne(notes) };
  });
  const groupesAvecNotes = groupes.filter((groupe) => groupe.moyenne !== null);
  const derniere = groupesAvecNotes.at(-1);
  const avantDerniere = groupesAvecNotes.at(-2);
  const resume = derniere && avantDerniere
    ? tendance(avantDerniere.moyenne as number, derniere.moyenne as number)
    : null;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">Mon suivi scolaire</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Bonjour, {etudiant.prenom}
        </h1>
        <p className="mt-3 text-lg leading-8 text-slate-700">Voici un aperçu de tes résultats, période par période.</p>
      </div>

      <section aria-labelledby="profile-title" className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="profile-title" className="text-xl font-bold text-slate-950">Mes informations</h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-3">
          <div>
            <dt className="text-sm font-semibold text-slate-600">Nom et prénom</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-950">{etudiant.nom} {etudiant.prenom}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-600">Établissement</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-950">{etudiant.etablissement.nom}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-600">Niveau</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-950">{etudiant.niveau}</dd>
          </div>
        </dl>
      </section>

      {resume && (
        <section aria-labelledby="trend-title" className={`mt-6 rounded-xl border p-6 shadow-sm ${resume.tone}`}>
          <p className="text-sm font-semibold uppercase tracking-[0.14em]">Évolution</p>
          <h2 id="trend-title" className="mt-1 text-2xl font-bold">{resume.titre}</h2>
          <p className="mt-2 text-lg">{resume.detail}</p>
        </section>
      )}

      <section aria-labelledby="grades-title" className="mt-8">
        <div className="flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-700">Résultats</p>
            <h2 id="grades-title" className="mt-1 text-2xl font-bold text-slate-950">Mes notes</h2>
          </div>
          <p className="text-sm text-slate-600">{etudiant.notes.length} note{etudiant.notes.length > 1 ? "s" : ""}</p>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {groupes.map((groupe) => (
            <section key={groupe.periode} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 px-5 py-4">
                <h3 className="font-bold text-slate-950">{groupe.periode}</h3>
                {groupe.moyenne !== null && <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-teal-900">Moy. {groupe.moyenne.toFixed(1)}/20</span>}
              </div>
              {groupe.notes.length > 0 ? (
                <div className="divide-y divide-slate-200">
                  {groupe.notes.map((note) => (
                    <div key={note.id} className="flex items-center justify-between gap-4 px-5 py-3">
                      <span className="font-medium text-slate-800">{note.matiere}</span>
                      <span className="font-bold text-slate-950">{note.valeur}/20</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-5 py-5 text-slate-600">Aucune note pour cette période.</p>
              )}
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
