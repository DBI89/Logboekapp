import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { fasen } from "@/db/schema";
import { zoekRegistraties, geraakteObjectenVan } from "@/domain/registraties";
import { laadObjecten } from "@/domain/objecten";
import { STATUS_LABEL, TYPE_LABEL } from "@/domain/labels";
import { projectLeden } from "@/lib/sessie";
import { StatusLabel } from "@/components/StatusLabel";
import type { RegistratieType } from "@/domain/types";

const TYPEN = Object.keys(TYPE_LABEL) as RegistratieType[];

export default async function Registraties({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { projectId } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const projectFasen = (await db.select().from(fasen).where(eq(fasen.projectId, projectId))).sort((a, b) => a.volgorde - b.volgorde);
  let rijen = await zoekRegistraties(db, projectId, {
    type: sp.type ? [sp.type as RegistratieType] : undefined,
    status: sp.status ? [sp.status] : undefined,
    faseId: sp.fase || null,
    tekst: sp.tekst,
  });
  const geraakt = await geraakteObjectenVan(db, projectId, rijen.map((r) => r.id));
  const objecten = new Map((await laadObjecten(db, projectId)).map((o) => [o.id, o]));
  if (sp.object) {
    const z = sp.object.toLowerCase();
    rijen = rijen.filter((r) => [...(geraakt.get(r.id) ?? [])].some((o) => `${objecten.get(o)?.code} ${objecten.get(o)?.naam}`.toLowerCase().includes(z)));
  }
  const namen = new Map((await projectLeden(projectId)).map((l) => [l.id, l.naam]));
  const objectTekst = (id: string) => {
    const codes = [...(geraakt.get(id) ?? [])].map((o) => objecten.get(o)?.code).filter(Boolean) as string[];
    return codes.length > 3 ? `${codes.slice(0, 3).join(", ")} +${codes.length - 3}` : codes.join(", ");
  };
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Registraties</h1>
        <p className="mt-1 text-sm text-grijs">{rijen.length} registratie{rijen.length === 1 ? "" : "s"}</p>
      </header>
      <form className="kaart grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className="text-sm lg:col-span-2"><span className="label">Zoeken</span><input name="tekst" defaultValue={sp.tekst} className="invoer" placeholder="Nummer of tekst" /></label>
        <label className="text-sm"><span className="label">Type</span>
          <select name="type" defaultValue={sp.type ?? ""} className="invoer"><option value="">Alle</option>{TYPEN.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select>
        </label>
        <label className="text-sm"><span className="label">Status</span>
          <select name="status" defaultValue={sp.status ?? ""} className="invoer"><option value="">Alle</option>{Object.entries(STATUS_LABEL).filter(([k]) => !["nieuw", "omgezet", "samengevoegd"].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
        <label className="text-sm"><span className="label">Fase</span>
          <select name="fase" defaultValue={sp.fase ?? ""} className="invoer"><option value="">Alle</option>{projectFasen.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}</select>
        </label>
        <label className="text-sm"><span className="label">Object</span><input name="object" defaultValue={sp.object} className="invoer" placeholder="Code of naam" /></label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <button className="knop">Filteren</button>
          <Link href="?" className="knop-licht">Wissen</Link>
        </div>
      </form>
      <div className="kaart overflow-x-auto">
        <table className="tabel min-w-[720px]">
          <thead>
            <tr><th>Nr.</th><th>Titel</th><th>Type</th><th>Objecten</th><th>Status</th><th>Eigenaar</th><th>Fase</th></tr>
          </thead>
          <tbody>
            {rijen.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-xs"><Link className="text-blauw hover:underline" href={`/project/${projectId}/registraties/${r.nummer}`}>{r.nummer}</Link></td>
                <td><Link className="hover:text-blauw" href={`/project/${projectId}/registraties/${r.nummer}`}>{r.titel}</Link></td>
                <td>{TYPE_LABEL[r.type]}</td>
                <td className="font-mono text-xs">{objectTekst(r.id)}</td>
                <td><StatusLabel status={r.status} /></td>
                <td>{r.eigenaarId ? namen.get(r.eigenaarId) : <span className="text-grijs">–</span>}</td>
                <td>{r.faseCode}</td>
              </tr>
            ))}
            {!rijen.length && <tr><td colSpan={7} className="py-6 text-center text-grijs">Geen registraties gevonden.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
