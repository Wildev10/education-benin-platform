import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import {
  EntetePdf,
  PiedPagePdf,
  couleurs,
  formatDateLongue,
  formatNote,
  ligneStyle,
  styles,
} from "@/lib/pdf/commun";
import { messageAucun, titreRecapitulatif, type AnneeExport } from "@/lib/annee-export";
import { libellePeriode } from "@/lib/notes-trimestres";
import { comparerMatieres } from "@/lib/programme";

type NotePdf = { matiere: string; valeur: number; periode: string; anneeScolaire: string };
type AbsencePdf = { motif: string; periode: string; anneeScolaire: string };

const PERIODES = ["Trimestre 1", "Trimestre 2", "Trimestre 3"];

export type DonneesFicheEtudiant = {
  etudiant: {
    nom: string;
    prenom: string;
    niveau: string;
    etablissement: { nom: string; departement: string; commune: string };
  };
  /** Année scolaire en cours au Bénin */
  anneeScolaire: string;
  notes: AnneeExport<NotePdf>;
  absences: AnneeExport<AbsencePdf>;
  alertes: {
    niveauRisque: string;
    periode: string;
    /** Absente des anciennes alertes */
    anneeScolaire?: string | null;
    statut: string;
    moyenneAvant: number;
    moyenneApres: number;
    ecartPourcent: number;
    createdAt: Date;
  }[];
  genereLe: Date;
};

function moyenne(valeurs: number[]) {
  return valeurs.length ? valeurs.reduce((s, v) => s + v, 0) / valeurs.length : null;
}

function CelluleNote({ valeur, gras = false, width }: { valeur: number | null; gras?: boolean; width: string }) {
  return (
    <Text
      style={[
        styles.cellule,
        { width, textAlign: "right" },
        ...(gras ? [styles.gras] : []),
        ...(valeur === null ? [styles.gris] : valeur < 10 ? [styles.rouge] : []),
      ]}
    >
      {valeur === null ? "—" : formatNote(valeur)}
    </Text>
  );
}

/**
 * Éléments de l'année en cours ; sinon « Aucune note pour l'année … pour
 * l'instant », puis le récapitulatif de l'année précédente s'il existe.
 */
function SectionAnnee<T>({
  selection,
  type,
  rendu,
}: {
  selection: AnneeExport<T>;
  type: "note" | "absence";
  rendu: (elements: T[], annee: string) => ReactNode;
}) {
  if (selection.enCours.length > 0) return <>{rendu(selection.enCours, selection.anneeEnCours)}</>;
  return (
    <>
      <Text style={styles.vide}>{messageAucun(type, selection.anneeEnCours)}</Text>
      {selection.precedente && (
        <>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 4 }}>
            {titreRecapitulatif(selection.precedente.anneeScolaire)}
          </Text>
          {rendu(selection.precedente.elements, selection.precedente.anneeScolaire)}
        </>
      )}
    </>
  );
}

function TableauNotes({ notes, annee }: { notes: NotePdf[]; annee: string }) {
  const matieres = [...new Set(notes.map((n) => n.matiere))].sort(comparerMatieres);
  return (
    <View style={styles.table} wrap={false}>
      <View style={styles.ligneEntete}>
        <Text style={[styles.celluleEntete, { width: "34%" }]}>Matière ({annee})</Text>
        {PERIODES.map((p) => (
          <Text key={p} style={[styles.celluleEntete, { width: "22%", textAlign: "right" }]}>
            {p}
          </Text>
        ))}
      </View>
      {matieres.map((matiere, i) => (
        <View key={matiere} style={ligneStyle(i)}>
          <Text style={[styles.cellule, { width: "34%" }]}>{matiere}</Text>
          {PERIODES.map((p) => (
            <CelluleNote
              key={p}
              width="22%"
              valeur={moyenne(notes.filter((n) => n.matiere === matiere && n.periode === p).map((n) => n.valeur))}
            />
          ))}
        </View>
      ))}
      <View style={[styles.ligne, { borderTopWidth: 1.5, borderTopColor: couleurs.noir }]}>
        <Text style={[styles.cellule, styles.gras, { width: "34%" }]}>Moyenne du trimestre</Text>
        {PERIODES.map((p) => (
          <CelluleNote key={p} width="22%" gras valeur={moyenne(notes.filter((n) => n.periode === p).map((n) => n.valeur))} />
        ))}
      </View>
    </View>
  );
}

function TableauAbsences({ absences, annee }: { absences: AbsencePdf[]; annee: string }) {
  const parPeriode = PERIODES.map((periode) => {
    const liste = absences.filter((a) => a.periode === periode);
    const injustifiees = liste.filter((a) => a.motif === "injustifiee").length;
    return { periode, injustifiees, justifiees: liste.length - injustifiees, total: liste.length };
  });
  const totalInjustifiees = parPeriode.reduce((s, p) => s + p.injustifiees, 0);
  const totalJustifiees = parPeriode.reduce((s, p) => s + p.justifiees, 0);
  return (
    <View style={styles.table}>
      <View style={styles.ligneEntete}>
        <Text style={[styles.celluleEntete, { width: "34%" }]}>Période</Text>
        <Text style={[styles.celluleEntete, { width: "22%", textAlign: "right" }]}>Injustifiées</Text>
        <Text style={[styles.celluleEntete, { width: "22%", textAlign: "right" }]}>Justifiées</Text>
        <Text style={[styles.celluleEntete, { width: "22%", textAlign: "right" }]}>Total</Text>
      </View>
      {parPeriode.map((p, i) => (
        <View key={p.periode} style={ligneStyle(i)}>
          <Text style={[styles.cellule, { width: "34%" }]}>{libellePeriode(p.periode, annee)}</Text>
          <Text style={[styles.cellule, { width: "22%", textAlign: "right" }, ...(p.injustifiees > 0 ? [styles.rouge] : [])]}>
            {p.injustifiees}
          </Text>
          <Text style={[styles.cellule, { width: "22%", textAlign: "right" }]}>{p.justifiees}</Text>
          <Text style={[styles.cellule, styles.gras, { width: "22%", textAlign: "right" }]}>{p.total}</Text>
        </View>
      ))}
      <View style={[styles.ligne, { borderTopWidth: 1.5, borderTopColor: couleurs.noir }]}>
        <Text style={[styles.cellule, styles.gras, { width: "34%" }]}>Total {annee}</Text>
        <Text style={[styles.cellule, styles.gras, { width: "22%", textAlign: "right" }]}>{totalInjustifiees}</Text>
        <Text style={[styles.cellule, styles.gras, { width: "22%", textAlign: "right" }]}>{totalJustifiees}</Text>
        <Text style={[styles.cellule, styles.gras, { width: "22%", textAlign: "right" }]}>{totalInjustifiees + totalJustifiees}</Text>
      </View>
    </View>
  );
}

