"use client";

import { useEffect, useState } from "react";

type FontSize = "normal" | "large" | "x-large";

export default function AccessibilityControls() {
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
      if (direction === "increase") return current === "normal" ? "large" : "x-large";
      return current === "x-large" ? "large" : "normal";
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
      setSpeechMessage("La lecture vocale n’est pas disponible dans ce navigateur.");
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

  return (
    <div className="flex flex-wrap items-center justify-end gap-2" aria-label="Options d’accessibilité">
      <button
        type="button"
        aria-pressed={highContrast}
        onClick={toggleContrast}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
      >
        <span aria-hidden="true">◐</span> Contraste
      </button>
      <div className="flex items-center rounded-lg border border-slate-300 bg-white" aria-label="Taille du texte">
        <button type="button" aria-label="Réduire la taille du texte" onClick={() => changeFontSize("decrease")} className="px-2.5 py-2 text-sm font-bold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">A−</button>
        <span aria-hidden="true" className="border-x border-slate-200 px-1 text-sm text-slate-500">A</span>
        <button type="button" aria-label="Augmenter la taille du texte" onClick={() => changeFontSize("increase")} className="px-2.5 py-2 text-sm font-bold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">A+</button>
      </div>
      {isReading ? (
        <button type="button" onClick={stopReading} className="rounded-lg border border-red-300 bg-red-50 px-2.5 py-2 text-sm font-semibold text-red-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2">
          <span aria-hidden="true">■</span> Arrêter la lecture
        </button>
      ) : (
        <button type="button" onClick={startReading} className="rounded-lg border border-teal-300 bg-teal-50 px-2.5 py-2 text-sm font-semibold text-teal-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">
          <span aria-hidden="true">▶</span> Lire à voix haute
        </button>
      )}
      {speechMessage && <span role="status" className="basis-full text-right text-sm text-slate-700">{speechMessage}</span>}
    </div>
  );
}
