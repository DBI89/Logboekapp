import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { delegaties, registratieRelaties, registraties } from "@/db/schema";
import { logHistorie } from "./historie";
import { haalRij, werkBij, type Patch } from "./registraties";
import { heeftDelegatie, isOntwerpleider, magBeoordelen, magGoedkeuren, rolVan } from "./rechten";
import { ontbrekendeVelden, valideerDetails, VELD_LABEL, type Instemming } from "./velden";
import { Fout, type Actor } from "./types";
import { rondVervangingAf } from "./vervanging";

type Rij = Awaited<ReturnType<typeof haalRij>>;

async function laad(db: Db, actor: Actor, id: string): Promise<Rij> {
  const r = await haalRij(db, id);
  if (r.projectId !== actor.projectId) throw new Fout("Registratie hoort niet bij dit project");
  if (!(await rolVan(db, actor))) throw new Fout("Geen lid van dit project");
  return r;
}

function overgang(r: Rij, van: string[], naar: string) {
  if (!van.includes(r.status)) throw new Fout(`Overgang niet toegestaan: ${r.status} → ${naar}`);
}

function alleenGoedkeurTypen(r: Rij) {
  if (r.type === "issue") throw new Fout("Niet van toepassing op een issue");
  if (r.type === "raakvlak") throw new Fout("Raakvlakafspraken lopen via afstemmen en eindoordeel");
}

async function zetStatus(db: Db, actor: Actor, r: Rij, status: string, actie: string, extra: Partial<typeof registraties.$inferInsert> = {}, nieuw: Record<string, unknown> = {}) {
  await db.update(registraties).set({ status, ...extra }).where(eq(registraties.id, r.id));
  await logHistorie(db, {
    projectId: r.projectId,
    gebruikerId: actor.gebruikerId,
    entiteit: "registratie",
    entiteitId: r.id,
    actie,
    oud: { status: r.status },
    nieuw: { status, ...nieuw },
  });
}

export async function biedAan(db: Db, actor: Actor, id: string): Promise<void> {
  const r = await laad(db, actor, id);
  alleenGoedkeurTypen(r);
  overgang(r, ["concept", "afgewezen"], "ter_goedkeuring");
  const betrokken = r.aangemaaktDoor === actor.gebruikerId || r.eigenaarId === actor.gebruikerId || (await magBeoordelen(db, actor));
  if (!betrokken) throw new Fout("Alleen opsteller, eigenaar, ontwerpleider of coördinator mag aanbieden");
  const ontbreekt = ontbrekendeVelden(r.type, r.details);
  if (ontbreekt.length) throw new Fout(`Ontbrekende velden: ${ontbreekt.map((v) => VELD_LABEL[v] ?? v).join(", ")}`);
  await zetStatus(db, actor, r, "ter_goedkeuring", "aangeboden", { afwijsToelichting: null });
}

export async function keurGoed(db: Db, actor: Actor, id: string): Promise<void> {
  const r = await laad(db, actor, id);
  alleenGoedkeurTypen(r);
  overgang(r, ["ter_goedkeuring"], "goedgekeurd");
  const mag = await magGoedkeuren(db, actor, r);
  if (!mag.ok) throw new Fout(mag.reden);
  const ontbreekt = ontbrekendeVelden(r.type, r.details);
  if (ontbreekt.length) throw new Fout(`Ontbrekende velden: ${ontbreekt.map((v) => VELD_LABEL[v] ?? v).join(", ")}`);
  const onderDelegatie = !(await isOntwerpleider(db, actor));
  await zetStatus(
    db,
    actor,
    r,
    "goedgekeurd",
    "goedgekeurd",
    { goedgekeurdDoor: actor.gebruikerId, goedgekeurdOnderDelegatie: onderDelegatie, goedgekeurdOp: new Date() },
    { onderDelegatie },
  );
  await rondVervangingAf(db, actor, id);
}

export async function wijsAf(db: Db, actor: Actor, id: string, toelichting: string): Promise<void> {
  if (!toelichting?.trim()) throw new Fout("Toelichting is verplicht");
  const r = await laad(db, actor, id);
  alleenGoedkeurTypen(r);
  overgang(r, ["ter_goedkeuring"], "afgewezen");
  const mag = await magGoedkeuren(db, actor, r);
  if (!mag.ok) throw new Fout(mag.reden);
  await zetStatus(db, actor, r, "afgewezen", "afgewezen", { afwijsToelichting: toelichting.trim() }, { toelichting });
}

