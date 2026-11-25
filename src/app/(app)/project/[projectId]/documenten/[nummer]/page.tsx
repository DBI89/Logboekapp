import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { documenten, documentObjecten, fasen, objecten } from "@/db/schema";
import { KOLOMMEN, TYPE_VOLGORDE, rapportInhoud, verschilMetVorige } from "@/domain/rapport";
import { TYPE_MEERVOUD } from "@/domain/labels";
import { Uitsluiten, WeerOpnemen, RevisieVastleggen } from "@/components/DocumentActies";

const volgendeRevisie = (r: string) => (/^[A-Y]$/.test(r) ? String.fromCharCode(r.charCodeAt(0) + 1) : "A");

export default async function DocumentDetail({ params }: { params: Promise<{ projectId: string; nummer: string }> }) {
  const { projectId, nummer } = await params;
  const db = await getDb();
  const [doc] = await db.select().from(documenten).where(and(eq(documenten.projectId, projectId), eq(documenten.nummer, decodeURIComponent(nummer))));
  if (!doc) notFound();
  const [fase] = await db.select().from(fasen).where(eq(fasen.id, doc.faseId));
  const objs = await db.select({ code: objecten.code, naam: objecten.naam }).from(documentObjecten).innerJoin(objecten, eq(objecten.id, documentObjecten.objectId)).where(eq(documentObjecten.documentId, doc.id));
  const inhoud = await rapportInhoud(db, doc.id);
  const verschil = await verschilMetVorige(db, doc.id);
  const exportUrl = (f: string) => `/project/${projectId}/documenten/${doc.nummer}/export?formaat=${f}`;
  const leeg = TYPE_VOLGORDE.every((t) => !inhoud.perType[t].length);
  return (
    <div className="space-y-5">
      <nav className="text-sm text-grijs"><Link className="hover:text-blauw" href={`/project/${projectId}/documenten`}>Documenten</Link> / {doc.nummer}</nav>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-grijs">Fase {fase.code} · rev. {doc.revisie} · objecten {objs.map((o) => o.code).join(", ")} (inclusief onderliggend)</p>
          <h1 className="mt-1 text-2xl font-semibold"><span className="font-mono text-lg text-grijs">{doc.nummer}</span> {doc.titel}</h1>
        </div>
        <div className="flex gap-2">
          <a className="knop" href={exportUrl("docx")}>Download Word</a>
          <a className="knop-licht" href={exportUrl("xlsx")}>Download Excel</a>
        </div>
      </header>

      <section className="kaart grid gap-3 p-5 md:grid-cols-2">
        <div>
          <h2 className="font-semibold">{verschil.vorigeRevisie ? `Verschil met rev. ${verschil.vorigeRevisie}` : "Nog geen revisie vastgelegd"}</h2>
          <ul className="mt-1 text-sm">
            <li>Nieuw: {verschil.nieuw.join(", ") || "–"}</li>
            <li>Gewijzigd: {verschil.gewijzigd.join(", ") || "–"}</li>
            <li>Vervallen: {verschil.vervallen.join(", ") || "–"}</li>
          </ul>
        </div>
        <RevisieVastleggen projectId={projectId} documentId={doc.id} voorstel={volgendeRevisie(doc.revisie)} />
      </section>

      {leeg && <p className="kaart p-6 text-sm text-grijs">Nog geen goedgekeurde registraties voor de objecten en fase van dit document.</p>}
      {TYPE_VOLGORDE.filter((t) => inhoud.perType[t].length).map((t) => (
        <section key={t} className="kaart overflow-x-auto">
          <h2 className="px-5 pt-4 text-lg font-semibold">{TYPE_MEERVOUD[t]}</h2>
          <table className="tabel mt-2 min-w-[760px]">
            <thead><tr>{KOLOMMEN[t].map((k) => <th key={k.kop}>{k.kop}</th>)}<th /></tr></thead>
            <tbody>
              {inhoud.perType[t].map((r) => (
                <tr key={r.id}>
                  {KOLOMMEN[t].map((k, i) => (
                    <td key={k.kop} className={i === 0 ? "whitespace-nowrap font-mono text-xs" : ""}>
                      {i === 0 ? <Link className="text-blauw hover:underline" href={`/project/${projectId}/registraties/${r.nummer}`}>{k.waarde(r)}</Link> : k.waarde(r)}
                    </td>
                  ))}
                  <td className="w-28"><Uitsluiten projectId={projectId} documentId={doc.id} registratieId={r.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {inhoud.vervangen.length > 0 && (
        <section className="kaart p-5">
          <h2 className="font-semibold">Vervangen registraties uit vorige fasen</h2>
          <ul className="mt-2 text-sm">{inhoud.vervangen.map((v) => <li key={v.oud.nummer}><span className="font-mono">{v.oud.nummer}</span> ({v.oud.faseCode}) {v.oud.titel} → <span className="font-mono">{v.nieuw.nummer}</span> {v.nieuw.titel}</li>)}</ul>
        </section>
      )}
      {inhoud.uitgesloten.length > 0 && (
        <section className="kaart p-5">
          <h2 className="font-semibold">Uitgesloten voor dit document</h2>
          <ul className="mt-2 space-y-1 text-sm">{inhoud.uitgesloten.map((u) => <li key={u.registratie.id} className="flex flex-wrap gap-2"><span className="font-mono">{u.registratie.nummer}</span> {u.registratie.titel} <span className="text-grijs">— {u.reden}</span><WeerOpnemen projectId={projectId} documentId={doc.id} registratieId={u.registratie.id} /></li>)}</ul>
        </section>
      )}
    </div>
  );
}
