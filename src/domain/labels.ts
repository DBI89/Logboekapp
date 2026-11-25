import type { RegistratieType } from "./types";

export const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_behandeling: "In behandeling",
  opgelost: "Opgelost",
  vervallen: "Vervallen",
  concept: "Concept",
  ter_goedkeuring: "Ter goedkeuring",
  goedgekeurd: "Goedgekeurd",
  afgewezen: "Afgewezen",
  verwerkt: "Verwerkt",
  vervangen: "Vervangen",
  afgestemd: "Afgestemd",
  vastgesteld: "Vastgesteld",
  nieuw: "Nieuw",
  omgezet: "Omgezet",
  samengevoegd: "Samengevoegd",
};

export const TYPE_LABEL: Record<RegistratieType, string> = {
  issue: "Issue",
  afwijking: "Afwijking",
  wijziging: "Wijziging",
  ontwerpkeuze: "Ontwerpkeuze",
  raakvlak: "Raakvlakafspraak",
};

export const TYPE_MEERVOUD: Record<RegistratieType, string> = {
  afwijking: "Afwijkingen",
  wijziging: "Wijzigingen",
  ontwerpkeuze: "Ontwerpkeuzes",
  raakvlak: "Raakvlakafspraken",
  issue: "Issues",
};

export const ROL_LABEL = { teamlid: "Teamlid", ontwerpcoordinator: "Ontwerpcoördinator", ontwerpleider: "Ontwerpleider" } as const;

export const BRON_LABEL = { waarneming: "Eigen waarneming", mail: "Mail", overleg: "Overleg", document: "Document", ontwerppeil: "OntwerpPeil" } as const;
