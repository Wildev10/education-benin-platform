import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { FUSEAU_BENIN } from "@/lib/dates";

export const couleurs = {
  noir: "#0A0A0A",
  orange: "#F97316",
  gris: "#6B7280",
  bordure: "#E5E7EB",
  ligneAlternee: "#F9FAFB",
  rouge: "#B91C1C",
  rougeFond: "#FEF2F2",
  vert: "#047857",
};

const TZ = FUSEAU_BENIN;

export function formatDateLongue(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: TZ }).format(date);
}

export function formatDateHeure(date: Date) {
  const jour = formatDateLongue(date);
  const heure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ })
    .format(date)
    .replace(":", "h");
  return `${jour} à ${heure}`;
}

export function dateIso(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);
}

export function slugFichier(...parts: string[]) {
  return parts
    .join("-")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formatNote(valeur: number) {
  return valeur.toFixed(2).replace(".", ",");
}

export const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: couleurs.noir,
  },
  entete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 2,
    borderBottomColor: couleurs.orange,
    paddingBottom: 10,
  },
  marque: { fontFamily: "Helvetica-Bold", fontSize: 14, letterSpacing: 1.5 },
  marqueAccent: { color: couleurs.orange },
  pays: { fontSize: 7, color: couleurs.gris, letterSpacing: 1.2, marginBottom: 2 },
  intitule: { fontSize: 9, color: couleurs.gris, marginTop: 2 },
  dateEntete: { fontSize: 9, color: couleurs.gris, textAlign: "right" },
  titre: { fontFamily: "Helvetica-Bold", fontSize: 18, marginTop: 18 },
  sousTitre: { fontSize: 10, color: couleurs.gris, marginTop: 4 },
  section: { marginTop: 20 },
  sectionTitre: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    marginBottom: 8,
    paddingLeft: 6,
    borderLeftWidth: 3,
    borderLeftColor: couleurs.orange,
  },
  vide: { fontSize: 9, color: couleurs.gris, fontStyle: "italic" },
  table: { borderWidth: 1, borderColor: couleurs.bordure },
  ligneEntete: { flexDirection: "row", backgroundColor: couleurs.noir },
  celluleEntete: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  ligne: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: couleurs.bordure,
  },
  cellule: { fontSize: 9, paddingVertical: 5, paddingHorizontal: 6 },
  gras: { fontFamily: "Helvetica-Bold" },
  rouge: { color: couleurs.rouge },
  gris: { color: couleurs.gris },
  piedPage: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: couleurs.bordure,
    paddingTop: 6,
    fontSize: 8,
    color: couleurs.gris,
  },
});

export function EntetePdf({ genereLe }: { genereLe: Date }) {
  return (
    <View style={styles.entete} fixed>
      <View>
        <Text style={styles.pays}>RÉPUBLIQUE DU BÉNIN</Text>
        <Text style={styles.marque}>
          EDUTECH <Text style={styles.marqueAccent}>BÉNIN</Text>
        </Text>
        <Text style={styles.intitule}>Plateforme nationale de suivi scolaire</Text>
      </View>
      <Text style={styles.dateEntete}>Généré le {formatDateHeure(genereLe)}</Text>
    </View>
  );
}

export function PiedPagePdf({ genereLe }: { genereLe: Date }) {
  return (
    <View style={styles.piedPage} fixed>
      <Text>Document généré le {formatDateLongue(genereLe)} — EduTech Bénin</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

export function ligneStyle(index: number) {
  return index % 2 === 1 ? [styles.ligne, { backgroundColor: couleurs.ligneAlternee }] : [styles.ligne];
}
