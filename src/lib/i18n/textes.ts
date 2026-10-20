import type { Langue } from "./langue";

/**
 * Textes des pages publiques (accueil et connexion), en français et en
 * anglais ; l'anglais a exactement la même structure (vérifié par TypeScript
 * et par les tests).
 *
 * Intitulé neutre : la plateforme n'est le service d'aucun ministère. Seule
 * mention d'un ministère : le challenge dans lequel le projet a été
 * sélectionné, sans jamais présenter la plateforme comme un service officiel.
 */

/**
 * Nom recopié exactement (apostrophe typographique comprise). Pas de forme
 * anglaise officielle : il reste en français dans les deux langues.
 */
export const NOM_MINISTERE_CHALLENGE = "Ministère de la Transformation Digitale et de l’Innovation";

const fr = {
  commun: {
    nomPlateforme: "EduTech Bénin",
    pays: "République du Bénin",
    intitule: "Plateforme nationale de suivi scolaire",
    armoiriesAlt: "Armoiries du Bénin",
    /** Suivie du nom du ministère (NOM_MINISTERE_CHALLENGE), en français */
    mentionChallenge: "Projet sélectionné dans le cadre du challenge du",
  },
  selecteurLangue: {
    libelle: "Choix de la langue",
    fr: "Français",
    en: "English",
  },
  accueil: {
    seConnecter: "Se connecter",
    titreLigne1: "Personne ne voit un décrochage venir",
    titreLigne2: "avant qu'il soit acté.",
    accroche: "Notre plateforme le détecte automatiquement.",
    presentation:
      "EduTech Bénin relie les enseignants, les directeurs d'établissement et le pilotage national autour d'un objectif commun : agir avant qu'il soit trop tard.",
    acceder: "Accéder à la plateforme",
    chiffres: {
      eleves: "élèves suivis",
      etablissements: "établissements connectés",
      detection: "détection en temps réel",
      accessible: "accessible",
    },
    commentCaMarche: "Comment ça marche ?",
    etapes: [
      { titre: "L'enseignant saisit une note", description: "Les résultats sont enregistrés par période et par matière." },
      { titre: "La plateforme détecte les baisses", description: "Les moyennes sont comparées automatiquement entre périodes." },
      { titre: "Le niveau national est alerté et peut agir", description: "Les alertes remontent en temps réel au niveau national." },
    ],
    titreEspaces: "Une plateforme pour chaque acteur",
    espaces: {
      etudiant: { titre: "Étudiant", description: "Suivez vos résultats et votre progression" },
      enseignant: { titre: "Enseignant", description: "Gérez vos élèves et saisissez les notes" },
      directeur: { titre: "Directeur", description: "Pilotez votre établissement" },
      national: { titre: "Pilotage national", description: "Vue nationale des alertes et indicateurs" },
    },
    titreAccessibilite: "Conçu pour tous",
    accessibilite: {
      contraste: "Contraste élevé disponible",
      police: "Taille de police ajustable",
      lecture: "Lecture à voix haute",
      langue: "Interface en français simple",
    },
    piedDePage: "© 2026 EduTech Bénin",
  },
  connexion: {
    presentationPlateforme: "Présentation de la plateforme",
    titreLigne1: "La plateforme de suivi",
    titreLigne2: "scolaire nationale",
    accroche: "Suivez chaque élève, détectez les difficultés tôt et agissez avant qu'il soit trop tard.",
    atouts: [
      { titre: "Suivi en temps réel", description: "Moyennes, absences et alertes mis à jour dès la saisie." },
      { titre: "Détection précoce", description: "L'IA repère les baisses de résultats avant le décrochage." },
      { titre: "Couverture nationale", description: "Tous les établissements du Bénin sur une seule plateforme." },
    ],
    titre: "Connexion",
    sousTitre: "Accédez à votre espace dédié.",
    email: "Email",
    exempleEmail: "votre@email.bj",
    motDePasse: "Mot de passe",
    afficherMotDePasse: "Afficher le mot de passe",
    masquerMotDePasse: "Masquer le mot de passe",
    bloqueTitre: "Accès temporairement bloqué",
    bloqueDetail: "Trop de tentatives échouées. Réessayez dans 15 minutes.",
    erreurIdentifiants: "Email ou mot de passe incorrect.",
    erreurIndisponible: "La connexion est indisponible. Vérifie ta connexion puis réessaie.",
    boutonEnCours: "Connexion…",
    bouton: "Se connecter",
    bienvenue: "Connexion réussie. Bienvenue !",
    probleme: "Problème de connexion ?",
    contacter: "Contactez l'administration",
    oubli: {
      titre: "Mot de passe oublié ?",
      explication: "Saisissez votre adresse email. Un administrateur réinitialisera votre mot de passe et vous contactera.",
      envoyer: "Envoyer la demande",
      annuler: "Annuler",
      emailRequis: "Email requis",
      emailInvalide: "Adresse email invalide",
      envoyee: "Demande envoyée. Un administrateur vous contactera.",
      echec: "Impossible d'envoyer la demande. Réessayez.",
    },
  },
  accessibiliteControles: {
    groupe: "Options d'accessibilité",
    contraste: "Contraste",
    activerContraste: "Activer le contraste élevé",
    desactiverContraste: "Désactiver le contraste élevé",
    tailleTexte: "Taille du texte",
    reduireTexte: "Réduire la taille du texte",
    augmenterTexte: "Augmenter la taille du texte",
    lire: "Lire",
    arreter: "Arrêter",
    rienALire: "Aucun texte principal à lire.",
    lectureIndisponible: "La lecture vocale n'est pas disponible dans ce navigateur.",
    /** Langue de la voix de synthèse */
    voix: "fr-FR",
  },
  horsLigne: {
    bandeau: "Vous êtes hors ligne — données affichées de votre dernière visite",
  },
  miseAJour: {
    titre: "Une nouvelle version d'EduTech est disponible.",
    recharger: "Recharger",
    plusTard: "Plus tard",
  },
  metadonnees: {
    accueil: {
      titre: "EduTech Bénin — Plateforme nationale de suivi scolaire",
      description:
        "Détectez automatiquement les risques de décrochage scolaire. Plateforme nationale de suivi des élèves pour les établissements scolaires du Bénin.",
    },
    connexion: {
      titre: "Connexion — EduTech Bénin",
      description: "Accédez à votre espace EduTech Bénin.",
    },
    localeOpenGraph: "fr_FR",
  },
};

