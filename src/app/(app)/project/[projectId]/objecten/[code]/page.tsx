import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { objecten, projecten } from "@/db/schema";
import { effectieveEigenaar, objectBoom, voorouders } from "@/domain/objecten";
import { registratiesVoorObject } from "@/domain/registraties";
import { isOntwerpleider } from "@/domain/rechten";
import { TYPE_LABEL } from "@/domain/labels";
import { huidigeActor, projectLeden } from "@/lib/sessie";
import { plat } from "@/lib/objectenlijst";
import { StatusLabel } from "@/components/StatusLabel";
import { MeldingInvoer } from "@/components/MeldingInvoer";
import { EigenaarKiezer } from "@/components/EigenaarKiezer";
import { and } from "drizzle-orm";

export default async function ObjectDetail({ params, searchParams }: { params: Promise<{ projectId: string; code: string }>; searchParams: Promise<{ onder?: string; fase?: string }> }) {
  const { projectId, code } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const [o] = await db.select().from(objecten).where(and(eq(objecten.projectId, projectId), eq(objecten.code, decodeURIComponent(code))));
  if (!o) notFound();
  const [project] = await db.select().from(projecten).where(eq(projecten.id, projectId));
  const onder = sp.onder !== "0";
  const alleFasen = sp.fase === "alle";
  const rijen = await registratiesVoorObject(db, o.id, { inclusiefOnderliggend: onder, faseId: alleFasen ? null : project.actieveFaseId });
  const actor = await huidigeActor(projectId);
  const leden = await projectLeden(projectId);
  const namen = new Map(leden.map((l) => [l.id, l.naam]));
  const pad = await Promise.all((await voorouders(db, o.id)).reverse().map(async (id) => (await db.select().from(objecten).where(eq(objecten.id, id)))[0]));
  const eigenaar = await effectieveEigenaar(db, o.id);
  const link = (q: Record<string, string>) => `?${new URLSearchParams({ onder: onder ? "1" : "0", fase: alleFasen ? "alle" : "actief", ...q })}`;
  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-1 text-sm text-grijs">
        <Link href={`/project/${projectId}/objecten`} className="hover:text-blauw">Objecten</Link>
        {pad.map((v) => <span key={v.id}>/ <Link className="hover:text-blauw" href={`/project/${projectId}/objecten/${encodeURIComponent(v.code)}`}>{v.code}</Link></span>)}
      </nav>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-grijs">Niveau {o.niveau} · {o.objecttype}{o.toepassing ? ` (${o.toepassing})` : ""}{o.locatie ? ` · ${o.locatie}` : ""}{o.extern ? ` · extern: ${o.eigenaarOrganisatie}` : ""}</p>
          <h1 className="mt-1 text-2xl font-semibold"><span className="font-mono text-lg text-grijs">{o.code}</span> {o.naam}</h1>
          {!o.actief && <p className="mt-1 text-sm text-rood">Dit object komt niet meer voor in de laatste import.</p>}
        </div>
        <div className="w-full sm:w-64">
          {(await isOntwerpleider(db, actor)) ? (
            <EigenaarKiezer projectId={projectId} objectId={o.id} huidig={o.eigenaarId} leden={leden} />
          ) : (
            <p className="text-sm"><span className="label">Eigenaar</span>{eigenaar ? namen.get(eigenaar) : "–"}{!o.eigenaarId && eigenaar ? " (geërfd)" : ""}</p>
          )}
        </div>
      </header>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link className={onder ? "knop" : "knop-licht"} href={link({ onder: onder ? "0" : "1" })}>{onder ? "✓ " : ""}Inclusief onderliggend</Link>
        <Link className={!alleFasen ? "knop" : "knop-licht"} href={link({ fase: "actief" })}>Deze fase</Link>
        <Link className={alleFasen ? "knop" : "knop-licht"} href={link({ fase: "alle" })}>Alle fasen</Link>
      </div>
      <div className="kaart overflow-x-auto">
        <table className="tabel min-w-[600px]">
          <thead><tr><th>Nr.</th><th>Titel</th><th>Type</th><th>Status</th><th>Fase</th></tr></thead>
          <tbody>
            {rijen.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap font-mono text-xs"><Link className="text-blauw hover:underline" href={`/project/${projectId}/registraties/${r.nummer}`}>{r.nummer}</Link></td>
                <td>{r.titel}{r.viaType && <span className="ml-2 rounded bg-mint/20 px-1.5 text-[10px] text-emerald-900">via type</span>}</td>
                <td>{TYPE_LABEL[r.type]}</td>
                <td><StatusLabel status={r.status} /></td>
                <td>{r.faseCode}</td>
              </tr>
            ))}
            {!rijen.length && <tr><td colSpan={5} className="py-6 text-center text-grijs">Geen registraties.</td></tr>}
          </tbody>
        </table>
      </div>
      {o.actief && o.niveau <= 3 && (
        <div>
          <h2 className="mb-2 font-semibold">Melden over dit object</h2>
          <MeldingInvoer projectId={projectId} objecten={plat(await objectBoom(db, projectId))} vastObject={o.id} />
        </div>
      )}
    </div>
  );
}
