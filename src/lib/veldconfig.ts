import type { RegistratieType } from "@/domain/types";

export type Veld =
  | { sleutel: string; label: string; soort: "tekst" | "lang" | "datum" }
  | { sleutel: string; label: string; soort: "keuze"; opties: [string, string][] }
  | { sleutel: string; label: string; soort: "groep"; delen: [string, string][] }
  | { sleutel: string; label: string; soort: "alternatieven" }
  | { sleutel: string; label: string; soort: "lijst" };

export const VELDEN: Record<RegistratieType, Veld[]> = {
  issue: [
    { sleutel: "prioriteit", label: "Prioriteit", soort: "keuze", opties: [["hoog", "Hoog"], ["normaal", "Normaal"], ["laag", "Laag"]] },
    { sleutel: "gevolg", label: "Gevolg als het niet wordt opgelost", soort: "lang" },
    { sleutel: "streefdatum", label: "Streefdatum", soort: "datum" },
  ],
  afwijking: [
    { sleutel: "afwijkingVan", label: "Afwijking van (eis, norm of richtlijn) *", soort: "tekst" },
    { sleutel: "artikel", label: "Artikel", soort: "tekst" },
    { sleutel: "eis", label: "Eis *", soort: "lang" },
    { sleutel: "voorgesteld", label: "Voorgestelde situatie *", soort: "lang" },
    { sleutel: "motivatie", label: "Motivatie *", soort: "lang" },
    { sleutel: "gevolgen", label: "Gevolgen", soort: "groep", delen: [["veiligheid", "Veiligheid"], ["kosten", "Kosten"], ["planning", "Planning"], ["beheer", "Beheer en onderhoud"]] },
    { sleutel: "maatregelen", label: "Compenserende maatregelen", soort: "lang" },
  ],
  wijziging: [
    { sleutel: "aanleiding", label: "Aanleiding *", soort: "keuze", opties: [["opdrachtgever", "Opdrachtgever"], ["intern", "Intern"], ["extern", "Extern"]] },
    { sleutel: "situatieOud", label: "Situatie oud *", soort: "lang" },
    { sleutel: "situatieNieuw", label: "Situatie nieuw *", soort: "lang" },
    { sleutel: "gevolgen", label: "Gevolgen", soort: "groep", delen: [["scope", "Scope"], ["kosten", "Kosten"], ["planning", "Planning"], ["raakvlakken", "Raakvlakken"]] },
    { sleutel: "geraakteDocumenten", label: "Geraakte documenten (één per regel)", soort: "lijst" },
  ],
  ontwerpkeuze: [
    { sleutel: "vraagstuk", label: "Vraagstuk *", soort: "lang" },
    { sleutel: "alternatieven", label: "Beschouwde alternatieven * (minstens twee)", soort: "alternatieven" },
    { sleutel: "criteria", label: "Afwegingscriteria", soort: "lang" },
    { sleutel: "gekozen", label: "Gekozen alternatief *", soort: "tekst" },
    { sleutel: "motivatie", label: "Motivatie *", soort: "lang" },
    { sleutel: "consequenties", label: "Consequenties", soort: "lang" },
  ],
  raakvlak: [
    { sleutel: "soort", label: "Soort raakvlak *", soort: "keuze", opties: [["fysiek", "Fysiek"], ["functioneel", "Functioneel"], ["ruimtelijk", "Ruimtelijk"]] },
    { sleutel: "afspraak", label: "Afspraak *", soort: "lang" },
  ],
};
