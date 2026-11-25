import type { Db } from "@/db/client";
import { gebruikers, projecten, fasen, projectleden } from "@/db/schema";
import { eq } from "drizzle-orm";

/** Project met fasen SO..UO (actief: VO) en vier gebruikers. */
export async function maakBasisProject(db: Db, nummer = "P-1") {
  const [ol, oc, teamlid, teamlid2] = await db
    .insert(gebruikers)
    .values([
      { naam: "Ontwerpleider " + nummer, email: `ol-${nummer}@x.nl` },
      { naam: "Coördinator " + nummer, email: `oc-${nummer}@x.nl` },
      { naam: "Teamlid " + nummer, email: `tl-${nummer}@x.nl` },
      { naam: "Teamlid2 " + nummer, email: `tl2-${nummer}@x.nl` },
    ])
    .returning({ id: gebruikers.id });
  const [project] = await db.insert(projecten).values({ naam: "Project " + nummer, nummer }).returning();
  const fs = await db
    .insert(fasen)
    .values(["SO", "VO", "DO", "UO"].map((code, i) => ({ projectId: project.id, code, volgorde: i + 1 })))
    .returning();
  const fase = Object.fromEntries(fs.map((f) => [f.code, f.id])) as Record<"SO" | "VO" | "DO" | "UO", string>;
  await db.update(projecten).set({ actieveFaseId: fase.VO }).where(eq(projecten.id, project.id));
  await db.insert(projectleden).values([
    { projectId: project.id, gebruikerId: ol.id, rol: "ontwerpleider" },
    { projectId: project.id, gebruikerId: oc.id, rol: "ontwerpcoordinator" },
    { projectId: project.id, gebruikerId: teamlid.id, rol: "teamlid" },
    { projectId: project.id, gebruikerId: teamlid2.id, rol: "teamlid" },
  ]);
  return { projectId: project.id, ol: ol.id, oc: oc.id, teamlid: teamlid.id, teamlid2: teamlid2.id, fase };
}

export const actorVan = (projectId: string, gebruikerId: string) => ({ projectId, gebruikerId });

import { readFileSync } from "node:fs";
import path from "node:path";
import { parseObjectCsv, voerImportUit } from "@/domain/import";
import { objectIdVanCode } from "@/domain/objecten";

/** Importeert de SO- of DO-structuur uit de fixtures en geeft code → id. */
export async function metObjecten(
  db: Db,
  p: Awaited<ReturnType<typeof maakBasisProject>>,
  bestand: "so" | "do" = "do",
) {
  const { regels, fouten } = parseObjectCsv(readFileSync(path.join(__dirname, "fixtures", `${bestand}.csv`), "utf8"));
  if (fouten.length) throw new Error(fouten.join("\n"));
  await voerImportUit(db, actorVan(p.projectId, p.ol), bestand === "so" ? p.fase.SO : p.fase.DO, bestand, regels);
  const id = (code: string) => objectIdVanCode(db, p.projectId, code);
  return id;
}
