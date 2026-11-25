"use client";
import { useTransition } from "react";
import { wisselGebruiker } from "@/lib/sessie-acties";
import { ROL_LABEL } from "@/domain/labels";

type Lid = { id: string; naam: string; rol: keyof typeof ROL_LABEL };

export function GebruikerWissel({ leden, huidig }: { leden: Lid[]; huidig: string }) {
  const [bezig, start] = useTransition();
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/70">Ingelogd als (demo)</span>
      <select
        aria-label="Wissel van gebruiker"
        className="w-full rounded-md border border-white/30 bg-white/10 px-2 py-2 text-sm text-white outline-none focus:border-mint"
        value={huidig}
        disabled={bezig}
        onChange={(e) => start(() => wisselGebruiker(e.target.value))}
      >
        {leden.map((l) => (
          <option key={l.id} value={l.id} className="text-inkt">
            {l.naam} — {ROL_LABEL[l.rol]}
          </option>
        ))}
      </select>
    </label>
  );
}
