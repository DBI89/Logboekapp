import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const nu = (naam: string) => timestamp(naam, { withTimezone: true }).notNull().defaultNow();

export const gebruikers = pgTable("gebruikers", {
  id: id(),
  naam: text("naam").notNull(),
  email: text("email").notNull().unique(),
});

export const projecten = pgTable("projecten", {
  id: id(),
  naam: text("naam").notNull(),
  nummer: text("nummer").notNull(),
  actieveFaseId: uuid("actieve_fase_id"),
  inboxSignaalWerkdagen: integer("inbox_signaal_werkdagen").notNull().default(5),
});

export const fasen = pgTable("fasen", {
  id: id(),
  projectId: uuid("project_id").notNull().references(() => projecten.id),
  code: text("code").notNull(),
  volgorde: integer("volgorde").notNull(),
});

export const projectleden = pgTable(
  "projectleden",
  {
    projectId: uuid("project_id").notNull().references(() => projecten.id),
    gebruikerId: uuid("gebruiker_id").notNull().references(() => gebruikers.id),
    rol: text("rol").$type<"teamlid" | "ontwerpcoordinator" | "ontwerpleider">().notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.gebruikerId] })],
);

export const delegaties = pgTable(
  "delegaties",
  {
    projectId: uuid("project_id").notNull().references(() => projecten.id),
    gebruikerId: uuid("gebruiker_id").notNull().references(() => gebruikers.id),
    actief: boolean("actief").notNull().default(true),
    sinds: nu("sinds"),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.gebruikerId] })],
);

export const nummerteller = pgTable(
  "nummerteller",
  {
    projectId: uuid("project_id").notNull().references(() => projecten.id),
    soort: text("soort").notNull(),
    laatste: integer("laatste").notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.soort] })],
);

export const objectImports = pgTable("object_imports", {
  id: id(),
  projectId: uuid("project_id").notNull().references(() => projecten.id),
  faseId: uuid("fase_id").notNull().references(() => fasen.id),
  bestandsnaam: text("bestandsnaam").notNull(),
  uitgevoerdDoor: uuid("uitgevoerd_door").notNull().references(() => gebruikers.id),
  uitgevoerdOp: nu("uitgevoerd_op"),
});

export const objecten = pgTable(
  "objecten",
  {
    id: id(),
    projectId: uuid("project_id").notNull().references(() => projecten.id),
    code: text("code").notNull(),
    naam: text("naam").notNull(),
    niveau: integer("niveau").notNull(),
    objecttype: text("objecttype").notNull(),
    toepassing: text("toepassing"),
    locatie: text("locatie"),
    ouderId: uuid("ouder_id").references((): AnyPgColumn => objecten.id),
    extern: boolean("extern").notNull().default(false),
    eigenaarOrganisatie: text("eigenaar_organisatie"),
    eigenaarId: uuid("eigenaar_id").references(() => gebruikers.id),
    actief: boolean("actief").notNull().default(true),
    laatsteImportId: uuid("laatste_import_id").references(() => objectImports.id),
  },
  (t) => [unique().on(t.projectId, t.code)],
);

export type MeldingStatus = "nieuw" | "omgezet" | "samengevoegd" | "vervallen";
export type BronSoort = "waarneming" | "mail" | "overleg" | "document" | "ontwerppeil";

export const meldingen = pgTable("meldingen", {
  id: id(),
  projectId: uuid("project_id").notNull().references(() => projecten.id),
  nummer: text("nummer").notNull(),
  titel: text("titel").notNull(),
  omschrijving: text("omschrijving").notNull(),
  faseId: uuid("fase_id").notNull().references(() => fasen.id),
  status: text("status").$type<MeldingStatus>().notNull().default("nieuw"),
  bronSoort: text("bron_soort").$type<BronSoort>().notNull().default("waarneming"),
  bronRef: text("bron_ref"),
  gemeldDoor: uuid("gemeld_door").notNull().references(() => gebruikers.id),
  gemeldOp: nu("gemeld_op"),
  vervallenReden: text("vervallen_reden"),
  beoordeeldDoor: uuid("beoordeeld_door").references(() => gebruikers.id),
});

export const meldingObjecten = pgTable(
  "melding_objecten",
  {
    meldingId: uuid("melding_id").notNull().references(() => meldingen.id),
    objectId: uuid("object_id").notNull().references(() => objecten.id),
  },
  (t) => [primaryKey({ columns: [t.meldingId, t.objectId] })],
);

