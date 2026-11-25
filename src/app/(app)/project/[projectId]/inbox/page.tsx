import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { projecten, type MeldingStatus } from "@/db/schema";
import { inbox } from "@/domain/meldingen";
import { objectBoom } from "@/domain/objecten";
import { zoekRegistraties } from "@/domain/registraties";
import { magBeoordelen } from "@/domain/rechten";
import { BRON_LABEL } from "@/domain/labels";
import { huidigeActor, projectLeden } from "@/lib/sessie";
import { plat } from "@/lib/objectenlijst";
import { MeldingInvoer } from "@/components/MeldingInvoer";
import { MeldingActies } from "@/components/MeldingActies";
import { StatusLabel } from "@/components/StatusLabel";

const TABS: { sleutel: string; tekst: string; status: MeldingStatus[] }[] = [
  { sleutel: "nieuw", tekst: "Te beoordelen", status: ["nieuw"] },
  { sleutel: "beoordeeld", tekst: "Beoordeeld", status: ["omgezet", "samengevoegd", "vervallen"] },
];

export default async function Inbox({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ tab?: string; zoek?: string }> }) {
  const { projectId } = await params;
  const sp = await searchParams;
  const tab = TABS.find((t) => t.sleutel === sp.tab) ?? TABS[0];
  const db = await getDb();
  const actor = await huidigeActor(projectId);
  const [project] = await db.select().from(projecten).where(eq(projecten.id, projectId));
  const lijst = await inbox(db, projectId, { status: tab.status, zoek: sp.zoek });
  const namen = new Map((await projectLeden(projectId)).map((l) => [l.id, l.naam]));
  const objecten = plat(await objectBoom(db, projectId));
  const beoordelaar = await magBeoordelen(db, actor);
  const registraties = (await zoekRegistraties(db, projectId)).map((r) => ({ id: r.id, nummer: r.nummer, titel: r.titel }));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Inbox</h1>
        <p className="mt-1 text-sm text-grijs">Alles komt hier binnen. De ontwerpleider of coördinator deelt het in.</p>
      </header>
      <MeldingInvoer projectId={projectId} objecten={objecten} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1" aria-label="Inbox-tabbladen">
          {TABS.map((t) => (
            <Link key={t.sleutel} href={`?tab=${t.sleutel}`} className={`rounded-md px-3 py-2 text-sm ${t === tab ? "bg-navy text-white" : "text-grijs hover:bg-white"}`}>
              {t.tekst}
            </Link>
          ))}
        </nav>
        <form className="w-full sm:w-64">
          <input type="hidden" name="tab" value={tab.sleutel} />
          <input name="zoek" defaultValue={sp.zoek} className="invoer" placeholder="Zoeken in meldingen" aria-label="Zoeken in meldingen" />
        </form>
      </div>
      {!lijst.length && <p className="kaart p-6 text-sm text-grijs">Geen meldingen.</p>}
      <ul className="space-y-3">
        {lijst.map((m) => {
          const telaat = m.status === "nieuw" && m.werkdagenOpen > project.inboxSignaalWerkdagen;
          return (
            <li key={m.id} className="kaart p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-grijs">
                    <span className="font-mono">{m.nummer}</span> · {namen.get(m.gemeldDoor)} · {m.gemeldOp.toLocaleDateString("nl-NL")} · {BRON_LABEL[m.bronSoort]}
                    {m.bronRef ? `: ${m.bronRef}` : ""}
                  </p>
                  <h2 className="mt-0.5 font-semibold">{m.titel}</h2>
                  {m.omschrijving !== m.titel && <p className="mt-1 text-sm text-inkt/80">{m.omschrijving}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.objecten.map((o) => (
                      <Link key={o.id} href={`/project/${projectId}/objecten/${o.code}`} className="rounded-full bg-vlak px-2 py-0.5 text-xs text-navy hover:bg-blauw/10">
                        <span className="font-mono">{o.code}</span> {o.naam}
                      </Link>
                    ))}
                  </div>
                  {m.vervallenReden && <p className="mt-1 text-xs text-rood">Reden: {m.vervallenReden}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {m.status === "nieuw" && (
                    <span className={`text-xs ${telaat ? "font-semibold text-rood" : "text-grijs"}`}>
                      {m.werkdagenOpen} werkdag{m.werkdagenOpen === 1 ? "" : "en"} open
                    </span>
                  )}
                  <StatusLabel status={m.status} />
                </div>
              </div>
              {beoordelaar && m.status === "nieuw" && (
                <MeldingActies
                  projectId={projectId}
                  meldingId={m.id}
                  titel={m.titel}
                  objectIds={m.objecten.map((o) => o.id)}
                  objecten={objecten}
                  registraties={registraties}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
