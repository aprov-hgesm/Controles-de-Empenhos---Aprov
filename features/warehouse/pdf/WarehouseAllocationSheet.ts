'use client';

import type { jsPDF as JsPDF } from 'jspdf';

import type { WarehouseInvoiceIntakeQueueRow } from '../../../lib/warehouse/intakeStateRepository';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_X = 12;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN_X * 2);
const ALLOCATION_ROWS_PER_ITEM = 3;
const BOTTOM_SAFE_AREA = 24;

export interface WarehouseAllocationSheetInput {
  workspaceId: string;
  ug: string | null;
  issuedBy: string | null;
  kind: 'invoice' | 'pregao';
  subjectLabel: string;
  rows: WarehouseInvoiceIntakeQueueRow[];
}

interface AllocationSheetDocument {
  doc: JsPDF;
  filename: string;
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim() || '')
        .filter(Boolean)
    )
  );
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) return dateOnly[3] + '/' + dateOnly[2] + '/' + dateOnly[1];
  const parsed = Date.parse(value);
  return Number.isNaN(parsed)
    ? value
    : new Date(parsed).toLocaleDateString('pt-BR');
}

function formatDateTime(value: Date): string {
  return value.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatQuantity(value: number): string {
  return value.toLocaleString('pt-BR', {
    maximumFractionDigits: 6,
  });
}

function sanitizeFilenamePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'alocacao';
}

function line(doc: JsPDF, x1: number, y1: number, x2: number, y2: number): void {
  doc.line(x1, y1, x2, y2);
}

