"use client";
import { useState } from "react";
import { startFaseActie, delegeerActie } from "@/app/(app)/project/[projectId]/acties";
import { Foutmelding, useActie } from "./useActie";

export function FaseStart({ projectId, volgende, openIssues }: { projectId: string; volgende: { id: string; code: string } | null; openIssues: { id: string; nummer: string; titel: string }[] }) {
  const { bezig, fout, voerUit } = useActie();
  const [open, setOpen] = useState(false);
  const [b, setB] = useState<Record<string, { actie: "meenemen" | "vervallen"; reden?: string }>>(Object.fromEntries(openIssues.map((i) => [i.id, { actie: "meenemen" as const }])));
  if (!volgende) return null;
  return (
    <section className="kaart p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Fase {volgende.code} starten</h2>
          <p className="text-sm text-grijs">Registraties blijven in hun eigen fase. Open issues neem je mee of laat je vervallen.</p>
        </div>
        {!open && <button className="knop" onClick={() => setOpen(true)}>Start fase {volgende.code}</button>}
      </div>
      {open && (
        <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); voerUit(() => startFaseActie(projectId, volgende.id, openIssues.map((i) => ({ issueId: i.id, ...b[i.id] }))), () => setOpen(false)); }}>
          {openIssues.map((i) => (
            <div key={i.id} className="grid items-center gap-2 rounded-md border border-lijn p-2 text-sm sm:grid-cols-[1fr_auto_14rem]">
              <span><span className="font-mono">{i.nummer}</span> {i.titel}</span>
              <select className="invoer" aria-label={`Besluit ${i.nummer}`} value={b[i.id].actie} onChange={(e) => setB({ ...b, [i.id]: { ...b[i.id], actie: e.target.value as "meenemen" | "vervallen" } })}>
                <option value="meenemen">Meenemen naar {volgende.code}</option>
                <option value="vervallen">Vervallen</option>
              </select>
              {b[i.id].actie === "vervallen" ? <input className="invoer" placeholder="Reden" aria-label={`Reden ${i.nummer}`} value={b[i.id].reden ?? ""} onChange={(e) => setB({ ...b, [i.id]: { ...b[i.id], reden: e.target.value } })} /> : <span />}
            </div>
          ))}
          {!openIssues.length && <p className="text-sm text-grijs">Geen open issues.</p>}
          <div className="flex gap-2"><button className="knop" disabled={bezig}>Bevestig start fase {volgende.code}</button><button type="button" className="knop-licht" onClick={() => setOpen(false)}>Annuleren</button></div>
        </form>
      )}
      <Foutmelding fout={fout} />
    </section>
  );
}

export function Delegatie({ projectId, coordinatoren }: { projectId: string; coordinatoren: { id: string; naam: string; actief: boolean }[] }) {
  const { bezig, fout, voerUit } = useActie();
  return (
    <section className="kaart p-5">
      <h2 className="font-semibold">Delegatie goedkeuren</h2>
      <ul className="mt-2 space-y-2">
        {coordinatoren.map((c) => (
          <li key={c.id}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" disabled={bezig} defaultChecked={c.actief} onChange={(e) => voerUit(() => delegeerActie(projectId, c.id, e.target.checked))} />
              {c.naam} mag afwijkingen, wijzigingen en ontwerpkeuzes goedkeuren
            </label>
          </li>
        ))}
      </ul>
      <Foutmelding fout={fout} />
    </section>
  );
}
