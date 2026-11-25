import type { RegistratieType } from "@/domain/types";

export const SOORTEN: { slug: string; type: RegistratieType; titel: string; uitleg: string; statussen: string[] }[] = [
  { slug: "issues", type: "issue", titel: "Issues", uitleg: "Open vragen en problemen. Leg de voortgang periodiek vast tot het issue is opgelost.", statussen: ["open", "in_behandeling", "opgelost", "vervallen"] },
  { slug: "afwijkingen", type: "afwijking", titel: "Afwijkingen", uitleg: "Afwijkingen van eisen, normen of richtlijnen. Gelden pas na goedkeuring.", statussen: ["concept", "ter_goedkeuring", "goedgekeurd", "afgewezen", "verwerkt", "vervangen"] },
  { slug: "wijzigingen", type: "wijziging", titel: "Wijzigingen", uitleg: "Wijzigingen van scope, eisen of ontwerp. Gelden pas na goedkeuring.", statussen: ["concept", "ter_goedkeuring", "goedgekeurd", "afgewezen", "verwerkt", "vervangen"] },
  { slug: "ontwerpkeuzes", type: "ontwerpkeuze", titel: "Ontwerpkeuzes", uitleg: "Gemaakte keuzes met alternatieven en motivatie. Gelden pas na goedkeuring.", statussen: ["concept", "ter_goedkeuring", "goedgekeurd", "afgewezen", "verwerkt", "vervangen"] },
  { slug: "raakvlakken", type: "raakvlak", titel: "Raakvlakafspraken", uitleg: "Afspraken tussen objecten op hetzelfde niveau. Elke kant stemt af en verwerkt; de ontwerpleider stelt vast.", statussen: ["concept", "afgestemd", "verwerkt", "vastgesteld", "vervangen"] },
];

export const soortVanType = (type: RegistratieType) => SOORTEN.find((s) => s.type === type)!;
