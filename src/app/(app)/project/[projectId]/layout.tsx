import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { fasen, projecten } from "@/db/schema";
import { Zijbalk } from "@/components/Zijbalk";
import { huidigeActor, projectLeden } from "@/lib/sessie";
import { inbox } from "@/domain/meldingen";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const db = await getDb();
  const [project] = await db.select().from(projecten).where(eq(projecten.id, projectId));
  if (!project) notFound();
  const [fase] = await db.select().from(fasen).where(eq(fasen.id, project.actieveFaseId!));
  const actor = await huidigeActor(projectId);
  const nieuw = await inbox(db, projectId, { status: ["nieuw"] });
  return (
    <div className="md:flex">
      <Zijbalk
        projectId={projectId}
        projectNaam={project.naam}
        projectNummer={project.nummer}
        faseCode={fase?.code ?? "–"}
        inboxAantal={nieuw.length}
        leden={await projectLeden(projectId)}
        huidig={actor.gebruikerId}
      />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
