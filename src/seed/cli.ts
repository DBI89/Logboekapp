import { rmSync } from "node:fs";
import path from "node:path";
import { openPglite } from "@/db/client";
import { seedDemo } from "./demo";

/** Zet de lokale demodatabase (.data/pglite) terug naar de beginstand. */
async function main() {
  const map = path.join(process.cwd(), ".data", "pglite");
  rmSync(map, { recursive: true, force: true });
  await seedDemo(await openPglite(map));
  console.log("Demo-project aangemaakt: P-2026-014");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
