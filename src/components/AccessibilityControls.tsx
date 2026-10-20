"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  abonnerPreferences,
  enregistrerPreferences,
  lirePreferences,
  preferencesServeur,
  type TaillePolice,
} from "@/lib/preferences-accessibilite";
import { TEXTES_FR, type Textes } from "@/lib/i18n/textes";
import { IconeArret, IconeContraste, IconeLecture } from "@/components/ui/Icones";

type FontSize = TaillePolice;

const fontSizeSteps: FontSize[] = ["normal", "large", "x-large"];

const fontSizeLabel: Record<FontSize, string> = {
  normal: "A",
  large: "A+",
  "x-large": "A++",
};

export default function AccessibilityControls({
  variant = "dark",
  textes = TEXTES_FR.accessibiliteControles,
}: {
  variant?: "dark" | "light";
  /** Libellés et voix de lecture ; français par défaut (reste de l'application) */
  textes?: Textes["accessibiliteControles"];
}) {
  const t = textes;
  // Préférences lues dans localStorage ; valeurs par défaut au rendu serveur et à l'hydratation
  const preferences = useSyncExternalStore(abonnerPreferences, lirePreferences, preferencesServeur);
  const { contrasteEleve: highContrast, taille: fontSize } = preferences;
  const [isReading, setIsReading] = useState(false);
  const [speechMessage, setSpeechMessage] = useState("");

  // Applique les préférences à la page ; localStorage n'est écrit que sur une action de l'utilisateur
  useEffect(() => {
    document.documentElement.dataset.theme = highContrast ? "high-contrast" : "default";
    document.documentElement.dataset.fontSize = fontSize;
  }, [highContrast, fontSize]);

  useEffect(() => () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  function toggleContrast() {
    const courantes = lirePreferences();
    enregistrerPreferences({ ...courantes, contrasteEleve: !courantes.contrasteEleve });
  }

  function changeFontSize(direction: "increase" | "decrease") {
    const courantes = lirePreferences();
    const idx = fontSizeSteps.indexOf(courantes.taille);
    const taille = direction === "increase" ? fontSizeSteps[Math.min(idx + 1, 2)] : fontSizeSteps[Math.max(idx - 1, 0)];
    enregistrerPreferences({ ...courantes, taille });
  }

  function startReading() {
    const main = document.querySelector("main");
    const text = main?.textContent?.replace(/\s+/g, " ").trim();
    if (!text) {
      setSpeechMessage(t.rienALire);
      return;
    }
    if (!("speechSynthesis" in window)) {
      setSpeechMessage(t.lectureIndisponible);
      return;
    }
    setSpeechMessage("");
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = t.voix;
    // Voix installée dans la langue de la page (anglaise sur les pages en anglais), si le navigateur en propose une
    const prefixe = t.voix.slice(0, 2).toLowerCase();
    const voix = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(prefixe));
    if (voix) utterance.voice = voix;
    utterance.rate = 0.85;
    utterance.onend = () => setIsReading(false);
    utterance.onerror = () => setIsReading(false);
    setIsReading(true);
    window.speechSynthesis.speak(utterance);
  }

  function stopReading() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsReading(false);
    setSpeechMessage("");
  }

  const canDecrease = fontSize !== "normal";
  const canIncrease = fontSize !== "x-large";

  const d = variant === "dark";

  /* Shared base classes */
  const ring = "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2";
  const ringOffset = d ? "focus-visible:ring-offset-ink" : "focus-visible:ring-offset-surface";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2" aria-label={t.groupe}>

      {/* ── Contrast toggle ─────────────────────────── */}
      <button
        type="button"
        aria-pressed={highContrast}
        onClick={toggleContrast}
        title={highContrast ? t.desactiverContraste : t.activerContraste}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition ${ring} ${ringOffset} ${
          highContrast
            ? d
              ? "border-surface bg-surface text-ink"
              : "border-ink bg-ink text-surface"
            : d
              ? "border-white/25 bg-white/10 text-surface hover:bg-white/20"
              : "border-border bg-surface text-ink hover:bg-page"
        }`}
      >
        <IconeContraste taille={16} />
        <span>{t.contraste}</span>
        {highContrast && (
          <span aria-hidden="true" className={`rounded px-1 py-px text-xs font-bold ${d ? "bg-brand text-ink" : "bg-brand text-ink"}`}>
            ON
          </span>
        )}
      </button>

      {/* ── Font size ────────────────────────────────── */}
      <div
        role="group"
        aria-label={t.tailleTexte}
        className={`flex items-stretch overflow-hidden rounded-lg border ${d ? "border-white/25 bg-white/10" : "border-border bg-surface"}`}
      >
        <button
          type="button"
          aria-label={t.reduireTexte}
          onClick={() => changeFontSize("decrease")}
          disabled={!canDecrease}
          className={`px-3 py-2 text-sm font-semibold transition ${ring} ${
            d
              ? "text-surface hover:bg-white/20 disabled:opacity-30"
              : "text-ink hover:bg-page disabled:opacity-30"
          } disabled:cursor-not-allowed`}
        >
          A−
        </button>

        <span
          aria-hidden="true"
          className={`flex min-w-10 items-center justify-center border-x text-xs font-semibold ${
            d ? "border-white/20 text-surface/70" : "border-border text-ink-secondary"
          }`}
        >
          {fontSizeLabel[fontSize]}
        </span>

        <button
          type="button"
          aria-label={t.augmenterTexte}
          onClick={() => changeFontSize("increase")}
          disabled={!canIncrease}
          className={`px-3 py-2 text-sm font-semibold transition ${ring} ${
            d
              ? "text-surface hover:bg-white/20 disabled:opacity-30"
              : "text-ink hover:bg-page disabled:opacity-30"
          } disabled:cursor-not-allowed`}
        >
          A+
        </button>
      </div>

      {/* ── Read aloud ───────────────────────────────── */}
      {isReading ? (
        <button
          type="button"
          onClick={stopReading}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${ringOffset} ${
            d
              ? "border-red-400/50 bg-red-500/20 text-red-200 hover:bg-red-500/30"
              : "border-red-200 bg-red-50 text-red-900 hover:bg-red-100"
          }`}
        >
          <IconeArret taille={16} />
          <span>{t.arreter}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={startReading}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition ${ring} ${ringOffset} ${
            d
              ? "border-brand/40 bg-brand/15 text-surface hover:bg-brand/25"
              : "border-brand/30 bg-brand-light text-brand-dark hover:border-brand/50"
          }`}
        >
          <IconeLecture taille={16} />
          <span>{t.lire}</span>
        </button>
      )}

      {speechMessage && (
        <span role="status" className={`basis-full text-right text-sm ${d ? "text-surface/60" : "text-ink-secondary"}`}>
          {speechMessage}
        </span>
      )}
    </div>
  );
}
