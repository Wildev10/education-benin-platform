import AssistantChat from "@/components/AssistantChat";

export default function AdminAssistantPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">Outil d’analyse</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Assistant IA</h1>
        <p className="mt-3 text-lg leading-8 text-slate-700">Posez une question simple sur les données scolaires.</p>
      </div>
      <AssistantChat />
    </main>
  );
}
