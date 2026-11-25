import { ZodError } from "zod";
import { Fout } from "@/domain/types";

export type ActieResultaat<T> = { ok: true; data: T } | { ok: false; fout: string };

/** Voert een domeinactie uit en zet fouten om naar een Nederlandse melding voor de gebruiker. */
export async function actie<T>(fn: () => Promise<T>): Promise<ActieResultaat<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof Fout) return { ok: false, fout: e.message };
    if (e instanceof ZodError || (e as { name?: string })?.name === "ZodError")
      return { ok: false, fout: `Ongeldige invoer: ${(e as ZodError).issues.map((i) => i.path.join(".") || i.message).join(", ")}` };
    console.error(e);
    return { ok: false, fout: "Er ging iets mis. Probeer het opnieuw." };
  }
}
