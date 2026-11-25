export type RegistratieType = "issue" | "afwijking" | "wijziging" | "ontwerpkeuze" | "raakvlak";
export type NummerSoort = RegistratieType | "melding";
export type Rol = "teamlid" | "ontwerpcoordinator" | "ontwerpleider";
export type Actor = { gebruikerId: string; projectId: string };

export const PREFIX: Record<NummerSoort, string> = {
  melding: "M",
  issue: "IS",
  afwijking: "AF",
  wijziging: "WZ",
  ontwerpkeuze: "OK",
  raakvlak: "RV",
};

export const TYPE_LABEL: Record<RegistratieType, string> = {
  issue: "Issue",
  afwijking: "Afwijking",
  wijziging: "Wijziging",
  ontwerpkeuze: "Ontwerpkeuze",
  raakvlak: "Raakvlakafspraak",
};

/** Fout met een Nederlandse melding voor de gebruiker. */
export class Fout extends Error {
  constructor(melding: string) {
    super(melding);
    this.name = "Fout";
  }
}

export const BEVROREN = ["goedgekeurd", "verwerkt", "vervangen", "afgestemd", "vastgesteld"] as const;
