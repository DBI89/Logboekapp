import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { fasen } from "@/db/schema";
import { overzicht, type OverzichtRij } from "@/domain/overzicht";
import { STATUS_LABEL } from "@/domain/labels";
import { projectLeden } from "@/lib/sessie";
import { SOORTEN } from "@/lib/soorten";
import { StatusLabel } from "@/components/StatusLabel";
import type { RegistratieType } from "@/domain/types";

const d = (r: OverzichtRij, k: string) => (r.details[k] as string | undefined) ?? "";
const instemming = (r: OverzichtRij) => {
  const i = r.details.instemming as { nodig?: boolean; status?: string } | undefined;
  return !i?.nodig ? "Niet nodig" : STATUS_LABEL[i.status ?? ""] ?? i.status ?? "Nog aan te vragen";
};
const PRIO: Record<string, string> = { hoog: "Hoog", normaal: "Normaal", laag: "Laag" };

type Kolom = { kop: string; cel: (r: OverzichtRij) => React.ReactNode; breed?: boolean };
const KOLOMMEN: Record<RegistratieType, Kolom[]> = {
  issue: [
    { kop: "Objecten", cel: (r) => <span className="font-mono text-xs">{r.objecten}</span> },
    { kop: "Prioriteit", cel: (r) => PRIO[d(r, "prioriteit")] ?? "–" },
    { kop: "Streefdatum", cel: (r) => (d(r, "streefdatum") ? new Date(d(r, "streefdatum")).toLocaleDateString("nl-NL") : "–") },
    {
      kop: "Laatste voortgang",
      breed: true,
      cel: (r) =>
        r.laatsteVoortgang ? (
          <span>
            <span className="text-xs text-grijs">{r.laatsteVoortgang.op.toLocaleDateString("nl-NL")} </span>
            <span className="line-clamp-2">{r.laatsteVoortgang.tekst}</span>
          </span>
        ) : (
          <span className="text-grijs">–</span>
        ),
    },
  ],
  afwijking: [
    { kop: "Objecten", cel: (r) => <span className="font-mono text-xs">{r.objecten}</span> },
    { kop: "Afwijking van", cel: (r) => d(r, "afwijkingVan") || "–", breed: true },
    { kop: "Instemming OG", cel: instemming },
  ],
  wijziging: [
    { kop: "Objecten", cel: (r) => <span className="font-mono text-xs">{r.objecten}</span> },
    { kop: "Aanleiding", cel: (r) => ({ opdrachtgever: "Opdrachtgever", intern: "Intern", extern: "Extern" })[d(r, "aanleiding")] ?? "–" },
    { kop: "Instemming OG", cel: instemming },
  ],
  ontwerpkeuze: [
    { kop: "Objecten", cel: (r) => <span className="font-mono text-xs">{r.objecten}</span> },
    { kop: "Gekozen", cel: (r) => d(r, "gekozen") || "–", breed: true },
  ],
  raakvlak: [
    { kop: "Kanten", cel: (r) => <span className="font-mono text-xs">{r.kanten}</span> },
    { kop: "Soort", cel: (r) => ({ fysiek: "Fysiek", functioneel: "Functioneel", ruimtelijk: "Ruimtelijk" })[d(r, "soort")] ?? "–" },
    { kop: "Akkoord", cel: (r) => `${r.afgestemd}/${r.aantalKanten} afgestemd` },
  ],
};

export default async function Overzicht({ params, searchParams }: { params: Promise<{ projectId: string; soort: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { projectId, soort } = await params;
  const sp = await searchParams;
  const s = SOORTEN.find((x) => x.slug === soort);
  if (!s) notFound();
  const db = await getDb();
  const projectFasen = (await db.select().from(fasen).where(eq(fasen.projectId, projectId))).sort((a, b) => a.volgorde - b.volgorde);
  const rijen = await overzicht(db, projectId, s.type, { status: sp.status, faseId: sp.fase, tekst: sp.tekst, object: sp.object });
  const namen = new Map((await projectLeden(projectId)).map((l) => [l.id, l.naam]));
  const kolommen = KOLOMMEN[s.type];
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{s.titel}</h1>
          <p className="mt-1 max-w-2xl text-sm text-grijs">{s.uitleg}</p>
        </div>
        <Link href={`/project/${projectId}/inbox`} className="knop-licht">Nieuwe melding</Link>
      </header>
      <form className="kaart grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm lg:col-span-2"><span className="label">Zoeken</span><input name="tekst" defaultValue={sp.tekst} className="invoer" placeholder="Nummer of tekst" /></label>
        <label className="text-sm"><span className="label">Status</span>
          <select name="status" defaultValue={sp.status ?? ""} className="invoer"><option value="">Alle</option>{s.statussen.map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}</select>
        </label>
        <label className="text-sm"><span className="label">Fase</span>
          <select name="fase" defaultValue={sp.fase ?? ""} className="invoer"><option value="">Alle</option>{projectFasen.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}</select>
        </label>
        <label className="text-sm"><span className="label">Object</span><input name="object" defaultValue={sp.object} className="invoer" placeholder="Code of naam" /></label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
          <button className="knop">Filteren</button>
          <Link href="?" className="knop-licht">Wissen</Link>
        </div>
      </form>
      <p className="text-sm text-grijs">{rijen.length} {rijen.length === 1 ? "registratie" : "registraties"}</p>
      <div className="kaart overflow-x-auto">
        <table className="tabel min-w-[760px]">
          <thead>
            <tr>
              <th>Nr.</th>
              <th>Titel</th>
              {kolommen.map((k) => <th key={k.kop}>{k.kop}</th>)}
              <th>Status</th>
              <th>Eigenaar</th>
              <th>Fase</th>
            </tr>
          </thead>
          <tbody>
            {rijen.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap font-mono text-xs"><Link className="text-blauw hover:underline" href={`/project/${projectId}/registraties/${r.nummer}`}>{r.nummer}</Link></td>
                <td className="min-w-48"><Link className="hover:text-blauw" href={`/project/${projectId}/registraties/${r.nummer}`}>{r.titel}</Link></td>
                {kolommen.map((k) => <td key={k.kop} className={k.breed ? "min-w-44" : ""}>{k.cel(r)}</td>)}
                <td><StatusLabel status={r.status} /></td>
                <td>{r.eigenaarId ? namen.get(r.eigenaarId) : <span className="text-grijs">–</span>}</td>
                <td>{r.faseCode}</td>
              </tr>
            ))}
            {!rijen.length && <tr><td colSpan={kolommen.length + 5} className="py-6 text-center text-grijs">Geen {s.titel.toLowerCase()} gevonden.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
