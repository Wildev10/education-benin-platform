// Noms et prénoms des données de démonstration, par aire culturelle. Les noms
// de personnalités publiques connues sont volontairement absents.

export type Groupe = "fon" | "goun" | "yoruba" | "adja" | "mina" | "bariba" | "dendi";

type Prenoms = { F: string[]; M: string[] };

export const NOMS: Record<Groupe, string[]> = {
  fon: [
    "Agossou", "Dossou", "Hounkpatin", "Ahouansou", "Kpadonou", "Gbaguidi", "Houénou", "Sossou",
    "Tossou", "Dansou", "Hounsa", "Akpovi", "Houndékon", "Gnonlonfoun", "Hounnou", "Kakpo",
    "Assogba", "Dovonou", "Zannou", "Tchobo", "Djossou", "Houéto", "Agbo", "Ahodékon",
    "Vodounou", "Kpossou", "Tokannou", "Ahouandjinou",
  ],
  goun: [
    "Agbangla", "Hounkanrin", "Sossa", "Adanlin", "Avognon", "Dègla", "Hounton", "Tokpo",
    "Houéssou", "Gbénou", "Agonvi", "Ahissou",
  ],
  yoruba: [
    "Akanni", "Adébayo", "Alabi", "Bankolé", "Ogoubiyi", "Adjibadé", "Ladékan", "Odjo",
    "Salami", "Aboudou", "Amoussa", "Ayéna", "Adéyèmi", "Ogoundélé", "Arouna", "Bello",
    "Raïmi", "Lawani", "Yessoufou", "Akadiri", "Adéoti",
  ],
  adja: [
    "Agbodjan", "Ahossi", "Lokossou", "Adjahouinou", "Dakpo", "Adjakpa", "Kossouho", "Tchinkoun",
    "Gbétoho", "Akoha", "Dégbé", "Houssou",
  ],
  mina: [
    "Lawson", "d'Almeida", "Mensah", "Amoussou", "Ekué", "Kouévi", "Attiogbé", "Amégan",
    "Akakpo", "Johnson", "Kuassi", "Fiogbé",
  ],
  bariba: [
    "Gounou", "Sabi", "Yérima", "Sounon", "Chabi", "Worou", "Bani", "Sacca",
    "Gado", "Kora", "Séko", "Bouko", "Kpéra",
  ],
  dendi: [
    "Maïga", "Touré", "Issifou", "Boukari", "Soumanou", "Garba", "Moumouni", "Idrissou",
    "Saïbou", "Alassane", "Dicko", "Hamidou", "Mamoudou",
  ],
};

/** Prénoms d'usage courant dans tout le pays (français, chrétiens). */
export const PRENOMS_COURANTS: Prenoms = {
  F: [
    "Prudence", "Bénédicte", "Florentine", "Aurore", "Carine", "Grâce", "Victoire", "Espérance",
    "Mireille", "Pélagie", "Rosine", "Chimène", "Gloria", "Murielle", "Nadège", "Reine",
    "Sandrine", "Ornella", "Josiane", "Félicité", "Sidonie", "Edwige", "Huguette", "Solange",
    "Clarisse", "Merveille", "Fabiola", "Dorcas", "Christelle", "Hortense", "Inès", "Larissa",
    "Mélaine", "Esther",
  ],
  M: [
    "Rodrigue", "Ghislain", "Romaric", "Arsène", "Eustache", "Fiacre", "Brice", "Hervé",
    "Landry", "Cyriaque", "Judicaël", "Ulrich", "Josué", "Gildas", "Aristide", "Crépin",
    "Abel", "Hospice", "Prosper", "Christian", "Firmin", "Rolland", "Juste", "Médard",
    "Parfait", "Serge", "Thierry", "Désiré", "Achille", "Boris", "Fabrice", "Gédéon",
    "Jonas", "Basile",
  ],
};

/** Prénoms musulmans, surtout dans le Nord et chez les Yoruba. */
export const PRENOMS_MUSULMANS: Prenoms = {
  F: [
    "Nafissatou", "Rachidatou", "Zalia", "Mariama", "Aïchatou", "Fatouma", "Zénabou", "Safiatou",
    "Habiba", "Raïmatou", "Assana", "Hadjara", "Balkissou", "Samiratou", "Kadidjatou",
  ],
  M: [
    "Inoussa", "Moubarak", "Rachad", "Fataou", "Zakari", "Nourou", "Karim", "Souleymane",
    "Ismaël", "Aboubakar", "Ousmane", "Moussa", "Issa", "Ibrahim", "Tidjani", "Latif",
  ],
};

/** Prénoms propres à chaque aire culturelle. */
export const PRENOMS_LOCAUX: Record<Groupe, Prenoms> = {
  fon: { F: ["Sèna", "Houéfa", "Dossi", "Sènami", "Mahougnon"], M: ["Sèdjro", "Sènan", "Mahouna", "Dossa"] },
  goun: { F: ["Sèna", "Houéfa", "Dossi", "Sènami", "Mahougnon"], M: ["Sèdjro", "Sènan", "Mahouna", "Dossa"] },
  yoruba: {
    F: ["Adéola", "Folakè", "Bisola", "Titilayo", "Yétondé", "Bolanlé", "Adénikè", "Kafayath", "Rissikath", "Fadilath", "Basirath"],
    M: ["Kayodé", "Olouwafèmi", "Babatoundé", "Kolawolé", "Idowou", "Taïwo", "Kéhindé", "Nafiou", "Fatiou", "Wassiou", "Rafiou", "Sikirou"],
  },
  adja: { F: ["Akossiwa", "Adjo", "Abla", "Akouvi", "Yawa", "Afiwa", "Ablavi"], M: ["Kossi", "Kodjo", "Komlan", "Kokou", "Yao", "Kofi", "Komi"] },
  mina: {
    F: ["Akossiwa", "Adjo", "Akouvi", "Afiwa", "Ama", "Akpénè", "Enyonam", "Sélassi", "Mawuéna"],
    M: ["Kossi", "Kodjo", "Kokou", "Yao", "Komi", "Dodji", "Elom", "Mawuli"],
  },
  bariba: { F: ["Gnon", "Bona", "Yon", "Sika"], M: ["Orou", "Sabi", "Bio", "Sanni", "Worou", "Gani", "Yarou", "Bawa"] },
  dendi: { F: [], M: [] },
};

/** Part des prénoms locaux et musulmans par aire ; le reste : prénoms courants. */
export const REPARTITION_PRENOMS: Record<Groupe, { local: number; musulman: number }> = {
  fon: { local: 0.25, musulman: 0.05 },
  goun: { local: 0.25, musulman: 0.05 },
  adja: { local: 0.3, musulman: 0.05 },
  mina: { local: 0.3, musulman: 0.05 },
  yoruba: { local: 0.3, musulman: 0.3 },
  bariba: { local: 0.3, musulman: 0.35 },
  dendi: { local: 0, musulman: 0.85 },
};
