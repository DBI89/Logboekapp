import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { documenten, documentObjecten, fasen, objecten } from "@/db/schema";

export default async function Documenten({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const db = await getDb();
  const docs = await db.select({ d: documenten, fase: fasen.code }).from(documenten).innerJoin(fasen, eq(fasen.id, documenten.faseId)).where(eq(documenten.projectId, projectId));
  const ids = docs.map((x) => x.d.id);
  const koppels = ids.length
    ? await db.select({ documentId: documentObjecten.documentId, code: objecten.code }).from(documentObjecten).innerJoin(objecten, eq(objecten.id, documentObjecten.objectId)).where(inArray(documentObjecten.documentId, ids))
    : [];
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Documenten</h1>
        <p className="mt-1 text-sm text-grijs">Documentenlijst (in de demo voorbeelddata). Per document stelt de app de tabellen voor het rapport samen.</p>
      </header>
      <div className="kaart overflow-x-auto">
        <table className="tabel min-w-[640px]">
          <thead><tr><th>Nummer</th><th>Titel</th><th>Discipline</th><th>Fase</th><th>Revisie</th><th>Objecten</th></tr></thead>
          <tbody>
            {docs.sort((a, b) => a.d.nummer.localeCompare(b.d.nummer)).map(({ d, fase }) => (
              <tr key={d.id}>
                <td className="font-mono text-xs"><Link className="text-blauw hover:underline" href={`/project/${projectId}/documenten/${d.nummer}`}>{d.nummer}</Link></td>
                <td><Link className="hover:text-blauw" href={`/project/${projectId}/documenten/${d.nummer}`}>{d.titel}</Link></td>
                <td>{d.discipline}</td>
                <td>{fase}</td>
                <td>{d.revisie}</td>
                <td className="font-mono text-xs">{koppels.filter((k) => k.documentId === d.id).map((k) => k.code).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
