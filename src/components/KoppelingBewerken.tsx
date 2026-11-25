"use client";
import { useState } from "react";
import { slaRegistratieOp } from "@/app/(app)/project/[projectId]/acties";
import { Foutmelding, useActie } from "./useActie";
import { typeOpties, type ObjectOptie } from "@/lib/objectenlijst";
import type { Koppeling } from "@/domain/registraties";

type Huidig = { soort: "exemplaar" | "type"; objectId: string | null; objecttype: string | null; toepassing: string | null; bereikId: string | null; tekst: string; teHerkoppelen: boolean };

export function KoppelingBewerken({ projectId, id, huidig, objecten, bewerkbaar }: { projectId: string; id: string; huidig: Huidig[]; objecten: ObjectOptie[]; bewerkbaar: boolean }) {
  const { bezig, fout, voerUit } = useActie();
  const [lijst, setLijst] = useState<Huidig[]>(huidig);
  const [bewerken, setBewerken] = useState(false);
  const [nieuwObject, setNieuwObject] = useState("");
  const [nieuwType, setNieuwType] = useState("");
  const [bereik, setBereik] = useState("");
  const typen = typeOpties(objecten);
  const perId = new Map(objecten.map((o) => [o.id, o]));
  const naarKoppeling = (h: Huidig): Koppeling =>
    h.soort === "exemplaar" ? { soort: "exemplaar", objectId: h.objectId! } : { soort: "type", objecttype: h.objecttype!, toepassing: h.toepassing, bereikObjectId: h.bereikId };

  return (
    <section className="kaart p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Objecten</h2>
        {bewerkbaar && !bewerken && <button className="knop-licht" onClick={() => setBewerken(true)}>Koppelingen wijzigen</button>}
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {lijst.map((k, i) => (
          <li key={i} className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${k.teHerkoppelen ? "bg-amber-100 text-oranje" : k.soort === "type" ? "bg-mint/20 text-emerald-900" : "bg-blauw/10 text-navy"}`}>
            {k.soort === "type" && <span className="font-semibold">Type:</span>}
            {k.tekst}
            {k.teHerkoppelen && " (te herkoppelen)"}
            {bewerken && <button aria-label={`Verwijder ${k.tekst}`} className="ml-1 hover:text-rood" onClick={() => setLijst(lijst.filter((_, j) => j !== i))}>✕</button>}
          </li>
        ))}
        {!lijst.length && <li className="text-sm text-grijs">Nog geen objecten gekoppeld.</li>}
      </ul>
      {bewerken && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="k-ex">Exemplaar toevoegen</label>
            <div className="flex gap-2">
              <select id="k-ex" className="invoer" value={nieuwObject} onChange={(e) => setNieuwObject(e.target.value)}>
                <option value="">Kies object…</option>
                {objecten.filter((o) => o.niveau <= 3).map((o) => (
                  <option key={o.id} value={o.id}>{" ".repeat(o.diepte * 2)}{o.code} {o.naam}</option>
                ))}
              </select>
              <button className="knop-licht shrink-0" disabled={!nieuwObject} onClick={() => { const o = perId.get(nieuwObject)!; setLijst([...lijst, { soort: "exemplaar", objectId: o.id, objecttype: null, toepassing: null, bereikId: null, tekst: o.code, teHerkoppelen: false }]); setNieuwObject(""); }}>
                Toevoegen
              </button>
            </div>
          </div>
          <div>
            <span className="label">Type binnen bereik toevoegen</span>
            <div className="grid gap-2">
              <select className="invoer" aria-label="Objecttype en toepassing" value={nieuwType} onChange={(e) => setNieuwType(e.target.value)}>
                <option value="">Kies type…</option>
                {typen.map((t) => <option key={`${t.objecttype}|${t.toepassing ?? ""}`} value={`${t.objecttype}|${t.toepassing ?? ""}`}>{t.toepassing ?? t.objecttype} ({t.objecttype})</option>)}
              </select>
              <div className="flex gap-2">
                <select className="invoer" aria-label="Bereik" value={bereik} onChange={(e) => setBereik(e.target.value)}>
                  <option value="">Heel project</option>
                  {objecten.filter((o) => o.niveau <= 2).map((o) => <option key={o.id} value={o.id}>binnen {o.code} {o.naam}</option>)}
                </select>
                <button
                  className="knop-licht shrink-0"
                  disabled={!nieuwType}
                  onClick={() => {
                    const [objecttype, toepassing] = nieuwType.split("|");
                    setLijst([...lijst, { soort: "type", objectId: null, objecttype, toepassing: toepassing || null, bereikId: bereik || null, tekst: `alle ${toepassing || objecttype}${bereik ? ` in ${perId.get(bereik)?.code}` : ""}`, teHerkoppelen: false }]);
                    setNieuwType("");
                  }}
                >
                  Toevoegen
                </button>
              </div>
            </div>
          </div>
          <div className="md:col-span-2">
            <Foutmelding fout={fout} />
            <div className="mt-2 flex gap-2">
              <button className="knop" disabled={bezig} onClick={() => voerUit(() => slaRegistratieOp(projectId, id, { koppelingen: lijst.map(naarKoppeling) }, false), () => setBewerken(false))}>Opslaan</button>
              <button className="knop-licht" onClick={() => { setLijst(huidig); setBewerken(false); }}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
