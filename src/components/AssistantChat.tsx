"use client";

import { FormEvent, useState } from "react";

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

  async function sendQuestion(value: string) {
    const trimmed = value.trim();
    if (!trimmed || sending) return;

    const messageId = Date.now();
    setMessages((current) => [
      ...current,
      { id: messageId, role: "user", text: trimmed },
      { id: messageId + 1, role: "assistant", text: "L’assistant réfléchit..." },
    ]);
    setQuestion("");
    setSending(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Impossible de traiter la question.");

      setMessages((current) => current.map((message) => (
        message.id === messageId + 1
          ? { ...message, text: data.reponse, results: data.donnees ?? [] }
          : message
      )));
    } catch (error) {
      const text = error instanceof Error ? error.message : "Une erreur réseau est survenue.";
      setMessages((current) => current.map((message) => (
        message.id === messageId + 1
          ? { ...message, role: "error", text: `Erreur : ${text}` }
          : message
      )));
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendQuestion(question);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Assistant IA">
      <div className="min-h-112 max-h-152 space-y-4 overflow-y-auto bg-slate-50 p-5 sm:p-7" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex min-h-96 items-center justify-center text-center">
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-700">Questions simples</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">Posez une question sur les données scolaires</h2>
              <p className="mt-3 text-slate-700">L’assistant cherche les informations utiles et vous les présente.</p>
            </div>
          </div>
        ) : messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <article className={`max-w-[90%] rounded-2xl px-4 py-3 sm:max-w-[78%] ${message.role === "user" ? "bg-teal-700 text-white" : message.role === "error" ? "border border-red-200 bg-red-50 text-red-900" : "border border-slate-200 bg-white text-slate-900"}`}>
              <p className="leading-7">{message.text}</p>
              {message.results && message.results.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <p className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Résultats affichés : {message.results.length}</p>
                  <ul className="divide-y divide-slate-200">
                    {message.results.map((result, index) => (
                      <li key={`${message.id}-${index}`} className="px-3 py-2">
                        <p className="font-semibold text-slate-950">{resultTitle(result)}</p>
                        <p className="text-sm text-slate-700">{resultMeta(result) || "Donnée correspondante"}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 p-5 sm:p-7">
        {messages.length === 0 && (
          <div className="mb-5">
            <p className="mb-2 text-sm font-semibold text-slate-800">Exemples de questions</p>
            <div className="flex flex-wrap gap-2">
              {examples.map((example) => (
                <button key={example} type="button" onClick={() => void sendQuestion(example)} disabled={sending} className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-left text-sm font-medium text-teal-900 transition hover:bg-teal-100 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="assistant-question" className="mb-2 block text-sm font-semibold text-slate-800">Votre question</label>
            <input id="assistant-question" type="text" value={question} onChange={(event) => setQuestion(event.target.value)} disabled={sending} placeholder="Ex. Combien d'étudiants sont en Terminale D ?" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-950 placeholder:text-slate-500 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-slate-100" />
          </div>
          <button type="submit" disabled={sending || !question.trim()} className="rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400">
            {sending ? "Envoi..." : "Envoyer"}
          </button>
        </form>
        <p className="mt-3 text-sm text-slate-600" aria-live="polite">{sending ? "L’assistant réfléchit..." : ""}</p>
      </div>
    </section>
  );
}
