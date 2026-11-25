import type { Db } from "@/db/client";
import { historie } from "@/db/schema";

export type HistorieInvoer = {
  projectId: string;
  gebruikerId: string;
  entiteit: "melding" | "registratie" | "object" | "document";
  entiteitId: string;
  actie: string;
  oud?: unknown;
  nieuw?: unknown;
};

export async function logHistorie(db: Db, h: HistorieInvoer): Promise<void> {
  await db.insert(historie).values({ ...h, oud: h.oud ?? null, nieuw: h.nieuw ?? null });
}
