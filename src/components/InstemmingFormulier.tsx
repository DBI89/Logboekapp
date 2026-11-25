"use client";
import { useState } from "react";
import { slaInstemmingOp } from "@/app/(app)/project/[projectId]/acties";
import { Foutmelding, useActie } from "./useActie";
import type { Instemming } from "@/domain/velden";

export function InstemmingFormulier({ projectId, id, waarde, bewerkbaar }: { projectId: string; id: string; waarde?: Instemming; bewerkbaar: boolean }) {
  const { bezig, fout, voerUit } = useActie();
  const [i, setI] = useState<Instemming>(waarde ?? { nodig: false });
  const [open, setOpen] = useState(false);
  const tekst = !waarde?.nodig ? "Niet nodig" : `${waarde.status ?? "nog aan te vragen"}${waarde.referentie ? ` — ${waarde.referentie}` : ""}${waarde.datum ? ` (${waarde.datum})` : ""}`;
  return (
    <section className="kaart p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Instemming opdrachtgever</h2>
          <p className="text-sm">{tekst}</p>
        </div>
        {bewerkbaar && !open && <button className="knop-licht" onClick={() => setOpen(true)}>Bijwerken</button>}
      </div>
      {open && (
        <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); voerUit(() => slaInstemmingOp(projectId, id, i), () => setOpen(false)); }}>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={i.nodig} onChange={(e) => setI({ ...i, nodig: e.target.checked })} /> Instemming van de opdrachtgever nodig
          </label>
          {i.nodig && (
            <>
              <label className="text-sm">
                <span className="label">Status</span>
                <select className="invoer" value={i.status ?? ""} onChange={(e) => setI({ ...i, status: (e.target.value || undefined) as Instemming["status"] })}>
                  <option value="">Nog aan te vragen</option>
                  <option value="aangevraagd">Aangevraagd</option>
                  <option value="verleend">Verleend</option>
                  <option value="geweigerd">Geweigerd</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="label">Datum</span>
                <input type="date" className="invoer" value={i.datum ?? ""} onChange={(e) => setI({ ...i, datum: e.target.value || undefined })} />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="label">Referentie (brief, RFC-nummer, mail)</span>
                <input className="invoer" value={i.referentie ?? ""} onChange={(e) => setI({ ...i, referentie: e.target.value || undefined })} />
              </label>
            </>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button className="knop" disabled={bezig}>Opslaan</button>
            <button type="button" className="knop-licht" onClick={() => setOpen(false)}>Annuleren</button>
          </div>
          <div className="sm:col-span-2"><Foutmelding fout={fout} /></div>
        </form>
      )}
    </section>
  );
}
