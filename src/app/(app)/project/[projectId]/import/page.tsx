import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { fasen, projecten } from "@/db/schema";
import { teHerkoppelen, dieperVoorstellen } from "@/domain/import";
import { objectBoom } from "@/domain/objecten";
import { isOntwerpleider } from "@/domain/rechten";
import { huidigeActor } from "@/lib/sessie";
import { plat } from "@/lib/objectenlijst";
import { leesCsv } from "@/seed/demo";
import { ImportScherm } from "@/components/ImportScherm";

export default async function Import({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const db = await getDb();
  const actor = await huidigeActor(projectId);
  const [project] = await db.select().from(projecten).where(eq(projecten.id, projectId));
  const projectFasen = (await db.select().from(fasen).where(eq(fasen.projectId, projectId))).sort((a, b) => a.volgorde - b.volgorde);
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Import</h1>
        <p className="mt-1 text-sm text-grijs">Per fase een nieuwe, diepere export uit de eigen OTL-structuur. De import matcht op objectcode.</p>
      </header>
      <ImportScherm
        projectId={projectId}
        ol={await isOntwerpleider(db, actor)}
        fasen={projectFasen.map((f) => ({ id: f.id, code: f.code }))}
        actieveFaseId={project.actieveFaseId!}
        voorbeeld={leesCsv("do")}
        herkoppelen={await teHerkoppelen(db, projectId)}
        dieper={await dieperVoorstellen(db, projectId)}
        objecten={plat(await objectBoom(db, projectId))}
      />
    </div>
  );
}
