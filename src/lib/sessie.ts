import "server-only";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { gebruikers, projectleden } from "@/db/schema";
import type { Actor, Rol } from "@/domain/types";

export const COOKIE = "demo_gebruiker";

export async function projectLeden(projectId: string) {
  const db = await getDb();
  return db
    .select({ id: gebruikers.id, naam: gebruikers.naam, rol: projectleden.rol })
    .from(projectleden)
    .innerJoin(gebruikers, eq(gebruikers.id, projectleden.gebruikerId))
    .where(eq(projectleden.projectId, projectId));
}

/** Huidige demogebruiker (cookie), standaard de ontwerpleider van het project. */
export async function huidigeActor(projectId: string): Promise<Actor & { naam: string; rol: Rol }> {
  const db = await getDb();
  const gekozen = (await cookies()).get(COOKIE)?.value;
  if (gekozen) {
    const [lid] = await db
      .select({ id: gebruikers.id, naam: gebruikers.naam, rol: projectleden.rol })
      .from(projectleden)
      .innerJoin(gebruikers, eq(gebruikers.id, projectleden.gebruikerId))
      .where(and(eq(projectleden.projectId, projectId), eq(projectleden.gebruikerId, gekozen)));
    if (lid) return { projectId, gebruikerId: lid.id, naam: lid.naam, rol: lid.rol };
  }
  const leden = await projectLeden(projectId);
  const ol = leden.find((l) => l.rol === "ontwerpleider") ?? leden[0];
  return { projectId, gebruikerId: ol.id, naam: ol.naam, rol: ol.rol };
}
