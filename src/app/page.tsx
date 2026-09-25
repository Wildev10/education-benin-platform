import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">EduTech Bénin</h1>
      <p>Plateforme de suivi et d'alerte décrochage scolaire.</p>
      <pre className="mt-4 bg-gray-100 p-4 rounded text-sm">
        {JSON.stringify(session, null, 2)}
      </pre>
    </main>
  );
}