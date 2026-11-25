import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { haalRegistratie, registratieIdVanNummer, zoekRegistraties } from "@/domain/registraties";
import { objectBoom } from "@/domain/objecten";
import { magGoedkeuren, isOntwerpleider, magBeoordelen } from "@/domain/rechten";
import { BRON_LABEL, STATUS_LABEL, TYPE_LABEL } from "@/domain/labels";
import { BEVROREN } from "@/domain/types";
import { huidigeActor, projectLeden } from "@/lib/sessie";
import { plat } from "@/lib/objectenlijst";
import { StatusLabel } from "@/components/StatusLabel";
import { RegistratieFormulier } from "@/components/RegistratieFormulier";
import { KoppelingBewerken } from "@/components/KoppelingBewerken";
import { RegistratieActies, type Toegestaan } from "@/components/RegistratieActies";
import { InstemmingFormulier } from "@/components/InstemmingFormulier";
import { RaakvlakKanten } from "@/components/RaakvlakKanten";
import type { Instemming } from "@/domain/velden";

const RELATIE = { vervangt: ["Vervangt", "Vervangen door"], lost_op: ["Lost op", "Opgelost door"], gerelateerd: ["Gerelateerd aan", "Gerelateerd aan"], verfijnt: ["Verfijnt", "Verfijnd in"] } as const;

