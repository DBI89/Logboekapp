import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { documenten } from "@/db/schema";
import { rapportInhoud } from "@/domain/rapport";
import { exporteerDocx, exporteerXlsx } from "@/domain/export";

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string; nummer: string }> }) {
  const { projectId, nummer } = await params;
  const formaat = new URL(req.url).searchParams.get("formaat") === "xlsx" ? "xlsx" : "docx";
  const db = await getDb();
  const [doc] = await db.select().from(documenten).where(and(eq(documenten.projectId, projectId), eq(documenten.nummer, decodeURIComponent(nummer))));
  if (!doc) return new Response("Document niet gevonden", { status: 404 });
  const inhoud = await rapportInhoud(db, doc.id);
  const info = { nummer: doc.nummer, titel: doc.titel, revisie: doc.revisie };
  const buf = formaat === "docx" ? await exporteerDocx(inhoud, info) : await exporteerXlsx(inhoud, info);
  const type = formaat === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${doc.nummer}-rev${doc.revisie}-registraties.${formaat}"` },
  });
}
