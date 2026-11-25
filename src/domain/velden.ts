import { z } from "zod";
import type { RegistratieType } from "./types";

export const InstemmingSchema = z.object({
  nodig: z.boolean(),
  status: z.enum(["aangevraagd", "verleend", "geweigerd"]).optional(),
  datum: z.string().optional(),
  referentie: z.string().optional(),
});
export type Instemming = z.infer<typeof InstemmingSchema>;

const tekst = z.string();

export const DetailSchemas = {
  issue: z.object({
    prioriteit: z.enum(["hoog", "normaal", "laag"]),
    gevolg: tekst,
    streefdatum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum als JJJJ-MM-DD"),
  }),
  afwijking: z.object({
    afwijkingVan: tekst,
    artikel: tekst,
    eis: tekst,
    voorgesteld: tekst,
    motivatie: tekst,
    gevolgen: z.object({ veiligheid: tekst, kosten: tekst, planning: tekst, beheer: tekst }).partial(),
    maatregelen: tekst,
    instemming: InstemmingSchema,
  }),
  wijziging: z.object({
    aanleiding: z.enum(["opdrachtgever", "intern", "extern"]),
    situatieOud: tekst,
    situatieNieuw: tekst,
    gevolgen: z.object({ scope: tekst, kosten: tekst, planning: tekst, raakvlakken: tekst }).partial(),
    geraakteDocumenten: z.array(tekst),
    instemming: InstemmingSchema,
  }),
  ontwerpkeuze: z.object({
    vraagstuk: tekst,
    alternatieven: z.array(z.object({ naam: tekst, voordelen: tekst.optional(), nadelen: tekst.optional() })),
    criteria: tekst,
    gekozen: tekst,
    motivatie: tekst,
    consequenties: tekst,
    instemming: InstemmingSchema,
  }),
  raakvlak: z.object({
    soort: z.enum(["fysiek", "functioneel", "ruimtelijk"]),
    afspraak: tekst,
  }),
} satisfies Record<RegistratieType, z.ZodObject<z.ZodRawShape>>;

export type Details<T extends RegistratieType> = Partial<z.infer<(typeof DetailSchemas)[T]>>;

/** Valideert (gedeeltelijke) details van een type; gooit bij ongeldige waarden. */
export function valideerDetails(type: RegistratieType, details: unknown): Record<string, unknown> {
  return DetailSchemas[type].partial().strict().parse(details ?? {}) as Record<string, unknown>;
}

export const verplichtVoorAanbieden: Record<RegistratieType, string[]> = {
  issue: [],
  afwijking: ["afwijkingVan", "eis", "voorgesteld", "motivatie"],
  wijziging: ["aanleiding", "situatieOud", "situatieNieuw"],
  ontwerpkeuze: ["vraagstuk", "alternatieven", "gekozen", "motivatie"],
  raakvlak: ["soort", "afspraak"],
};

export function ontbrekendeVelden(type: RegistratieType, details: Record<string, unknown>): string[] {
  return verplichtVoorAanbieden[type].filter((veld) => {
    const w = details[veld];
    if (veld === "alternatieven") return !Array.isArray(w) || w.length < 2;
    return w === undefined || w === null || (typeof w === "string" && !w.trim());
  });
}

export const VELD_LABEL: Record<string, string> = {
  prioriteit: "Prioriteit",
  gevolg: "Gevolg als het niet wordt opgelost",
  streefdatum: "Streefdatum",
  afwijkingVan: "Afwijking van (eis, norm of richtlijn)",
  artikel: "Artikel",
  eis: "Eis",
  voorgesteld: "Voorgestelde situatie",
  motivatie: "Motivatie",
  maatregelen: "Compenserende maatregelen",
  aanleiding: "Aanleiding",
  situatieOud: "Situatie oud",
  situatieNieuw: "Situatie nieuw",
  geraakteDocumenten: "Geraakte documenten",
  vraagstuk: "Vraagstuk",
  alternatieven: "Alternatieven (minstens twee)",
  criteria: "Afwegingscriteria",
  gekozen: "Gekozen alternatief",
  consequenties: "Consequenties",
  soort: "Soort raakvlak",
  afspraak: "Afspraak",
};
