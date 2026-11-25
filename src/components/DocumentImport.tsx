"use client";
import { useState } from "react";
import { controleerDocumentImport, voerDocumentImportUitActie } from "@/app/(app)/project/[projectId]/acties";
import { Foutmelding, useActie } from "./useActie";

export function DocumentImport({ projectId, voorbeeld }: { projectId: string; voorbeeld: string }) {
  const { bezig, fout, voerUit } = useActie();
  const [tekst, setTekst] = useState("");
  const [naam, setNaam] = useState("");
  const [controle, setControle] = useState<{ fouten: string[]; nieuw: string[]; bijgewerkt: string[] } | null>(null);
  const [klaar, setKlaar] = useState<string | null>(null);
  const laad = (t: string, n: string) => { setTekst(t); setNaam(n); setControle(null); setKlaar(null); };
  return (
    <section className="kaart grid gap-3 p-5">
      <div>
        <h2 className="font-semibold">Documentenlijst</h2>
        <p className="text-sm text-grijs">Export uit de documentregistratie, met per document de objecten die het behandelt (codes gescheiden door komma&apos;s). Bestaande documenten worden bijgewerkt op nummer.</p>
      </div>
      <label className="text-sm"><span className="label">CSV-bestand (; gescheiden)</span>
        <input type="file" accept=".csv,text/csv" className="invoer" onChange={async (e) => { const f = e.target.files?.[0]; if (f) laad(await f.text(), f.name); }} />
      </label>
      <p className="text-xs text-grijs">Kolommen: nummer;titel;discipline;revisie;status;fase;objecten</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="knop-licht" onClick={() => laad(voorbeeld, "Documentenlijst.csv")}>Voorbeeld documentenlijst laden</button>
        <button className="knop" disabled={bezig || !tekst} onClick={() => voerUit(() => controleerDocumentImport(projectId, tekst), setControle)}>Controleren</button>
      </div>
      {naam && <p className="text-sm text-grijs">Geladen: {naam}</p>}
      {controle?.fouten.length ? <ul className="rounded-md border border-rood/30 bg-rood/5 p-3 text-sm text-rood">{controle.fouten.map((f) => <li key={f}>{f}</li>)}</ul> : null}
      {controle && !controle.fouten.length && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-lijn p-3"><h3 className="text-sm font-semibold">Nieuw ({controle.nieuw.length})</h3><p className="mt-1 font-mono text-xs">{controle.nieuw.join(", ") || "–"}</p></div>
          <div className="rounded-md border border-lijn p-3"><h3 className="text-sm font-semibold">Bijwerken ({controle.bijgewerkt.length})</h3><p className="mt-1 font-mono text-xs">{controle.bijgewerkt.join(", ") || "–"}</p></div>
          <div className="md:col-span-2">
            <button className="knop" disabled={bezig} onClick={() => voerUit(() => voerDocumentImportUitActie(projectId, tekst), (r) => { setKlaar(`Documentenlijst geïmporteerd: ${r.nieuw} nieuw, ${r.bijgewerkt} bijgewerkt.`); setControle(null); })}>Documentenlijst importeren</button>
          </div>
        </div>
      )}
      {klaar && <p className="text-sm text-emerald-800" role="status">{klaar}</p>}
      <Foutmelding fout={fout} />
    </section>
  );
}
