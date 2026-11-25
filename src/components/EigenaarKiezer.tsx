"use client";
import { wijzigEigenaar } from "@/app/(app)/project/[projectId]/acties";
import { Foutmelding, useActie } from "./useActie";

export function EigenaarKiezer({ projectId, objectId, huidig, leden }: { projectId: string; objectId: string; huidig: string | null; leden: { id: string; naam: string }[] }) {
  const { bezig, fout, voerUit } = useActie();
  return (
    <div>
      <label className="label" htmlFor="eig">Eigenaar van dit object</label>
      <select id="eig" className="invoer" disabled={bezig} defaultValue={huidig ?? ""} onChange={(e) => voerUit(() => wijzigEigenaar(projectId, objectId, e.target.value || null))}>
        <option value="">Erft van bovenliggend object</option>
        {leden.map((l) => <option key={l.id} value={l.id}>{l.naam}</option>)}
      </select>
      <Foutmelding fout={fout} />
    </div>
  );
}
