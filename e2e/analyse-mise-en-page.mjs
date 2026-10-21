// Analyse de la mise en page d'une page affichée, dans le navigateur : défilement
// horizontal, éléments qui sortent de l'écran, textes coupés ou qui débordent,
// zones tactiles, tableaux, graphiques, petits textes et contraste des textes.
// Utilisé par le scénario « responsive » et par les audits ponctuels.

/** Largeurs testées : téléphones, tablettes, ordinateurs et téléphone en paysage. */
export const FORMATS = [
  { nom: "320", largeur: 320, hauteur: 640 },
  { nom: "360", largeur: 360, hauteur: 740 },
  { nom: "375", largeur: 375, hauteur: 812 },
  { nom: "390", largeur: 390, hauteur: 844 },
  { nom: "414", largeur: 414, hauteur: 896 },
  { nom: "768", largeur: 768, hauteur: 1024 },
  { nom: "820", largeur: 820, hauteur: 1180 },
  { nom: "1024", largeur: 1024, hauteur: 768 },
  { nom: "1280", largeur: 1280, hauteur: 800 },
  { nom: "1440", largeur: 1440, hauteur: 900 },
  { nom: "1920", largeur: 1920, hauteur: 1080 },
  { nom: "paysage-844x390", largeur: 844, hauteur: 390 },
];

/**
 * Zoom du navigateur à 200 % sur une fenêtre de 1280 × 800 : la page dispose de
 * 640 × 400 px CSS, affichés avec des pixels deux fois plus grands.
 */
export const ZOOM_200 = { nom: "zoom-200", largeur: 640, hauteur: 400, echelle: 2 };

/** Largeur jusqu'à laquelle on exige des zones tactiles de 44 × 44 px (téléphones et tablettes). */
export const LARGEUR_MAX_TACTILE = 1024;

/**
 * Analyse la page courante. `cibleTactile` : taille minimale exigée des zones
 * cliquables (0 pour ne pas vérifier). `contraste` : calcule aussi le contraste des textes.
 */
