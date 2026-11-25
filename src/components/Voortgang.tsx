"use client";
import { useState } from "react";
import { voegVoortgangToeActie } from "@/app/(app)/project/[projectId]/acties";
import { Foutmelding, useActie } from "./useActie";

type Notitie = { id: string; tekst: string; naam: string; op: string };

export function Voortgang({ projectId, id, notities, open }: { projectId: string; id: string; notities: Notitie[]; open: boolean }) {
  const { bezig, fout, voerUit } = useActie();
  const [tekst, setTekst] = useState("");
  return (
    <section className="kaart p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">Voortgang</h2>
      {open && (
        <form
          className="mt-3 grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            voerUit(() => voegVoortgangToeActie(projectId, id, tekst), () => setTekst(""));
          }}
        >
          <label htmlFor="voortgang-tekst" className="sr-only">Nieuwe voortgang</label>
          <textarea id="voortgang-tekst" className="invoer min-h-16" placeholder="Wat is er sinds de vorige keer gebeurd?" value={tekst} onChange={(e) => setTekst(e.target.value)} />
          <div><button className="knop" disabled={bezig || !tekst.trim()}>Voortgang toevoegen</button></div>
          <Foutmelding fout={fout} />
        </form>
      )}
      <ol className="mt-4 space-y-3 border-l-2 border-mint/60 pl-4">
        {notities.map((n) => (
          <li key={n.id}>
            <p className="text-xs text-grijs">{new Date(n.op).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" })} · {n.naam}</p>
            <p className="whitespace-pre-wrap text-sm">{n.tekst}</p>
          </li>
        ))}
        {!notities.length && <li className="text-sm text-grijs">Nog geen voortgang vastgelegd.</li>}
      </ol>
    </section>
  );
}
