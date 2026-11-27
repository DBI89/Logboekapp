"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { filterEnSorteer, uniekeWaarden, type Filters, type Sortering, type TabelRij } from "@/lib/tabelfilter";
import { StatusLabel } from "./StatusLabel";

export type TabelKolom = { sleutel: string; kop: string; soort: "tekst" | "keuze"; breed?: boolean; mono?: boolean };

function FilterPopover({ kolom, rijen, filter, zet, sluit, anker }: {
  kolom: TabelKolom;
  rijen: TabelRij[];
  filter: { tekst?: string; waarden?: string[] };
  zet: (f: { tekst?: string; waarden?: string[] }) => void;
  sluit: () => void;
  anker: DOMRect;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoek, setZoek] = useState("");
  useEffect(() => {
    const klik = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) sluit(); };
    const toets = (e: KeyboardEvent) => { if (e.key === "Escape") sluit(); };
    const scroll = (e: Event) => { if (!ref.current?.contains(e.target as Node)) sluit(); };
    document.addEventListener("mousedown", klik);
    document.addEventListener("keydown", toets);
    window.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("mousedown", klik);
      document.removeEventListener("keydown", toets);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [sluit]);
  const breedte = 256;
  const links = Math.max(8, Math.min(anker.left, window.innerWidth - breedte - 8));
  const opties = uniekeWaarden(rijen, kolom.sleutel).filter((w) => w.toLowerCase().includes(zoek.toLowerCase()));
  const gekozen = filter.waarden ?? [];
  return (
    <div ref={ref} role="dialog" aria-label={`Filter ${kolom.kop}`} className="fixed z-40 rounded-lg border border-lijn bg-white p-3 text-sm normal-case tracking-normal text-inkt shadow-lg" style={{ top: anker.bottom + 4, left: links, width: breedte }}>
      {kolom.soort === "tekst" ? (
        <label className="block">
          <span className="label">Bevat</span>
          <input autoFocus className="invoer" value={filter.tekst ?? ""} onChange={(e) => zet({ tekst: e.target.value })} placeholder={`Zoek in ${kolom.kop.toLowerCase()}`} />
        </label>
      ) : (
        <div>
          <input autoFocus className="invoer" value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek waarde" aria-label="Zoek waarde" />
          <ul className="mt-2 max-h-56 overflow-auto">
            {opties.map((w) => (
              <li key={w}>
                <label className="flex min-h-8 cursor-pointer items-center gap-2 rounded px-1 hover:bg-vlak">
                  <input type="checkbox" checked={gekozen.includes(w)} onChange={(e) => zet({ waarden: e.target.checked ? [...gekozen, w] : gekozen.filter((x) => x !== w) })} />
                  {w}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 flex justify-between">
        <button className="text-xs text-blauw hover:underline" onClick={() => zet({})}>Filter wissen</button>
        <button className="text-xs text-grijs hover:underline" onClick={sluit}>Sluiten</button>
      </div>
    </div>
  );
}

export function RegistratieTabel({ kolommen, rijen, open, leeg }: { kolommen: TabelKolom[]; rijen: (TabelRij & { statusCode: string })[]; open?: string; leeg: string }) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>({});
  const [sortering, setSortering] = useState<Sortering>({ sleutel: "nummer", richting: "op" });
  const [popover, setPopover] = useState<{ sleutel: string; anker: DOMRect } | null>(null);
  const zichtbaar = useMemo(() => filterEnSorteer(rijen, filters, sortering) as (TabelRij & { statusCode: string })[], [rijen, filters, sortering]);
  const actief = (k: string) => Boolean(filters[k]?.tekst?.trim() || filters[k]?.waarden?.length);
  const aantalActief = kolommen.filter((k) => actief(k.sleutel)).length;
  const sorteer = (k: string) => setSortering((s) => ({ sleutel: k, richting: s.sleutel === k && s.richting === "op" ? "af" : "op" }));
  const href = (nummer: string) => `?open=${encodeURIComponent(nummer)}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-sm text-grijs">
        <span>{zichtbaar.length === rijen.length ? `${rijen.length} ${rijen.length === 1 ? "registratie" : "registraties"}` : `${zichtbaar.length} van ${rijen.length} registraties`}</span>
        {aantalActief > 0 && <button className="text-blauw hover:underline" onClick={() => setFilters({})}>Alle filters wissen ({aantalActief})</button>}
        <span className="hidden sm:inline">Klik op een kolomtitel om te sorteren; filter met het trechtertje.</span>
      </div>
      <div className="kaart overflow-x-auto">
        <table className="tabel min-w-[760px]">
          <thead>
            <tr>
              {kolommen.map((k) => (
                <th key={k.sleutel} aria-sort={sortering.sleutel === k.sleutel ? (sortering.richting === "op" ? "ascending" : "descending") : "none"}>
                  <span className="flex items-center gap-1">
                    <button className="flex items-center gap-1 uppercase tracking-wide hover:text-navy" onClick={() => sorteer(k.sleutel)}>
                      {k.kop}
                      <span aria-hidden className="text-[10px]">{sortering.sleutel === k.sleutel ? (sortering.richting === "op" ? "▲" : "▼") : ""}</span>
                    </button>
                    <button
                      aria-label={`Filter op ${k.kop}`}
                      aria-expanded={popover?.sleutel === k.sleutel}
                      className={`ml-auto rounded p-1 ${actief(k.sleutel) ? "bg-blauw text-white" : "text-grijs hover:bg-white hover:text-navy"}`}
                      onClick={(e) => setPopover(popover?.sleutel === k.sleutel ? null : { sleutel: k.sleutel, anker: e.currentTarget.getBoundingClientRect() })}
                    >
                      <svg aria-hidden width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2h14l-5.5 6.5V14l-3 1.5V8.5z" /></svg>
                    </button>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zichtbaar.map((r) => {
              const gekozen = open === r.waarden.nummer;
              return (
                <tr
                  key={r.id}
                  onClick={() => router.push(href(r.waarden.nummer), { scroll: false })}
                  className={`cursor-pointer ${gekozen ? "!bg-mint/20 outline outline-2 -outline-offset-2 outline-mint" : ""}`}
                  aria-selected={gekozen}
                >
                  {kolommen.map((k) => (
                    <td key={k.sleutel} className={`${k.breed ? "min-w-44" : ""} ${k.mono ? "font-mono text-xs" : ""}`}>
                      {k.sleutel === "nummer" ? (
                        <Link scroll={false} className="whitespace-nowrap font-mono text-xs text-blauw hover:underline" href={href(r.waarden.nummer)} onClick={(e) => e.stopPropagation()}>{r.waarden.nummer}</Link>
                      ) : k.sleutel === "status" ? (
                        <StatusLabel status={r.statusCode} />
                      ) : (
                        <span className={k.breed ? "line-clamp-2" : ""}>{r.waarden[k.sleutel] || <span className="text-grijs">–</span>}</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
            {!zichtbaar.length && <tr><td colSpan={kolommen.length} className="py-6 text-center text-grijs">{rijen.length ? "Geen registraties binnen deze filters." : leeg}</td></tr>}
          </tbody>
        </table>
      </div>
      {popover && (
        <FilterPopover
          kolom={kolommen.find((k) => k.sleutel === popover.sleutel)!}
          rijen={rijen}
          anker={popover.anker}
          filter={filters[popover.sleutel] ?? {}}
          zet={(f) => setFilters((alle) => ({ ...alle, [popover.sleutel]: f }))}
          sluit={() => setPopover(null)}
        />
      )}
    </div>
  );
}
