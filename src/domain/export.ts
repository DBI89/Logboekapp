import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, ShadingType } from "docx";
import ExcelJS from "exceljs";
import { KOLOMMEN, TYPE_MEERVOUD, TYPE_VOLGORDE, type RapportInhoud } from "./rapport";

type DocInfo = { nummer: string; titel: string; revisie: string };

const cel = (t: string, kop = false) =>
  new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: t, bold: kop, size: 18, font: "Arial" })] })],
    shading: kop ? { type: ShadingType.CLEAR, color: "auto", fill: "D9E6F0" } : undefined,
  });

const tabel = (koppen: string[], rijen: string[][]) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ tableHeader: true, children: koppen.map((k) => cel(k, true)) }), ...rijen.map((r) => new TableRow({ children: r.map((c) => cel(c)) }))],
  });

export async function exporteerDocx(inhoud: RapportInhoud, doc: DocInfo): Promise<Uint8Array> {
  const delen: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`Registraties ${doc.nummer} ${doc.titel} rev. ${doc.revisie}`)] }),
  ];
  for (const t of TYPE_VOLGORDE) {
    const rijen = inhoud.perType[t];
    if (!rijen.length) continue;
    delen.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(TYPE_MEERVOUD[t])] }));
    delen.push(tabel(KOLOMMEN[t].map((k) => k.kop), rijen.map((r) => KOLOMMEN[t].map((k) => k.waarde(r)))));
  }
  if (inhoud.vervangen.length) {
    delen.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Vervangen registraties uit vorige fasen")] }));
    delen.push(
      tabel(
        ["Vervangen", "Fase", "Titel", "Vervangen door", "Nieuwe titel"],
        inhoud.vervangen.map((v) => [v.oud.nummer, v.oud.faseCode, v.oud.titel, v.nieuw.nummer, v.nieuw.titel]),
      ),
    );
  }
  return new Uint8Array(await Packer.toArrayBuffer(new Document({ sections: [{ children: delen }] })));
}

export async function exporteerXlsx(inhoud: RapportInhoud, doc: DocInfo): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.title = `${doc.nummer} rev. ${doc.revisie}`;
  for (const t of TYPE_VOLGORDE) {
    const rijen = inhoud.perType[t];
    if (!rijen.length) continue;
    const ws = wb.addWorksheet(TYPE_MEERVOUD[t]);
    ws.addRow(KOLOMMEN[t].map((k) => k.kop)).font = { bold: true };
    for (const r of rijen) ws.addRow(KOLOMMEN[t].map((k) => k.waarde(r)));
    ws.columns.forEach((c) => (c.width = 24));
  }
  if (inhoud.vervangen.length) {
    const ws = wb.addWorksheet("Vervangen");
    ws.addRow(["Vervangen", "Fase", "Titel", "Vervangen door", "Nieuwe titel"]).font = { bold: true };
    for (const v of inhoud.vervangen) ws.addRow([v.oud.nummer, v.oud.faseCode, v.oud.titel, v.nieuw.nummer, v.nieuw.titel]);
  }
  if (!wb.worksheets.length) wb.addWorksheet("Leeg").addRow(["Geen registraties voor dit document"]);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
