import "./stijl.css";
import { createRoot } from "react-dom/client";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { router } from "./router";
import { Omleiding, NietGevonden } from "./shims/next-navigation";
import { getDb, wisDemo, bewaardInBrowser } from "./shims/db-client";

import Start from "@/app/page";
import ProjectLayout from "@/app/(app)/project/[projectId]/layout";
import Project from "@/app/(app)/project/[projectId]/page";
import MijnWerk from "@/app/(app)/project/[projectId]/mijn-werk/page";
import Inbox from "@/app/(app)/project/[projectId]/inbox/page";
import Registraties from "@/app/(app)/project/[projectId]/registraties/page";
import RegistratieDetail from "@/app/(app)/project/[projectId]/registraties/[nummer]/page";
import Objecten from "@/app/(app)/project/[projectId]/objecten/page";
import ObjectDetail from "@/app/(app)/project/[projectId]/objecten/[code]/page";
import Documenten from "@/app/(app)/project/[projectId]/documenten/page";
import DocumentDetail from "@/app/(app)/project/[projectId]/documenten/[nummer]/page";
import Fasen from "@/app/(app)/project/[projectId]/fasen/page";
import Import from "@/app/(app)/project/[projectId]/import/page";
import Overzicht from "@/app/(app)/project/[projectId]/overzicht/[soort]/page";
import { GET as exportRoute } from "@/app/(app)/project/[projectId]/documenten/[nummer]/export/route";

type Pagina = (p: { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string>> }) => Promise<ReactNode> | ReactNode;

const ROUTES: [RegExp, string[], Pagina][] = [
  [/^\/project\/([^/]+)\/mijn-werk$/, ["projectId"], MijnWerk as unknown as Pagina],
  [/^\/project\/([^/]+)\/inbox$/, ["projectId"], Inbox as unknown as Pagina],
  [/^\/project\/([^/]+)\/registraties$/, ["projectId"], Registraties as unknown as Pagina],
  [/^\/project\/([^/]+)\/registraties\/([^/]+)$/, ["projectId", "nummer"], RegistratieDetail as unknown as Pagina],
  [/^\/project\/([^/]+)\/objecten$/, ["projectId"], Objecten as unknown as Pagina],
  [/^\/project\/([^/]+)\/objecten\/([^/]+)$/, ["projectId", "code"], ObjectDetail as unknown as Pagina],
  [/^\/project\/([^/]+)\/documenten$/, ["projectId"], Documenten as unknown as Pagina],
  [/^\/project\/([^/]+)\/documenten\/([^/]+)$/, ["projectId", "nummer"], DocumentDetail as unknown as Pagina],
  [/^\/project\/([^/]+)\/fasen$/, ["projectId"], Fasen as unknown as Pagina],
  [/^\/project\/([^/]+)\/import$/, ["projectId"], Import as unknown as Pagina],
  [/^\/project\/([^/]+)\/overzicht\/([^/]+)$/, ["projectId", "soort"], Overzicht as unknown as Pagina],
  [/^\/project\/([^/]+)$/, ["projectId"], Project as unknown as Pagina],
];

