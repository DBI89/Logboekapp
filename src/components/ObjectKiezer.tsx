"use client";
import { useMemo, useState } from "react";
import type { ObjectOptie } from "@/lib/objectenlijst";

/** Meervoudige objectkeuze met zoekveld (alleen niveau 0–3). */
export function ObjectKiezer({ opties, gekozen, onChange, label = "Objecten" }: { opties: ObjectOptie[]; gekozen: string[]; onChange: (ids: string[]) => void; label?: string }) {
  const [zoek, setZoek] = useState("");
  const zichtbaar = useMemo(() => {
    const z = zoek.trim().toLowerCase();
    return opties.filter((o) => o.niveau <= 3 && (!z || `${o.code} ${o.naam}`.toLowerCase().includes(z)));
  }, [opties, zoek]);
  const perId = new Map(opties.map((o) => [o.id, o]));
  return (
    <div>
      <span className="label">{label}</span>
      {gekozen.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {gekozen.map((id) => (
            <button
              type="button"
              key={id}
              onClick={() => onChange(gekozen.filter((g) => g !== id))}
              className="rounded-full bg-blauw/10 px-2 py-1 text-xs text-navy hover:bg-rood/10 hover:text-rood"
              aria-label={`Verwijder ${perId.get(id)?.code}`}
            >
              {perId.get(id)?.code} ✕
            </button>
          ))}
        </div>
      )}
      <input className="invoer" placeholder="Zoek op code of naam" value={zoek} onChange={(e) => setZoek(e.target.value)} aria-label="Zoek object" />
      <ul className="mt-1 max-h-48 overflow-auto rounded-md border border-lijn bg-white text-sm">
        {zichtbaar.map((o) => (
          <li key={o.id}>
            <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-vlak" style={{ paddingLeft: 8 + o.diepte * 14 }}>
              <input
                type="checkbox"
                checked={gekozen.includes(o.id)}
                onChange={(e) => onChange(e.target.checked ? [...gekozen, o.id] : gekozen.filter((g) => g !== o.id))}
              />
              <span className="font-mono text-xs text-grijs">{o.code}</span>
              <span>{o.naam}</span>
              {o.extern && <span className="rounded bg-amber-100 px-1 text-[10px] text-oranje">extern</span>}
              <span className="ml-auto text-[10px] text-grijs">niv. {o.niveau}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