export type Textes = typeof fr;

const en: Textes = {
  commun: {
    nomPlateforme: "EduTech Bénin",
    pays: "Republic of Benin",
    intitule: "National student monitoring platform",
    armoiriesAlt: "Coat of arms of Benin",
    mentionChallenge: "Project selected as part of the challenge organized by the",
  },
  selecteurLangue: {
    libelle: "Language selection",
    fr: "Français",
    en: "English",
  },
  accueil: {
    seConnecter: "Sign in",
    titreLigne1: "No one sees school dropout coming",
    titreLigne2: "until it has already happened.",
    accroche: "Our platform detects it automatically.",
    presentation:
      "EduTech Bénin brings teachers, school principals and national oversight together around a shared goal: taking action before it is too late.",
    acceder: "Access the platform",
    chiffres: {
      eleves: "students monitored",
      etablissements: "schools connected",
      detection: "real-time detection",
      accessible: "accessible",
    },
    commentCaMarche: "How does it work?",
    etapes: [
      { titre: "The teacher records a grade", description: "Results are recorded by term and by subject." },
      { titre: "The platform detects declines", description: "Averages are automatically compared from one term to the next." },
      { titre: "The national level is alerted and can take action", description: "Alerts are escalated to the national level in real time." },
    ],
    titreEspaces: "A platform for every stakeholder",
    espaces: {
      etudiant: { titre: "Student", description: "Track your results and your progress" },
      enseignant: { titre: "Teacher", description: "Manage your students and record grades" },
      directeur: { titre: "School principal", description: "Oversee your school" },
      national: { titre: "National oversight", description: "National overview of alerts and indicators" },
    },
    titreAccessibilite: "Designed for everyone",
    accessibilite: {
      contraste: "High-contrast mode available",
      police: "Adjustable text size",
      lecture: "Read-aloud feature",
      langue: "Plain-language interface (in French)",
    },
    piedDePage: "© 2026 EduTech Bénin",
  },
  connexion: {
    presentationPlateforme: "About the platform",
    titreLigne1: "The national platform",
    titreLigne2: "for student monitoring",
    accroche: "Monitor every student, identify difficulties early and act before it is too late.",
    atouts: [
      { titre: "Real-time monitoring", description: "Averages, absences and alerts are updated as soon as data is entered." },
      { titre: "Early detection", description: "AI identifies declining results before students drop out." },
      { titre: "Nationwide coverage", description: "All schools in Benin on a single platform." },
    ],
    titre: "Sign in",
    sousTitre: "Access your dedicated workspace.",
    email: "Email",
    exempleEmail: "your@email.bj",
    motDePasse: "Password",
    afficherMotDePasse: "Show password",
    masquerMotDePasse: "Hide password",
    bloqueTitre: "Access temporarily blocked",
    bloqueDetail: "Too many failed attempts. Please try again in 15 minutes.",
    erreurIdentifiants: "Incorrect email or password.",
    erreurIndisponible: "Sign-in is currently unavailable. Please check your connection and try again.",
    boutonEnCours: "Signing in…",
    bouton: "Sign in",
    bienvenue: "Signed in successfully. Welcome!",
    probleme: "Trouble signing in?",
    contacter: "Contact the administration",
    oubli: {
      titre: "Forgot your password?",
      explication: "Enter your email address. An administrator will reset your password and contact you.",
      envoyer: "Send request",
      annuler: "Cancel",
      emailRequis: "Email address required",
      emailInvalide: "Invalid email address",
      envoyee: "Request sent. An administrator will contact you.",
      echec: "Unable to send the request. Please try again.",
    },
  },
  accessibiliteControles: {
    groupe: "Accessibility options",
    contraste: "Contrast",
    activerContraste: "Turn on high contrast",
    desactiverContraste: "Turn off high contrast",
    tailleTexte: "Text size",
    reduireTexte: "Decrease text size",
    augmenterTexte: "Increase text size",
    lire: "Read aloud",
    arreter: "Stop",
    rienALire: "No main content to read.",
    lectureIndisponible: "Read-aloud is not available in this browser.",
    voix: "en-US",
  },
  horsLigne: {
    bandeau: "You are offline — showing data from your last visit",
  },
  miseAJour: {
    titre: "A new version of EduTech is available.",
    recharger: "Reload",
    plusTard: "Later",
  },
  metadonnees: {
    accueil: {
      titre: "EduTech Bénin — National Student Monitoring Platform",
      description:
        "Automatically detect the risk of school dropout. A national student monitoring platform for schools in Benin.",
    },
    connexion: {
      titre: "Sign in — EduTech Bénin",
      description: "Access your EduTech Bénin workspace.",
    },
    localeOpenGraph: "en_US",
  },
};

export const TEXTES: Record<Langue, Textes> = { fr, en };

/** Textes français : valeurs par défaut des composants partagés avec le reste de l'application. */
export const TEXTES_FR = fr;
