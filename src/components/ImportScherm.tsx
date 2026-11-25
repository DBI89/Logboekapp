"use client";
import { useState } from "react";
import { controleerImport, voerImportUitActie, herkoppelActie } from "@/app/(app)/project/[projectId]/acties";
import { Foutmelding, useActie } from "./useActie";
import type { ImportDiff } from "@/domain/import";
import type { ObjectOptie } from "@/lib/objectenlijst";

type Herkoppel = { koppelingId: string; nummer: string; objectCode: string; objectNaam: string; voorstellen: { objectId: string; code: string; naam: string }[] };
type Dieper = { koppelingId: string; registratieNummer: string; huidigCode: string; voorstelCode: string; voorstelObjectId: string };

export function ImportScherm(p: {
  projectId: string;
  ol: boolean;
  fasen: { id: string; code: string }[];
  actieveFaseId: string;
  voorbeeld: string;
  herkoppelen: Herkoppel[];
  dieper: Dieper[];
  objecten: ObjectOptie[];
}) {
  const { bezig, fout, voerUit } = useActie();
  const [fase, setFase] = useState(p.actieveFaseId);
  const [tekst, setTekst] = useState("");
  const [naam, setNaam] = useState("");
  const [diff, setDiff] = useState<ImportDiff | null>(null);
  const [fouten, setFouten] = useState<string[]>([]);
  const [klaar, setKlaar] = useState<string | null>(null);
  const [keuze, setKeuze] = useState<Record<string, string>>({});

  const laad = (t: string, n: string) => { setTekst(t); setNaam(n); setDiff(null); setFouten([]); setKlaar(null); };

  return (
    <div className="space-y-5">
      {p.ol ? (
        <section className="kaart grid gap-3 p-5">
          <h2 className="font-semibold">Objectstructuur importeren</h2>
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <label className="text-sm"><span className="label">Fase</span>
              <select className="invoer" value={fase} onChange={(e) => setFase(e.target.value)}>{p.fasen.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}</select>
            </label>
            <label className="text-sm"><span className="label">CSV-bestand (; gescheiden)</span>
              <input type="file" accept=".csv,text/csv" className="invoer" onChange={async (e) => { const f = e.target.files?.[0]; if (f) laad(await f.text(), f.name); }} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="knop-licht" type="button" onClick={() => laad(p.voorbeeld, "OTL-export DO.csv")}>Voorbeeld DO-import laden</button>
            <button className="knop" disabled={bezig || !tekst} onClick={() => voerUit(() => controleerImport(p.projectId, tekst), (r) => { setFouten(r.fouten); setDiff(r.diff); })}>Controleren</button>
          </div>
          {naam && <p className="text-sm text-grijs">Geladen: {naam}</p>}
          {fouten.length > 0 && (
            <ul className="rounded-md border border-rood/30 bg-rood/5 p-3 text-sm text-rood">{fouten.map((f) => <li key={f}>{f}</li>)}</ul>
          )}
          {diff && (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-lijn p-3"><h3 className="text-sm font-semibold">Nieuw ({diff.nieuw.length})</h3><ul className="mt-1 text-xs">{diff.nieuw.map((r) => <li key={r.code}><span className="font-mono">{r.code}</span> {r.naam}</li>)}</ul></div>
              <div className="rounded-md border border-lijn p-3"><h3 className="text-sm font-semibold">Gewijzigd ({diff.gewijzigd.length})</h3><ul className="mt-1 text-xs">{diff.gewijzigd.map((r) => <li key={r.code}><span className="font-mono">{r.code}</span>: {r.velden.join(", ")}</li>)}</ul></div>
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3"><h3 className="text-sm font-semibold">Verdwenen ({diff.verdwenen.length})</h3><ul className="mt-1 text-xs">{diff.verdwenen.map((r) => <li key={r.code}><span className="font-mono">{r.code}</span> {r.naam} — {r.aantalKoppelingen} koppeling(en)</li>)}</ul></div>
              <div className="md:col-span-3">
                <button className="knop" disabled={bezig} onClick={() => voerUit(() => voerImportUitActie(p.projectId, fase, naam || "import.csv", tekst), (r) => { setKlaar(`Import uitgevoerd. ${r.teHerkoppelen} koppeling(en) te herkoppelen.`); setDiff(null); })}>
                  Import uitvoeren
                </button>
              </div>
            </div>
          )}
          {klaar && <p className="text-sm text-emerald-800" role="status">{klaar}</p>}
        </section>
      ) : (
        <p className="kaart p-5 text-sm text-grijs">Alleen de ontwerpleider voert imports uit.</p>
      )}

      <section className="kaart p-5">
        <h2 className="font-semibold">Te herkoppelen ({p.herkoppelen.length})</h2>
        <p className="text-sm text-grijs">Registraties waarvan het object is verdwenen of gesplitst. Kies het nieuwe object.</p>
        <ul className="mt-3 divide-y divide-lijn">
          {p.herkoppelen.map((h) => (
            <li key={h.koppelingId} className="flex flex-wrap items-center gap-2 py-3 text-sm">
              <span className="font-mono">{h.nummer}</span> was gekoppeld aan <span className="font-mono">{h.objectCode}</span> {h.objectNaam}
              <span className="ml-auto flex flex-wrap gap-2">
                {h.voorstellen.map((v) => (
                  <button key={v.objectId} className="knop-licht" disabled={bezig} onClick={() => voerUit(() => herkoppelActie(p.projectId, h.koppelingId, v.objectId))}>→ {v.code}</button>
                ))}
                <select className="invoer w-48" aria-label={`Ander object voor ${h.nummer}`} value={keuze[h.koppelingId] ?? ""} onChange={(e) => setKeuze({ ...keuze, [h.koppelingId]: e.target.value })}>
                  <option value="">Ander object…</option>
                  {p.objecten.filter((o) => o.niveau <= 3).map((o) => <option key={o.id} value={o.id}>{o.code} {o.naam}</option>)}
                </select>
                <button className="knop" disabled={bezig || !keuze[h.koppelingId]} onClick={() => voerUit(() => herkoppelActie(p.projectId, h.koppelingId, keuze[h.koppelingId]))}>Koppel</button>
              </span>
            </li>
          ))}
          {!p.herkoppelen.length && <li className="py-3 text-sm text-grijs">Niets te herkoppelen.</li>}
        </ul>
      </section>

      {p.dieper.length > 0 && (
        <section className="kaart p-5">
          <h2 className="font-semibold">Voorstellen: naar een dieper object</h2>
          <p className="text-sm text-grijs">De tekst van deze registraties gaat over een onderdeel dat nu als apart object bestaat.</p>
          <ul className="mt-3 divide-y divide-lijn">
            {p.dieper.map((d) => (
              <li key={`${d.koppelingId}-${d.voorstelObjectId}`} className="flex flex-wrap items-center gap-2 py-3 text-sm">
                <span className="font-mono">{d.registratieNummer}</span>: <span className="font-mono">{d.huidigCode}</span> → <span className="font-mono">{d.voorstelCode}</span>
                <button className="knop-licht ml-auto" disabled={bezig} onClick={() => voerUit(() => herkoppelActie(p.projectId, d.koppelingId, d.voorstelObjectId))}>Verplaatsen</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Foutmelding fout={fout} />
    </div>
  );
}
