import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { overzicht, type OverzichtRij } from "@/domain/overzicht";
import { objectBoom } from "@/domain/objecten";
import { magBeoordelen } from "@/domain/rechten";
import { STATUS_LABEL } from "@/domain/labels";
import { huidigeActor, projectLeden } from "@/lib/sessie";
import { plat } from "@/lib/objectenlijst";
import { SOORTEN } from "@/lib/soorten";
import { RegistratieTabel, type TabelKolom } from "@/components/RegistratieTabel";
import { NieuweRegistratie } from "@/components/NieuweRegistratie";
import { NaarPaneel } from "@/components/NaarPaneel";
import { registratieWeergave } from "@/components/RegistratieWeergave";
import type { RegistratieType } from "@/domain/types";

const d = (r: OverzichtRij, k: string) => (r.details[k] as string | undefined) ?? "";
const instemming = (r: OverzichtRij) => {
  const i = r.details.instemming as { nodig?: boolean; status?: string } | undefined;
  return !i?.nodig ? "Niet nodig" : ({ aangevraagd: "Aangevraagd", verleend: "Verleend", geweigerd: "Geweigerd" } as Record<string, string>)[i.status ?? ""] ?? "Nog aan te vragen";
};
const datum = (iso: string) => (iso ? new Date(iso).toLocaleDateString("nl-NL") : "");

type Extra = { kolom: TabelKolom; waarde: (r: OverzichtRij) => string; sorteer?: (r: OverzichtRij) => string };
const objectenKolom: Extra = { kolom: { sleutel: "objecten", kop: "Objecten", soort: "tekst", mono: true }, waarde: (r) => r.objecten };
const EXTRA: Record<RegistratieType, Extra[]> = {
  issue: [
    objectenKolom,
    { kolom: { sleutel: "prioriteit", kop: "Prioriteit", soort: "keuze" }, waarde: (r) => ({ hoog: "Hoog", normaal: "Normaal", laag: "Laag" })[d(r, "prioriteit")] ?? "", sorteer: (r) => ({ hoog: "1", normaal: "2", laag: "3" })[d(r, "prioriteit")] ?? "" },
    { kolom: { sleutel: "streefdatum", kop: "Streefdatum", soort: "tekst" }, waarde: (r) => datum(d(r, "streefdatum")), sorteer: (r) => d(r, "streefdatum") },
    {
      kolom: { sleutel: "voortgang", kop: "Laatste voortgang", soort: "tekst", breed: true },
      waarde: (r) => (r.laatsteVoortgang ? `${r.laatsteVoortgang.op.toLocaleDateString("nl-NL")}: ${r.laatsteVoortgang.tekst}` : ""),
      sorteer: (r) => r.laatsteVoortgang?.op.toISOString() ?? "",
    },
  ],
  afwijking: [objectenKolom, { kolom: { sleutel: "afwijkingVan", kop: "Afwijking van", soort: "tekst", breed: true }, waarde: (r) => d(r, "afwijkingVan") }, { kolom: { sleutel: "instemming", kop: "Instemming OG", soort: "keuze" }, waarde: instemming }],
  wijziging: [
    objectenKolom,
    { kolom: { sleutel: "aanleiding", kop: "Aanleiding", soort: "keuze" }, waarde: (r) => ({ opdrachtgever: "Opdrachtgever", intern: "Intern", extern: "Extern" })[d(r, "aanleiding")] ?? "" },
    { kolom: { sleutel: "instemming", kop: "Instemming OG", soort: "keuze" }, waarde: instemming },
  ],
  ontwerpkeuze: [objectenKolom, { kolom: { sleutel: "gekozen", kop: "Gekozen", soort: "tekst", breed: true }, waarde: (r) => d(r, "gekozen") }],
  raakvlak: [
    { kolom: { sleutel: "kanten", kop: "Kanten", soort: "tekst", mono: true }, waarde: (r) => r.kanten },
    { kolom: { sleutel: "soort", kop: "Soort", soort: "keuze" }, waarde: (r) => ({ fysiek: "Fysiek", functioneel: "Functioneel", ruimtelijk: "Ruimtelijk" })[d(r, "soort")] ?? "" },
    { kolom: { sleutel: "akkoord", kop: "Akkoord", soort: "keuze" }, waarde: (r) => `${r.afgestemd}/${r.aantalKanten} afgestemd` },
  ],
};
const NIEUW: Record<RegistratieType, string> = {
  issue: "Nieuw issue",
  afwijking: "Nieuwe afwijking",
  wijziging: "Nieuwe wijziging",
  ontwerpkeuze: "Nieuwe ontwerpkeuze",
  raakvlak: "Nieuwe raakvlakafspraak",
};

export default async function Overzicht({ params, searchParams }: { params: Promise<{ projectId: string; soort: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { projectId, soort } = await params;
  const sp = await searchParams;
  const s = SOORTEN.find((x) => x.slug === soort);
  if (!s) notFound();
  const db = await getDb();
  const actor = await huidigeActor(projectId);
  const beoordelaar = await magBeoordelen(db, actor);
  const rijen = await overzicht(db, projectId, s.type);
  const namen = new Map((await projectLeden(projectId)).map((l) => [l.id, l.naam]));
  const extra = EXTRA[s.type];
  const kolommen: TabelKolom[] = [
    { sleutel: "nummer", kop: "Nr.", soort: "tekst" },
    { sleutel: "titel", kop: "Titel", soort: "tekst", breed: true },
    ...extra.map((e) => e.kolom),
    { sleutel: "status", kop: "Status", soort: "keuze" },
    { sleutel: "eigenaar", kop: "Eigenaar", soort: "keuze" },
    { sleutel: "fase", kop: "Fase", soort: "keuze" },
  ];
  const tabelRijen = rijen.map((r) => ({
    id: r.id,
    statusCode: r.status,
    waarden: {
      nummer: r.nummer,
      titel: r.titel,
      status: STATUS_LABEL[r.status] ?? r.status,
      eigenaar: r.eigenaarId ? namen.get(r.eigenaarId) ?? "" : "",
      fase: r.faseCode,
      ...Object.fromEntries(extra.map((e) => [e.kolom.sleutel, e.waarde(r)])),
    },
    sorteer: Object.fromEntries(extra.filter((e) => e.sorteer).map((e) => [e.kolom.sleutel, e.sorteer!(r)])),
  }));
  const open = sp.open && rijen.some((r) => r.nummer === sp.open) ? sp.open : undefined;
  const paneel = open ? await registratieWeergave({ projectId, nummer: open, paneel: true }) : null;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{s.titel}</h1>
          <p className="mt-1 max-w-2xl text-sm text-grijs">{s.uitleg}</p>
        </div>
        {beoordelaar ? (
          <NieuweRegistratie projectId={projectId} type={s.type} label={NIEUW[s.type]} objecten={plat(await objectBoom(db, projectId))} />
        ) : (
          <Link href={`/project/${projectId}/inbox`} className="knop-licht">Nieuwe melding via de inbox</Link>
        )}
      </header>
      <RegistratieTabel kolommen={kolommen} rijen={tabelRijen} open={open} leeg={`Nog geen ${s.titel.toLowerCase()}.`} />
      {open && paneel && (
        <NaarPaneel nummer={open}>
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2 text-sm">
            <Link className="knop-licht" href={`/project/${projectId}/registraties/${open}`}>Volledig scherm</Link>
            <Link className="knop-licht" href="?" scroll={false}>Sluiten</Link>
          </div>
          <div key={open}>{paneel}</div>
        </NaarPaneel>
      )}
    </div>
  );
}
