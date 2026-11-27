"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { maakDirectActie } from "@/app/(app)/project/[projectId]/acties";
import { Foutmelding, useActie } from "./useActie";
import { ObjectKiezer } from "./ObjectKiezer";
import type { ObjectOptie } from "@/lib/objectenlijst";
import type { RegistratieType } from "@/domain/types";

export function NieuweRegistratie({ projectId, type, label, objecten }: { projectId: string; type: RegistratieType; label: string; objecten: ObjectOptie[] }) {
  const router = useRouter();
  const { bezig, fout, voerUit } = useActie();
  const [open, setOpen] = useState(false);
  const [titel, setTitel] = useState("");
  const [objectIds, setObjectIds] = useState<string[]>([]);
  if (!open) return <button className="knop" onClick={() => setOpen(true)}>{label}</button>;
  return (
    <form
      className="kaart grid w-full gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        voerUit(() => maakDirectActie(projectId, { type, titel, objectIds }), (r) => {
          setOpen(false);
          setTitel("");
          setObjectIds([]);
          router.push(`?open=${encodeURIComponent(r.nummer)}`, { scroll: false });
        });
      }}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">{label}</h2>
      <label className="text-sm"><span className="label">Titel</span><input autoFocus className="invoer" value={titel} onChange={(e) => setTitel(e.target.value)} /></label>
      <ObjectKiezer opties={objecten} gekozen={objectIds} onChange={setObjectIds} label={type === "raakvlak" ? "Objecten (minstens twee, zelfde niveau)" : "Objecten"} />
      <p className="text-xs text-grijs">De registratie opent onder de tabel; daar vul je de overige velden in.</p>
      <Foutmelding fout={fout} />
      <div className="flex gap-2">
        <button className="knop" disabled={bezig}>Aanmaken</button>
        <button type="button" className="knop-licht" onClick={() => setOpen(false)}>Annuleren</button>
      </div>
    </form>
  );
}
