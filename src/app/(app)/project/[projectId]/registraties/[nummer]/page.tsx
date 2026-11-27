import { notFound } from "next/navigation";
import { registratieWeergave } from "@/components/RegistratieWeergave";

export default async function RegistratieDetail({ params }: { params: Promise<{ projectId: string; nummer: string }> }) {
  const { projectId, nummer } = await params;
  const inhoud = await registratieWeergave({ projectId, nummer: decodeURIComponent(nummer) });
  if (!inhoud) notFound();
  return inhoud;
}
