import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { objecten } from "@/db/schema";
import { Fout } from "./types";
import { isOntwerpleider } from "./rechten";
import { logHistorie } from "./historie";

export type ObjectRij = typeof objecten.$inferSelect;

export type ObjectKnoop = {
  id: string;
  code: string;
  naam: string;
  niveau: number;
  objecttype: string;
  toepassing: string | null;
  locatie: string | null;
  extern: boolean;
  eigenaarOrganisatie: string | null;
  eigenaarId: string | null;
  effectieveEigenaarId: string | null;
  kinderen: ObjectKnoop[];
};

export async function laadObjecten(db: Db, projectId: string, alleenActief = true): Promise<ObjectRij[]> {
  const rijen = await db.select().from(objecten).where(eq(objecten.projectId, projectId));
  return alleenActief ? rijen.filter((o) => o.actief) : rijen;
}

async function projectVan(db: Db, objectId: string): Promise<string> {
  const [o] = await db.select({ projectId: objecten.projectId }).from(objecten).where(eq(objecten.id, objectId));
  if (!o) throw new Fout("Object bestaat niet");
  return o.projectId;
}

export async function objectIdVanCode(db: Db, projectId: string, code: string): Promise<string> {
  const [o] = await db
    .select({ id: objecten.id })
    .from(objecten)
    .where(and(eq(objecten.projectId, projectId), eq(objecten.code, code)));
  if (!o) throw new Fout(`Object ${code} bestaat niet`);
  return o.id;
}

/** Ouders van het object, van direct bovenliggend tot de wortel. */
export async function voorouders(db: Db, objectId: string): Promise<string[]> {
  const alle = new Map((await laadObjecten(db, await projectVan(db, objectId), false)).map((o) => [o.id, o]));
  return vooroudersUit(alle, objectId);
}

export function vooroudersUit(alle: Map<string, ObjectRij>, objectId: string): string[] {
  const uit: string[] = [];
  let huidig = alle.get(objectId)?.ouderId ?? null;
  while (huidig && !uit.includes(huidig)) {
    uit.push(huidig);
    huidig = alle.get(huidig)?.ouderId ?? null;
  }
  return uit;
}

/** Alle actieve objecten onder het object (zonder het object zelf). */
export async function nakomelingen(db: Db, objectId: string): Promise<string[]> {
  return nakomelingenUit(await laadObjecten(db, await projectVan(db, objectId)), objectId);
}

export function nakomelingenUit(alle: ObjectRij[], objectId: string): string[] {
  const kinderen = new Map<string, string[]>();
  for (const o of alle) if (o.ouderId) kinderen.set(o.ouderId, [...(kinderen.get(o.ouderId) ?? []), o.id]);
  const uit: string[] = [];
  const stapel = [...(kinderen.get(objectId) ?? [])];
  while (stapel.length) {
    const id = stapel.pop()!;
    uit.push(id);
    stapel.push(...(kinderen.get(id) ?? []));
  }
  return uit;
}

export function effectieveEigenaarUit(alle: Map<string, ObjectRij>, objectId: string): string | null {
  let huidig: string | null = objectId;
  const gezien = new Set<string>();
  while (huidig && !gezien.has(huidig)) {
    gezien.add(huidig);
    const o = alle.get(huidig);
    if (!o) return null;
    if (o.eigenaarId) return o.eigenaarId;
    huidig = o.ouderId;
  }
  return null;
}

/** Eerste eigenaar omhoog in de boom. */
export async function effectieveEigenaar(db: Db, objectId: string): Promise<string | null> {
  const alle = new Map((await laadObjecten(db, await projectVan(db, objectId), false)).map((o) => [o.id, o]));
  return effectieveEigenaarUit(alle, objectId);
}

export async function objectBoom(db: Db, projectId: string): Promise<ObjectKnoop[]> {
  const alle = await laadObjecten(db, projectId);
  const perId = new Map(alle.map((o) => [o.id, o]));
  const knopen = new Map<string, ObjectKnoop>(
    alle.map((o) => [
      o.id,
      {
        id: o.id,
        code: o.code,
        naam: o.naam,
        niveau: o.niveau,
        objecttype: o.objecttype,
        toepassing: o.toepassing,
        locatie: o.locatie,
        extern: o.extern,
        eigenaarOrganisatie: o.eigenaarOrganisatie,
        eigenaarId: o.eigenaarId,
        effectieveEigenaarId: effectieveEigenaarUit(perId, o.id),
        kinderen: [],
      },
    ]),
  );
  const wortels: ObjectKnoop[] = [];
  for (const o of alle) {
    const k = knopen.get(o.id)!;
    const ouder = o.ouderId ? knopen.get(o.ouderId) : undefined;
    (ouder ? ouder.kinderen : wortels).push(k);
  }
  const sorteer = (l: ObjectKnoop[]) => {
    l.sort((a, b) => a.code.localeCompare(b.code, "nl"));
    l.forEach((k) => sorteer(k.kinderen));
  };
  sorteer(wortels);
  return wortels;
}

export async function zetEigenaar(db: Db, actor: { projectId: string; gebruikerId: string }, objectId: string, eigenaarId: string | null): Promise<void> {
  if (!(await isOntwerpleider(db, actor))) throw new Fout("Alleen de ontwerpleider wijst objecteigenaren aan");
  const [o] = await db.select().from(objecten).where(eq(objecten.id, objectId));
  if (!o || o.projectId !== actor.projectId) throw new Fout("Object bestaat niet");
  if (eigenaarId) {
    const { rolVan } = await import("./rechten");
    if (!(await rolVan(db, { projectId: actor.projectId, gebruikerId: eigenaarId }))) throw new Fout("Eigenaar moet lid van het project zijn");
  }
  await db.update(objecten).set({ eigenaarId }).where(eq(objecten.id, objectId));
  await logHistorie(db, { projectId: actor.projectId, gebruikerId: actor.gebruikerId, entiteit: "object", entiteitId: objectId, actie: "eigenaar", oud: { eigenaarId: o.eigenaarId }, nieuw: { eigenaarId } });
}
