"use client";
import { useState } from "react";
import { sluitUitActie, neemOpActie, legRevisieVastActie } from "@/app/(app)/project/[projectId]/acties";
import { Foutmelding, useActie } from "./useActie";

export function Uitsluiten({ projectId, documentId, registratieId }: { projectId: string; documentId: string; registratieId: string }) {
  const { bezig, fout, voerUit } = useActie();
  const [open, setOpen] = useState(false);
  const [reden, setReden] = useState("");
  if (!open) return <button className="text-xs text-grijs hover:text-rood" onClick={() => setOpen(true)}>Uitsluiten</button>;
  return (
    <form className="flex flex-col gap-1" onSubmit={(e) => { e.preventDefault(); voerUit(() => sluitUitActie(projectId, documentId, registratieId, reden)); }}>
      <input className="invoer text-xs" placeholder="Reden" aria-label="Reden uitsluiten" value={reden} onChange={(e) => setReden(e.target.value)} />
      <button className="knop-licht text-xs" disabled={bezig}>Uitsluiten</button>
      <Foutmelding fout={fout} />
    </form>
  );
}

export function WeerOpnemen({ projectId, documentId, registratieId }: { projectId: string; documentId: string; registratieId: string }) {
  const { bezig, voerUit } = useActie();
  return <button className="text-xs text-blauw hover:underline" disabled={bezig} onClick={() => voerUit(() => neemOpActie(projectId, documentId, registratieId))}>Weer opnemen</button>;
}

export function RevisieVastleggen({ projectId, documentId, voorstel }: { projectId: string; documentId: string; voorstel: string }) {
  const { bezig, fout, voerUit } = useActie();
  const [rev, setRev] = useState(voorstel);
  const [klaar, setKlaar] = useState(false);
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); voerUit(() => legRevisieVastActie(projectId, documentId, rev), () => setKlaar(true)); }}>
      <label className="text-sm"><span className="label">Revisie</span><input className="invoer w-20" value={rev} onChange={(e) => setRev(e.target.value)} /></label>
      <button className="knop" disabled={bezig}>Revisie vastleggen</button>
      {klaar && <span className="text-sm text-emerald-800" role="status">Vastgelegd.</span>}
      <div className="w-full"><Foutmelding fout={fout} /></div>
    </form>
  );
}
