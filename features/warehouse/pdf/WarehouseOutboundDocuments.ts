'use client';

import type { jsPDF as JsPDF } from 'jspdf';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_X = 12;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN_X * 2);
const FOOTER_Y = PAGE_HEIGHT - 9;
const BOTTOM_LIMIT = PAGE_HEIGHT - 18;

export interface WarehouseOutboundDocumentLine {
  lineId: string;
  materialDescription: string;
  quantity: number;
  unitLabel: string;
  presentationLabel: string;
  positionLabel: string;
  expiresOn: string | null;
  barcode: string | null;
  invoiceId: string | null;
  empenhoId: string | null;
  supplier: string | null;
}

export interface WarehouseOutboundDocumentsInput {
  workspaceId: string;
  ug: string;
  operatorName: string | null;
  withdrawalId: string;
  destinationName: string;
  withdrawnBy: string;
  finalizedAt: string;
  lines: WarehouseOutboundDocumentLine[];
}

export interface WarehouseOutboundControlIdentity {
  controlNumber: string;
  controlCode: string;
  dateKey: string;
}

interface CreatedOutboundDocuments {
  doc: JsPDF;
  filename: string;
  identity: WarehouseOutboundControlIdentity;
}

function line(doc: JsPDF, x1: number, y1: number, x2: number, y2: number): void {
  doc.line(x1, y1, x2, y2);
}

function formatQuantity(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}

