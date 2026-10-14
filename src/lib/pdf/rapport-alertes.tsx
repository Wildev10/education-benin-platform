import { Document, Page, Text, View } from "@react-pdf/renderer";
import { EntetePdf, PiedPagePdf, couleurs, formatNote, ligneStyle, styles } from "@/lib/pdf/commun";

export type AlerteRapport = {
  niveauRisque: string;
  periode: string;
  moyenneApres: number;
  ecartPourcent: number;
  etudiant: {
    nom: string;
    prenom: string;
    niveau: string;
    etablissement: { id: string; nom: string; departement: string };
  };
};

const COLONNES = [
  { titre: "Étudiant", width: "24%" },
  { titre: "Établissement", width: "22%" },
  { titre: "Niveau", width: "11%" },
  { titre: "Période", width: "15%" },
  { titre: "Baisse", width: "12%", droite: true },
  { titre: "Moyenne actuelle", width: "16%", droite: true },
];

function pluriel(n: number, mot: string) {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

export function RapportAlertesPdf({ alertes, genereLe }: { alertes: AlerteRapport[]; genereLe: Date }) {
  const parEtablissement = new Map<string, AlerteRapport[]>();
  for (const a of alertes) {
    const id = a.etudiant.etablissement.id;
    parEtablissement.set(id, [...(parEtablissement.get(id) ?? []), a]);
  }
  const groupes = [...parEtablissement.values()]
    .map((liste) => ({
      etablissement: liste[0].etudiant.etablissement,
      alertes: liste.sort(
        (a, b) =>
          Number(b.niveauRisque === "eleve") - Number(a.niveauRisque === "eleve") ||
          b.ecartPourcent - a.ecartPourcent
      ),
    }))
    .sort((a, b) => b.alertes.length - a.alertes.length || a.etablissement.nom.localeCompare(b.etablissement.nom, "fr"));
  const nbEleve = alertes.filter((a) => a.niveauRisque === "eleve").length;

  return (
    <Document title="Rapport des alertes actives" author="EduTech Bénin" language="fr">
      <Page size="A4" style={styles.page}>
        <EntetePdf genereLe={genereLe} />
        <Text style={styles.titre}>Rapport des alertes actives</Text>
        <Text style={styles.sousTitre}>
          {pluriel(alertes.length, "alerte")} active{alertes.length > 1 ? "s" : ""} dans{" "}
          {pluriel(groupes.length, "établissement")}, dont {nbEleve} à risque élevé.
        </Text>

        {groupes.length === 0 && (
          <Text style={[styles.vide, { marginTop: 20 }]}>Aucune alerte active à ce jour.</Text>
        )}

        {groupes.map(({ etablissement, alertes: liste }) => (
          <View key={etablissement.id} style={styles.section}>
            <View wrap={false}>
              <Text style={styles.sectionTitre}>
                {etablissement.nom}
                <Text style={{ fontFamily: "Helvetica", color: couleurs.gris, fontSize: 10 }}>
                  {"  "}
                  {etablissement.departement} · {pluriel(liste.length, "alerte")}
                </Text>
              </Text>
              <View style={styles.ligneEntete}>
                {COLONNES.map((c) => (
                  <Text
                    key={c.titre}
                    style={[styles.celluleEntete, { width: c.width }, ...(c.droite ? [{ textAlign: "right" as const }] : [])]}
                  >
                    {c.titre}
                  </Text>
                ))}
              </View>
            </View>
            <View style={[styles.table, { borderTopWidth: 0 }]}>
              {liste.map((a, i) => (
                <View key={i} style={ligneStyle(i)} wrap={false}>
                  <View style={[styles.cellule, { width: COLONNES[0].width }]}>
                    <Text style={styles.gras}>
                      {a.etudiant.prenom} {a.etudiant.nom}
                    </Text>
                    <Text style={[styles.gris, { fontSize: 8, marginTop: 1 }]}>{a.etudiant.niveau}</Text>
                  </View>
                  <Text style={[styles.cellule, { width: COLONNES[1].width }]}>{etablissement.nom}</Text>
                  <Text
                    style={[styles.cellule, styles.gras, { width: COLONNES[2].width }, ...(a.niveauRisque === "eleve" ? [styles.rouge] : [])]}
                  >
                    {a.niveauRisque === "eleve" ? "Élevé" : "Moyen"}
                  </Text>
                  <Text style={[styles.cellule, { width: COLONNES[3].width }]}>{a.periode}</Text>
                  <Text style={[styles.cellule, styles.rouge, { width: COLONNES[4].width, textAlign: "right" }]}>
                    -{a.ecartPourcent.toFixed(1).replace(".", ",")} %
                  </Text>
                  <Text
                    style={[
                      styles.cellule,
                      styles.gras,
                      { width: COLONNES[5].width, textAlign: "right" },
                      ...(a.moyenneApres < 10 ? [styles.rouge] : []),
                    ]}
                  >
                    {formatNote(a.moyenneApres)}/20
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {groupes.length > 0 && (
          <View
            wrap={false}
            style={{
              marginTop: 20,
              flexDirection: "row",
              justifyContent: "space-between",
              backgroundColor: couleurs.noir,
              paddingVertical: 8,
              paddingHorizontal: 10,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontFamily: "Helvetica-Bold" }}>Total</Text>
            <Text style={{ color: "#FFFFFF" }}>
              {pluriel(alertes.length, "alerte")} · {nbEleve} à risque élevé · {alertes.length - nbEleve} à risque moyen
            </Text>
          </View>
        )}

        <PiedPagePdf genereLe={genereLe} />
      </Page>
    </Document>
  );
}
