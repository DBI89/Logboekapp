import { getDb } from "@/db/client";
import { objectBoom, type ObjectKnoop } from "@/domain/objecten";
import { registratiesOpObjectBoom } from "@/domain/registraties";
import { projectLeden } from "@/lib/sessie";
import { ObjectBoom, type BoomKnoop } from "@/components/ObjectBoom";

export default async function Objecten({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const db = await getDb();
  const telling = await registratiesOpObjectBoom(db, projectId);
  const namen = new Map((await projectLeden(projectId)).map((l) => [l.id, l.naam]));
  const omzet = (k: ObjectKnoop): BoomKnoop => ({
    id: k.id, code: k.code, naam: k.naam, niveau: k.niveau, objecttype: k.objecttype, toepassing: k.toepassing, extern: k.extern,
    eigenaar: k.effectieveEigenaarId ? namen.get(k.effectieveEigenaarId) ?? null : k.eigenaarOrganisatie,
    geerfd: !k.eigenaarId, aantal: telling.get(k.id) ?? 0, kinderen: k.kinderen.map(omzet),
  });
  const boom = (await objectBoom(db, projectId)).map(omzet);
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Objecten</h1>
        <p className="mt-1 text-sm text-grijs">OTL-decompositie van de laatste import. Het getal telt alle registraties op het object en eronder; grijze eigenaren zijn geërfd.</p>
      </header>
      {boom.length ? <ObjectBoom boom={boom} projectId={projectId} /> : <p className="kaart p-6 text-sm text-grijs">Nog geen objecten. Importeer de objectstructuur via Import.</p>}
    </div>
  );
}
