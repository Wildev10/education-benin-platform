// Fuseaux horaires : le serveur (UTC sur Vercel) et le navigateur doivent afficher
// les mêmes dates, celles du Bénin (Africa/Porto-Novo), quel que soit le fuseau du
// navigateur. Un écart provoque une erreur d'hydratation React (n° 418) et des
// dates décalées d'un jour. Pages comparées à un navigateur réglé sur le Bénin.
// Aucune écriture en base.
import { COMPTES, connecter, creerRapport, getJson, lancerNavigateur, ouvrir } from "./commun.mjs";

const rapport = creerRapport("Fuseaux horaires");
const { check } = rapport;
const navigateur = await lancerNavigateur();
const REFERENCE = "Africa/Porto-Novo";
const FUSEAUX = ["UTC", "America/New_York"];

// Dates en toutes lettres (« 3 oct. 2026 », « 14 octobre 2026 »), jj/mm/aaaa et heures hh:mm
// (le texte de la page colle les libellés aux valeurs : « naissance5 mars 2010 », d'où les
// assertions sur les chiffres plutôt que \b ; \s couvre aussi les espaces insécables)
const MOTIF_DATE =
  /(?<!\d)\d{1,2}(?:er)?\s(?:janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)[a-zéû]*\.?\s\d{4}(?!\d)|(?<!\d)\d{2}\/\d{2}\/\d{4}(?!\d)|(?<!\d)\d{2}[:h]\d{2}(?!\d)/g;

async function datesDeLaPage(page, chemin) {
  await ouvrir(page, chemin);
  const texte = (await page.locator("main").last().textContent()) ?? "";
  return texte.match(MOTIF_DATE) ?? [];
}

/** Dates affichées sur chaque page, erreurs JS, et date maximale du champ « absence » des fiches. */
async function pagesDuRole(compte, fuseau, chemins) {
  const page = await connecter(navigateur, compte, { fuseau });
  const resultats = {};
  for (const chemin of chemins) {
    page.erreursJs.length = 0;
    const dates = await datesDeLaPage(page, chemin);
    const champ = page.locator('input[type="date"]').first();
    const jourMax = (await champ.count()) ? await champ.getAttribute("max") : null;
    resultats[chemin] = { dates, jourMax, erreurs: [...page.erreursJs] };
  }
  await page.context().close();
  return resultats;
}

/** Élève qui a des alertes, dans le périmètre du compte (dates de détection et d'absence affichées). */
async function eleveDuPerimetre(compte) {
  const page = await connecter(navigateur, compte, { fuseau: REFERENCE });
  const { corps } = await getJson(page, "/api/alertes?statut=toutes&page=1");
  await page.context().close();
  return corps?.elements?.[0]?.etudiant?.id ?? null;
}

const jourBenin = new Intl.DateTimeFormat("en-CA", { timeZone: REFERENCE }).format(new Date());
const SCENARIOS = [
  ["admin", COMPTES.admin, (id) => [`/admin/etudiants/${id}`, "/admin/utilisateurs", "/admin/historique", "/admin/alertes", "/profil"]],
  ["enseignant", COMPTES.enseignant, (id) => [`/enseignant/etudiants/${id}`, "/enseignant/alertes", "/profil"]],
  ["directeur", COMPTES.directeur, (id) => ["/directeur", "/directeur/alertes", `/enseignant/etudiants/${id}`]],
];

for (const [role, compte, pages] of SCENARIOS) {
  if (!compte) {
    rapport.ignorer(`Fuseaux ${role}`, "compte de test non défini");
    continue;
  }
  const id = await eleveDuPerimetre(compte);
  if (!check(`${role} : un élève avec des alertes dans son périmètre`, !!id)) continue;
  const chemins = pages(id);
  const libelle = (chemin) => chemin.replace(id, "[id]");
  const reference = await pagesDuRole(compte, REFERENCE, chemins);
  check(`${role} : des dates sont affichées au Bénin (référence)`, chemins.some((c) => reference[c].dates.length > 0));
  for (const fuseau of FUSEAUX) {
    const autre = await pagesDuRole(compte, fuseau, chemins);
    for (const chemin of chemins) {
      const ref = reference[chemin];
      const res = autre[chemin];
      check(
        `${role}, navigateur en ${fuseau} : ${libelle(chemin)} sans erreur JS (dont hydratation n° 418)`,
        res.erreurs.length === 0,
        res.erreurs[0]?.slice(0, 80) ?? ""
      );
      check(
        `${role}, navigateur en ${fuseau} : ${libelle(chemin)} affiche les mêmes dates qu'au Bénin`,
        JSON.stringify(res.dates) === JSON.stringify(ref.dates),
        `${res.dates.length} date(s)${res.dates.length ? `, ex. « ${res.dates[0]} »` : ""}`
      );
      if (ref.jourMax) {
        check(
          `${role}, navigateur en ${fuseau} : ${libelle(chemin)}, date maximale d'une absence = aujourd'hui au Bénin`,
          res.jourMax === jourBenin,
          `${res.jourMax} (Bénin : ${jourBenin})`
        );
      }
    }
  }
}

await navigateur.close();
rapport.terminer();