export const registraties = pgTable("registraties", {
  id: id(),
  projectId: uuid("project_id").notNull().references(() => projecten.id),
  type: text("type").$type<"issue" | "afwijking" | "wijziging" | "ontwerpkeuze" | "raakvlak">().notNull(),
  nummer: text("nummer").notNull(),
  titel: text("titel").notNull(),
  omschrijving: text("omschrijving").notNull().default(""),
  faseId: uuid("fase_id").notNull().references(() => fasen.id),
  status: text("status").notNull(),
  discipline: text("discipline"),
  eigenaarId: uuid("eigenaar_id").references(() => gebruikers.id),
  aangemaaktDoor: uuid("aangemaakt_door").notNull().references(() => gebruikers.id),
  aangemaaktOp: nu("aangemaakt_op"),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  goedgekeurdDoor: uuid("goedgekeurd_door").references(() => gebruikers.id),
  goedgekeurdOnderDelegatie: boolean("goedgekeurd_onder_delegatie").notNull().default(false),
  goedgekeurdOp: timestamp("goedgekeurd_op", { withTimezone: true }),
  afwijsToelichting: text("afwijs_toelichting"),
  verwerktDoor: uuid("verwerkt_door").references(() => gebruikers.id),
  verwerktOp: timestamp("verwerkt_op", { withTimezone: true }),
  vervangenDoorId: uuid("vervangen_door_id").references((): AnyPgColumn => registraties.id),
});

export const registratieKoppelingen = pgTable("registratie_koppelingen", {
  id: id(),
  registratieId: uuid("registratie_id").notNull().references(() => registraties.id),
  soort: text("soort").$type<"exemplaar" | "type">().notNull(),
  objectId: uuid("object_id").references(() => objecten.id),
  objecttype: text("objecttype"),
  toepassing: text("toepassing"),
  bereikObjectId: uuid("bereik_object_id").references(() => objecten.id),
  teHerkoppelen: boolean("te_herkoppelen").notNull().default(false),
});

export const registratieRelaties = pgTable(
  "registratie_relaties",
  {
    vanId: uuid("van_id").notNull().references(() => registraties.id),
    naarId: uuid("naar_id").notNull().references(() => registraties.id),
    soort: text("soort").$type<"vervangt" | "lost_op" | "gerelateerd" | "verfijnt">().notNull(),
  },
  (t) => [primaryKey({ columns: [t.vanId, t.naarId, t.soort] })],
);

export const registratieBronnen = pgTable(
  "registratie_bronnen",
  {
    registratieId: uuid("registratie_id").notNull().references(() => registraties.id),
    meldingId: uuid("melding_id").notNull().references(() => meldingen.id),
  },
  (t) => [primaryKey({ columns: [t.registratieId, t.meldingId] })],
);

export const raakvlakKanten = pgTable("raakvlak_kanten", {
  id: id(),
  registratieId: uuid("registratie_id").notNull().references(() => registraties.id),
  objectId: uuid("object_id").notNull().references(() => objecten.id),
  verantwoordelijkeId: uuid("verantwoordelijke_id").references(() => gebruikers.id),
  afgestemdOp: timestamp("afgestemd_op", { withTimezone: true }),
  afgestemdBron: text("afgestemd_bron"),
  verwerktOp: timestamp("verwerkt_op", { withTimezone: true }),
});

export const documenten = pgTable("documenten", {
  id: id(),
  projectId: uuid("project_id").notNull().references(() => projecten.id),
  nummer: text("nummer").notNull(),
  titel: text("titel").notNull(),
  discipline: text("discipline"),
  revisie: text("revisie").notNull(),
  status: text("status").notNull(),
  faseId: uuid("fase_id").notNull().references(() => fasen.id),
});

export const documentObjecten = pgTable(
  "document_objecten",
  {
    documentId: uuid("document_id").notNull().references(() => documenten.id),
    objectId: uuid("object_id").notNull().references(() => objecten.id),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.objectId] })],
);

export const documentUitsluitingen = pgTable(
  "document_uitsluitingen",
  {
    documentId: uuid("document_id").notNull().references(() => documenten.id),
    registratieId: uuid("registratie_id").notNull().references(() => registraties.id),
    reden: text("reden").notNull(),
    door: uuid("door").notNull().references(() => gebruikers.id),
    op: nu("op"),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.registratieId] })],
);

export const rapportSnapshots = pgTable("rapport_snapshots", {
  id: id(),
  documentId: uuid("document_id").notNull().references(() => documenten.id),
  revisie: text("revisie").notNull(),
  vastgelegdDoor: uuid("vastgelegd_door").notNull().references(() => gebruikers.id),
  vastgelegdOp: nu("vastgelegd_op"),
  inhoud: jsonb("inhoud")
    .$type<{ id: string; nummer: string; status: string; hash: string; waarden: Record<string, string> }[]>()
    .notNull(),
});

export const historie = pgTable("historie", {
  id: id(),
  projectId: uuid("project_id").notNull().references(() => projecten.id),
  gebruikerId: uuid("gebruiker_id").notNull().references(() => gebruikers.id),
  entiteit: text("entiteit").notNull(),
  entiteitId: uuid("entiteit_id").notNull(),
  actie: text("actie").notNull(),
  oud: jsonb("oud"),
  nieuw: jsonb("nieuw"),
  op: nu("op"),
});

export const voortgang = pgTable("voortgang", {
  id: id(),
  registratieId: uuid("registratie_id").notNull().references(() => registraties.id),
  tekst: text("tekst").notNull(),
  door: uuid("door").notNull().references(() => gebruikers.id),
  op: nu("op"),
});
