"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { wijzigStatus } from "@/app/(app)/project/[projectId]/acties";
import { Foutmelding, useActie } from "./useActie";
import { StatusLabel } from "./StatusLabel";
import type { Overgang } from "@/domain/overgangen";

type Props = {
  projectId: string;
  id: string;
  status: string;
  overgangen: Overgang[];
  registraties: { id: string; nummer: string; titel: string }[];
  kanten: { id: string; code: string }[];
};

/** Statuswijziging via één keuzemenu met alleen de mogelijke vervolgstappen. */
export function StatusMenu(p: Props) {
  const router = useRouter();
  const { bezig, fout, voerUit } = useActie();
  const [keuze, setKeuze] = useState("");
  const [tekst, setTekst] = useState("");
  const [oplossing, setOplossing] = useState("");
  const [kantIds, setKantIds] = useState<string[]>([]);
  const gekozen = p.overgangen.find((o) => o.actie === keuze);

  return (
    <section className="kaart p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">Status</h2>
        <StatusLabel status={p.status} />
      </div>
      {p.overgangen.length === 0 ? (
        <p className="mt-2 text-sm text-grijs">Voor jou is er nu geen statuswijziging mogelijk.</p>
      ) : (
        <form
          className="mt-3 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!gekozen) return;
            voerUit(
              () => wijzigStatus(p.projectId, p.id, gekozen.actie, { toelichting: tekst, reden: tekst, opmerking: tekst, oplossingId: oplossing, kantIds }),
              (r) => {
                setKeuze("");
                setTekst("");
                if (r.nieuwNummer) router.push(`/project/${p.projectId}/registraties/${r.nieuwNummer}`);
              },
            );
          }}
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="status-keuze" className="sr-only">Nieuwe status</label>
            <select id="status-keuze" className="invoer sm:max-w-sm" value={keuze} onChange={(e) => setKeuze(e.target.value)}>
              <option value="">Wijzig status…</option>
              {p.overgangen.map((o) => (
                <option key={o.actie} value={o.actie}>{o.label}</option>
              ))}
            </select>
            <button className="knop shrink-0" disabled={bezig || !gekozen}>Bevestigen</button>
          </div>
          {gekozen?.vraagt === "oplossing" && (
            <label className="text-sm">
              <span className="label">Opgelost door registratie</span>
              <select className="invoer" value={oplossing} onChange={(e) => setOplossing(e.target.value)}>
                <option value="">Kies…</option>
                {p.registraties.filter((r) => r.id !== p.id).map((r) => <option key={r.id} value={r.id}>{r.nummer} — {r.titel}</option>)}
              </select>
            </label>
          )}
          {(gekozen?.vraagt === "toelichting" || gekozen?.vraagt === "reden" || gekozen?.vraagt === "opmerking_kanten") && (
            <label className="text-sm">
              <span className="label">{gekozen.vraagt === "toelichting" ? "Toelichting bij afwijzen" : gekozen.vraagt === "reden" ? "Reden" : "Wat ontbreekt er?"}</span>
              <input className="invoer" value={tekst} onChange={(e) => setTekst(e.target.value)} />
            </label>
          )}
          {gekozen?.vraagt === "opmerking_kanten" && (
            <fieldset className="text-sm">
              <legend className="label">Terug naar kant</legend>
              <div className="flex flex-wrap gap-3">
                {p.kanten.map((k) => (
                  <label key={k.id} className="flex items-center gap-1.5">
                    <input type="checkbox" checked={kantIds.includes(k.id)} onChange={(e) => setKantIds(e.target.checked ? [...kantIds, k.id] : kantIds.filter((x) => x !== k.id))} />
                    {k.code}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </form>
      )}
      <Foutmelding fout={fout} />
    </section>
  );
}
