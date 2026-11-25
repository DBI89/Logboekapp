"use client";
import { useState } from "react";
import { zetDocumentObjectenActie } from "@/app/(app)/project/[projectId]/acties";
import { Foutmelding, useActie } from "./useActie";
import { ObjectKiezer } from "./ObjectKiezer";
import type { ObjectOptie } from "@/lib/objectenlijst";

export function DocumentObjecten({ projectId, documentId, huidig, objecten }: { projectId: string; documentId: string; huidig: string[]; objecten: ObjectOptie[] }) {
  const { bezig, fout, voerUit } = useActie();
  const [open, setOpen] = useState(false);
  const [gekozen, setGekozen] = useState(huidig);
  if (!open) return <button className="knop-licht" onClick={() => setOpen(true)}>Objecten aanpassen</button>;
  return (
    <div className="kaart grid gap-3 p-4">
      <ObjectKiezer label="Objecten die dit document behandelt" opties={objecten} gekozen={gekozen} onChange={setGekozen} />
      <Foutmelding fout={fout} />
      <div className="flex gap-2">
        <button className="knop" disabled={bezig} onClick={() => voerUit(() => zetDocumentObjectenActie(projectId, documentId, gekozen), () => setOpen(false))}>Opslaan</button>
        <button className="knop-licht" onClick={() => { setGekozen(huidig); setOpen(false); }}>Annuleren</button>
      </div>
    </div>
  );
}
