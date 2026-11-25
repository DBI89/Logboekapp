import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { fasen, raakvlakKanten, registratieKoppelingen, registraties, voortgang } from "@/db/schema";
import { laadObjecten } from "./objecten";
import { geraakteObjectenVan } from "./registraties";
import type { RegistratieType } from "./types";

export type OverzichtRij = {
  id: string;
  nummer: string;
  titel: string;
  status: string;
  faseCode: string;
  eigenaarId: string | null;
  details: Record<string, unknown>;
  objecten: string;
  kanten: string;
  afgestemd: number;
  aantalKanten: number;
  laatsteVoortgang: { tekst: string; op: Date } | null;
};

/** Rijen voor het overzicht van één registratietype, met de gegevens die de kolommen van dat type tonen. */
export async function overzicht(
  db: Db,
  projectId: string,
  type: RegistratieType,
  filter: { status?: string; faseId?: string; tekst?: string; object?: string } = {},
): Promise<OverzichtRij[]> {
  const voorwaarden = [eq(registraties.projectId, projectId), eq(registraties.type, type)];
  if (filter.status) voorwaarden.push(eq(registraties.status, filter.status));
  if (filter.faseId) voorwaarden.push(eq(registraties.faseId, filter.faseId));
  let rijen = await db
    .select({ r: registraties, faseCode: fasen.code })
    .from(registraties)
    .innerJoin(fasen, eq(fasen.id, registraties.faseId))
    .where(and(...voorwaarden));
  const t = filter.tekst?.trim().toLowerCase();
  if (t) rijen = rijen.filter(({ r }) => `${r.nummer} ${r.titel} ${r.omschrijving}`.toLowerCase().includes(t));
  const ids = rijen.map((x) => x.r.id);
  if (!ids.length) return [];

  const objecten = new Map((await laadObjecten(db, projectId, false)).map((o) => [o.id, o]));
  const koppelingen = await db.select().from(registratieKoppelingen).where(inArray(registratieKoppelingen.registratieId, ids));
  const kanten = await db.select().from(raakvlakKanten).where(inArray(raakvlakKanten.registratieId, ids));
  const notities = await db.select().from(voortgang).where(inArray(voortgang.registratieId, ids)).orderBy(desc(voortgang.op));
  const geraakt = filter.object ? await geraakteObjectenVan(db, projectId, ids) : null;
  const z = filter.object?.trim().toLowerCase();

  return rijen
    .filter(({ r }) => !z || [...(geraakt!.get(r.id) ?? [])].some((o) => `${objecten.get(o)?.code} ${objecten.get(o)?.naam}`.toLowerCase().includes(z)))
    .sort((a, b) => a.r.nummer.localeCompare(b.r.nummer))
    .map(({ r, faseCode }) => {
      const eigen = kanten.filter((k) => k.registratieId === r.id);
      const notitie = notities.find((n) => n.registratieId === r.id);
      return {
        id: r.id,
        nummer: r.nummer,
        titel: r.titel,
        status: r.status,
        faseCode,
        eigenaarId: r.eigenaarId,
        details: r.details,
        objecten: koppelingen
          .filter((k) => k.registratieId === r.id)
          .map((k) =>
            k.soort === "exemplaar"
              ? objecten.get(k.objectId!)?.code ?? ""
              : `alle ${k.toepassing ?? k.objecttype}${k.bereikObjectId ? ` in ${objecten.get(k.bereikObjectId)?.code}` : ""}`,
          )
          .filter(Boolean)
          .join(", "),
        kanten: eigen.map((k) => objecten.get(k.objectId)?.code ?? "").sort().join(" ↔ "),
        afgestemd: eigen.filter((k) => k.afgestemdOp).length,
        aantalKanten: eigen.length,
        laatsteVoortgang: notitie ? { tekst: notitie.tekst, op: notitie.op } : null,
      };
    });
}