async function bouw(pad: string): Promise<ReactNode> {
  const [pathname, query = ""] = pad.split("?");
  if (pathname === "/" || pathname === "") return Start();
  const searchParams = Object.fromEntries(new URLSearchParams(query));
  for (const [re, namen, Pagina] of ROUTES) {
    const m = pathname.match(re);
    if (!m) continue;
    const params = Object.fromEntries(namen.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
    const inhoud = await Pagina({ params: Promise.resolve(params), searchParams: Promise.resolve(searchParams) });
    return ProjectLayout({ children: inhoud, params: Promise.resolve({ projectId: params.projectId }) });
  }
  throw new NietGevonden();
}

type Downloads = { save: (r: { filename: string; data: Blob }) => Promise<unknown> };
const claudeUse = () => (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude?.use;

async function exporteer(pad: string, melding: (t: string) => void) {
  const m = pad.match(/^\/project\/([^/]+)\/documenten\/([^/]+)\/export\?(.*)$/);
  if (!m) return;
  const res = await exportRoute(new Request(`https://demo.local${pad}`), { params: Promise.resolve({ projectId: m[1], nummer: m[2] }) });
  if (!res.ok) return melding("Export mislukt.");
  const naam = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "export.docx";
  const blob = await res.blob();
  const capabiliteit = claudeUse();
  const downloads = capabiliteit ? ((await capabiliteit("downloads").catch(() => null)) as Downloads | null) : null;
  if (downloads) {
    try {
      await downloads.save({ filename: naam, data: blob });
      melding(`${naam} is opgeslagen.`);
    } catch (e) {
      const code = (e as { code?: string }).code;
      melding(code === "declined" ? "Downloaden geannuleerd." : "Downloaden is hier niet beschikbaar.");
    }
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = naam;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function DemoBalk({ melding }: { melding: string | null }) {
  const [vraag, setVraag] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-mint/25 px-4 py-2 text-xs text-navy">
      <span>
        <strong>Demo</strong> met fictieve gegevens. Wissel van gebruiker linksonder.{" "}
        {bewaardInBrowser ? "Wijzigingen blijven alleen in deze browser bewaard." : "Wijzigingen verdwijnen bij herladen."}
      </span>
      <span className="flex items-center gap-2">
        {melding && <span role="status" className="font-medium">{melding}</span>}
        {!vraag ? (
          <button className="rounded border border-navy/30 bg-white px-2 py-1 hover:border-navy" onClick={() => setVraag(true)}>
            Beginstand herstellen
          </button>
        ) : (
          <>
            <span>Alle wijzigingen wissen?</span>
            <button
              className="rounded bg-navy px-2 py-1 text-white"
              onClick={async () => {
                await wisDemo();
                location.reload();
              }}
            >
              Ja, herstellen
            </button>
            <button className="rounded border border-navy/30 bg-white px-2 py-1" onClick={() => setVraag(false)}>
              Annuleren
            </button>
          </>
        )}
      </span>
    </div>
  );
}

function Laden() {
  return (
    <div className="mx-auto max-w-md p-8 text-sm text-grijs">
      <p className="text-base font-semibold text-navy">Ontwerp logboek wordt klaargezet…</p>
      <p className="mt-2">De eerste keer bouwt de demo een database met voorbeelddata op in je browser. Dat duurt ongeveer tien seconden; daarna gaat het direct.</p>
    </div>
  );
}

function App() {
  const pad = useSyncExternalStore(router.abonneer, router.pad);
  const versie = useSyncExternalStore(router.abonneer, router.versie);
  const [inhoud, setInhoud] = useState<ReactNode>(null);
  const [laden, setLaden] = useState(true);
  const [melding, setMelding] = useState<string | null>(null);

  useEffect(() => {
    if (pad.includes("/export?")) {
      const terug = pad.replace(/\/export\?.*$/, "");
      exporteer(pad, (t) => {
        setMelding(t);
        setTimeout(() => setMelding(null), 5000);
      }).finally(() => router.ga(terug));
      return;
    }
    let actueel = true;
    setLaden(true);
    bouw(pad)
      .then((el) => actueel && setInhoud(el))
      .catch((e) => {
        if (!actueel) return;
        if (e instanceof Omleiding) return router.ga(e.naar);
        if (e instanceof NietGevonden) return setInhoud(<p className="p-8">Deze pagina bestaat niet. <button className="text-blauw underline" onClick={() => router.ga("/")}>Naar het begin</button></p>);
        console.error(e);
        setInhoud(<p className="p-8 text-rood">Er ging iets mis bij het laden van deze pagina.</p>);
      })
      .finally(() => actueel && setLaden(false));
    return () => {
      actueel = false;
    };
  }, [pad, versie]);

  const pathname = pad.split("?")[0];
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <DemoBalk melding={melding} />
      {inhoud ?? <Laden />}
      {laden && inhoud && <div aria-hidden className="fixed inset-x-0 top-0 z-50 h-0.5 animate-pulse bg-mint" />}
    </>
  );
}

// Gewone <a href="/..."> (bijv. downloadknoppen) en GET-formulieren (filters) binnen de pagina afhandelen.
document.addEventListener("click", (e) => {
  const a = (e.target as HTMLElement).closest("a");
  const href = a?.getAttribute("href");
  if (!a || !href || e.defaultPrevented || a.target === "_blank" || /^[a-z]+:/i.test(href)) return;
  e.preventDefault();
  router.ga(href);
});
document.addEventListener("submit", (e) => {
  const form = e.target as HTMLFormElement;
  if (e.defaultPrevented || (form.getAttribute("method") ?? "get").toLowerCase() !== "get") return;
  e.preventDefault();
  const q = new URLSearchParams();
  new FormData(form).forEach((v, k) => typeof v === "string" && v !== "" && q.append(k, v));
  router.ga(`${router.pad().split("?")[0]}?${q}`);
});

getDb().catch((e) => console.error(e));
createRoot(document.getElementById("app")!).render(<App />);
