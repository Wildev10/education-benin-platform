import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { detecterAlerte } from "@/lib/detection-alerte";
import { prisma } from "@/lib/prisma";

const TAILLE_MAX = 1 * 1024 * 1024; // 1 Mo

const MATIERES_VALIDES = new Set([
  "Mathématiques",
  "Physique-Chimie",
  "SVT",
  "Français",
  "Anglais",
  "Histoire-Géo",
]);

const PERIODES_VALIDES = new Set(["Trimestre 1", "Trimestre 2", "Trimestre 3"]);

const ANNEE_REGEX = /^\d{4}-\d{4}$/;

type LigneErreur = { ligne: number; contenu: string; raison: string };

export async function POST(request: Request) {
  const access = await requireRole(["admin", "enseignant"]);
  if (access instanceof Response) return access;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Corps de la requête invalide." }, { status: 400 });
  }

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File)) {
    return NextResponse.json({ error: "Champ \"fichier\" manquant ou invalide." }, { status: 400 });
  }
  if (fichier.size > TAILLE_MAX) {
    return NextResponse.json({ error: "Le fichier dépasse la taille maximale de 1 Mo." }, { status: 413 });
  }

  const texte = await fichier.text();
  const lignesRaw = texte.split(/\r?\n/);

  // Ignore la ligne d'en-tête (première ligne non vide)
  const lignesData = lignesRaw.slice(1);

  let importees = 0;
  let alertesCreees = 0;
  const erreurs: LigneErreur[] = [];
  let numeroLigne = 1; // 1 = en-tête, donc data commence à 2

  // Cache email → etudiantId pour éviter les requêtes répétées
  const cacheEmail = new Map<string, string | null>();

  for (const ligneRaw of lignesData) {
    numeroLigne++;
    const ligne = ligneRaw.trim();
    if (ligne === "") continue; // ligne vide ignorée silencieusement

    const colonnes = ligne.split(",").map((c) => c.trim());
    if (colonnes.length < 5) {
      erreurs.push({ ligne: numeroLigne, contenu: ligne, raison: "Format invalide : 5 colonnes attendues (email_etudiant,matiere,valeur,periode,anneeScolaire)." });
      continue;
    }

    const [emailEtudiant, matiere, valeurStr, periode, anneeScolaire] = colonnes;

    // Validation matière
    if (!MATIERES_VALIDES.has(matiere)) {
      erreurs.push({ ligne: numeroLigne, contenu: ligne, raison: `Matière inconnue : "${matiere}". Valeurs acceptées : ${[...MATIERES_VALIDES].join(", ")}.` });
      continue;
    }

    // Validation valeur
    const valeur = Number(valeurStr);
    if (!Number.isFinite(valeur) || valeur < 0 || valeur > 20) {
      erreurs.push({ ligne: numeroLigne, contenu: ligne, raison: `Valeur invalide : "${valeurStr}". La note doit être un nombre entre 0 et 20.` });
      continue;
    }

    // Validation période
    if (!PERIODES_VALIDES.has(periode)) {
      erreurs.push({ ligne: numeroLigne, contenu: ligne, raison: `Période inconnue : "${periode}". Valeurs acceptées : Trimestre 1, Trimestre 2, Trimestre 3.` });
      continue;
    }

    // Validation année scolaire
    if (!ANNEE_REGEX.test(anneeScolaire)) {
      erreurs.push({ ligne: numeroLigne, contenu: ligne, raison: `Année scolaire invalide : "${anneeScolaire}". Format attendu : YYYY-YYYY.` });
      continue;
    }

    // Résolution email → etudiantId (avec cache)
    let etudiantId: string | null | undefined = cacheEmail.get(emailEtudiant);
    if (etudiantId === undefined) {
      const user = await prisma.user.findUnique({
        where: { email: emailEtudiant },
        select: { role: true, etudiantId: true },
      });
      if (!user || user.role !== "etudiant" || !user.etudiantId) {
        etudiantId = null;
      } else {
        etudiantId = user.etudiantId;
      }
      cacheEmail.set(emailEtudiant, etudiantId);
    }

    if (!etudiantId) {
      erreurs.push({ ligne: numeroLigne, contenu: ligne, raison: `Email introuvable ou compte sans étudiant lié : "${emailEtudiant}".` });
      continue;
    }

    // Création de la note
    try {
      const note = await prisma.note.create({
        data: { etudiantId, matiere, valeur, periode, anneeScolaire },
      });

      const issue = await detecterAlerte(note.etudiantId);
      if (issue !== null) alertesCreees++;

      importees++;
    } catch (err) {
      console.error("Erreur création note CSV ligne", numeroLigne, err);
      erreurs.push({ ligne: numeroLigne, contenu: ligne, raison: "Erreur interne lors de la création de la note." });
    }
  }

  const total = lignesData.filter((l) => l.trim() !== "").length;

  return NextResponse.json({ total, importees, erreurs, alertesCreees }, { status: 200 });
}
