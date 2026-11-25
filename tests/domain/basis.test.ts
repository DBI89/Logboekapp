import { describe, it, expect, beforeEach } from "vitest";
import { maakTestDb } from "@/db/test-db";
import type { Db } from "@/db/client";
import { volgendNummer } from "@/domain/nummering";
import { logHistorie } from "@/domain/historie";
import { magGoedkeuren } from "@/domain/rechten";
import { maakBasisProject } from "../helpers";
import { historie, delegaties } from "@/db/schema";
import { eq } from "drizzle-orm";

let db: Db;
let p: Awaited<ReturnType<typeof maakBasisProject>>;

beforeEach(async () => {
  db = await maakTestDb();
  p = await maakBasisProject(db);
});

describe("volgendNummer", () => {
  it("geeft AF-0001 dan AF-0002, los per soort en project", async () => {
    expect(await volgendNummer(db, p.projectId, "afwijking")).toBe("AF-0001");
    expect(await volgendNummer(db, p.projectId, "afwijking")).toBe("AF-0002");
    expect(await volgendNummer(db, p.projectId, "issue")).toBe("IS-0001");
    expect(await volgendNummer(db, p.projectId, "melding")).toBe("M-0001");
    const p2 = await maakBasisProject(db, "P-2");
    expect(await volgendNummer(db, p2.projectId, "afwijking")).toBe("AF-0001");
  });
});

describe("logHistorie", () => {
  it("schrijft een regel met oud en nieuw", async () => {
    await logHistorie(db, {
      projectId: p.projectId,
      gebruikerId: p.ol,
      entiteit: "registratie",
      entiteitId: p.projectId,
      actie: "test",
      oud: { a: 1 },
      nieuw: { a: 2 },
    });
    const rijen = await db.select().from(historie).where(eq(historie.projectId, p.projectId));
    expect(rijen).toHaveLength(1);
    expect(rijen[0].actie).toBe("test");
    expect(rijen[0].oud).toEqual({ a: 1 });
    expect(rijen[0].nieuw).toEqual({ a: 2 });
  });
});

describe("magGoedkeuren", () => {
  const actor = (id: string) => ({ gebruikerId: id, projectId: p.projectId });

  it("ontwerpleider mag goedkeuren", async () => {
    expect(await magGoedkeuren(db, actor(p.ol), { aangemaaktDoor: p.teamlid })).toEqual({ ok: true });
  });
  it("opsteller mag niet zelf goedkeuren", async () => {
    expect(await magGoedkeuren(db, actor(p.ol), { aangemaaktDoor: p.ol })).toEqual({
      ok: false,
      reden: "Opsteller mag niet zelf goedkeuren",
    });
  });
  it("coördinator zonder delegatie mag niet", async () => {
    expect(await magGoedkeuren(db, actor(p.oc), { aangemaaktDoor: p.teamlid })).toEqual({
      ok: false,
      reden: "Geen delegatie",
    });
  });
  it("coördinator met delegatie mag", async () => {
    await db.insert(delegaties).values({ projectId: p.projectId, gebruikerId: p.oc, actief: true });
    expect(await magGoedkeuren(db, actor(p.oc), { aangemaaktDoor: p.teamlid })).toEqual({ ok: true });
  });
  it("teamlid mag niet", async () => {
    expect(await magGoedkeuren(db, actor(p.teamlid), { aangemaaktDoor: p.ol })).toEqual({
      ok: false,
      reden: "Geen bevoegdheid",
    });
  });
});
