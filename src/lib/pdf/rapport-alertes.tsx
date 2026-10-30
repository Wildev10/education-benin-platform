import { Document, Page, Text, View } from "@react-pdf/renderer";
import { EntetePdf, PiedPagePdf, couleurs, formatBaisse, formatNote, ligneStyle, styles } from "@/lib/pdf/commun";
import { libellePeriode } from "@/lib/notes-trimestres";
import { nomComplet } from "@/lib/nom-utilisateur";

export type AlerteRapport = {
  type: string;
  niveauRisque: string;
  periode: string;
  /** Absente des anciennes alertes */
  anneeScolaire?: string | null;
  moyenneApres: number;
  ecartPourcent: number;
  /** Responsable du suivi (null : à désigner) */
  responsable?: { nom: string; prenom: string } | null;
  etudiant: {
    nom: string;
    prenom: string;
    niveau: string;
    etablissement: { id: string; nom: string; departement: string };
  };
};

const COLONNES = [
  { titre: "Étudiant", width: "22%" },
  { titre: "Établissement", width: "20%" },
  { titre: "Niveau", width: "10%" },
  { titre: "Période", width: "20%" },
  { titre: "Baisse", width: "12%", droite: true },
  { titre: "Moyenne actuelle", width: "16%", droite: true },
];

function pluriel(n: number, mot: string) {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

const titres: Record<string, string> = {
  active: "Rapport des alertes ouvertes",
  nouvelle: "Rapport des alertes nouvelles",
  en_suivi: "Rapport des alertes en cours de suivi",
  traitee: "Rapport des alertes clôturées",
  toutes: "Rapport des alertes",
};

export function RapportAlertesPdf({
  alertes,
  genereLe,
  statut = "active",
  filtres = [],
}: {
  alertes: AlerteRapport[];
  genereLe: Date;
  /** Statut filtré : détermine le titre du rapport */
  statut?: string;
  /** Résumé des filtres appliqués, affiché sous le titre */
  filtres?: string[];
}) {
  const titre = titres[statut] ?? titres.toutes;
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
    <Document title={titre} author="EduTech Bénin" language="fr">
      <Page size="A4" style={styles.page}>
        <EntetePdf genereLe={genereLe} />
        <Text style={styles.titre}>{titre}</Text>
        {filtres.length > 0 && (
          <Text style={[styles.gris, { fontSize: 9, marginTop: 2 }]}>Filtres : {filtres.join(" · ")}</Text>
        )}
        <Text style={styles.sousTitre}>
          {pluriel(alertes.length, "alerte")} dans {pluriel(groupes.length, "établissement")}, dont{" "}
          {nbEleve} à risque élevé.
        </Text>

        {groupes.length === 0 && (
          <Text style={[styles.vide, { marginTop: 20 }]}>Aucune alerte ne correspond à ces critères.</Text>
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
                    {a.responsable && (
                      <Text style={[styles.gris, { fontSize: 8, marginTop: 1 }]}>
                        Suivi : {nomComplet(a.responsable.prenom, a.responsable.nom)}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.cellule, { width: COLONNES[1].width }]}>{etablissement.nom}</Text>
                  <Text
                    style={[styles.cellule, styles.gras, { width: COLONNES[2].width }, ...(a.niveauRisque === "eleve" ? [styles.rouge] : [])]}
                  >
                    {a.niveauRisque === "eleve" ? "Élevé" : "Moyen"}
                  </Text>
                  <Text style={[styles.cellule, { width: COLONNES[3].width }]}>{libellePeriode(a.periode, a.anneeScolaire)}</Text>
                  {a.type === "absences" ? (
                    <>
                      <Text style={[styles.cellule, styles.gris, { width: COLONNES[4].width, textAlign: "right" }]}>—</Text>
                      <Text style={[styles.cellule, styles.gras, styles.rouge, { width: COLONNES[5].width, textAlign: "right" }]}>
                        {pluriel(a.moyenneApres, "absence")}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.cellule, styles.rouge, { width: COLONNES[4].width, textAlign: "right" }]}>
                        {formatBaisse(a.ecartPourcent)}
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
                    </>
                  )}
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
