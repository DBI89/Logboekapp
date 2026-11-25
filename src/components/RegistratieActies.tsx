"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { registratieActie, startVervanging } from "@/app/(app)/project/[projectId]/acties";
import { Foutmelding, useActie } from "./useActie";

export type Toegestaan = {
  aanbieden?: boolean;
  goedkeuren?: boolean;
  verwerkt?: boolean;
  vervangen?: boolean;
  issue?: ("in_behandeling" | "opgelost" | "vervallen" | "heropenen")[];
};

export function RegistratieActies({ projectId, id, mag, registraties }: { projectId: string; id: string; mag: Toegestaan; registraties: { id: string; nummer: string; titel: string }[] }) {
  const router = useRouter();
  const { bezig, fout, voerUit } = useActie();
  const [invoer, setInvoer] = useState<null | "afwijzen" | "opgelost" | "vervallen">(null);
  const [tekst, setTekst] = useState("");
  const doe = (soort: Parameters<typeof registratieActie>[2], opts = {}) => voerUit(() => registratieActie(projectId, id, soort, opts), () => { setInvoer(null); setTekst(""); });
  const leeg = !mag.aanbieden && !mag.goedkeuren && !mag.verwerkt && !mag.vervangen && !mag.issue?.length;
  if (leeg) return null;
  return (
    <div className="kaart p-4">
      <div className="flex flex-wrap gap-2">
        {mag.aanbieden && <button className="knop" disabled={bezig} onClick={() => doe("aanbieden")}>Ter goedkeuring aanbieden</button>}
        {mag.goedkeuren && <button className="knop" disabled={bezig} onClick={() => doe("goedkeuren")}>Goedkeuren</button>}
        {mag.goedkeuren && <button className="knop-gevaar" disabled={bezig} onClick={() => setInvoer("afwijzen")}>Afwijzen</button>}
        {mag.verwerkt && <button className="knop" disabled={bezig} onClick={() => doe("verwerkt")}>Markeer als verwerkt</button>}
        {mag.issue?.includes("in_behandeling") && <button className="knop" disabled={bezig} onClick={() => doe("in_behandeling")}>In behandeling nemen</button>}
        {mag.issue?.includes("opgelost") && <button className="knop" disabled={bezig} onClick={() => setInvoer("opgelost")}>Opgelost</button>}
        {mag.issue?.includes("heropenen") && <button className="knop-licht" disabled={bezig} onClick={() => doe("heropenen")}>Terug naar open</button>}
        {mag.issue?.includes("vervallen") && <button className="knop-gevaar" disabled={bezig} onClick={() => setInvoer("vervallen")}>Vervallen</button>}
        {mag.vervangen && (
          <button className="knop-licht" disabled={bezig} onClick={() => voerUit(() => startVervanging(projectId, id), (nummer) => router.push(`/project/${projectId}/registraties/${nummer}`))}>
            Vervangen in actieve fase
          </button>
        )}
      </div>
      {invoer && (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (invoer === "afwijzen") doe("afwijzen", { toelichting: tekst });
            if (invoer === "vervallen") doe("vervallen", { reden: tekst });
            if (invoer === "opgelost") doe("opgelost", { oplossingId: tekst });
          }}
        >
          {invoer === "opgelost" ? (
            <select className="invoer" value={tekst} onChange={(e) => setTekst(e.target.value)} aria-label="Opgelost door registratie">
              <option value="">Opgelost door…</option>
              {registraties.filter((r) => r.id !== id).map((r) => <option key={r.id} value={r.id}>{r.nummer} — {r.titel}</option>)}
            </select>
          ) : (
            <input className="invoer" value={tekst} onChange={(e) => setTekst(e.target.value)} placeholder={invoer === "afwijzen" ? "Toelichting bij afwijzen" : "Reden"} aria-label={invoer === "afwijzen" ? "Toelichting" : "Reden"} />
          )}
          <button className="knop shrink-0" disabled={bezig}>Bevestigen</button>
        </form>
      )}
      <Foutmelding fout={fout} />
    </div>
  );
}
