"use client";
import { useState, useTransition } from "react";
import type { ActieResultaat } from "@/lib/acties";

/** Voert een server-actie uit en houdt de foutmelding bij. */
export function useActie() {
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  function voerUit<T>(fn: () => Promise<ActieResultaat<T>>, gelukt?: (data: T) => void) {
    setFout(null);
    start(async () => {
      const r = await fn();
      if (r.ok) gelukt?.(r.data);
      else setFout(r.fout);
    });
  }
  return { bezig, fout, setFout, voerUit };
}

export function Foutmelding({ fout }: { fout: string | null }) {
  if (!fout) return null;
  return (
    <p role="alert" className="mt-2 rounded-md border border-rood/30 bg-rood/5 px-3 py-2 text-sm text-rood">
      {fout}
    </p>
  );
}
