"use client";

import { FormEvent, useRef, useEffect, useState } from "react";

type Result = Record<string, unknown>;

type Message = {
  id: number;
  role: "user" | "assistant" | "error";
  text: string;
  results?: Result[];
};

const examples = [
  "Combien d'étudiants à risque dans l'Atlantique ?",
  "Liste les alertes de niveau élevé",
  "Combien d'étudiants au Lycée Mathieu Bouké ?",
  "Combien d'absences injustifiées ce trimestre ?",
];

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function resultTitle(result: Result) {
  const student = result.etudiant as Result | undefined;
  const source = student ?? result;
  const prenom = getString(source.prenom);
  const nom = getString(source.nom);
  return `${prenom} ${nom}`.trim() || "Résultat";
}

function resultMeta(result: Result) {
  const student = result.etudiant as Result | undefined;
  const source = student ?? result;
  const establishment = source.etablissement as Result | undefined;
  const name = getString(establishment?.nom);
  const department = getString(establishment?.departement);
  const level = getString(source.niveau);
  const risk = getString(result.niveauRisque);
  return [name, department, level, risk ? `Risque ${risk === "eleve" ? "élevé" : "moyen"}` : ""]
    .filter(Boolean)
    .join(" · ");
}

export default function AssistantChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendQuestion(value: string) {
    const trimmed = value.trim();
    if (!trimmed || sending) return;

    const messageId = Date.now();
    setMessages((current) => [
      ...current,
      { id: messageId, role: "user", text: trimmed },
      { id: messageId + 1, role: "assistant", text: "L'assistant réfléchit…" },
    ]);
    setQuestion("");
    setSending(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Impossible de traiter la question.");

      setMessages((current) =>
        current.map((m) =>
          m.id === messageId + 1
            ? { ...m, text: data.reponse, results: data.donnees ?? [] }
            : m
        )
      );
    } catch (error) {
      const text = error instanceof Error ? error.message : "Une erreur réseau est survenue.";
      setMessages((current) =>
        current.map((m) =>
          m.id === messageId + 1 ? { ...m, role: "error", text: `Erreur : ${text}` } : m
        )
      );
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendQuestion(question);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm" aria-label="Assistant IA">
      {/* ── Messages area ─────────────────────────────────── */}
      <div
        className="min-h-96 max-h-128 space-y-4 overflow-y-auto bg-page p-5 sm:p-7"
        aria-live="polite"
        aria-atomic="false"
      >
        {messages.length === 0 ? (
          <div className="flex min-h-80 items-center justify-center text-center">
            <div className="max-w-lg">
              <div aria-hidden="true" className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-light">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                  <path d="M14 3C8.477 3 4 7.477 4 13c0 2.21.713 4.254 1.923 5.915L4.5 23l4.085-1.423A9.95 9.95 0 0 0 14 23c5.523 0 10-4.477 10-10S19.523 3 14 3z" stroke="#C2410C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 13h.01M14 13h.01M19 13h.01" stroke="#C2410C" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">
                Questions simples
              </p>
              <h2 className="mt-2 text-2xl font-bold text-ink">
                Posez une question sur les données scolaires
              </h2>
              <p className="mt-3 text-ink-secondary">
                L'assistant cherche les informations utiles et vous les présente clairement.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <article
                className={`max-w-[90%] rounded-2xl px-4 py-3 sm:max-w-[78%] ${
                  message.role === "user"
                    ? "bg-ink text-surface"
                    : message.role === "error"
                      ? "border border-red-200 bg-red-50 text-red-900"
                      : "border border-border bg-surface text-ink shadow-sm"
                }`}
              >
                <p className="leading-7">{message.text}</p>

                {message.results && message.results.length > 0 && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-border bg-page">
                    <p className="border-b border-border px-3 py-2 text-sm font-semibold text-ink-secondary">
                      Résultats : {message.results.length}
                    </p>
                    <ul className="divide-y divide-border">
                      {message.results.map((result, index) => (
                        <li key={`${message.id}-${index}`} className="px-3 py-2">
                          <p className="font-semibold text-ink">{resultTitle(result)}</p>
                          <p className="text-sm text-ink-secondary">
                            {resultMeta(result) || "Donnée correspondante"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            </div>
          ))
        )}

        {/* Chargement visible */}
        {sending && (
          <div className="flex justify-start" aria-live="assertive">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">
              <span
                aria-label="L'assistant réfléchit"
                className="flex gap-1"
                aria-busy="true"
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{ animationDelay: `${i * 0.2}s` }}
                    className="h-2 w-2 animate-bounce rounded-full bg-brand"
                    aria-hidden="true"
                  />
                ))}
              </span>
              <span className="text-sm text-ink-secondary">L'assistant réfléchit…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input area ────────────────────────────────────── */}
      <div className="border-t border-border bg-surface p-5 sm:p-7">
        {messages.length === 0 && (
          <div className="mb-5">
            <p className="mb-3 text-sm font-semibold text-ink">Exemples de questions</p>
            <div className="flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => void sendQuestion(example)}
                  disabled={sending}
                  className="rounded-lg border border-brand/30 bg-brand-light px-3 py-2 text-left text-sm font-medium text-brand-dark transition hover:border-brand hover:bg-brand/10 focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="assistant-question" className="mb-2 block text-sm font-semibold text-ink">
              Votre question
            </label>
            <input
              id="assistant-question"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={sending}
              placeholder="Ex. Combien d'étudiants sont en Terminale D ?"
              className="w-full rounded-lg border border-border px-4 py-3 text-ink placeholder:text-ink-secondary/50 transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark disabled:bg-page"
            />
          </div>
          <button
            type="submit"
            disabled={sending || !question.trim()}
            aria-label="Envoyer la question"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 font-semibold text-ink transition hover:bg-brand-dark hover:text-surface focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M16 9H2M16 9L10 3M16 9l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {sending ? "Envoi…" : "Envoyer"}
          </button>
        </form>
      </div>
    </section>
  );
}
