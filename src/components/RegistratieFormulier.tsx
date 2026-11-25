"use client";
import { useState } from "react";
import { slaRegistratieOp } from "@/app/(app)/project/[projectId]/acties";
import { Foutmelding, useActie } from "./useActie";
import { VELDEN, type Veld } from "@/lib/veldconfig";
import type { RegistratieType } from "@/domain/types";

type Props = {
  projectId: string;
  id: string;
  type: RegistratieType;
  titel: string;
  omschrijving: string;
  details: Record<string, unknown>;
  bewerkbaar: boolean;
  correctie: boolean;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

function Weergave({ veld, waarde }: { veld: Veld; waarde: unknown }) {
  if (veld.soort === "alternatieven") {
    const l = (waarde as { naam: string; voordelen?: string; nadelen?: string }[]) ?? [];
    return l.length ? (
      <ul className="list-disc pl-5">
        {l.map((a, i) => (
          <li key={i}>
            <strong>{a.naam}</strong>
            {a.voordelen ? ` — voordelen: ${a.voordelen}` : ""}
            {a.nadelen ? `; nadelen: ${a.nadelen}` : ""}
          </li>
        ))}
      </ul>
    ) : <span className="text-grijs">–</span>;
  }
  if (veld.soort === "groep") {
    const g = (waarde as Record<string, string>) ?? {};
    const delen = veld.delen.filter(([k]) => g[k]);
    return delen.length ? <dl className="grid grid-cols-[auto_1fr] gap-x-3">{delen.map(([k, l]) => <div key={k} className="contents"><dt className="text-grijs">{l}</dt><dd>{g[k]}</dd></div>)}</dl> : <span className="text-grijs">–</span>;
  }
  if (veld.soort === "lijst") return <span>{((waarde as string[]) ?? []).join(", ") || "–"}</span>;
  if (veld.soort === "keuze") return <span>{veld.opties.find(([k]) => k === waarde)?.[1] ?? "–"}</span>;
  return <span className="whitespace-pre-wrap">{str(waarde) || <span className="text-grijs">–</span>}</span>;
}

export function RegistratieFormulier(p: Props) {
  const { bezig, fout, voerUit } = useActie();
  const [bewerken, setBewerken] = useState(false);
  const [titel, setTitel] = useState(p.titel);
  const [omschrijving, setOmschrijving] = useState(p.omschrijving);
  const [details, setDetails] = useState<Record<string, unknown>>(p.details);
  const zet = (k: string, v: unknown) => setDetails({ ...details, [k]: v });
  const velden = VELDEN[p.type];

  if (!bewerken)
    return (
      <section className="kaart p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="whitespace-pre-wrap text-sm">{p.omschrijving || <span className="text-grijs">Geen omschrijving.</span>}</p>
          {(p.bewerkbaar || p.correctie) && (
            <button className="knop-licht shrink-0" onClick={() => setBewerken(true)}>
              {p.bewerkbaar ? "Bewerken" : "Tekstcorrectie"}
            </button>
          )}
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[14rem_1fr]">
          {velden.map((v) => (
            <div key={v.sleutel} className="contents">
              <dt className="font-medium text-grijs">{v.label.replace(" *", "")}</dt>
              <dd><Weergave veld={v} waarde={p.details[v.sleutel]} /></dd>
            </div>
          ))}
        </dl>
      </section>
    );

  return (
    <form
      className="kaart grid gap-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const { instemming: _i, ...zonder } = details;
        voerUit(() => slaRegistratieOp(p.projectId, p.id, { titel, omschrijving, details: zonder }, !p.bewerkbaar), () => setBewerken(false));
      }}
    >
      {!p.bewerkbaar && <p className="rounded-md bg-amber-50 p-2 text-sm text-oranje">Tekstcorrectie: alleen bedoeld voor taal- en typfouten. De correctie wordt in de historie vastgelegd.</p>}
      <div>
        <label className="label" htmlFor="r-titel">Titel</label>
        <input id="r-titel" className="invoer" value={titel} onChange={(e) => setTitel(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="r-oms">Omschrijving</label>
        <textarea id="r-oms" className="invoer min-h-20" value={omschrijving} onChange={(e) => setOmschrijving(e.target.value)} />
      </div>
      {velden.map((v) => {
        const id = `v-${v.sleutel}`;
        if (v.soort === "keuze")
          return (
            <div key={v.sleutel}>
              <label className="label" htmlFor={id}>{v.label}</label>
              <select id={id} className="invoer" value={str(details[v.sleutel])} onChange={(e) => zet(v.sleutel, e.target.value || undefined)}>
                <option value="">Kies…</option>
                {v.opties.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          );
        if (v.soort === "groep") {
          const g = (details[v.sleutel] as Record<string, string>) ?? {};
          return (
            <fieldset key={v.sleutel}>
              <legend className="label">{v.label}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {v.delen.map(([k, l]) => (
                  <label key={k} className="text-sm">
                    <span className="text-grijs">{l}</span>
                    <input className="invoer" value={g[k] ?? ""} onChange={(e) => zet(v.sleutel, { ...g, [k]: e.target.value })} />
                  </label>
                ))}
              </div>
            </fieldset>
          );
        }
        if (v.soort === "lijst")
          return (
            <div key={v.sleutel}>
              <label className="label" htmlFor={id}>{v.label}</label>
              <textarea id={id} className="invoer" value={((details[v.sleutel] as string[]) ?? []).join("\n")} onChange={(e) => zet(v.sleutel, e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))} />
            </div>
          );
        if (v.soort === "alternatieven") {
          const l = (details[v.sleutel] as { naam: string; voordelen?: string; nadelen?: string }[]) ?? [];
          return (
            <fieldset key={v.sleutel}>
              <legend className="label">{v.label}</legend>
              <div className="space-y-2">
                {l.map((a, i) => (
                  <div key={i} className="grid gap-2 rounded-md border border-lijn p-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    {(["naam", "voordelen", "nadelen"] as const).map((k) => (
                      <input key={k} className="invoer" placeholder={k[0].toUpperCase() + k.slice(1)} aria-label={`Alternatief ${i + 1} ${k}`} value={a[k] ?? ""} onChange={(e) => zet(v.sleutel, l.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
                    ))}
                    <button type="button" className="knop-licht" onClick={() => zet(v.sleutel, l.filter((_, j) => j !== i))} aria-label={`Verwijder alternatief ${i + 1}`}>✕</button>
                  </div>
                ))}
                <button type="button" className="knop-licht" onClick={() => zet(v.sleutel, [...l, { naam: "" }])}>+ Alternatief</button>
              </div>
            </fieldset>
          );
        }
        return (
          <div key={v.sleutel}>
            <label className="label" htmlFor={id}>{v.label}</label>
            {v.soort === "lang" ? (
              <textarea id={id} className="invoer min-h-16" value={str(details[v.sleutel])} onChange={(e) => zet(v.sleutel, e.target.value)} />
            ) : (
              <input id={id} type={v.soort === "datum" ? "date" : "text"} className="invoer" value={str(details[v.sleutel])} onChange={(e) => zet(v.sleutel, e.target.value || undefined)} />
            )}
          </div>
        );
      })}
      <Foutmelding fout={fout} />
      <div className="flex gap-2">
        <button className="knop" disabled={bezig}>Opslaan</button>
        <button type="button" className="knop-licht" onClick={() => setBewerken(false)}>Annuleren</button>
      </div>
    </form>
  );
}
