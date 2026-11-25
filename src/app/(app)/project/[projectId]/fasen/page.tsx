import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { delegaties, fasen, projecten } from "@/db/schema";
import { faseOverzicht, openIssuesVorigeFase } from "@/domain/fasen";
import { isOntwerpleider } from "@/domain/rechten";
import { TYPE_MEERVOUD } from "@/domain/labels";
import { huidigeActor, projectLeden } from "@/lib/sessie";
import { FaseStart, Delegatie } from "@/components/FaseStart";
import { soortVanType } from "@/lib/soorten";
import type { RegistratieType } from "@/domain/types";

const TYPEN: RegistratieType[] = ["afwijking", "wijziging", "ontwerpkeuze", "raakvlak", "issue"];

export default async function Fasen({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const db = await getDb();
  const actor = await huidigeActor(projectId);
  const ol = await isOntwerpleider(db, actor);
  const [project] = await db.select().from(projecten).where(eq(projecten.id, projectId));
  const lijst = (await db.select().from(fasen).where(eq(fasen.projectId, projectId))).sort((a, b) => a.volgorde - b.volgorde);
  const actief = lijst.find((f) => f.id === project.actieveFaseId)!;
  const volgende = lijst.find((f) => f.volgorde === actief.volgorde + 1) ?? null;
  const overzichten = await Promise.all(lijst.map(async (f) => ({ f, o: await faseOverzicht(db, projectId, f.id) })));
  const leden = await projectLeden(projectId);
  const dels = await db.select().from(delegaties).where(and(eq(delegaties.projectId, projectId)));
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Fasen</h1>
        <p className="mt-1 text-sm text-grijs">Een registratie hoort bij de fase waarin hij ontstaat. Vervangingen zie je in de fase van de nieuwe registratie.</p>
      </header>
      {ol && <FaseStart projectId={projectId} volgende={volgende ? { id: volgende.id, code: volgende.code } : null} openIssues={(await openIssuesVorigeFase(db, projectId)).map((r) => ({ id: r.id, nummer: r.nummer, titel: r.titel }))} />}
      <div className="grid gap-4 md:grid-cols-2">
        {overzichten.map(({ f, o }) => (
          <section key={f.id} className={`kaart p-5 ${f.id === actief.id ? "ring-2 ring-mint" : ""}`}>
            <h2 className="font-semibold">{f.code} {f.id === actief.id && <span className="ml-1 rounded bg-mint/30 px-1.5 text-xs text-emerald-900">actief</span>}</h2>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {TYPEN.map((t) => {
                  const n = o.registraties.filter((r) => r.type === t);
                  return (
                    <tr key={t} className="border-b border-lijn last:border-0">
                      <td className="py-1"><Link className="hover:text-blauw" href={`/project/${projectId}/overzicht/${soortVanType(t).slug}?fase=${f.id}`}>{TYPE_MEERVOUD[t]}</Link></td>
                      <td className="py-1 text-right font-semibold">{n.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {o.vervangenUitVorigeFasen.length > 0 && (
              <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm">
                <h3 className="font-semibold text-oranje">Vervangen registraties uit vorige fasen</h3>
                <ul className="mt-1">
                  {o.vervangenUitVorigeFasen.map((v) => (
                    <li key={v.nieuw.id}>
                      <Link className="font-mono text-blauw" href={`/project/${projectId}/registraties/${v.oud.nummer}`}>{v.oud.nummer}</Link> ({v.oud.faseCode}) → <Link className="font-mono text-blauw" href={`/project/${projectId}/registraties/${v.nieuw.nummer}`}>{v.nieuw.nummer}</Link> {v.nieuw.titel}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
      </div>
      {ol && <Delegatie projectId={projectId} coordinatoren={leden.filter((l) => l.rol === "ontwerpcoordinator").map((l) => ({ id: l.id, naam: l.naam, actief: dels.some((d) => d.gebruikerId === l.id && d.actief) }))} />}
    </div>
  );
}