function parseDate(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDateTime(value: string): string {
  return parseDate(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function compactDateParts(value: string): {
  ymd: string;
  dmy: string;
} {
  const date = parseDate(value);
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return {
    ymd: year + month + day,
    dmy: day + month + year.slice(-2),
  };
}

function withdrawalNumericSeed(withdrawalId: string): number {
  const hex = withdrawalId.replace(/^wd_/, '').replace(/[^a-f0-9]/gi, '').slice(0, 10);
  const parsed = Number.parseInt(hex || '0', 16);
  if (!Number.isFinite(parsed)) return 0;
  return parsed % 1_000_000;
}

export function getWarehouseOutboundControlIdentity(
  withdrawalId: string,
  finalizedAt: string
): WarehouseOutboundControlIdentity {
  const date = compactDateParts(finalizedAt);
  const numeric = withdrawalNumericSeed(withdrawalId);
  const sixDigits = String(numeric).padStart(6, '0');
  const alpha = numeric.toString(36).toUpperCase().padStart(4, '0');

  return {
    controlNumber: date.ymd + '-' + sixDigits,
    controlCode: 'EMX-SM-' + date.dmy + '-' + alpha,
    dateKey: date.ymd,
  };
}

function fitTextLines(
  doc: JsPDF,
  value: string,
  maxWidth: number,
  maxLines: number,
  startSize: number,
  minSize: number
): { lines: string[]; fontSize: number } {
  let fontSize = startSize;
  let lines: string[] = [];

  while (fontSize >= minSize) {
    doc.setFontSize(fontSize);
    lines = doc.splitTextToSize(value || '—', maxWidth);
    if (lines.length <= maxLines) return { lines, fontSize };
    fontSize -= 0.35;
  }

  doc.setFontSize(minSize);
  lines = doc.splitTextToSize(value || '—', maxWidth);
  if (lines.length > maxLines) {
    const visible = lines.slice(0, maxLines);
    let last = visible[maxLines - 1] || '';
    while (last.length > 1 && doc.getTextWidth(last + '…') > maxWidth) {
      last = last.slice(0, -1);
    }
    visible[maxLines - 1] = last.trimEnd() + '…';
    lines = visible;
  }

  return { lines, fontSize: minSize };
}

function drawDocumentHeader(
  doc: JsPDF,
  input: WarehouseOutboundDocumentsInput,
  identity: WarehouseOutboundControlIdentity,
  title: string,
  documentLabel: string,
  continuation = false
): number {
  let y = 12;

  doc.setTextColor(10);
  doc.setDrawColor(30);
  doc.setLineWidth(0.4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('EMPROVEX', MARGIN_X, y);

  doc.setFontSize(7.2);
  doc.text('ADM DEPÓSITO · ÁREA LOGÍSTICA', PAGE_WIDTH - MARGIN_X, y, {
    align: 'right',
  });

  y += 7;
  doc.setFontSize(11.5);
  doc.text(title, PAGE_WIDTH / 2, y, { align: 'center' });

  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text(
    documentLabel + (continuation ? ' · continuação' : ''),
    PAGE_WIDTH / 2,
    y,
    { align: 'center' }
  );

  y += 4.5;
  line(doc, MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);

  y += 5;
  const fields = [
    ['CONTROLE', identity.controlNumber, MARGIN_X, 50],
    ['CÓDIGO', identity.controlCode, 65, 57],
    ['DATA/HORA', formatDateTime(input.finalizedAt), 128, 42],
    ['UG', input.ug, 174, 24],
  ] as const;

  for (const [label, value, x, width] of fields) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    const fitted = fitTextLines(doc, value, width, 1, 7.3, 5.7);
    doc.setFontSize(fitted.fontSize);
    doc.text(fitted.lines[0], x, y + 3.8);
  }

  y += 9;
  doc.setFillColor('#F2F2F2');
  doc.rect(MARGIN_X, y, CONTENT_WIDTH, 14, 'F');
  doc.rect(MARGIN_X, y, CONTENT_WIDTH, 14, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.text('DESTINO', MARGIN_X + 3, y + 4);
  doc.text('RETIRADO / RECEBIDO POR', 82, y + 4);
  doc.text('OPERADOR EMPROVEX', 150, y + 4);

  doc.setFont('helvetica', 'normal');
  const destination = fitTextLines(doc, input.destinationName, 62, 2, 7.1, 5.8);
  doc.setFontSize(destination.fontSize);
  doc.text(destination.lines, MARGIN_X + 3, y + 8.3);

  const withdrawn = fitTextLines(doc, input.withdrawnBy, 61, 2, 7.1, 5.8);
  doc.setFontSize(withdrawn.fontSize);
  doc.text(withdrawn.lines, 82, y + 8.3);

  const operator = fitTextLines(
    doc,
    input.operatorName || 'Usuário autenticado',
    47,
    2,
    7.1,
    5.6
  );
  doc.setFontSize(operator.fontSize);
  doc.text(operator.lines, 150, y + 8.3);

  return y + 20;
}

function drawPickingInstructions(doc: JsPDF, y: number): number {
  doc.setFillColor('#FAFAFA');
  doc.setDrawColor(70);
  doc.rect(MARGIN_X, y, CONTENT_WIDTH, 13, 'FD');

  doc.setTextColor(15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.text('ORIENTAÇÃO PARA RETIRADA FÍSICA', MARGIN_X + 3, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.4);
  doc.text(
    'Localize cada material exatamente na posição indicada, confira quantidade/validade e entregue ao destino informado.',
    MARGIN_X + 3,
    y + 8
  );
  doc.text(
    'A baixa no EMPROVEX já foi registrada; esta ficha orienta a separação física e a conferência da retirada.',
    MARGIN_X + 3,
    y + 11
  );

  return y + 17;
}

function drawSiscofisInstructions(doc: JsPDF, y: number): number {
  doc.setFillColor('#FAFAFA');
  doc.setDrawColor(70);
  doc.rect(MARGIN_X, y, CONTENT_WIDTH, 17, 'FD');

  doc.setTextColor(15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.text('FINALIDADE', MARGIN_X + 3, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.3);
  doc.text(
    'Ficha auxiliar para fundamentar o Pedido de Material obrigatório no SISCOFIS.',
    MARGIN_X + 3,
    y + 8
  );
  doc.text(
    'Não substitui o lançamento oficial no SISCOFIS. Confira NF, empenho e quantidade antes de concluir o pedido.',
    MARGIN_X + 3,
    y + 11
  );
  doc.text(
    'Quando a origem documental não puder ser determinada automaticamente, o campo será sinalizado para conferência manual.',
    MARGIN_X + 3,
    y + 14
  );

  return y + 21;
}

function drawPickingTableHeader(doc: JsPDF, y: number): number {
  const widths = [10, 61, 20, 67, 28];
  const labels = ['#', 'MATERIAL', 'QTD.', 'LOCALIZAÇÃO EXATA', 'LOTE / CÓDIGO'];
  let x = MARGIN_X;

  doc.setFillColor('#E8E8E8');
  doc.setDrawColor(35);
  doc.rect(MARGIN_X, y, CONTENT_WIDTH, 9, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.1);
  labels.forEach((label, index) => {
    const width = widths[index];
    doc.text(label, x + 1.5, y + 5.5, { maxWidth: width - 3 });
    if (index > 0) line(doc, x, y, x, y + 9);
    x += width;
  });

  return y + 9;
}

function drawPickingRow(
  doc: JsPDF,
  item: WarehouseOutboundDocumentLine,
  index: number,
  y: number
): number {
  const widths = [10, 61, 20, 67, 28];
  const materialFit = fitTextLines(doc, item.materialDescription, widths[1] - 4, 3, 7.1, 5.8);
  const positionFit = fitTextLines(doc, item.positionLabel, widths[3] - 4, 3, 7.0, 5.7);
  const traceText = [
    'Val. ' + (item.expiresOn
      ? item.expiresOn.split('-').reverse().join('/')
      : 'não informada'),
    item.barcode ? 'Cod. ' + item.barcode : '',
  ].filter(Boolean).join(' · ');
  const traceFit = fitTextLines(doc, traceText, widths[4] - 4, 3, 6.5, 5.3);

  const maxLines = Math.max(materialFit.lines.length, positionFit.lines.length, traceFit.lines.length);
  const rowHeight = Math.max(13, 5 + (maxLines * 3.4));

  doc.setDrawColor(55);
  doc.rect(MARGIN_X, y, CONTENT_WIDTH, rowHeight, 'S');

  let x = MARGIN_X;
  for (let i = 1; i < widths.length; i += 1) {
    x += widths[i - 1];
    line(doc, x, y, x, y + rowHeight);
  }

  doc.setTextColor(10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(String(index + 1), MARGIN_X + (widths[0] / 2), y + 7, { align: 'center' });

  x = MARGIN_X + widths[0];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(materialFit.fontSize);
  doc.text(materialFit.lines, x + 2, y + 4.5);

  x += widths[1];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.1);
  doc.text(formatQuantity(item.quantity), x + (widths[2] / 2), y + 5.4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.7);
  doc.text(item.unitLabel, x + (widths[2] / 2), y + 9.2, { align: 'center' });

  x += widths[2];
  doc.setFontSize(positionFit.fontSize);
  doc.text(positionFit.lines, x + 2, y + 4.5);

  x += widths[3];
  doc.setFontSize(traceFit.fontSize);
  doc.text(traceFit.lines, x + 2, y + 4.5);

  return y + rowHeight;
}

function drawSiscofisTableHeader(doc: JsPDF, y: number): number {
  const widths = [9, 83, 25, 26, 20, 23];
  const labels = ['#', 'DETALHAMENTO', 'NF', 'NOTA DE EMPENHO', 'QTD.', 'UNID.'];
  let x = MARGIN_X;

  doc.setFillColor('#E8E8E8');
  doc.setDrawColor(35);
  doc.rect(MARGIN_X, y, CONTENT_WIDTH, 9, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  labels.forEach((label, index) => {
    const width = widths[index];
    doc.text(label, x + 1.3, y + 5.4, { maxWidth: width - 2.6 });
    if (index > 0) line(doc, x, y, x, y + 9);
    x += width;
  });

  return y + 9;
}

function drawSiscofisRow(
  doc: JsPDF,
  item: WarehouseOutboundDocumentLine,
  index: number,
  y: number
): number {
  const widths = [9, 83, 25, 26, 20, 23];
  const detail = item.supplier
    ? item.materialDescription + '\nFornecedor: ' + item.supplier
    : item.materialDescription;

  const detailFit = fitTextLines(doc, detail, widths[1] - 4, 4, 7.0, 5.7);
  const invoiceFit = fitTextLines(doc, item.invoiceId || '—*', widths[2] - 3, 2, 6.7, 5.5);
  const empenhoFit = fitTextLines(doc, item.empenhoId || '—*', widths[3] - 3, 2, 6.7, 5.4);
  const maxLines = Math.max(detailFit.lines.length, invoiceFit.lines.length, empenhoFit.lines.length);
  const rowHeight = Math.max(13, 5 + (maxLines * 3.35));

  doc.setDrawColor(55);
  doc.rect(MARGIN_X, y, CONTENT_WIDTH, rowHeight, 'S');

  let x = MARGIN_X;
  for (let i = 1; i < widths.length; i += 1) {
    x += widths[i - 1];
    line(doc, x, y, x, y + rowHeight);
  }

  doc.setTextColor(10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.9);
  doc.text(String(index + 1), MARGIN_X + (widths[0] / 2), y + 7, { align: 'center' });

  x = MARGIN_X + widths[0];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(detailFit.fontSize);
  doc.text(detailFit.lines, x + 2, y + 4.5);

  x += widths[1];
  doc.setFontSize(invoiceFit.fontSize);
  doc.text(invoiceFit.lines, x + 1.5, y + 4.5);

  x += widths[2];
  doc.setFontSize(empenhoFit.fontSize);
  doc.text(empenhoFit.lines, x + 1.5, y + 4.5);

  x += widths[3];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(formatQuantity(item.quantity), x + (widths[4] / 2), y + 6.3, { align: 'center' });

  x += widths[4];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(item.unitLabel || '—', x + (widths[5] / 2), y + 6.3, { align: 'center' });

  return y + rowHeight;
}

function drawPickingSignatures(doc: JsPDF, y: number): void {
  if (y + 31 > BOTTOM_LIMIT) {
    doc.addPage();
    y = 22;
  }

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('CONFERÊNCIA DA RETIRADA', MARGIN_X, y);

  y += 10;
  line(doc, MARGIN_X, y, MARGIN_X + 76, y);
  line(doc, MARGIN_X + 94, y, PAGE_WIDTH - MARGIN_X, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.text('Militar responsável pela separação física · assinatura', MARGIN_X, y + 3.5);
  doc.text('Retirado/recebido por · assinatura', MARGIN_X + 94, y + 3.5);

  y += 11;
  doc.setFontSize(6.5);
  doc.text('Data da retirada física: ____/____/________   Hora: ______:______', MARGIN_X, y);
  doc.text('Conferência: (   ) sem divergência   (   ) com ressalva', MARGIN_X + 100, y);
}

function drawSiscofisSignatures(doc: JsPDF, y: number): void {
  if (y + 36 > BOTTOM_LIMIT) {
    doc.addPage();
    y = 22;
  }

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('CONTROLE DO PEDIDO SISCOFIS', MARGIN_X, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.text('Nº do Pedido SISCOFIS: _______________________________', MARGIN_X, y);
  doc.text('Data do lançamento: ____/____/________', MARGIN_X + 105, y);

  y += 10;
  line(doc, MARGIN_X, y, MARGIN_X + 76, y);
  line(doc, MARGIN_X + 94, y, PAGE_WIDTH - MARGIN_X, y);
  doc.setFontSize(6.2);
  doc.text('Operador SISCOFIS · nome/assinatura', MARGIN_X, y + 3.5);
  doc.text('Solicitante / responsável · nome/assinatura', MARGIN_X + 94, y + 3.5);

  y += 10;
  doc.setFontSize(5.9);
  doc.text(
    '* “—” indica origem documental não determinada automaticamente. Conferir o histórico do material antes do pedido oficial.',
    MARGIN_X,
    y,
    { maxWidth: CONTENT_WIDTH }
  );
}

function addFooters(
  doc: JsPDF,
  input: WarehouseOutboundDocumentsInput,
  identity: WarehouseOutboundControlIdentity
): void {
  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(150);
    doc.setLineWidth(0.2);
    line(doc, MARGIN_X, PAGE_HEIGHT - 12, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 12);

    doc.setTextColor(90);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.text('EMPROVEX · ADM Depósito · Controle ' + identity.controlNumber, MARGIN_X, FOOTER_Y);
    doc.text('Código ' + identity.controlCode, PAGE_WIDTH / 2, FOOTER_Y, { align: 'center' });
    doc.text('Página ' + page + ' de ' + pageCount, PAGE_WIDTH - MARGIN_X, FOOTER_Y, { align: 'right' });
  }
}

function drawPickingDocument(
  doc: JsPDF,
  input: WarehouseOutboundDocumentsInput,
  identity: WarehouseOutboundControlIdentity
): void {
  let y = drawDocumentHeader(
    doc,
    input,
    identity,
    'FICHA DE SAÍDA DE MATERIAL',
    'DOCUMENTO 1 DE 2 · orientação para retirada física'
  );
  y = drawPickingInstructions(doc, y);
  y = drawPickingTableHeader(doc, y);

  input.lines.forEach((item, index) => {
    const estimated = 24;
    if (y + estimated > BOTTOM_LIMIT) {
      doc.addPage();
      y = drawDocumentHeader(
        doc,
        input,
        identity,
        'FICHA DE SAÍDA DE MATERIAL',
        'DOCUMENTO 1 DE 2 · orientação para retirada física',
        true
      );
      y = drawPickingTableHeader(doc, y);
    }
    y = drawPickingRow(doc, item, index, y);
  });

  drawPickingSignatures(doc, y);
}

function drawSiscofisDocument(
  doc: JsPDF,
  input: WarehouseOutboundDocumentsInput,
  identity: WarehouseOutboundControlIdentity
): void {
  doc.addPage();

  let y = drawDocumentHeader(
    doc,
    input,
    identity,
    'FICHA AUXILIAR DE PEDIDO DE MATERIAL - SISCOFIS',
    'DOCUMENTO 2 DE 2 · apoio ao lançamento obrigatório no SISCOFIS'
  );
  y = drawSiscofisInstructions(doc, y);
  y = drawSiscofisTableHeader(doc, y);

  input.lines.forEach((item, index) => {
    const estimated = 25;
    if (y + estimated > BOTTOM_LIMIT) {
      doc.addPage();
      y = drawDocumentHeader(
        doc,
        input,
        identity,
        'FICHA AUXILIAR DE PEDIDO DE MATERIAL - SISCOFIS',
        'DOCUMENTO 2 DE 2 · apoio ao lançamento obrigatório no SISCOFIS',
        true
      );
      y = drawSiscofisTableHeader(doc, y);
    }
    y = drawSiscofisRow(doc, item, index, y);
  });

  drawSiscofisSignatures(doc, y);
}

export async function createWarehouseOutboundDocumentsPdf(
  input: WarehouseOutboundDocumentsInput
): Promise<CreatedOutboundDocuments> {
  if (!input.lines.length) throw new Error('WAREHOUSE_OUTBOUND_DOCUMENTS_EMPTY');

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  const identity = getWarehouseOutboundControlIdentity(
    input.withdrawalId,
    input.finalizedAt
  );

  drawPickingDocument(doc, input, identity);
  drawSiscofisDocument(doc, input, identity);
  addFooters(doc, input, identity);

  return {
    doc,
    identity,
    filename: 'EMPROVEX_Saida_Material_' + identity.controlNumber + '.pdf',
  };
}

export async function downloadWarehouseOutboundDocuments(
  input: WarehouseOutboundDocumentsInput
): Promise<WarehouseOutboundControlIdentity> {
  const { doc, filename, identity } = await createWarehouseOutboundDocumentsPdf(input);
  doc.save(filename);
  return identity;
}

export async function printWarehouseOutboundDocuments(
  input: WarehouseOutboundDocumentsInput
): Promise<WarehouseOutboundControlIdentity> {
  const printWindow = window.open('', '_blank');

  try {
    const { doc, identity } = await createWarehouseOutboundDocumentsPdf(input);
    doc.autoPrint();
    const blobUrl = URL.createObjectURL(doc.output('blob'));

    if (printWindow) {
      printWindow.location.href = blobUrl;
    } else {
      window.open(blobUrl, '_blank');
    }

    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
    return identity;
  } catch (error) {
    printWindow?.close();
    throw error;
  }
}