export function FicheEtudiantPdf({ etudiant, anneeScolaire, notes, absences, alertes, genereLe }: DonneesFicheEtudiant) {
  const alertesActives = alertes.filter((a) => a.statut === "active");

  return (
    <Document
      title={`Fiche de suivi — ${etudiant.prenom} ${etudiant.nom}`}
      author="EduTech Bénin"
      language="fr"
    >
      <Page size="A4" style={styles.page}>
        <EntetePdf genereLe={genereLe} />

        <Text style={styles.titre}>
          Fiche de suivi — {etudiant.prenom} {etudiant.nom}
        </Text>

        {alertesActives.length > 0 && (
          <View
            style={{
              marginTop: 12,
              padding: 8,
              backgroundColor: couleurs.rouge,
              borderRadius: 3,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 10 }}>
              {alertesActives.length} alerte{alertesActives.length > 1 ? "s" : ""} active
              {alertesActives.length > 1 ? "s" : ""} — suivi prioritaire recommandé
            </Text>
          </View>
        )}

        {/* Informations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitre}>Informations de l&apos;élève</Text>
          <View style={[styles.table, { flexDirection: "row", flexWrap: "wrap" }]}>
            {[
              ["Nom", etudiant.nom],
              ["Prénom", etudiant.prenom],
              ["Établissement", etudiant.etablissement.nom],
              ["Localisation", `${etudiant.etablissement.commune}, ${etudiant.etablissement.departement}`],
              ["Niveau", etudiant.niveau],
              ["Année scolaire", anneeScolaire],
            ].map(([libelle, valeur]) => (
              <View key={libelle} style={{ width: "50%", paddingVertical: 5, paddingHorizontal: 8 }}>
                <Text style={{ fontSize: 8, color: couleurs.gris }}>{libelle}</Text>
                <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 1 }}>{valeur}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Notes : année en cours, sinon récapitulatif de l'année précédente */}
        <View style={styles.section}>
          <Text style={styles.sectionTitre}>Notes par période (sur 20) — année {anneeScolaire}</Text>
          <SectionAnnee
            selection={notes}
            type="note"
            rendu={(liste, annee) => <TableauNotes notes={liste} annee={annee} />}
          />
        </View>

        {/* Absences : même règle */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitre}>Absences — année {anneeScolaire}</Text>
          <SectionAnnee
            selection={absences}
            type="absence"
            rendu={(liste, annee) => <TableauAbsences absences={liste} annee={annee} />}
          />
        </View>

        {/* Alertes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitre}>Alertes</Text>
          {alertes.length === 0 ? (
            <Text style={styles.vide}>Aucune alerte dans l&apos;historique de cet élève.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.ligneEntete} fixed>
                <Text style={[styles.celluleEntete, { width: "16%" }]}>Niveau</Text>
                <Text style={[styles.celluleEntete, { width: "18%" }]}>Période</Text>
                <Text style={[styles.celluleEntete, { width: "22%", textAlign: "right" }]}>Moyenne</Text>
                <Text style={[styles.celluleEntete, { width: "12%", textAlign: "right" }]}>Baisse</Text>
                <Text style={[styles.celluleEntete, { width: "14%" }]}>Statut</Text>
                <Text style={[styles.celluleEntete, { width: "18%" }]}>Date</Text>
              </View>
              {alertes.map((a, i) => (
                <View key={i} style={ligneStyle(i)} wrap={false}>
                  <Text style={[styles.cellule, styles.gras, { width: "16%" }, ...(a.niveauRisque === "eleve" ? [styles.rouge] : [])]}>
                    {a.niveauRisque === "eleve" ? "Élevé" : "Moyen"}
                  </Text>
                  <Text style={[styles.cellule, { width: "18%" }]}>{libellePeriode(a.periode, a.anneeScolaire)}</Text>
                  <Text style={[styles.cellule, { width: "22%", textAlign: "right" }]}>
                    {formatNote(a.moyenneAvant)} › {formatNote(a.moyenneApres)}
                  </Text>
                  <Text style={[styles.cellule, styles.rouge, { width: "12%", textAlign: "right" }]}>
                    -{a.ecartPourcent.toFixed(1).replace(".", ",")} %
                  </Text>
                  <Text style={[styles.cellule, styles.gras, { width: "14%" }, a.statut === "active" ? styles.rouge : { color: couleurs.vert }]}>
                    {a.statut === "active" ? "Active" : "Traitée"}
                  </Text>
                  <Text style={[styles.cellule, styles.gris, { width: "18%" }]}>{formatDateLongue(a.createdAt)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <PiedPagePdf genereLe={genereLe} />
      </Page>
    </Document>
  );
}
