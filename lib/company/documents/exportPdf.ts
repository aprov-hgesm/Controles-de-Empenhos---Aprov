import { jsPDF } from 'jspdf';
import { CompanyDocumentError } from './model';

export type ExportKind = 'purchase-order' | 'packing-list';
export interface PdfLine { id: string; description: string; quantity: string; unit: string; unitPriceCents?: number }
export interface PdfSource {
  id: string; companyId: string; workspaceId: string; documentNumber: string;
  customerName: string; supplierName?: string; deliveryAddress?: string; issuedAt: string;
  lines: PdfLine[]; notes?: string;
}
export function validatePdfSource(input: unknown, companyId: string): PdfSource {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new CompanyDocumentError('PDF_SOURCE_INVALID', 422);
  const v = input as Record<string, unknown>;
  if (v.companyId !== companyId || v.workspaceId !== companyId) throw new CompanyDocumentError('DOCUMENT_NOT_FOUND', 404);
  const str = (value: unknown, max = 240): value is string =>
    typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  if (!str(v.id) || !str(v.documentNumber) || !str(v.customerName)
    || !str(v.issuedAt, 40) || !Array.isArray(v.lines)
    || v.lines.length === 0 || v.lines.length > 200) throw new CompanyDocumentError('PDF_SOURCE_INVALID', 422);
  const seen = new Set<string>();
  const lines: PdfLine[] = v.lines.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new CompanyDocumentError('PDF_LINE_INVALID', 422);
    const r = item as Record<string, unknown>;
    if (!str(r.id) || seen.has(r.id) || !str(r.description, 400)
      || !str(r.quantity, 40) || !str(r.unit, 20)
      || (r.unitPriceCents !== undefined && (!Number.isSafeInteger(r.unitPriceCents) || Number(r.unitPriceCents) < 0))) {
      throw new CompanyDocumentError('PDF_LINE_INVALID', 422);
    }
    seen.add(r.id);
    return {
      id: r.id, description: r.description.trim(), quantity: r.quantity,
      unit: r.unit, ...(r.unitPriceCents === undefined ? {} : { unitPriceCents: r.unitPriceCents as number }),
    };
  });
  return {
    id: v.id, companyId, workspaceId: companyId,
    documentNumber: v.documentNumber, customerName: v.customerName,
    ...(str(v.supplierName) ? { supplierName: v.supplierName } : {}),
    ...(str(v.deliveryAddress, 500) ? { deliveryAddress: v.deliveryAddress } : {}),
    issuedAt: v.issuedAt, lines,
    ...(str(v.notes, 2000) ? { notes: v.notes } : {}),
  };
}
export function generateCompanyPdf(kind: ExportKind, source: PdfSource): Uint8Array {
  if (!(['purchase-order','packing-list'] as string[]).includes(kind)) throw new CompanyDocumentError('PDF_KIND_INVALID', 400);
  const safe = validatePdfSource(source, source.companyId);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: kind === 'purchase-order' ? 'Ordem de Compra' : 'Romaneio', author: 'EMPROVEX Empresas' });
  let y = 20;
  const print = (value: string, size = 10) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(value.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 3000), 175) as string[];
    for (const row of wrapped) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(row, 17, y); y += size <= 9 ? 5 : 7;
    }
  };
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text('EMPROVEX | EMPRESAS', 17, y); y += 13;
  print(kind === 'purchase-order' ? 'ORDEM DE COMPRA' : 'ROMANEIO DE ENTREGA', 13);
  print('Documento: ' + safe.documentNumber);
  print('Data: ' + safe.issuedAt);
  print('Cliente: ' + safe.customerName);
  if (safe.supplierName) print('Fornecedor: ' + safe.supplierName);
  if (safe.deliveryAddress) print('Endereço de entrega: ' + safe.deliveryAddress);
  y += 5; print('ITENS', 12);
  safe.lines.forEach((line, i) => {
    print(`${i + 1}. ${line.description}`);
    print(`Quantidade: ${line.quantity} ${line.unit}${line.unitPriceCents === undefined ? '' : ' | Valor unit.: R$ ' + (line.unitPriceCents / 100).toFixed(2)}`, 9);
    y += 2;
  });
  if (safe.notes) { y += 3; print('Observações: ' + safe.notes); }
  y += 8;
  print('Confirme o conteúdo antes de enviar. Este arquivo não comprova entrega ou aceite.', 8);
  return new Uint8Array(doc.output('arraybuffer'));
}
