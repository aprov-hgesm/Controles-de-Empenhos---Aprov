import { jsPDF } from 'jspdf';

import {
  WAREHOUSE_LABEL_PRESETS,
  paginateWarehouseLabels,
  warehouseLabelKindLabel,
  type WarehouseLabelItem,
  type WarehouseLabelSheetPreset,
} from '../../../lib/warehouse/labels';

export interface WarehouseLabelPdfOptions {
  preset: WarehouseLabelSheetPreset;
  includeUg: boolean;
  includeHierarchy: boolean;
  generatedAt?: Date;
}

function fitText(
  doc: jsPDF,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
  style: 'normal' | 'bold' = 'normal'
): number {
  doc.setFont('helvetica', style);
  let size = startSize;
  doc.setFontSize(size);
  while (size > minSize && doc.getTextWidth(text) > maxWidth) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  return size;
}

function drawLabel(
  doc: jsPDF,
  item: WarehouseLabelItem,
  x: number,
  y: number,
  width: number,
  height: number,
  options: WarehouseLabelPdfOptions
): void {
  const compact = options.preset === 'COMPACT';
  const large = options.preset === 'LARGE';
  const pad = compact ? 3.2 : large ? 5 : 4.2;

  doc.setDrawColor(20);
  doc.setTextColor(10);
  doc.setLineWidth(compact ? 0.25 : 0.35);
  doc.roundedRect(x, y, width, height, compact ? 1.5 : 2, compact ? 1.5 : 2);

  // Faixa institucional monocromática: funciona bem em toner e diferencia o EMPROVEX.
  doc.setFillColor(20);
  doc.rect(x, y, compact ? 2.4 : 3.2, height, 'F');

  const innerX = x + pad + (compact ? 1 : 1.5);
  const innerWidth = width - (innerX - x) - pad;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(compact ? 6 : 7);
  doc.text('EMPROVEX', innerX, y + pad + 1.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(compact ? 4.8 : 5.5);
  doc.text('ADM DEPÓSITO', innerX, y + pad + (compact ? 3.7 : 4.3));

  const kind = warehouseLabelKindLabel(item.kind);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(compact ? 4.8 : 5.4);
  const kindWidth = doc.getTextWidth(kind) + (compact ? 3.2 : 4);
  const kindHeight = compact ? 4.5 : 5.2;
  const kindX = x + width - pad - kindWidth;
  const kindY = y + pad;
  doc.setLineWidth(0.22);
  doc.roundedRect(kindX, kindY, kindWidth, kindHeight, 1, 1);
  doc.text(kind, kindX + kindWidth / 2, kindY + kindHeight - (compact ? 1.3 : 1.6), {
    align: 'center',
  });

  const codeY = y + (compact ? 13.2 : large ? 20 : 16.2);
  const codeSize = fitText(
    doc,
    item.code,
    innerWidth,
    compact ? 13.5 : large ? 22 : 18,
    compact ? 8 : 10,
    'bold'
  );
  doc.setFontSize(codeSize);
  doc.text(item.code, innerX, codeY);

  const nameY = codeY + (compact ? 5 : large ? 8 : 6.5);
  const nameSize = fitText(
    doc,
    item.name,
    innerWidth,
    compact ? 7 : large ? 11 : 9,
    compact ? 5.2 : 6,
    'bold'
  );
  doc.setFontSize(nameSize);
  doc.text(item.name, innerX, nameY);

  let cursorY = nameY + (compact ? 3.6 : large ? 5.8 : 4.5);

  if (options.includeHierarchy && item.hierarchy.length > 1) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(compact ? 4.7 : 5.8);
    const hierarchy = item.hierarchy.slice(0, -1).join('  ›  ');
    const lines = doc.splitTextToSize(hierarchy, innerWidth);
    const maxLines = compact ? 1 : large ? 2 : 1;
    for (const line of lines.slice(0, maxLines)) {
      doc.text(line, innerX, cursorY);
      cursorY += compact ? 2.7 : 3.5;
    }
  }

  const footerY = y + height - (compact ? 3 : 3.8);
  doc.setDrawColor(165);
  doc.setLineWidth(0.15);
  doc.line(innerX, footerY - (compact ? 3 : 3.7), x + width - pad, footerY - (compact ? 3 : 3.7));

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(compact ? 4.2 : 5);
  const footerParts: string[] = [];
  if (options.includeUg) footerParts.push('UG ' + item.ug);
  footerParts.push(item.workspaceId);
  doc.text(footerParts.join('  ·  '), innerX, footerY);

  doc.setFontSize(compact ? 3.8 : 4.6);
  doc.text('Estrutura física', x + width - pad, footerY, { align: 'right' });
}

export function createWarehouseLabelsPdf(
  items: WarehouseLabelItem[],
  options: WarehouseLabelPdfOptions
): Blob {
  if (items.length === 0) {
    throw new Error('WAREHOUSE_LABELS_EMPTY');
  }

  const preset = WAREHOUSE_LABEL_PRESETS[options.preset];
  const pages = paginateWarehouseLabels(items, options.preset);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const usableWidth =
    pageWidth - preset.marginMm * 2 - preset.gapMm * (preset.columns - 1);
  const usableHeight =
    pageHeight - preset.marginMm * 2 - preset.gapMm * (preset.rows - 1);
  const labelWidth = usableWidth / preset.columns;
  const labelHeight = usableHeight / preset.rows;

  pages.forEach((pageItems, pageIndex) => {
    if (pageIndex > 0) doc.addPage('a4', 'portrait');

    pageItems.forEach((item, index) => {
      const row = Math.floor(index / preset.columns);
      const column = index % preset.columns;
      const x = preset.marginMm + column * (labelWidth + preset.gapMm);
      const y = preset.marginMm + row * (labelHeight + preset.gapMm);
      drawLabel(doc, item, x, y, labelWidth, labelHeight, options);
    });
  });

  doc.setProperties({
    title: 'Etiquetas ADM Depósito - EMPROVEX',
    subject: 'Etiquetas de identificação física',
    author: 'EMPROVEX',
    creator: 'EMPROVEX ADM Depósito',
  });

  return doc.output('blob');
}

export function openWarehouseLabelsPdf(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadWarehouseLabelsPdf(
  blob: Blob,
  fileName = 'emprovex-etiquetas-adm-deposito.pdf'
): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
}