export default async function RegistratieDetail({ params }: { params: Promise<{ projectId: string; nummer: string }> }) {
  const { projectId, nummer } = await params;
  const db = await getDb();
  const id = await registratieIdVanNummer(db, projectId, decodeURIComponent(nummer));
  if (!id) notFound();
  const r = await haalRegistratie(db, id);
  const actor = await huidigeActor(projectId);
  const ol = await isOntwerpleider(db, actor);
  const namen = new Map((await projectLeden(projectId)).map((l) => [l.id, l.naam]));
  const objecten = plat(await objectBoom(db, projectId));
  const bevroren = (BEVROREN as readonly string[]).includes(r.status);
  const goedkeurType = ["afwijking", "wijziging", "ontwerpkeuze"].includes(r.type);
  const betrokken = r.aangemaaktDoor === actor.gebruikerId || r.eigenaarId === actor.gebruikerId || (await magBeoordelen(db, actor));
  const lopendeVervanging = r.relaties.some((x) => x.soort === "vervangt" && x.richting === "in");

  const mag: Toegestaan = {};
  if (goedkeurType) {
    mag.aanbieden = ["concept", "afgewezen"].includes(r.status) && betrokken;
    mag.goedkeuren = r.status === "ter_goedkeuring" && (await magGoedkeuren(db, actor, r)).ok;
    mag.verwerkt = r.status === "goedgekeurd";
  }
  mag.vervangen = ["goedgekeurd", "verwerkt", "vastgesteld"].includes(r.status) && !lopendeVervanging;
  if (r.type === "issue")
    mag.issue = r.status === "open" ? ["in_behandeling", "opgelost", "vervallen"] : r.status === "in_behandeling" ? ["opgelost", "vervallen", "heropenen"] : [];
  const registraties = (await zoekRegistraties(db, projectId)).map((x) => ({ id: x.id, nummer: x.nummer, titel: x.titel }));
  const details = r.details as Record<string, unknown>;

  return (
    <div className="space-y-5">
      <nav className="text-sm text-grijs"><Link className="hover:text-blauw" href={`/project/${projectId}/registraties`}>Registraties</Link> / {r.nummer}</nav>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-grijs">{TYPE_LABEL[r.type]} · fase {r.faseCode} · eigenaar {r.eigenaarId ? namen.get(r.eigenaarId) : "–"}</p>
          <h1 className="mt-1 text-2xl font-semibold"><span className="font-mono text-lg text-grijs">{r.nummer}</span> {r.titel}</h1>
        </div>
        <StatusLabel status={r.status} />
      </header>
      {r.status === "afgewezen" && r.afwijsToelichting && <p className="rounded-md border border-rood/30 bg-rood/5 p-3 text-sm text-rood">Afgewezen: {r.afwijsToelichting}</p>}
      {r.goedgekeurdDoor && (
        <p className="text-sm text-grijs">
          {r.type === "raakvlak" ? "Vastgesteld" : "Goedgekeurd"} door {namen.get(r.goedgekeurdDoor)}
          {r.goedgekeurdOnderDelegatie ? " (onder delegatie)" : ""}
          {r.goedgekeurdOp ? ` op ${r.goedgekeurdOp.toLocaleDateString("nl-NL")}` : ""}
          {r.verwerktDoor ? ` · verwerkt door ${namen.get(r.verwerktDoor)}` : ""}
        </p>
      )}
      {lopendeVervanging && <p className="rounded-md bg-amber-50 p-3 text-sm text-oranje">Er loopt een vervanging voor deze registratie (zie relaties).</p>}

      <RegistratieActies projectId={projectId} id={r.id} mag={mag} registraties={registraties} />
      <RegistratieFormulier projectId={projectId} id={r.id} type={r.type} titel={r.titel} omschrijving={r.omschrijving} details={details} bewerkbaar={!bevroren && r.status !== "vervangen" && r.status !== "ter_goedkeuring"} correctie={bevroren && ol && r.status !== "vervangen"} />
      {goedkeurType && <InstemmingFormulier projectId={projectId} id={r.id} waarde={details.instemming as Instemming | undefined} bewerkbaar={r.status !== "vervangen"} />}

      {r.type === "raakvlak" ? (
        <RaakvlakKanten
          projectId={projectId}
          id={r.id}
          status={r.status}
          eindoordeel={ol}
          kanten={r.kanten.map((k) => ({
            id: k.id,
            code: k.object.code,
            naam: k.object.naam,
            extern: k.object.extern,
            verantwoordelijke: k.verantwoordelijkeId ? namen.get(k.verantwoordelijkeId) ?? "–" : "–",
            afgestemdOp: k.afgestemdOp?.toISOString() ?? null,
            afgestemdBron: k.afgestemdBron,
            verwerktOp: k.verwerktOp?.toISOString() ?? null,
            magActie: ol || k.verantwoordelijkeId === actor.gebruikerId,
          }))}
        />
      ) : (
        <KoppelingBewerken
          projectId={projectId}
          id={r.id}
          bewerkbaar={!bevroren && r.status !== "vervangen" && r.status !== "ter_goedkeuring"}
          objecten={objecten}
          huidig={r.koppelingen.map((k) => ({
            soort: k.soort,
            objectId: k.object?.id ?? null,
            objecttype: k.objecttype,
            toepassing: k.toepassing,
            bereikId: k.bereik?.id ?? null,
            tekst: k.soort === "exemplaar" ? `${k.object?.code} ${k.object?.naam}` : `alle ${k.toepassing ?? k.objecttype}${k.bereik ? ` in ${k.bereik.code}` : " in project"}`,
            teHerkoppelen: k.teHerkoppelen,
          }))}
        />
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <section className="kaart p-5">
          <h2 className="font-semibold">Relaties en bronnen</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {r.relaties.map((x) => (
              <li key={`${x.id}-${x.soort}-${x.richting}`}>
                {RELATIE[x.soort][x.richting === "uit" ? 0 : 1]}{" "}
                <Link className="font-mono text-blauw hover:underline" href={`/project/${projectId}/registraties/${x.nummer}`}>{x.nummer}</Link> {x.titel} <span className="text-grijs">({STATUS_LABEL[x.status]})</span>
              </li>
            ))}
            {r.bronnen.map((b) => (
              <li key={b.id}>
                Melding <span className="font-mono">{b.nummer}</span> — {b.titel} <span className="text-grijs">({BRON_LABEL[b.bronSoort]}{b.bronRef ? `: ${b.bronRef}` : ""})</span>
              </li>
            ))}
            {!r.relaties.length && !r.bronnen.length && <li className="text-grijs">Geen.</li>}
          </ul>
          <h3 className="mt-4 text-sm font-semibold">Opgenomen in</h3>
          <ul className="mt-1 text-sm">
            {r.opgenomenIn.map((o) => <li key={`${o.documentNummer}-${o.revisie}`}>{o.documentNummer} rev. {o.revisie}</li>)}
            {!r.opgenomenIn.length && <li className="text-grijs">Nog in geen vastgelegde rapportrevisie.</li>}
          </ul>
        </section>
        <section className="kaart p-5">
          <h2 className="font-semibold">Historie</h2>
          <ol className="mt-2 space-y-2 border-l border-lijn pl-4 text-sm">
            {r.historie.map((h) => (
              <li key={h.id}>
                <span className="text-xs text-grijs">{h.op.toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}</span>
                <br />
                <strong>{h.naam}</strong> — {h.actie.replaceAll("_", " ")}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
