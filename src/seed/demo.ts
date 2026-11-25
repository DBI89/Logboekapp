import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { delegaties, documenten, documentObjecten, fasen, gebruikers, meldingen, projecten, projectleden } from "@/db/schema";
import { parseObjectCsv, voerImportUit } from "@/domain/import";
import { objectIdVanCode, zetEigenaar } from "@/domain/objecten";
import { maakRegistratie } from "@/domain/registraties";
import { biedAan, keurGoed } from "@/domain/workflow";
import { maakRaakvlak, kantAfgestemd } from "@/domain/raakvlakken";
import { meld, parseSnelinvoer } from "@/domain/meldingen";
import { legRevisieVast } from "@/domain/rapport";
import { haalRegistratie } from "@/domain/registraties";

import { SO_CSV, DO_CSV } from "./data/csv";

export const leesCsv = (naam: "so" | "do") => (naam === "so" ? SO_CSV : DO_CSV);

export async function seedDemo(db: Db) {
  const g = await db
    .insert(gebruikers)
    .values([
      { naam: "Sanne de Vries", email: "sanne.devries@demo.nl" },
      { naam: "Joris Bakker", email: "joris.bakker@demo.nl" },
      { naam: "Fatma Yilmaz", email: "fatma.yilmaz@demo.nl" },
      { naam: "Pieter Jansen", email: "pieter.jansen@demo.nl" },
      { naam: "Lotte Visser", email: "lotte.visser@demo.nl" },
    ])
    .returning();
  const [ol, oc, constructeur, wegontwerper, installatie] = g.map((x) => x.id);
  const [project] = await db.insert(projecten).values({ naam: "Traject N-weg — Viaduct Noord", nummer: "P-2026-014" }).returning();
  const projectId = project.id;
  const fs = await db
    .insert(fasen)
    .values(["SO", "VO", "DO", "UO"].map((code, i) => ({ projectId, code, volgorde: i + 1 })))
    .returning();
  const fase = Object.fromEntries(fs.map((f) => [f.code, f.id])) as Record<string, string>;
  await db.update(projecten).set({ actieveFaseId: fase.VO }).where(eq(projecten.id, projectId));
  await db.insert(projectleden).values([
    { projectId, gebruikerId: ol, rol: "ontwerpleider" },
    { projectId, gebruikerId: oc, rol: "ontwerpcoordinator" },
    { projectId, gebruikerId: constructeur, rol: "teamlid" },
    { projectId, gebruikerId: wegontwerper, rol: "teamlid" },
    { projectId, gebruikerId: installatie, rol: "teamlid" },
  ]);
  await db.insert(delegaties).values({ projectId, gebruikerId: oc, actief: true });

  const a = (gebruikerId: string) => ({ projectId, gebruikerId });
  await voerImportUit(db, a(ol), fase.SO, "OTL-export SO.csv", parseObjectCsv(leesCsv("so")).regels);
  const id = (code: string) => objectIdVanCode(db, projectId, code);
  await zetEigenaar(db, a(ol), await id("VN"), constructeur);
  await zetEigenaar(db, a(ol), await id("TN-WL"), wegontwerper);

  // OK-0001: goedgekeurde ontwerpkeuze
  const ok = await maakRegistratie(db, a(constructeur), {
    type: "ontwerpkeuze",
    titel: "Liggerdek in plaats van plaatdek",
    omschrijving: "Keuze van het dektype voor de drie overspanningen.",
    discipline: "Constructief",
    koppelingen: [{ soort: "exemplaar", objectId: await id("VN") }],
    details: {
      vraagstuk: "Welk dektype past bij overspanningen tot 32 m en de bouwtijd boven de N-weg?",
      alternatieven: [
        { naam: "In het werk gestort plaatdek", voordelen: "Slank", nadelen: "Lange stremming N-weg" },
        { naam: "Prefab liggerdek", voordelen: "Korte stremming, bewezen", nadelen: "Hogere constructiehoogte" },
      ],
      criteria: "Stremming, kosten, onderhoud",
      gekozen: "Prefab liggerdek",
      motivatie: "Stremming van de N-weg blijft beperkt tot twee weekenden.",
      consequenties: "Constructiehoogte +0,3 m; aansluiting wegprofiel aanpassen.",
      instemming: { nodig: false },
    },
  });
  await biedAan(db, a(constructeur), ok.id);
  await keurGoed(db, a(ol), ok.id);

  // AF-0001: afwijking ter goedkeuring, typekoppeling op alle steunpunten
  const af = await maakRegistratie(db, a(constructeur), {
    type: "afwijking",
    titel: "Betondekking steunpunten 40 mm in plaats van 45 mm",
    omschrijving: "Wapening en bekisting laten 45 mm niet toe bij de gekozen kolomafmeting.",
    discipline: "Constructief",
    koppelingen: [{ soort: "type", objecttype: "Onderbouw", toepassing: "Steunpunt", bereikObjectId: await id("VN") }],
    details: {
      afwijkingVan: "Programma van Eisen, eis K-112",
      artikel: "NEN-EN 1992-1-1, 4.4.1",
      eis: "Betondekking minimaal 45 mm (XD3)",
      voorgesteld: "Betondekking 40 mm met hoogwaardig beton C45/55 en coating",
      motivatie: "Gelijkwaardige duurzaamheid; past binnen de kolomafmeting.",
      gevolgen: { veiligheid: "Geen", kosten: "+ € 18.000 coating", planning: "Geen", beheer: "Coating inspecteren elke 10 jaar" },
      maatregelen: "Coating op spatzone, extra inspectie",
      instemming: { nodig: true, status: "aangevraagd", referentie: "RFC-2026-031" },
    },
  });
  await biedAan(db, a(constructeur), af.id);

  // WZ-0001: wijziging in concept
  await maakRegistratie(db, a(wegontwerper), {
    type: "wijziging",
    titel: "Extra fietsstrook op het viaduct",
    omschrijving: "Opdrachtgever vraagt om een vrijliggende fietsstrook aan de noordzijde.",
    discipline: "Wegontwerp",
    koppelingen: [{ soort: "exemplaar", objectId: await id("VN") }],
    details: { aanleiding: "opdrachtgever", situatieOud: "2 rijstroken, geen fietsvoorziening", situatieNieuw: "2 rijstroken + fietsstrook 2,5 m" },
  });

  // IS-0001: open issue op steunpunt as-3 (wordt bij de DO-import te herkoppelen)
  await maakRegistratie(db, a(constructeur), {
    type: "issue",
    titel: "Funderingsadvies steunpunt as-3 ontbreekt",
    omschrijving: "Sondering S-14 laat een slappe laag zien; geotechnisch advies nodig.",
    koppelingen: [{ soort: "exemplaar", objectId: await id("VN-SP-3") }],
    details: { prioriteit: "hoog", gevolg: "Paalpuntniveau onbekend", streefdatum: "2026-12-12" },
  });

  // RV-0001: afgestemd, RV-0002: concept met extern object
  const rv1 = await maakRaakvlak(db, a(constructeur), {
    titel: "Oplegging overspanning as-1–as-2 op tussensteunpunt as-2",
    omschrijving: "",
    objectIds: [await id("VN-OV-12"), await id("VN-SP-2")],
    details: { soort: "fysiek", afspraak: "Elastomeer opleggingen, oplegbreedte 400 mm, ruimte voor vijzels." },
  });
  for (const k of (await haalRegistratie(db, rv1.id)).kanten) await kantAfgestemd(db, a(constructeur), k.id);
  await maakRaakvlak(db, a(wegontwerper), {
    titel: "Kruising middenspanningskabel met rijbaan rechts",
    omschrijving: "Netbeheerder Noord legt een nieuwe kabel onder de rijbaan.",
    objectIds: [await id("EXT-KL"), await id("TN-WL-RB-R")],
    details: { soort: "ruimtelijk", afspraak: "Kabel in mantelbuis op minimaal 1,2 m onder verharding." },
  });

  // Meldingen
  const oud = await meld(db, a(installatie), {
    titel: "Verlichting op viaduct: masten of leuningverlichting?",
    omschrijving: "Nog geen besluit; heeft invloed op de randelementen.",
    objectIds: [await id("VN")],
  });
  await db.update(meldingen).set({ gemeldOp: new Date(Date.now() - 10 * 86400000) }).where(eq(meldingen.id, oud.id));
  await meld(db, a(oc), {
    titel: "Kabeltracé langs steunpunt as-1",
    omschrijving: "Besluit B-0012 uit Ontwerpteamoverleg #8: netbeheerder wil het kabeltracé langs steunpunt as-1 leggen. Afstemmen met fundering.",
    objectIds: [await id("VN-SP-1")],
    bronSoort: "ontwerppeil",
    bronRef: "OntwerpPeil · Ontwerpteamoverleg #8 · B-0012",
  });
  const snel = await parseSnelinvoer(db, projectId, "Sparing voor afwatering ontbreekt in tekening #VN-SP-1");
  await meld(db, a(constructeur), { titel: snel.titel, omschrijving: snel.titel, objectIds: snel.objectId ? [snel.objectId] : [] });
  await meld(db, a(wegontwerper), {
    titel: "Afwijking van de norm voor boogstraal toerit",
    omschrijving: "Boogstraal toerit noord wordt 180 m i.p.v. 250 m door ruimtebeslag.",
    objectIds: [await id("TN-WL-RB-R")],
    bronSoort: "mail",
    bronRef: "Mail opdrachtgever 18-11-2026",
  });

  // Documenten
  const docs = await db
    .insert(documenten)
    .values([
      { projectId, nummer: "VN-NOT-001", titel: "Ontwerpnota Viaduct Noord VO", discipline: "Constructief", revisie: "0", status: "concept", faseId: fase.VO },
      { projectId, nummer: "VN-NOT-002", titel: "Ontwerpnota Viaduct Noord DO", discipline: "Constructief", revisie: "0", status: "concept", faseId: fase.DO },
      { projectId, nummer: "TN-NOT-001", titel: "Raakvlakkendocument Traject N-weg", discipline: "Integraal", revisie: "0", status: "concept", faseId: fase.VO },
    ])
    .returning();
  const doc = Object.fromEntries(docs.map((d) => [d.nummer, d.id]));
  await db.insert(documentObjecten).values([
    { documentId: doc["VN-NOT-001"], objectId: await id("VN") },
    { documentId: doc["VN-NOT-002"], objectId: await id("VN") },
    { documentId: doc["TN-NOT-001"], objectId: await id("TN") },
  ]);
  await legRevisieVast(db, a(ol), doc["VN-NOT-001"], "A");

  return { projectId, gebruikers: { ol, oc, constructeur, wegontwerper, installatie } };
}
