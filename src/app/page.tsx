import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { projecten } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function Start() {
  const db = await getDb();
  const [p] = await db.select().from(projecten).limit(1);
  if (!p)
    return (
      <main className="mx-auto max-w-lg p-8">
        <h1 className="text-xl font-semibold">Nog geen project</h1>
        <p className="mt-2 text-grijs">Vul de demodata met <code>npm run seed</code> en ververs de pagina.</p>
      </main>
    );
  redirect(`/project/${p.id}/mijn-werk`);
}
