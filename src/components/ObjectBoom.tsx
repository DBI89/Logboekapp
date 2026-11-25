"use client";
import Link from "next/link";
import { useState } from "react";

export type BoomKnoop = { id: string; code: string; naam: string; niveau: number; objecttype: string; toepassing: string | null; extern: boolean; eigenaar: string | null; geerfd: boolean; aantal: number; kinderen: BoomKnoop[] };

function Knoop({ k, projectId, open, wissel }: { k: BoomKnoop; projectId: string; open: Set<string>; wissel: (id: string) => void }) {
  const isOpen = open.has(k.id);
  return (
    <li>
      <div className="flex min-h-11 items-center gap-2 border-b border-lijn px-2 py-1.5 hover:bg-vlak">
        {k.kinderen.length ? (
          <button className="w-6 text-grijs" aria-expanded={isOpen} aria-label={`${isOpen ? "Inklappen" : "Uitklappen"} ${k.code}`} onClick={() => wissel(k.id)}>
            {isOpen ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-6" />
        )}
        <span className="w-12 shrink-0 rounded bg-vlak px-1 text-center text-[10px] text-grijs">niv. {k.niveau}</span>
        <Link href={`/project/${projectId}/objecten/${encodeURIComponent(k.code)}`} className="min-w-0 flex-1 truncate hover:text-blauw">
          <span className="font-mono text-xs text-grijs">{k.code}</span> <span className="font-medium">{k.naam}</span>{" "}
          <span className="text-xs text-grijs">{k.objecttype}{k.toepassing ? ` (${k.toepassing})` : ""}</span>
        </Link>
        {k.extern && <span className="rounded bg-amber-100 px-1 text-[10px] text-oranje">extern</span>}
        <span className={`hidden w-40 truncate text-xs sm:block ${k.geerfd ? "text-grijs" : ""}`} title={k.geerfd ? "Geërfd van bovenliggend object" : undefined}>
          {k.eigenaar ?? "–"}
        </span>
        <span className={`w-8 text-right text-xs font-semibold ${k.aantal ? "text-navy" : "text-lijn"}`} title="Registraties inclusief onderliggend">{k.aantal || 0}</span>
      </div>
      {isOpen && k.kinderen.length > 0 && (
        <ul className="pl-5">
          {k.kinderen.map((c) => <Knoop key={c.id} k={c} projectId={projectId} open={open} wissel={wissel} />)}
        </ul>
      )}
    </li>
  );
}

export function ObjectBoom({ boom, projectId }: { boom: BoomKnoop[]; projectId: string }) {
  const start = new Set<string>();
  const loop = (l: BoomKnoop[]) => l.forEach((k) => { if (k.niveau < 2) start.add(k.id); loop(k.kinderen); });
  loop(boom);
  const [open, setOpen] = useState(start);
  const wissel = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <div className="kaart overflow-hidden">
      <div className="flex items-center gap-2 border-b border-lijn bg-vlak px-2 py-2 text-xs font-semibold uppercase tracking-wide text-grijs">
        <span className="w-6" /><span className="w-12">Niveau</span><span className="flex-1">Object</span><span className="hidden w-40 sm:block">Eigenaar</span><span className="w-8 text-right">#</span>
      </div>
      <ul>{boom.map((k) => <Knoop key={k.id} k={k} projectId={projectId} open={open} wissel={wissel} />)}</ul>
    </div>
  );
}
