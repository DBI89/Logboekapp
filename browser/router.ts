/** Navigatie binnen de pagina (in het geheugen): de artifact-link draagt geen paden. */
type Luisteraar = () => void;
let pad = "/";
let versie = 0;
const luisteraars = new Set<Luisteraar>();
const meld = () => luisteraars.forEach((l) => l());

export const router = {
  pad: () => pad,
  versie: () => versie,
  abonneer(l: Luisteraar) {
    luisteraars.add(l);
    return () => luisteraars.delete(l);
  },
  ga(naar: string) {
    pad = maakAbsoluut(naar);
    meld();
  },
  ververs() {
    versie++;
    meld();
  },
};

/** Maakt een (relatieve) href absoluut ten opzichte van het huidige pad. */
export function maakAbsoluut(href: string): string {
  if (href.startsWith("/")) return href;
  const [huidigPad] = pad.split("?");
  if (href.startsWith("?")) return huidigPad + href;
  if (href === "" || href === "#") return pad;
  const basis = huidigPad.endsWith("/") ? huidigPad : huidigPad.replace(/[^/]*$/, "");
  return basis + href;
}
