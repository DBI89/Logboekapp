import { redirect } from "next/navigation";

export default async function Project({ params }: { params: Promise<{ projectId: string }> }) {
  redirect(`/project/${(await params).projectId}/mijn-werk`);
}