function drawPageHeader(
  doc: JsPDF,
  input: WarehouseAllocationSheetInput,
  emittedAt: Date
): number {
  let y = 12;

  doc.setTextColor(20);
  doc.setDrawColor(45);
  doc.setLineWidth(0.35);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('EMPROVEX', MARGIN_X, y);

  doc.setFontSize(7.5);
  doc.text('ADM DEPÓSITO · ÁREA LOGÍSTICA', PAGE_WIDTH - MARGIN_X, y, {
    align: 'right',
  });

  y += 7;
  doc.setFontSize(12);
  doc.text('FICHA DE ALOCAÇÃO FÍSICA DE MATERIAIS', PAGE_WIDTH / 2, y, {
    align: 'center',
  });

  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    'Documento operacional para registro manual da alocação física e posterior lançamento no EMPROVEX.',
    PAGE_WIDTH / 2,
    y,
    { align: 'center' }
  );

  y += 5;
  line(doc, MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);

  y += 5;
  const invoices = unique(input.rows.map((row) => row.invoiceId));
  const empenhos = unique(input.rows.map((row) => row.empenhoId));
  const suppliers = unique(input.rows.map((row) => row.supplier));
  const pregaos = unique(input.rows.map((row) => row.pregao));
  const issueDates = unique(input.rows.map((row) => row.issueDate));

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('TIPO', MARGIN_X, y);
  doc.text('REFERÊNCIA', 47, y);
  doc.text('UG', 119, y);
  doc.text('EMISSÃO', 147, y);

  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(input.kind === 'invoice' ? 'Por Nota Fiscal' : 'Por Pregão', MARGIN_X, y);
  doc.text(input.subjectLabel, 47, y, { maxWidth: 66 });
  doc.text(input.ug || '—', 119, y);
  doc.text(formatDateTime(emittedAt), 147, y);

  y += 6;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('NF(S)', MARGIN_X, y);
  doc.text('EMPENHO(S)', 72, y);
  doc.text('PREGÃO', 137, y);

  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(invoices.join(', ') || '—', MARGIN_X, y, { maxWidth: 54 });
  doc.text(empenhos.join(', ') || '—', 72, y, { maxWidth: 58 });
  doc.text(pregaos.join(', ') || '—', 137, y, { maxWidth: 60 });

  y += 6;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('FORNECEDOR(ES)', MARGIN_X, y);
  doc.text('DATA(S) DA NF', 147, y);

  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const supplierLines = doc.splitTextToSize(suppliers.join(' · ') || '—', 128);
  doc.text(supplierLines.slice(0, 2), MARGIN_X, y);
  doc.text(issueDates.map(formatDate).join(', ') || '—', 147, y, { maxWidth: 50 });
  y += Math.max(5, Math.min(2, supplierLines.length) * 3.4);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('EMITIDO POR', MARGIN_X, y);
  doc.text('WORKSPACE', 119, y);

  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(input.issuedBy || 'Usuário autenticado', MARGIN_X, y, { maxWidth: 96 });
  doc.text(input.workspaceId, 119, y, { maxWidth: 78 });

  y += 5;
  doc.setFillColor(246);
  doc.rect(MARGIN_X, y, CONTENT_WIDTH, 16, 'F');
  doc.rect(MARGIN_X, y, CONTENT_WIDTH, 16, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.text('INSTRUÇÕES DE PREENCHIMENTO', MARGIN_X + 3, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const instructions = [
    '1. Registre o depósito, local, subposição (se houver) e a quantidade realmente armazenada.',
    '2. Quando um item for dividido entre destinos, utilize uma linha de alocação para cada parcela.',
    '3. A soma das parcelas deve corresponder à quantidade indicada como “Qtd. para alocação”.',
    '4. Após a conferência física, entregue esta ficha ao operador para lançamento no EMPROVEX.',
  ];
  doc.text(instructions.slice(0, 2), MARGIN_X + 3, y + 8);
  doc.text(instructions.slice(2), MARGIN_X + 3, y + 13);

  return y + 21;
}

function drawItemBlock(
  doc: JsPDF,
  row: WarehouseInvoiceIntakeQueueRow,
  itemIndex: number,
  y: number
): number {
  const headerHeight = 12;
  const rowHeight = 9;
  const blockHeight = headerHeight + (ALLOCATION_ROWS_PER_ITEM * rowHeight);

  doc.setDrawColor(55);
  doc.setLineWidth(0.28);

  doc.setFillColor(242);
  doc.rect(MARGIN_X, y, CONTENT_WIDTH, headerHeight, 'F');
  doc.rect(MARGIN_X, y, CONTENT_WIDTH, blockHeight, 'S');
  line(doc, MARGIN_X, y + headerHeight, PAGE_WIDTH - MARGIN_X, y + headerHeight);

  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.text('ITEM ' + String(itemIndex + 1).padStart(2, '0'), MARGIN_X + 2.5, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  const description = row.itemName || 'Material sem descrição';
  const descriptionLines = doc.splitTextToSize(description, 100);
  doc.text(descriptionLines.slice(0, 2), MARGIN_X + 20, y + 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.7);
  doc.text('UN', 139, y + 4);
  doc.text('RECEBIDO', 153, y + 4);
  doc.text('QTD. PARA ALOCAÇÃO', 176, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.text(row.unitLabel || '—', 139, y + 8);
  doc.text(formatQuantity(row.receivedQuantity), 153, y + 8);
  doc.text(formatQuantity(row.pendingQuantity), 176, y + 8);

  const x = {
    slot: MARGIN_X,
    depot: MARGIN_X + 16,
    local: MARGIN_X + 57,
    sub: MARGIN_X + 99,
    qty: MARGIN_X + 144,
    obs: MARGIN_X + 165,
    end: PAGE_WIDTH - MARGIN_X,
  };

  line(doc, x.depot, y + headerHeight, x.depot, y + blockHeight);
  line(doc, x.local, y + headerHeight, x.local, y + blockHeight);
  line(doc, x.sub, y + headerHeight, x.sub, y + blockHeight);
  line(doc, x.qty, y + headerHeight, x.qty, y + blockHeight);
  line(doc, x.obs, y + headerHeight, x.obs, y + blockHeight);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.9);
  const labelY = y + headerHeight + 3.2;
  doc.text('ALOC.', x.slot + 2, labelY);
  doc.text('DEPÓSITO', x.depot + 2, labelY);
  doc.text('LOCAL', x.local + 2, labelY);
  doc.text('SUBPOSIÇÃO', x.sub + 2, labelY);
  doc.text('QTD.', x.qty + 2, labelY);
  doc.text('OBS.', x.obs + 2, labelY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  for (let slot = 0; slot < ALLOCATION_ROWS_PER_ITEM; slot += 1) {
    const rowTop = y + headerHeight + (slot * rowHeight);
    if (slot > 0) {
      line(doc, MARGIN_X, rowTop, PAGE_WIDTH - MARGIN_X, rowTop);
    }
    doc.text(String(slot + 1), x.slot + 7.5, rowTop + 6.1, { align: 'center' });
  }

  return y + blockHeight + 3;
}

function addFinalConferenceArea(doc: JsPDF, y: number): void {
  const needed = 40;
  if (y + needed > PAGE_HEIGHT - 12) {
    doc.addPage();
    y = 18;
  }

  doc.setDrawColor(55);
  doc.setLineWidth(0.3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CONFERÊNCIA E REPASSE AO OPERADOR', MARGIN_X, y + 2);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    'Declaro que as posições acima correspondem à alocação física efetivamente realizada no depósito.',
    MARGIN_X,
    y
  );

  y += 9;
  line(doc, MARGIN_X, y, MARGIN_X + 78, y);
  line(doc, MARGIN_X + 92, y, PAGE_WIDTH - MARGIN_X, y);
  doc.setFontSize(6.5);
  doc.text('Responsável pela alocação física · nome/assinatura', MARGIN_X, y + 3.5);
  doc.text('Operador que lançou no EMPROVEX · nome/assinatura', MARGIN_X + 92, y + 3.5);

  y += 11;
  doc.setFontSize(7);
  doc.text('Data da alocação física: ____/____/________   Hora: ______:______', MARGIN_X, y);
  doc.text('Data do lançamento no sistema: ____/____/________', MARGIN_X + 100, y);

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('OBSERVAÇÕES GERAIS', MARGIN_X, y);
  y += 4;
  line(doc, MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
  line(doc, MARGIN_X, y + 6, PAGE_WIDTH - MARGIN_X, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.text(
    'Se um item exigir mais de três destinos, utilize este campo e identifique claramente item, destino e quantidade.',
    MARGIN_X,
    y + 10
  );
}

function addFooters(doc: JsPDF, emittedAt: Date): void {
  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(150);
    doc.setLineWidth(0.2);
    line(doc, MARGIN_X, PAGE_HEIGHT - 12, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 12);

    doc.setTextColor(90);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.text(
      'EMPROVEX · ADM Depósito · Ficha de Alocação Física de Materiais',
      MARGIN_X,
      PAGE_HEIGHT - 8
    );
    doc.text(
      'Emitida em ' + formatDateTime(emittedAt),
      PAGE_WIDTH / 2,
      PAGE_HEIGHT - 8,
      { align: 'center' }
    );
    doc.text(
      'Página ' + page + ' de ' + pageCount,
      PAGE_WIDTH - MARGIN_X,
      PAGE_HEIGHT - 8,
      { align: 'right' }
    );
  }
}

export function getWarehouseAllocationSheetRows(
  rows: WarehouseInvoiceIntakeQueueRow[]
): WarehouseInvoiceIntakeQueueRow[] {
  return rows.filter(
    (row) =>
      (row.status === 'PENDING' || row.status === 'PARTIALLY_PROCESSED')
      && row.pendingQuantity > 0.000001
  );
}

export async function createWarehouseAllocationSheetPdf(
  input: WarehouseAllocationSheetInput
): Promise<AllocationSheetDocument> {
  const rows = getWarehouseAllocationSheetRows(input.rows);
  if (rows.length === 0) {
    throw new Error('WAREHOUSE_ALLOCATION_SHEET_NO_PENDING_ITEMS');
  }

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  const emittedAt = new Date();

  let y = drawPageHeader(doc, { ...input, rows }, emittedAt);

  rows.forEach((row, index) => {
    const estimatedBlockHeight = 12 + (ALLOCATION_ROWS_PER_ITEM * 9) + 3;
    if (y + estimatedBlockHeight > PAGE_HEIGHT - BOTTOM_SAFE_AREA) {
      doc.addPage();
      y = drawPageHeader(doc, { ...input, rows }, emittedAt);
    }
    y = drawItemBlock(doc, row, index, y);
  });

  addFinalConferenceArea(doc, y + 2);
  addFooters(doc, emittedAt);

  const subject = sanitizeFilenamePart(input.subjectLabel);
  return {
    doc,
    filename: 'EMPROVEX_Ficha_Alocacao_' + subject + '.pdf',
  };
}

export async function downloadWarehouseAllocationSheet(
  input: WarehouseAllocationSheetInput
): Promise<void> {
  const { doc, filename } = await createWarehouseAllocationSheetPdf(input);
  doc.save(filename);
}

export async function printWarehouseAllocationSheet(
  input: WarehouseAllocationSheetInput
): Promise<void> {
  const printWindow = window.open('', '_blank');

  try {
    const { doc } = await createWarehouseAllocationSheetPdf(input);
    doc.autoPrint();
    const blobUrl = URL.createObjectURL(doc.output('blob'));

    if (printWindow) {
      printWindow.location.href = blobUrl;
    } else {
      window.open(blobUrl, '_blank');
    }

    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
  } catch (error) {
    printWindow?.close();
    throw error;
  }
}
