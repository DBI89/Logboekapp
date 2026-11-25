"use client";
import { useState } from "react";
import { snelMelden, meldUitgebreid } from "@/app/(app)/project/[projectId]/acties";
import { Foutmelding, useActie } from "./useActie";
import { ObjectKiezer } from "./ObjectKiezer";
import type { ObjectOptie } from "@/lib/objectenlijst";
import { BRON_LABEL } from "@/domain/labels";
import type { BronSoort } from "@/db/schema";

export function MeldingInvoer({ projectId, objecten, vastObject }: { projectId: string; objecten: ObjectOptie[]; vastObject?: string }) {
  const { bezig, fout, voerUit } = useActie();
  const [tekst, setTekst] = useState("");
  const [kandidaten, setKandidaten] = useState<{ id: string; code: string; naam: string }[]>([]);
  const [titelKandidaat, setTitelKandidaat] = useState("");
  const [bevestiging, setBevestiging] = useState<string | null>(null);
  const [uitgebreid, setUitgebreid] = useState(Boolean(vastObject));
  const [form, setForm] = useState({ titel: "", omschrijving: "", objectIds: vastObject ? [vastObject] : [], bronSoort: "waarneming" as BronSoort, bronRef: "" });

  const klaar = (nummer: string) => {
    setBevestiging(`${nummer} staat in de inbox.`);
    setTekst("");
    setKandidaten([]);
    setForm({ titel: "", omschrijving: "", objectIds: vastObject ? [vastObject] : [], bronSoort: "waarneming", bronRef: "" });
  };

  return (
    <section className="kaart p-4">
      {!uitgebreid ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!tekst.trim()) return;
            setBevestiging(null);
            voerUit(
              () => snelMelden(projectId, tekst),
              (r) => {
                if (r.gemeld) klaar(r.gemeld);
                else {
                  setKandidaten(r.kandidaten);
                  setTitelKandidaat(r.titel);
                }
              },
            );
          }}
        >
          <label htmlFor="snel" className="label">
            Snel melden
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="snel"
              className="invoer"
              placeholder="Bijv. Kabels passen niet door landhoofd #VN-LH-1"
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
            />
            <button className="knop shrink-0" disabled={bezig}>
              Melden
            </button>
          </div>
          <p className="mt-1.5 text-xs text-grijs">Gebruik #code of #woord om een object te koppelen. Enter = melden.</p>
        </form>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setBevestiging(null);
            voerUit(() => meldUitgebreid(projectId, form), (m) => klaar(m.nummer));
          }}
        >
          <div>
            <label className="label" htmlFor="m-titel">Titel</label>
            <input id="m-titel" className="invoer" value={form.titel} onChange={(e) => setForm({ ...form, titel: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="m-oms">Wat speelt er?</label>
            <textarea id="m-oms" className="invoer min-h-20" value={form.omschrijving} onChange={(e) => setForm({ ...form, omschrijving: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="m-bron">Bron</label>
              <select id="m-bron" className="invoer" value={form.bronSoort} onChange={(e) => setForm({ ...form, bronSoort: e.target.value as BronSoort })}>
                {Object.entries(BRON_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="m-ref">Verwijzing (mail, overleg, document)</label>
              <input id="m-ref" className="invoer" value={form.bronRef} onChange={(e) => setForm({ ...form, bronRef: e.target.value })} />
            </div>
          </div>
          <ObjectKiezer opties={objecten} gekozen={form.objectIds} onChange={(objectIds) => setForm({ ...form, objectIds })} />
          <div>
            <button className="knop" disabled={bezig}>Melding opslaan</button>
          </div>
        </form>
      )}
      {kandidaten.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-medium">Meerdere objecten passen. Kies het juiste:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {kandidaten.map((k) => (
              <button
                key={k.id}
                type="button"
                className="knop-licht"
                disabled={bezig}
                onClick={() => voerUit(() => meldUitgebreid(projectId, { titel: titelKandidaat, omschrijving: titelKandidaat, objectIds: [k.id], bronSoort: "waarneming", bronRef: "" }), (m) => klaar(m.nummer))}
              >
                <span className="font-mono text-xs">{k.code}</span> {k.naam}
              </button>
            ))}
          </div>
        </div>
      )}
      <Foutmelding fout={fout} />
      {bevestiging && <p className="mt-2 text-sm text-emerald-800" role="status">{bevestiging}</p>}
      {!vastObject && (
        <button type="button" className="mt-3 text-sm text-blauw underline-offset-2 hover:underline" onClick={() => setUitgebreid(!uitgebreid)}>
          {uitgebreid ? "Terug naar snel melden" : "Uitgebreid melden"}
        </button>
      )}
    </section>
  );
}
