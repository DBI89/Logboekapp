"use client";
import { useEffect, useRef } from "react";

/** Schuift het geopende registratiepaneel in beeld als er een andere registratie wordt gekozen. */
export function NaarPaneel({ nummer, children }: { nummer: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const boven = el.getBoundingClientRect().top;
    if (boven > window.innerHeight * 0.6 || boven < 0) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [nummer]);
  return (
    <section ref={ref} id="paneel" aria-label={`Registratie ${nummer}`} className="scroll-mt-4 rounded-xl border-2 border-mint/60 bg-vlak/60 p-4 sm:p-5">
      {children}
    </section>
  );
}