export async function markeerVerwerkt(db: Db, actor: Actor, id: string): Promise<void> {
  const r = await laad(db, actor, id);
  alleenGoedkeurTypen(r);
  overgang(r, ["goedgekeurd"], "verwerkt");
  await zetStatus(db, actor, r, "verwerkt", "verwerkt", { verwerktDoor: actor.gebruikerId, verwerktOp: new Date() });
}

export async function zetInstemming(db: Db, actor: Actor, id: string, instemming: Instemming): Promise<void> {
  const r = await laad(db, actor, id);
  if (!["afwijking", "wijziging", "ontwerpkeuze"].includes(r.type)) throw new Fout("Instemming geldt alleen voor afwijking, wijziging of ontwerpkeuze");
  if (r.status === "vervangen") throw new Fout("Registratie is vervangen");
  const details = valideerDetails(r.type, { ...r.details, instemming });
  await db.update(registraties).set({ details }).where(eq(registraties.id, id));
  await logHistorie(db, {
    projectId: r.projectId,
    gebruikerId: actor.gebruikerId,
    entiteit: "registratie",
    entiteitId: id,
    actie: "instemming",
    oud: { instemming: r.details.instemming ?? null },
    nieuw: { instemming },
  });
}

export async function tekstcorrectie(db: Db, actor: Actor, id: string, patch: Pick<Patch, "titel" | "omschrijving" | "details">): Promise<void> {
  if (!(await isOntwerpleider(db, actor))) throw new Fout("Alleen de ontwerpleider mag een tekstcorrectie doen");
  const r = await laad(db, actor, id);
  if (!["goedgekeurd", "verwerkt", "afgestemd", "vastgesteld"].includes(r.status))
    throw new Fout("Tekstcorrectie alleen op een vastgelegde registratie");
  await werkBij(db, actor, id, { titel: patch.titel, omschrijving: patch.omschrijving, details: patch.details }, { actie: "tekstcorrectie", negeerBevroren: true });
}

export async function zetIssueStatus(
  db: Db,
  actor: Actor,
  id: string,
  naar: "in_behandeling" | "opgelost" | "vervallen" | "open",
  opts: { oplossingId?: string; reden?: string } = {},
): Promise<void> {
  const r = await laad(db, actor, id);
  if (r.type !== "issue") throw new Fout("Alleen voor issues");
  const toegestaan: Record<string, string[]> = {
    open: ["in_behandeling"],
    in_behandeling: ["open", "opgelost", "vervallen"],
    opgelost: [],
    vervallen: [],
  };
  if (r.status === "open" && (naar === "opgelost" || naar === "vervallen")) toegestaan.open.push(naar);
  if (!toegestaan[r.status]?.includes(naar)) throw new Fout(`Overgang niet toegestaan: ${r.status} → ${naar}`);
  if (naar === "opgelost") {
    if (!opts.oplossingId) throw new Fout("Kies de registratie die het issue oplost");
    const opl = await haalRij(db, opts.oplossingId);
    if (opl.projectId !== r.projectId || opl.id === r.id) throw new Fout("Kies een andere registratie uit dit project");
    await db.insert(registratieRelaties).values({ vanId: r.id, naarId: opl.id, soort: "lost_op" }).onConflictDoNothing();
  }
  if (naar === "vervallen" && !opts.reden?.trim()) throw new Fout("Reden is verplicht");
  await zetStatus(db, actor, r, naar, `issue_${naar}`, {}, { oplossingId: opts.oplossingId, reden: opts.reden });
}

export async function delegeer(db: Db, actor: Actor, gebruikerId: string, actief: boolean): Promise<void> {
  if (!(await isOntwerpleider(db, actor))) throw new Fout("Alleen de ontwerpleider mag delegeren");
  if ((await rolVan(db, { projectId: actor.projectId, gebruikerId })) !== "ontwerpcoordinator")
    throw new Fout("Delegeren kan alleen aan een ontwerpcoördinator");
  await db
    .insert(delegaties)
    .values({ projectId: actor.projectId, gebruikerId, actief })
    .onConflictDoUpdate({ target: [delegaties.projectId, delegaties.gebruikerId], set: { actief, sinds: new Date() } });
}

export { heeftDelegatie };
