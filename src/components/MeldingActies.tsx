"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { vraagVoorstel, zetMeldingOm, voegMeldingSamen, laatMeldingVervallen } from "@/app/(app)/project/[projectId]/acties";
import { Foutmelding, useActie } from "./useActie";
import { ObjectKiezer } from "./ObjectKiezer";
import type { ObjectOptie } from "@/lib/objectenlijst";
import { TYPE_LABEL } from "@/domain/labels";
import type { RegistratieType } from "@/domain/types";
import type { Voorstel } from "@/domain/ai";

const TYPEN: RegistratieType[] = ["issue", "afwijking", "wijziging", "ontwerpkeuze", "raakvlak"];

type Props = {
  projectId: string;
  meldingId: string;
  titel: string;
  objectIds: string[];
  objecten: ObjectOptie[];
  registraties: { id: string; nummer: string; titel: string }[];
};

export function MeldingActies(p: Props) {
  const router = useRouter();
  const { bezig, fout, voerUit } = useActie();
  const [modus, setModus] = useState<null | "omzetten" | "samenvoegen" | "vervallen">(null);
  const [voorstel, setVoorstel] = useState<Voorstel | null>(null);
  const [typen, setTypen] = useState<RegistratieType[]>([]);
  const [objectIds, setObjectIds] = useState(p.objectIds);
  const [titel, setTitel] = useState(p.titel);
  const [samen, setSamen] = useState("");
  const [reden, setReden] = useState("");
  const code = new Map(p.registraties.map((r) => [r.nummer, r.id]));

  return (
    <div className="mt-3 border-t border-lijn pt-3">
      <div className="flex flex-wrap gap-2">
        <button
          className="knop-licht"
          disabled={bezig}
          onClick={() =>
            voerUit(
              () => vraagVoorstel(p.projectId, p.meldingId),
              (v) => {
                setVoorstel(v);
                setTypen([v.type]);
                if (v.objectIds.length) setObjectIds(v.objectIds);
                setModus("omzetten");
              },
            )
          }
        >
          Voorstel
        </button>
        <button className="knop" onClick={() => setModus(modus === "omzetten" ? null : "omzetten")}>Omzetten</button>
        <button className="knop-licht" onClick={() => setModus(modus === "samenvoegen" ? null : "samenvoegen")}>Samenvoegen</button>
        <button className="knop-gevaar" onClick={() => setModus(modus === "vervallen" ? null : "vervallen")}>Vervallen</button>
      </div>

      {voorstel && modus === "omzetten" && (
        <div className="mt-3 rounded-md bg-blauw/5 p-3 text-sm">
          <span className="mr-2 rounded bg-navy px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            {voorstel.bron === "ai" ? "AI-voorstel" : "Automatisch voorstel"}
          </span>
          {TYPE_LABEL[voorstel.type]}. {voorstel.toelichting}
          {voorstel.mogelijkDubbel.length > 0 && (
            <p className="mt-1">
              Mogelijk dubbel met:{" "}
              {voorstel.mogelijkDubbel.map((n) => (
                <button key={n} className="mr-2 font-medium text-blauw underline" onClick={() => { setSamen(code.get(n) ?? ""); setModus("samenvoegen"); }}>
                  {n}
                </button>
              ))}
            </p>
          )}
        </div>
      )}

      {modus === "omzetten" && (
        <form
          className="mt-3 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const koppelingen = objectIds.map((objectId) => ({ soort: "exemplaar" as const, objectId }));
            voerUit(
              () => zetMeldingOm(p.projectId, p.meldingId, typen.map((type) => ({ type, titel, koppelingen }))),
              (r) => { if (r.length === 1) router.push(`/project/${p.projectId}/registraties/${r[0].nummer}`); },
            );
          }}
        >
          <fieldset>
            <legend className="label">Wordt (één of meer)</legend>
            <div className="flex flex-wrap gap-3 text-sm">
              {TYPEN.map((t) => (
                <label key={t} className="flex min-h-9 items-center gap-1.5">
                  <input type="checkbox" checked={typen.includes(t)} onChange={(e) => setTypen(e.target.checked ? [...typen, t] : typen.filter((x) => x !== t))} />
                  {TYPE_LABEL[t]}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label className="label" htmlFor={`t-${p.meldingId}`}>Titel</label>
            <input id={`t-${p.meldingId}`} className="invoer" value={titel} onChange={(e) => setTitel(e.target.value)} />
          </div>
          <ObjectKiezer opties={p.objecten} gekozen={objectIds} onChange={setObjectIds} />
          {typen.includes("raakvlak") && <p className="text-xs text-grijs">Een raakvlakafspraak vraagt minstens twee objecten op hetzelfde niveau.</p>}
          <div><button className="knop" disabled={bezig || !typen.length}>Omzetten</button></div>
        </form>
      )}

      {modus === "samenvoegen" && (
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); voerUit(() => voegMeldingSamen(p.projectId, p.meldingId, samen)); }}>
          <select className="invoer" value={samen} onChange={(e) => setSamen(e.target.value)} aria-label="Samenvoegen met registratie">
            <option value="">Kies een registratie…</option>
            {p.registraties.map((r) => (
              <option key={r.id} value={r.id}>{r.nummer} — {r.titel}</option>
            ))}
          </select>
          <button className="knop shrink-0" disabled={bezig || !samen}>Samenvoegen</button>
        </form>
      )}

      {modus === "vervallen" && (
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); voerUit(() => laatMeldingVervallen(p.projectId, p.meldingId, reden)); }}>
          <input className="invoer" placeholder="Reden (verplicht)" value={reden} onChange={(e) => setReden(e.target.value)} aria-label="Reden vervallen" />
          <button className="knop-gevaar shrink-0" disabled={bezig}>Laat vervallen</button>
        </form>
      )}
      <Foutmelding fout={fout} />
    </div>
  );
}
