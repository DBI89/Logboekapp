/** Filteren en sorteren vanuit de kolomkoppen (zoals in Excel), los van de weergave. */
export type TabelRij = { id: string; waarden: Record<string, string>; sorteer?: Record<string, string> };
export type KolomFilter = { tekst?: string; waarden?: string[] };
export type Filters = Record<string, KolomFilter>;
export type Sortering = { sleutel: string; richting: "op" | "af" };

export const LEEG = "(leeg)";
const waarde = (r: TabelRij, k: string) => r.waarden[k] ?? "";

export function uniekeWaarden(rijen: TabelRij[], sleutel: string): string[] {
  return [...new Set(rijen.map((r) => waarde(r, sleutel) || LEEG))].sort((a, b) => a.localeCompare(b, "nl", { numeric: true }));
}

export function filterEnSorteer(rijen: TabelRij[], filters: Filters, sortering?: Sortering): TabelRij[] {
  const uit = rijen.filter((r) =>
    Object.entries(filters).every(([k, f]) => {
      const w = waarde(r, k);
      if (f.tekst?.trim() && !w.toLowerCase().includes(f.tekst.trim().toLowerCase())) return false;
      if (f.waarden?.length && !f.waarden.includes(w || LEEG)) return false;
      return true;
    }),
  );
  if (!sortering) return uit;
  const s = (r: TabelRij) => r.sorteer?.[sortering.sleutel] ?? waarde(r, sortering.sleutel);
  return [...uit].sort((a, b) => {
    const x = s(a);
    const y = s(b);
    if (!x !== !y) return x ? -1 : 1; // lege waarden altijd onderaan
    const c = x.localeCompare(y, "nl", { numeric: true });
    return sortering.richting === "op" ? c : -c;
  });
}
