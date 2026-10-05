"use client";

import { useEffect, useState } from "react";

type FontSize = "normal" | "large" | "x-large";

const fontSizeSteps: FontSize[] = ["normal", "large", "x-large"];

const fontSizeLabel: Record<FontSize, string> = {
  normal: "A",
  large: "A+",
  "x-large": "A++",
};

export default function AccessibilityControls({
  variant = "dark",
}: {
  variant?: "dark" | "light";
}) {
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("normal");
  const [isReading, setIsReading] = useState(false);
  const [speechMessage, setSpeechMessage] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const savedContrast = localStorage.getItem("accessibility-contrast") === "high";
    const savedFontSize = localStorage.getItem("accessibility-font-size") as FontSize | null;
    setHighContrast(savedContrast);
    setFontSize(savedFontSize === "large" || savedFontSize === "x-large" ? savedFontSize : "normal");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.dataset.theme = highContrast ? "high-contrast" : "default";
    document.documentElement.dataset.fontSize = fontSize;
    localStorage.setItem("accessibility-contrast", highContrast ? "high" : "default");
    localStorage.setItem("accessibility-font-size", fontSize);
  }, [hydrated, highContrast, fontSize]);

  useEffect(() => () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  function toggleContrast() {
    setHighContrast((current) => !current);
  }

  function changeFontSize(direction: "increase" | "decrease") {
    setFontSize((current) => {
      const idx = fontSizeSteps.indexOf(current);
      if (direction === "increase") return fontSizeSteps[Math.min(idx + 1, 2)];
      return fontSizeSteps[Math.max(idx - 1, 0)];
    });
  }

  function startReading() {
    const main = document.querySelector("main");
    const text = main?.textContent?.replace(/\s+/g, " ").trim();
    if (!text) {
      setSpeechMessage("Aucun texte principal à lire.");
      return;
    }
    if (!("speechSynthesis" in window)) {
      setSpeechMessage("La lecture vocale n'est pas disponible dans ce navigateur.");
      return;
    }
    setSpeechMessage("");
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
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
    <div className="flex flex-wrap items-center justify-end gap-2" aria-label="Options d'accessibilité">

      {/* ── Contrast toggle ─────────────────────────── */}
      <button
        type="button"
        aria-pressed={highContrast}
        onClick={toggleContrast}
        title={highContrast ? "Désactiver le contraste élevé" : "Activer le contraste élevé"}
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
        <span aria-hidden="true" className="text-base leading-none">◐</span>
        <span>Contraste</span>
        {highContrast && (
          <span aria-hidden="true" className={`rounded px-1 py-px text-xs font-bold ${d ? "bg-brand text-ink" : "bg-brand text-ink"}`}>
            ON
          </span>
        )}
      </button>

      {/* ── Font size ────────────────────────────────── */}
      <div
        role="group"
        aria-label="Taille du texte"
        className={`flex items-stretch overflow-hidden rounded-lg border ${d ? "border-white/25 bg-white/10" : "border-border bg-surface"}`}
      >
        <button
          type="button"
          aria-label="Réduire la taille du texte"
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
          aria-label="Augmenter la taille du texte"
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
          <span aria-hidden="true">■</span>
          <span>Arrêter</span>
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
          <span aria-hidden="true">▶</span>
          <span>Lire</span>
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
