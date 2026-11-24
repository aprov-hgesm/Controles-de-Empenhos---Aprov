import { jsPDF } from 'jspdf';
import type { CreditMember } from '../../server/creditControlAuth';

export type CreditReportLine = { label: string; value: string };
export const money = (cents: number) => {
  if (!Number.isSafeInteger(cents)) throw new Error('Valor financeiro inválido.');
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
export const displayDate = (date: string | null | undefined) =>
  date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('/') : 'Não informado';
const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/[^\u0020-\u007e\u00a0-\u00ff]/g, '?').slice(0, 1000);

export function creditPdf(member: CreditMember, title: string, lines: CreditReportLine[], year?: number): Uint8Array {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const issued = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  let y = 0;
  const header = () => {
    pdf.setTextColor(35); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14);
    pdf.text('EMPROVEX | Controle de Crédito', 15, 17);
    pdf.setFontSize(11); pdf.text(clean(title), 15, 24);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
    pdf.text(clean('UG ' + member.ug + (year ? ' | Exercício ' + year : '') + (member.role === 'centro' ? ' | Centro ' + member.centerId : ' | Gestão')), 15, 31);
    pdf.text('Emissão: ' + issued, 15, 36);
    pdf.setDrawColor(140); pdf.line(15, 40, 195, 40); y = 47;
  };
  header();
  for (const row of lines) {
    pdf.setFontSize(10);
    const wrapped = pdf.splitTextToSize(clean(row.label + ': ' + row.value), 180) as string[];
    for (const line of wrapped) {
      if (y > 270) { pdf.addPage(); header(); pdf.setFontSize(10); }
      pdf.text(line, 15, y); y += 5;
    }
    y += 2;
  }
  const count = pdf.getNumberOfPages();
  for (let i = 1; i <= count; i++) {
    pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(70);
    pdf.line(15, 278, 195, 278);
    pdf.text('Saldo registrado no sistema; não equivale ao saldo oficial do SIAFI.', 15, 283);
    pdf.text(i + '/' + count, 195, 283, { align: 'right' });
  }
  return new Uint8Array(pdf.output('arraybuffer'));
}

export function creditPdfResponse(bytes: Uint8Array, filename: string): Response {
  return new Response(new Uint8Array(bytes), { headers: {
    'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="' + filename + '"',
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  } });
}