export function analyserPage(page, { cibleTactile = 44, contraste = false } = {}) {
  return page.evaluate(
    ({ cibleTactile, contraste }) => {
      const doc = document.documentElement;
      const vw = doc.clientWidth;
      const resultat = {
        largeurVue: vw,
        debordementHorizontal: Math.max(0, doc.scrollWidth - vw),
        depassements: [],
        textesCoupes: [],
        textesQuiDebordent: [],
        ciblesPetites: [],
        tableaux: [],
        graphiques: [],
        petitsTextes: [],
        contrastes: [],
      };

      const style = (el) => getComputedStyle(el);
      const decrire = (el) => {
        const classes = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
        const texte = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50);
        return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${classes ? `.${classes}` : ""}${texte ? ` « ${texte} »` : ""}`;
      };
      const masque = (el) => {
        for (let a = el; a && a !== document.body; a = a.parentElement) {
          const s = style(a);
          if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return true;
          // Texte réservé aux lecteurs d'écran (sr-only) : volontairement hors de la vue
          if (s.position === "absolute" && s.clip === "rect(0px, 0px, 0px, 0px)") return true;
          if (s.clipPath === "inset(50%)") return true;
        }
        return false;
      };
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !masque(el);
      };
      /**
       * Ancêtre qui découpe ou fait défiler horizontalement son contenu. Un élément
       * en position absolue n'est découpé que par les ancêtres de son bloc de
       * positionnement : sinon il s'échappe du cadre (et peut élargir la page).
       */
      const conteneurHorizontal = (el) => {
        let a = el;
        while (a && a !== document.body && a !== doc) {
          const position = style(a).position;
          a = position === "fixed" ? null : position === "absolute" ? a.offsetParent : a.parentElement;
          if (!a || a === document.body || a === doc) return null;
          if (["auto", "scroll", "hidden", "clip"].includes(style(a).overflowX)) return a;
        }
        return null;
      };
      const texteDirect = (el) =>
        [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0);

      const tous = [...document.body.querySelectorAll("*")].filter((el) => !(el instanceof SVGElement && el.tagName !== "svg"));
      const visibles = tous.filter(visible);

      // ── Éléments qui sortent de l'écran sans conteneur de défilement ──
      // Les textes réservés aux lecteurs d'écran comptent aussi : invisibles, ils
      // élargissent quand même la page s'ils s'échappent de leur cadre.
      const affiches = tous.filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        for (let a = el; a && a !== document.body; a = a.parentElement) {
          const s = style(a);
          if (s.display === "none" || s.visibility === "hidden") return false;
        }
        return true;
      });
      const sortants = new Set();
      for (const el of affiches) {
        const r = el.getBoundingClientRect();
        if (r.right <= vw + 1 && r.left >= -1) continue;
        if (style(el).position === "fixed" && (r.right <= 0 || r.left >= vw)) continue; // hors champ volontaire
        if (conteneurHorizontal(el)) continue;
        sortants.add(el);
      }
      for (const el of sortants) {
        if (el.parentElement && sortants.has(el.parentElement)) continue; // seul le plus externe compte
        const r = el.getBoundingClientRect();
        resultat.depassements.push({ element: decrire(el), gauche: Math.round(r.left), droite: Math.round(r.right) });
      }

      // ── Textes coupés (découpés par leur cadre) et textes qui débordent de leur cadre ──
      for (const el of visibles) {
        if (!texteDirect(el)) continue;
        const s = style(el);
        if (s.display === "inline" || el.tagName === "svg") continue;
        const largeurEnTrop = el.scrollWidth - el.clientWidth;
        const hauteurEnTrop = el.scrollHeight - el.clientHeight;
        const decoupeX = ["hidden", "clip"].includes(s.overflowX);
        const decoupeY = ["hidden", "clip"].includes(s.overflowY);
        if (decoupeX && largeurEnTrop > 1) {
          resultat.textesCoupes.push({ element: decrire(el), sens: "largeur", ellipse: s.textOverflow === "ellipsis", titre: !!el.getAttribute("title") });
        } else if (decoupeY && hauteurEnTrop > 2 && !["SELECT", "TEXTAREA", "INPUT"].includes(el.tagName)) {
          resultat.textesCoupes.push({ element: decrire(el), sens: "hauteur", ellipse: s.webkitLineClamp !== "none" && !!s.webkitLineClamp, titre: !!el.getAttribute("title") });
        } else if (!decoupeX && largeurEnTrop > 1 && !["auto", "scroll"].includes(s.overflowX)) {
          resultat.textesQuiDebordent.push({ element: decrire(el), enTrop: largeurEnTrop });
        }
      }

      // ── Zones tactiles ──
      if (cibleTactile > 0) {
        const cliquables = document.body.querySelectorAll(
          'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="switch"], [role="menuitem"]'
        );
        const rectsCibles = [...cliquables].filter((el) => !el.disabled && visible(el)).map((el) => [el, el.getBoundingClientRect()]);
        /** Exception d'espacement (WCAG 2.5.8) : un cercle de 24 px centré sur la cible ne touche aucune autre cible. */
        const bienEspacee = (el, r) => {
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          return rectsCibles.every(([autre, ra]) => {
            if (autre === el || autre.contains(el) || el.contains(autre)) return true;
            const dx = Math.max(ra.left - cx, 0, cx - ra.right), dy = Math.max(ra.top - cy, 0, cy - ra.bottom);
            return Math.hypot(dx, dy) >= 12;
          });
        };
        for (const el of cliquables) {
          if (el.disabled) continue;
          let cible = el;
          // Case à cocher, bouton radio ou champ fichier masqué : c'est l'étiquette qu'on touche
          // Champ fichier masqué : on touche sa zone de dépôt, vérifiée pour elle-même
          if (el.tagName === "INPUT" && el.type === "file" && masque(el)) continue;
          if (el.tagName === "INPUT" && ["checkbox", "radio", "file"].includes(el.type)) {
            cible = el.closest("label") ?? (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null) ?? el;
          }
          if (!visible(cible)) continue;
          // Lien au fil d'un texte : exception prévue par les règles d'accessibilité (WCAG 2.5.8)
          if (el.tagName === "A") {
            const parent = el.parentElement;
            const texteParent = (parent?.textContent ?? "").trim().length;
            if (style(el).display === "inline" && parent && texteParent > (el.textContent ?? "").trim().length + 15) continue;
          }
          const r = cible.getBoundingClientRect();
          if (r.width < cibleTactile - 0.5 || r.height < cibleTactile - 0.5) {
            if (cibleTactile <= 24 && bienEspacee(el, r)) continue;
            resultat.ciblesPetites.push({ element: decrire(el), largeur: Math.round(r.width), hauteur: Math.round(r.height) });
          }
        }
      }

      // ── Tableaux : défilement interne propre ou présentation adaptée ──
      for (const table of document.body.querySelectorAll("table")) {
        if (!visible(table)) continue;
        const conteneur = conteneurHorizontal(table);
        const rc = (conteneur ?? table.parentElement).getBoundingClientRect();
        const rt = table.getBoundingClientRect();
        const defile = !!conteneur && ["auto", "scroll"].includes(style(conteneur).overflowX);
        const tropLarge = rt.width > rc.width + 1;
        resultat.tableaux.push({
          element: decrire(table).slice(0, 60),
          largeurTableau: Math.round(rt.width),
          largeurVisible: Math.round(Math.min(rc.width, vw)),
          defilementInterne: defile && tropLarge,
          probleme: tropLarge && !defile ? "tableau plus large que son cadre, sans défilement interne" : rc.right > vw + 1 ? "cadre du tableau hors de l'écran" : null,
        });
      }

      // ── Graphiques ──
      for (const svg of document.body.querySelectorAll("svg.recharts-surface")) {
        if (!visible(svg)) continue;
        const r = svg.getBoundingClientRect();
        const etiquettes = [...svg.querySelectorAll(".recharts-cartesian-axis-tick-value, .recharts-cartesian-axis-tick text")]
          .filter(visible)
          .map((t) => ({ texte: t.textContent, r: t.getBoundingClientRect(), axe: t.closest(".recharts-xAxis") ? "x" : "y" }));
        let chevauchements = 0;
        for (let i = 0; i < etiquettes.length; i++) {
          for (let j = i + 1; j < etiquettes.length; j++) {
            const a = etiquettes[i], b = etiquettes[j];
            if (a.axe !== b.axe) continue;
            const recouvreX = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
            const recouvreY = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
            if (recouvreX > 1 && recouvreY > 1) chevauchements++;
          }
        }
        const sortantes = etiquettes.filter((e) => e.r.left < r.left - 2 || e.r.right > r.right + 2).length;
        resultat.graphiques.push({
          element: decrire(svg.closest("[role=img], [aria-label]") ?? svg).slice(0, 70),
          largeur: Math.round(r.width),
          hauteur: Math.round(r.height),
          chevauchements,
          etiquettesHorsCadre: sortantes,
          probleme:
            r.right > vw + 1 ? "graphique hors de l'écran"
            : r.width < 200 ? "graphique trop étroit"
            : r.height < 140 ? "graphique trop bas"
            : chevauchements ? "étiquettes d'axe qui se chevauchent"
            : sortantes ? "étiquettes d'axe coupées"
            : null,
        });
      }

      // ── Petits textes (moins de 12 px) ──
      for (const el of visibles) {
        if (!texteDirect(el)) continue;
        const taille = parseFloat(style(el).fontSize);
        if (taille < 12) resultat.petitsTextes.push({ element: decrire(el), taille });
      }

      // ── Contraste des textes (couleur du texte sur le premier fond opaque) ──
      if (contraste) {
        const rgba = (c) => {
          const m = c.match(/rgba?\(([^)]+)\)/);
          if (!m) return null;
          const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
          return { r, g, b, a };
        };
        const lum = ({ r, g, b }) => {
          const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const fond = (el) => {
          for (let a = el; a; a = a.parentElement) {
            const s = style(a);
            if (s.backgroundImage !== "none" && !s.backgroundImage.startsWith("url")) return null; // dégradé : non calculable
            const c = rgba(s.backgroundColor);
            if (c && c.a >= 0.99) return c;
          }
          return { r: 255, g: 255, b: 255, a: 1 };
        };
        const vus = new Set();
        for (const el of visibles) {
          if (!texteDirect(el)) continue;
          const s = style(el);
          const texte = rgba(s.color);
          const f = fond(el);
          if (!texte || !f || texte.a < 0.99) continue;
          const [l1, l2] = [lum(texte), lum(f)].sort((a, b) => b - a);
          const ratio = (l1 + 0.05) / (l2 + 0.05);
          const taille = parseFloat(s.fontSize);
          const grand = taille >= 24 || (taille >= 18.66 && Number(s.fontWeight) >= 700);
          const seuil = grand ? 3 : 4.5;
          const cle = `${s.color}|${f.r},${f.g},${f.b}`;
          if (ratio < seuil && !vus.has(cle)) {
            vus.add(cle);
            resultat.contrastes.push({ element: decrire(el), ratio: Math.round(ratio * 100) / 100, seuil });
          }
        }
      }
      return resultat;
    },
    { cibleTactile, contraste }
  );
}

/** Applique les préférences d'accessibilité (taille du texte, contraste) avant le chargement des pages. */
export async function preferencesAccessibilite(contexte, { taille = "normal", contrasteEleve = false } = {}) {
  await contexte.addInitScript(
    ({ taille, contrasteEleve }) => {
      try {
        localStorage.setItem("accessibility-font-size", taille);
        localStorage.setItem("accessibility-contrast", contrasteEleve ? "high" : "default");
      } catch {
        // stockage indisponible : préférences par défaut
      }
    },
    { taille, contrasteEleve }
  );
}
