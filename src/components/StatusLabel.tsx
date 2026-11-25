import { STATUS_LABEL } from "@/domain/labels";

const KLEUR: Record<string, string> = {
  concept: "bg-slate-100 text-slate-700",
  nieuw: "bg-blauw/10 text-blauw",
  open: "bg-blauw/10 text-blauw",
  in_behandeling: "bg-amber-100 text-oranje",
  ter_goedkeuring: "bg-amber-100 text-oranje",
  goedgekeurd: "bg-mint/25 text-emerald-900",
  afgestemd: "bg-mint/25 text-emerald-900",
  opgelost: "bg-mint/25 text-emerald-900",
  omgezet: "bg-mint/25 text-emerald-900",
  samengevoegd: "bg-mint/25 text-emerald-900",
  verwerkt: "bg-navy text-white",
  vastgesteld: "bg-navy text-white",
  afgewezen: "bg-rood/10 text-rood",
  vervallen: "bg-rood/10 text-rood",
  vervangen: "bg-slate-100 text-slate-500 line-through",
};

export function StatusLabel({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${KLEUR[status] ?? "bg-slate-100"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
