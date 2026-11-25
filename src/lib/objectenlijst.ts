import type { ObjectKnoop } from "@/domain/objecten";

export type ObjectOptie = { id: string; code: string; naam: string; niveau: number; diepte: number; objecttype: string; toepassing: string | null; extern: boolean };

export function plat(boom: ObjectKnoop[], diepte = 0): ObjectOptie[] {
  return boom.flatMap((k) => [
    { id: k.id, code: k.code, naam: k.naam, niveau: k.niveau, diepte, objecttype: k.objecttype, toepassing: k.toepassing, extern: k.extern },
    ...plat(k.kinderen, diepte + 1),
  ]);
}

export function typeOpties(lijst: ObjectOptie[]) {
  const m = new Map<string, { objecttype: string; toepassing: string | null }>();
  for (const o of lijst) m.set(`${o.objecttype}|${o.toepassing ?? ""}`, { objecttype: o.objecttype, toepassing: o.toepassing });
  return [...m.values()].sort((a, b) => `${a.toepassing}`.localeCompare(`${b.toepassing}`, "nl"));
}
