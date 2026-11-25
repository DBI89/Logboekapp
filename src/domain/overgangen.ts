import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { registratieRelaties } from "@/db/schema";
import { haalRij } from "./registraties";
import { isOntwerpleider, magBeoordelen, magGoedkeuren, rolVan } from "./rechten";
import { biedAan, keurGoed, markeerVerwerkt, wijsAf, zetIssueStatus } from "./workflow";
import { eindoordeel } from "./raakvlakken";
import { vervang } from "./fasen";
import { Fout, type Actor } from "./types";

export type OvergangActie =
  | "aanbieden"
  | "goedkeuren"
  | "afwijzen"
  | "verwerkt"
  | "vervangen"
  | "in_behandeling"
  | "opgelost"
  | "vervallen"
  | "heropenen"
  | "vaststellen"
  | "terugsturen";

export type Overgang = { actie: OvergangActie; label: string; vraagt?: "toelichting" | "reden" | "oplossing" | "opmerking_kanten" };

const LABEL: Record<OvergangActie, string> = {
  aanbieden: "Ter goedkeuring aanbieden",
  goedkeuren: "Goedkeuren",
  afwijzen: "Afwijzen",
  verwerkt: "Verwerkt (doorgevoerd in het ontwerp)",
  vervangen: "Vervangen door een nieuwe registratie",
  in_behandeling: "In behandeling",
  opgelost: "Opgelost",
  vervallen: "Vervallen",
  heropenen: "Terug naar open",
  vaststellen: "Vastgesteld (eindoordeel akkoord)",
  terugsturen: "Terug naar afgestemd (eindoordeel niet akkoord)",
};

const VRAAGT: Partial<Record<OvergangActie, Overgang["vraagt"]>> = {
  afwijzen: "toelichting",
  opgelost: "oplossing",
  vervallen: "reden",
  terugsturen: "opmerking_kanten",
};

/** De statuswijzigingen die deze gebruiker nu kan doen, in een vaste volgorde. */
export async function mogelijkeOvergangen(db: Db, actor: Actor, id: string): Promise<Overgang[]> {
  const r = await haalRij(db, id);
  if (r.projectId !== actor.projectId || !(await rolVan(db, actor))) return [];
  const acties: OvergangActie[] = [];
  const lopendeVervanging = (
    await db.select().from(registratieRelaties).where(and(eq(registratieRelaties.naarId, id), eq(registratieRelaties.soort, "vervangt")))
  ).length > 0;
  if (r.type === "issue") {
    if (r.status === "open") acties.push("in_behandeling", "opgelost", "vervallen");
    if (r.status === "in_behandeling") acties.push("opgelost", "vervallen", "heropenen");
  } else if (r.type === "raakvlak") {
    if (r.status === "verwerkt" && (await isOntwerpleider(db, actor))) acties.push("vaststellen", "terugsturen");
    if (r.status === "vastgesteld" && !lopendeVervanging) acties.push("vervangen");
  } else {
    const betrokken = r.aangemaaktDoor === actor.gebruikerId || r.eigenaarId === actor.gebruikerId || (await magBeoordelen(db, actor));
    if (["concept", "afgewezen"].includes(r.status) && betrokken) acties.push("aanbieden");
    if (r.status === "ter_goedkeuring" && (await magGoedkeuren(db, actor, r)).ok) acties.push("goedkeuren", "afwijzen");
    if (r.status === "goedgekeurd") acties.push("verwerkt");
    if (["goedgekeurd", "verwerkt"].includes(r.status) && !lopendeVervanging) acties.push("vervangen");
  }
  return acties.map((actie) => ({ actie, label: LABEL[actie], ...(VRAAGT[actie] ? { vraagt: VRAAGT[actie] } : {}) }));
}

export type OvergangInvoer = { toelichting?: string; reden?: string; oplossingId?: string; opmerking?: string; kantIds?: string[] };

/** Voert een statuswijziging uit het keuzemenu uit. Bij vervangen komt het nummer van de nieuwe registratie terug. */
export async function voerOvergangUit(db: Db, actor: Actor, id: string, actie: OvergangActie, invoer: OvergangInvoer = {}): Promise<{ nieuwNummer?: string }> {
  if (!(await mogelijkeOvergangen(db, actor, id)).some((o) => o.actie === actie)) throw new Fout("Deze statuswijziging is nu niet mogelijk");
  switch (actie) {
    case "aanbieden":
      await biedAan(db, actor, id);
      break;
    case "goedkeuren":
      await keurGoed(db, actor, id);
      break;
    case "afwijzen":
      await wijsAf(db, actor, id, invoer.toelichting ?? "");
      break;
    case "verwerkt":
      await markeerVerwerkt(db, actor, id);
      break;
    case "vervangen":
      return { nieuwNummer: (await vervang(db, actor, id, {})).nummer };
    case "in_behandeling":
    case "opgelost":
    case "vervallen":
      await zetIssueStatus(db, actor, id, actie, { reden: invoer.reden, oplossingId: invoer.oplossingId });
      break;
    case "heropenen":
      await zetIssueStatus(db, actor, id, "open");
      break;
    case "vaststellen":
      await eindoordeel(db, actor, id, true, { opmerking: invoer.opmerking });
      break;
    case "terugsturen":
      await eindoordeel(db, actor, id, false, { opmerking: invoer.opmerking, terugNaarKantIds: invoer.kantIds });
      break;
  }
  return {};
}
