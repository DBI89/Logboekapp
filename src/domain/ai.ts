import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { meldingen, meldingObjecten, registraties } from "@/db/schema";
import { laadObjecten } from "./objecten";
import { Fout, type RegistratieType } from "./types";

export type Voorstel = {
  type: RegistratieType;
  objectIds: string[];
  mogelijkDubbel: string[];
  toelichting: string;
  bron: "ai" | "heuristiek";
};

/** Minimale vorm van de Anthropic-client die we gebruiken (te vervangen in tests). */
export type AiClient = {
  messages: { parse: (verzoek: never) => Promise<{ stop_reason: string | null; parsed_output: unknown }> };
};

const TYPEN = ["issue", "afwijking", "wijziging", "ontwerpkeuze", "raakvlak"] as const;
export const VoorstelSchema = z.object({
  type: z.enum(TYPEN),
  objectCodes: z.array(z.string()),
  mogelijkDubbel: z.array(z.string()),
  toelichting: z.string(),
});

const REGELS: [RegExp, RegistratieType][] = [
  [/raakvlak|aansluit|interface|kabel|leiding|kruis/i, "raakvlak"],
  [/afwijk|norm\b|normen|\beis\b|eisen|richtlijn/i, "afwijking"],
  [/wijzig|scope|opdrachtgever wil|extra\b|meerwerk/i, "wijziging"],
  [/keuze|kiezen|variant|alternatie/i, "ontwerpkeuze"],
];

export function heuristischType(tekst: string): RegistratieType {
  return REGELS.find(([re]) => re.test(tekst))?.[1] ?? "issue";
}

const STOP = new Set(["de", "het", "een", "van", "en", "in", "op", "bij", "voor", "met", "te", "is", "niet", "door", "aan", "naar", "of", "om", "dat", "die"]);
const woorden = (s: string) =>
  s
    .toLowerCase()
    .split(/[\s–—,.;:()/!?]+/)
    .filter((w) => w.length > 1 && !STOP.has(w));

async function context(db: Db, projectId: string, meldingId: string) {
  const [m] = await db.select().from(meldingen).where(eq(meldingen.id, meldingId));
  if (!m || m.projectId !== projectId) throw new Fout("Melding bestaat niet");
  const objecten = await laadObjecten(db, projectId);
  const regs = await db
    .select({ nummer: registraties.nummer, titel: registraties.titel, status: registraties.status })
    .from(registraties)
    .where(eq(registraties.projectId, projectId));
  const gekoppeld = (await db.select().from(meldingObjecten).where(eq(meldingObjecten.meldingId, meldingId))).map((x) => x.objectId);
  return { m, objecten, regs: regs.filter((r) => r.status !== "vervallen" && r.status !== "vervangen"), gekoppeld };
}

function heuristiek(c: Awaited<ReturnType<typeof context>>): Voorstel {
  const tekst = `${c.m.titel} ${c.m.omschrijving}`;
  const w = new Set(woorden(tekst));
  let objectIds = c.gekoppeld;
  if (!objectIds.length) {
    const exact = c.objecten.filter((o) => w.has(o.code.toLowerCase()));
    if (exact.length) objectIds = exact.map((o) => o.id);
    else {
      const scores = c.objecten.map((o) => ({ o, s: new Set(woorden(`${o.naam} ${o.locatie ?? ""}`).filter((x) => w.has(x))).size }));
      const max = Math.max(0, ...scores.map((x) => x.s));
      objectIds = max >= 2 ? scores.filter((x) => x.s === max).map((x) => x.o.id) : [];
    }
  }
  const titelWoorden = new Set(woorden(c.m.titel));
  const mogelijkDubbel = c.regs
    .filter((r) => new Set(woorden(r.titel).filter((x) => titelWoorden.has(x))).size >= 2)
    .map((r) => r.nummer);
  const type = heuristischType(tekst);
  return { type, objectIds, mogelijkDubbel, toelichting: "Automatisch voorstel op basis van trefwoorden.", bron: "heuristiek" };
}

const SYSTEEM = `Je helpt een ontwerpteam in de civiele techniek meldingen in te delen in het ontwerplogboek.
Kies precies één type:
- issue: een open vraag of probleem dat nog opgelost moet worden
- afwijking: het ontwerp wijkt af van een eis, norm of richtlijn
- wijziging: scope, eisen of ontwerp veranderen (bijvoorbeeld op verzoek van de opdrachtgever)
- ontwerpkeuze: er moet gekozen worden tussen alternatieven, of er is gekozen
- raakvlakafspraak: een afspraak tussen twee objecten, disciplines of partijen over hoe ze op elkaar aansluiten
Kies alleen objectcodes uit de gegeven lijst die echt over de melding gaan (bij een raakvlak beide kanten, op hetzelfde niveau).
Noem bij mogelijkDubbel alleen nummers uit de lijst bestaande registraties die over hetzelfde gaan.
Geef een toelichting van één zin in het Nederlands.`;

async function standaardClient(): Promise<AiClient | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  return new Anthropic() as unknown as AiClient;
}

export async function stelVoor(db: Db, projectId: string, meldingId: string, opts: { client?: AiClient } = {}): Promise<Voorstel> {
  const c = await context(db, projectId, meldingId);
  const client = opts.client ?? (await standaardClient());
  if (!client) return heuristiek(c);
  try {
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
    const inhoud = [
      `Melding ${c.m.nummer}: ${c.m.titel}`,
      c.m.omschrijving,
      "",
      "Objecten (code | naam | niveau):",
      ...c.objecten.map((o) => `${o.code} | ${o.naam} | ${o.niveau}`),
      "",
      "Bestaande registraties (nummer | titel):",
      ...c.regs.map((r) => `${r.nummer} | ${r.titel}`),
    ].join("\n");
    const res = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 1024,
      output_config: { effort: "low", format: zodOutputFormat(VoorstelSchema) },
      system: SYSTEEM,
      messages: [{ role: "user", content: inhoud }],
    } as never);
    if (res.stop_reason === "refusal" || !res.parsed_output) return heuristiek(c);
    const v = VoorstelSchema.parse(res.parsed_output);
    const perCode = new Map(c.objecten.map((o) => [o.code, o.id]));
    const bekend = new Set(c.regs.map((r) => r.nummer));
    return {
      type: v.type,
      objectIds: v.objectCodes.filter((code) => perCode.has(code)).map((code) => perCode.get(code)!),
      mogelijkDubbel: v.mogelijkDubbel.filter((n) => bekend.has(n)),
      toelichting: v.toelichting,
      bron: "ai",
    };
  } catch {
    return heuristiek(c);
  }
}
