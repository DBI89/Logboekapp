"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { GebruikerWissel } from "./GebruikerWissel";

type Props = {
  projectId: string;
  projectNaam: string;
  projectNummer: string;
  faseCode: string;
  inboxAantal: number;
  leden: { id: string; naam: string; rol: "teamlid" | "ontwerpcoordinator" | "ontwerpleider" }[];
  huidig: string;
};

export function Zijbalk(p: Props) {
  const pad = usePathname();
  const [open, setOpen] = useState(false);
  const basis = `/project/${p.projectId}`;
  const items = [
    { href: `${basis}/mijn-werk`, tekst: "Mijn werk" },
    { href: `${basis}/inbox`, tekst: "Inbox", teller: p.inboxAantal },
    { href: `${basis}/registraties`, tekst: "Registraties" },
    { href: `${basis}/objecten`, tekst: "Objecten" },
    { href: `${basis}/documenten`, tekst: "Documenten" },
    { href: `${basis}/fasen`, tekst: "Fasen" },
    { href: `${basis}/import`, tekst: "Import" },
  ];
  return (
    <aside className="bg-gradient-to-b from-navy to-[#005a8f] text-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-4 md:block md:px-5 md:py-6">
        <div>
          <div className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-3 w-3 rounded-sm bg-mint" />
            <span className="text-lg font-semibold tracking-tight">Ontwerp logboek</span>
          </div>
          <p className="mt-1 text-xs text-white/75">
            {p.projectNummer} · {p.projectNaam}
          </p>
          <p className="mt-0.5 text-xs text-white/75">Actieve fase: {p.faseCode}</p>
        </div>
        <button
          className="rounded-md border border-white/30 px-3 py-2 text-sm md:hidden"
          aria-expanded={open}
          aria-controls="hoofdmenu"
          onClick={() => setOpen(!open)}
        >
          Menu
        </button>
      </div>
      <nav id="hoofdmenu" className={`${open ? "block" : "hidden"} px-2 pb-3 md:block md:flex-1`}>
        <ul className="space-y-0.5">
          {items.map((i) => {
            const actief = pad.startsWith(i.href);
            return (
              <li key={i.href}>
                <Link
                  href={i.href}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-11 items-center justify-between rounded-md px-3 text-sm ${actief ? "bg-white/15 font-semibold" : "text-white/85 hover:bg-white/10"}`}
                  aria-current={actief ? "page" : undefined}
                >
                  {i.tekst}
                  {i.teller ? <span className="rounded-full bg-mint px-2 text-xs font-semibold text-navy">{i.teller}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className={`${open ? "block" : "hidden"} border-t border-white/15 px-4 py-4 md:block`}>
        <GebruikerWissel leden={p.leden} huidig={p.huidig} />
      </div>
    </aside>
  );
}
