import Link from "next/link";
import { getDb } from "@/db/client";
import { mijnWerk, signalen } from "@/domain/signalen";
import { TYPE_LABEL } from "@/domain/labels";
import { huidigeActor } from "@/lib/sessie";
import { StatusLabel } from "@/components/StatusLabel";
import type { RegistratieRij } from "@/domain/registraties";

function Blok({ titel, uitleg, children, leeg }: { titel: string; uitleg: string; children: React.ReactNode; leeg: boolean }) {
  return (
    <section className="kaart p-5">
      <h2 className="font-semibold">{titel}</h2>
      <p className="text-xs text-grijs">{uitleg}</p>
      {leeg ? <p className="mt-3 text-sm text-grijs">Niets.</p> : <ul className="mt-3 divide-y divide-lijn">{children}</ul>}
    </section>
  );
}

function RegRegel({ projectId, r, extra }: { projectId: string; r: RegistratieRij; extra?: string }) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <Link href={`/project/${projectId}/registraties/${r.nummer}`} className="font-mono text-xs text-blauw hover:underline">{r.nummer}</Link>
      <Link href={`/project/${projectId}/registraties/${r.nummer}`} className="min-w-0 flex-1 truncate hover:text-blauw">{r.titel}</Link>
      <span className="text-xs text-grijs">{extra ?? TYPE_LABEL[r.type]}</span>
      <StatusLabel status={r.status} />
    </li>
  );
}

export default async function MijnWerk({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const db = await getDb();
  const actor = await huidigeActor(projectId);
  const w = await mijnWerk(db, actor);
  const s = await signalen(db, projectId);
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Mijn werk</h1>
        <p className="mt-1 text-sm text-grijs">Goedendag {actor.naam.split(" ")[0]}. Dit wacht op jou.</p>
      </header>
      {s.length > 0 && (
        <section aria-label="Signalen" className="grid gap-2 sm:grid-cols-2">
          {s.map((x) => (
            <Link key={x.soort} href={`/project/${projectId}/${x.link}`} className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm hover:border-oranje">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-oranje" />
              {x.tekst}
            </Link>
          ))}
        </section>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {(w.wachtOpMijnGoedkeuring.length > 0 || actor.rol !== "teamlid") && (
          <Blok titel="Wacht op mijn goedkeuring" uitleg="Afwijkingen, wijzigingen en ontwerpkeuzes ter goedkeuring." leeg={!w.wachtOpMijnGoedkeuring.length}>
            {w.wachtOpMijnGoedkeuring.map((r) => <RegRegel key={r.id} projectId={projectId} r={r} />)}
          </Blok>
        )}
        {actor.rol === "ontwerpleider" && (
          <Blok titel="Wacht op mijn eindoordeel" uitleg="Raakvlakafspraken die aan alle kanten zijn verwerkt." leeg={!w.wachtOpEindoordeel.length}>
            {w.wachtOpEindoordeel.map((r) => <RegRegel key={r.id} projectId={projectId} r={r} />)}
          </Blok>
        )}
        <Blok titel="Raakvlakken: mijn akkoord" uitleg="Kanten waarvoor jij verantwoordelijk bent." leeg={!w.wachtOpMijnAkkoord.length}>
          {w.wachtOpMijnAkkoord.map((x) => <RegRegel key={x.kantId} projectId={projectId} r={x.registratie} extra={x.stap === "afstemmen" ? "Afstemmen" : "Verwerken"} />)}
        </Blok>
        <Blok titel="Goedgekeurd, nog niet verwerkt" uitleg="Nog doorvoeren in tekening, model of berekening." leeg={!w.goedgekeurdNietVerwerkt.length}>
          {w.goedgekeurdNietVerwerkt.map((r) => <RegRegel key={r.id} projectId={projectId} r={r} />)}
        </Blok>
        <Blok titel="Waar ik eigenaar van ben" uitleg="Lopende registraties op jouw objecten." leeg={!w.eigenaarVan.length}>
          {w.eigenaarVan.map((r) => <RegRegel key={r.id} projectId={projectId} r={r} />)}
        </Blok>
        {actor.rol !== "teamlid" && (
          <Blok titel="Te beoordelen meldingen" uitleg="Nieuwe meldingen in de inbox." leeg={!w.teBeoordelenMeldingen.length}>
            {w.teBeoordelenMeldingen.map((m) => (
              <li key={m.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="font-mono text-xs text-grijs">{m.nummer}</span>
                <Link href={`/project/${projectId}/inbox`} className="flex-1 truncate hover:text-blauw">{m.titel}</Link>
                <span className="text-xs text-grijs">{m.werkdagenOpen} wd</span>
              </li>
            ))}
          </Blok>
        )}
      </div>
    </div>
  );
}
