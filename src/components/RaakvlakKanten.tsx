"use client";
import { useState } from "react";
import { kantActie, geefEindoordeel } from "@/app/(app)/project/[projectId]/acties";
import { Foutmelding, useActie } from "./useActie";

type Kant = { id: string; code: string; naam: string; extern: boolean; verantwoordelijke: string; afgestemdOp: string | null; afgestemdBron: string | null; verwerktOp: string | null; magActie: boolean };

export function RaakvlakKanten({ projectId, id, status, kanten, eindoordeel }: { projectId: string; id: string; status: string; kanten: Kant[]; eindoordeel: boolean }) {
  const { bezig, fout, voerUit } = useActie();
  const [bron, setBron] = useState<Record<string, string>>({});
  const [niet, setNiet] = useState(false);
  const [opmerking, setOpmerking] = useState("");
  const [terug, setTerug] = useState<string[]>([]);
  const datum = (d: string | null) => (d ? new Date(d).toLocaleDateString("nl-NL") : null);
  return (
    <section className="kaart p-5">
      <h2 className="font-semibold">Kanten van de afspraak</h2>
      <ul className="mt-3 divide-y divide-lijn">
        {kanten.map((k) => (
          <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="font-medium">
                <span className="font-mono text-xs text-grijs">{k.code}</span> {k.naam}
                {k.extern && <span className="ml-2 rounded bg-amber-100 px-1 text-[10px] text-oranje">extern</span>}
              </p>
              <p className="text-xs text-grijs">Verantwoordelijk: {k.verantwoordelijke}</p>
              <p className="text-xs">
                {k.afgestemdOp ? `✓ Afgestemd ${datum(k.afgestemdOp)}${k.afgestemdBron ? ` (${k.afgestemdBron})` : ""}` : "○ Nog niet afgestemd"}
                {" · "}
                {k.verwerktOp ? `✓ Verwerkt ${datum(k.verwerktOp)}` : "○ Nog niet verwerkt"}
              </p>
            </div>
            {k.magActie && status === "concept" && !k.afgestemdOp && (
              <div className="flex flex-col gap-2 sm:flex-row">
                {k.extern && <input className="invoer" placeholder="Bron akkoord externe partij" aria-label={`Bron akkoord ${k.code}`} value={bron[k.id] ?? ""} onChange={(e) => setBron({ ...bron, [k.id]: e.target.value })} />}
                <button className="knop shrink-0" disabled={bezig} onClick={() => voerUit(() => kantActie(projectId, k.id, "afgestemd", bron[k.id]))}>Afgestemd</button>
              </div>
            )}
            {k.magActie && status === "afgestemd" && !k.verwerktOp && (
              <button className="knop" disabled={bezig} onClick={() => voerUit(() => kantActie(projectId, k.id, "verwerkt"))}>Verwerkt</button>
            )}
          </li>
        ))}
      </ul>
      {eindoordeel && status === "verwerkt" && (
        <div className="mt-3 rounded-md border border-lijn bg-vlak p-3">
          <p className="text-sm font-medium">Eindoordeel ontwerpleider: is de afspraak aan alle kanten verwerkt?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="knop" disabled={bezig} onClick={() => voerUit(() => geefEindoordeel(projectId, id, true, "", []))}>Akkoord — vaststellen</button>
            <button className="knop-gevaar" disabled={bezig} onClick={() => setNiet(!niet)}>Niet akkoord</button>
          </div>
          {niet && (
            <form className="mt-3 grid gap-2" onSubmit={(e) => { e.preventDefault(); voerUit(() => geefEindoordeel(projectId, id, false, opmerking, terug)); }}>
              <input className="invoer" placeholder="Wat ontbreekt er?" aria-label="Opmerking" value={opmerking} onChange={(e) => setOpmerking(e.target.value)} />
              <fieldset className="flex flex-wrap gap-3 text-sm">
                <legend className="label">Terug naar kant</legend>
                {kanten.map((k) => (
                  <label key={k.id} className="flex items-center gap-1.5">
                    <input type="checkbox" checked={terug.includes(k.id)} onChange={(e) => setTerug(e.target.checked ? [...terug, k.id] : terug.filter((t) => t !== k.id))} />
                    {k.code}
                  </label>
                ))}
              </fieldset>
              <div><button className="knop" disabled={bezig}>Terugsturen</button></div>
            </form>
          )}
        </div>
      )}
      <Foutmelding fout={fout} />
    </section>
  );
}
