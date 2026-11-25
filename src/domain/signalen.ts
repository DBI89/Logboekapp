import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { fasen, projecten, raakvlakKanten, registraties } from "@/db/schema";
import { inbox, type MeldingRij } from "./meldingen";
import { magBeoordelen, magGoedkeuren, isOntwerpleider } from "./rechten";
import { teHerkoppelen } from "./import";
import type { RegistratieRij } from "./registraties";
import type { Actor } from "./types";

const AFGEROND = ["opgelost", "vervallen", "vervangen", "vastgesteld", "verwerkt"];

async function rijen(db: Db, projectId: string) {
  const r = await db
    .select({ r: registraties, faseCode: fasen.code })
    .from(registraties)
    .innerJoin(fasen, eq(fasen.id, registraties.faseId))
    .where(eq(registraties.projectId, projectId));
  return r.sort((a, b) => a.r.nummer.localeCompare(b.r.nummer));
}

const naarRij = ({ r, faseCode }: Awaited<ReturnType<typeof rijen>>[number]): RegistratieRij => ({
  id: r.id,
  nummer: r.nummer,
  type: r.type,
  titel: r.titel,
  status: r.status,
  faseId: r.faseId,
  faseCode,
  eigenaarId: r.eigenaarId,
  viaType: false,
});

export async function mijnWerk(db: Db, actor: Actor) {
  const alle = await rijen(db, actor.projectId);
  const ol = await isOntwerpleider(db, actor);

  const wachtOpMijnGoedkeuring: RegistratieRij[] = [];
  for (const x of alle.filter((x) => x.r.status === "ter_goedkeuring"))
    if ((await magGoedkeuren(db, actor, x.r)).ok) wachtOpMijnGoedkeuring.push(naarRij(x));

  const ids = alle.map((x) => x.r.id);
  const kanten = ids.length
    ? await db
        .select()
        .from(raakvlakKanten)
        .where(and(inArray(raakvlakKanten.registratieId, ids), eq(raakvlakKanten.verantwoordelijkeId, actor.gebruikerId)))
    : [];
  const perId = new Map(alle.map((x) => [x.r.id, x]));
  type Akkoord = { kantId: string; registratie: RegistratieRij; stap: "afstemmen" | "verwerken" };
  const wachtOpMijnAkkoord = kanten.flatMap((k): Akkoord[] => {
    const x = perId.get(k.registratieId)!;
    if (x.r.status === "concept" && !k.afgestemdOp) return [{ kantId: k.id, registratie: naarRij(x), stap: "afstemmen" }];
    if (x.r.status === "afgestemd" && !k.verwerktOp) return [{ kantId: k.id, registratie: naarRij(x), stap: "verwerken" }];
    return [];
  });

  return {
    wachtOpMijnGoedkeuring,
    wachtOpEindoordeel: ol ? alle.filter((x) => x.r.type === "raakvlak" && x.r.status === "verwerkt").map(naarRij) : [],
    wachtOpMijnAkkoord,
    eigenaarVan: alle.filter((x) => x.r.eigenaarId === actor.gebruikerId && !AFGEROND.includes(x.r.status)).map(naarRij),
    goedgekeurdNietVerwerkt: alle
      .filter(
        (x) =>
          x.r.status === "goedgekeurd" &&
          (ol || x.r.eigenaarId === actor.gebruikerId || x.r.aangemaaktDoor === actor.gebruikerId),
      )
      .map(naarRij),
    teBeoordelenMeldingen: (await magBeoordelen(db, actor)) ? await inbox(db, actor.projectId, { status: ["nieuw"] }) : ([] as MeldingRij[]),
  };
}

export type Signaal = {
  soort: "inbox_te_lang" | "goedgekeurd_niet_verwerkt" | "instemming_open" | "te_herkoppelen" | "eindoordeel_nodig";
  tekst: string;
  link: string;
};

const meer = (n: number, een: string, meervoud: string) => `${n} ${n === 1 ? een : meervoud}`;

export async function signalen(db: Db, projectId: string): Promise<Signaal[]> {
  const [project] = await db.select().from(projecten).where(eq(projecten.id, projectId));
  const drempel = project.inboxSignaalWerkdagen;
  const uit: Signaal[] = [];
  const oud = (await inbox(db, projectId, { status: ["nieuw"] })).filter((m) => m.werkdagenOpen > drempel);
  if (oud.length)
    uit.push({
      soort: "inbox_te_lang",
      tekst: `${meer(oud.length, "melding staat", "meldingen staan")} langer dan ${drempel} werkdagen in de inbox`,
      link: "inbox",
    });
  const alle = (await rijen(db, projectId)).map((x) => x.r);
  const nietVerwerkt = alle.filter((r) => r.status === "goedgekeurd");
  if (nietVerwerkt.length)
    uit.push({
      soort: "goedgekeurd_niet_verwerkt",
      tekst: `${meer(nietVerwerkt.length, "registratie is", "registraties zijn")} goedgekeurd maar nog niet verwerkt`,
      link: "registraties?status=goedgekeurd",
    });
  const instemming = alle.filter((r) => {
    const i = r.details.instemming as { nodig?: boolean; status?: string } | undefined;
    return i?.nodig && i.status !== "verleend" && i.status !== "geweigerd" && r.status !== "vervangen";
  });
  if (instemming.length)
    uit.push({
      soort: "instemming_open",
      tekst: `${meer(instemming.length, "registratie wacht", "registraties wachten")} op instemming van de opdrachtgever`,
      link: "registraties?instemming=open",
    });
  const herkoppel = await teHerkoppelen(db, projectId);
  if (herkoppel.length)
    uit.push({ soort: "te_herkoppelen", tekst: `${meer(herkoppel.length, "koppeling moet", "koppelingen moeten")} opnieuw worden gekoppeld`, link: "import" });
  const eind = alle.filter((r) => r.type === "raakvlak" && r.status === "verwerkt");
  if (eind.length)
    uit.push({ soort: "eindoordeel_nodig", tekst: `${meer(eind.length, "raakvlakafspraak wacht", "raakvlakafspraken wachten")} op het eindoordeel`, link: "registraties?type=raakvlak&status=verwerkt" });
  return uit;
}
