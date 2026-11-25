import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { delegaties, projectleden } from "@/db/schema";
import type { Actor, Rol } from "./types";

export async function rolVan(db: Db, actor: Actor): Promise<Rol | null> {
  const [rij] = await db
    .select({ rol: projectleden.rol })
    .from(projectleden)
    .where(and(eq(projectleden.projectId, actor.projectId), eq(projectleden.gebruikerId, actor.gebruikerId)));
  return rij?.rol ?? null;
}

export async function isOntwerpleider(db: Db, actor: Actor): Promise<boolean> {
  return (await rolVan(db, actor)) === "ontwerpleider";
}

export async function magBeoordelen(db: Db, actor: Actor): Promise<boolean> {
  const rol = await rolVan(db, actor);
  return rol === "ontwerpleider" || rol === "ontwerpcoordinator";
}

export async function heeftDelegatie(db: Db, actor: Actor): Promise<boolean> {
  const [rij] = await db
    .select({ actief: delegaties.actief })
    .from(delegaties)
    .where(and(eq(delegaties.projectId, actor.projectId), eq(delegaties.gebruikerId, actor.gebruikerId)));
  return rij?.actief === true;
}

export async function magGoedkeuren(
  db: Db,
  actor: Actor,
  registratie: { aangemaaktDoor: string },
): Promise<{ ok: true } | { ok: false; reden: string }> {
  const rol = await rolVan(db, actor);
  if (rol !== "ontwerpleider" && rol !== "ontwerpcoordinator") return { ok: false, reden: "Geen bevoegdheid" };
  if (registratie.aangemaaktDoor === actor.gebruikerId)
    return { ok: false, reden: "Opsteller mag niet zelf goedkeuren" };
  if (rol === "ontwerpcoordinator" && !(await heeftDelegatie(db, actor))) return { ok: false, reden: "Geen delegatie" };
  return { ok: true };
}
