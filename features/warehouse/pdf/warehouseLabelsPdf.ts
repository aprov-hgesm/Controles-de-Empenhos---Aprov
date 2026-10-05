import { jsPDF } from 'jspdf';

import {
  WAREHOUSE_LABEL_PRESETS,
  paginateWarehouseLabels,
  warehouseLabelKindLabel,
  type WarehouseLabelItem,
  type WarehouseLabelSheetPreset,
} from '../../../lib/warehouse/labels';
import { buildWarehouseCode128Pattern } from '../../../lib/warehouse/locationBarcode';

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

function drawPhysicalBarcode(
  doc: jsPDF,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  textY: number,
  compact: boolean,
  textStartSize?: number,
  textMinSize?: number
): void {
  const pattern = buildWarehouseCode128Pattern(value);
  const moduleWidth = width / pattern.totalModules;

  doc.setFillColor(0, 0, 0);
  pattern.bars.forEach((bar) => {
    doc.rect(
      x + bar.offsetModules * moduleWidth,
      y,
      Math.max(moduleWidth * bar.widthModules, 0.08),
      height,
      'F'
    );
  });

  const textSize = fitText(
    doc,
    value,
    width,
    textStartSize ?? (compact ? 3.2 : 4),
    textMinSize ?? (compact ? 2.35 : 2.8),
    'normal'
  );
  doc.setFontSize(textSize);
  doc.text(value, x + width / 2, textY, { align: 'center' });
}

function drawCompactShelfLabel(
  doc: jsPDF,
  item: WarehouseLabelItem,
  x: number,
  y: number,
  width: number,
  height: number,
  options: WarehouseLabelPdfOptions
): void {
  const pad = 2.8;
  const leftX = x + pad;
  const rightEdge = x + width - pad;
  const dividerX = x + width * 0.43;
  const leftWidth = dividerX - leftX - 2.4;
  const barcodeX = dividerX + 3.2;
  const barcodeWidth = rightEdge - barcodeX;

  doc.setDrawColor(10, 10, 10);
  doc.setTextColor(5, 5, 5);
  doc.setLineWidth(0.28);
  doc.roundedRect(x, y, width, height, 1.4, 1.4);

  doc.setLineWidth(0.22);
  doc.line(dividerX, y + 2, dividerX, y + height - 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.6);
  doc.text('EMPROVEX', leftX, y + 4.4);

  doc.setFontSize(3.6);
  doc.text('CENTRAL DE DEPÓSITOS', leftX, y + 7.2);

  const codeSize = fitText(
    doc,
    item.code,
    leftWidth,
    17,
    8,
    'bold'
  );
  doc.setFontSize(codeSize);
  doc.text(item.code, leftX, y + 14.7);

  const nameSize = fitText(
    doc,
    item.name,
    leftWidth,
    7.5,
    4.4,
    'bold'
  );
  doc.setFontSize(nameSize);
  doc.text(item.name, leftX, y + 19.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.3);
  doc.text(warehouseLabelKindLabel(item.kind), leftX, y + 23.1);

  doc.setFontSize(4.1);
  doc.text('ESTRUTURA FÍSICA', leftX, y + 26.5);

  const footerSeparatorY = y + 28.5;
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.16);
  doc.line(leftX, footerSeparatorY, dividerX - 2.4, footerSeparatorY);

  const footerParts = [item.depotCode];
  if (options.includeUg) footerParts.push('UG ' + item.ug);
  footerParts.push(item.workspaceId.toUpperCase());
  const footerText = footerParts.join('   ');
  const footerSize = fitText(
    doc,
    footerText,
    leftWidth,
    4.1,
    2.8,
    'bold'
  );
  doc.setFontSize(footerSize);
  doc.text(footerText, leftX, y + 32.5);

  drawPhysicalBarcode(
    doc,
    item.physicalBarcode,
    barcodeX,
    y + 3,
    barcodeWidth,
    22.5,
    y + 31.2,
    true,
    5.6,
    3.2
  );
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
  if (compact) {
    drawCompactShelfLabel(doc, item, x, y, width, height, options);
    return;
  }

  const large = options.preset === 'LARGE';
  const pad = large ? 5 : 4.2;

  doc.setDrawColor(20, 20, 20);
  doc.setTextColor(10, 10, 10);
  doc.setLineWidth(compact ? 0.25 : 0.35);
  doc.roundedRect(x, y, width, height, compact ? 1.5 : 2, compact ? 1.5 : 2);

  // Faixa institucional monocromática: funciona bem em toner e diferencia o EMPROVEX.
  doc.setFillColor(20, 20, 20);
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

  const codeY = y + (compact ? 10.4 : large ? 18 : 14.5);
  const codeSize = fitText(
    doc,
    item.code,
    innerWidth,
    compact ? 12.5 : large ? 22 : 18,
    compact ? 7.5 : 10,
    'bold'
  );
  doc.setFontSize(codeSize);
  doc.text(item.code, innerX, codeY);

  const nameY = codeY + (compact ? 3.9 : large ? 7.2 : 5.7);
  const nameSize = fitText(
    doc,
    item.name,
    innerWidth,
    compact ? 6.4 : large ? 11 : 9,
    compact ? 4.8 : 6,
    'bold'
  );
  doc.setFontSize(nameSize);
  doc.text(item.name, innerX, nameY);

  let cursorY = nameY + (compact ? 3 : large ? 5.5 : 4.2);

  if (!compact && options.includeHierarchy && item.hierarchy.length > 1) {
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

  const footerY = y + height - (compact ? 2.6 : 3.8);
  const separatorY = footerY - (compact ? 2.1 : 2.8);
  const barcodeTextY = separatorY - (compact ? 0.9 : 1.2);
  const barcodeHeight = compact ? 10.2 : large ? 15.5 : 10.8;
  const barcodeGap = compact ? 0.9 : large ? 2.2 : 1.4;
  const barcodeY = barcodeTextY - barcodeGap - barcodeHeight;
  const barcodeX = x + pad;
  const barcodeWidth = width - pad * 2;

  drawPhysicalBarcode(
    doc,
    item.physicalBarcode,
    barcodeX,
    barcodeY,
    barcodeWidth,
    barcodeHeight,
    barcodeTextY,
    compact
  );

  doc.setDrawColor(165, 165, 165);
  doc.setLineWidth(0.15);
  doc.line(innerX, separatorY, x + width - pad, separatorY);

  doc.setFont('helvetica', 'normal');
  const footerParts: string[] = [];
  if (item.kind !== 'DEPOT') footerParts.push('DEP ' + item.depotCode);
  if (options.includeUg) footerParts.push('UG ' + item.ug);
  footerParts.push(item.workspaceId);
  const footerText = footerParts.join('  ·  ');
  const footerTextWidth = innerWidth * (compact ? 0.66 : 0.7);
  const footerSize = fitText(
    doc,
    footerText,
    footerTextWidth,
    compact ? 3.9 : 5,
    compact ? 2.9 : 3.7,
    'normal'
  );
  doc.setFontSize(footerSize);
  doc.text(footerText, innerX, footerY);

  doc.setFontSize(compact ? 3.5 : 4.6);
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
  const cellWidth = usableWidth / preset.columns;
  const cellHeight = usableHeight / preset.rows;
  const labelWidth = Math.min(preset.widthMm ?? cellWidth, cellWidth);
  const labelHeight = Math.min(preset.heightMm ?? cellHeight, cellHeight);

  pages.forEach((pageItems, pageIndex) => {
    if (pageIndex > 0) doc.addPage('a4', 'portrait');

    pageItems.forEach((item, index) => {
      const row = Math.floor(index / preset.columns);
      const column = index % preset.columns;
      const cellX = preset.marginMm + column * (cellWidth + preset.gapMm);
      const cellY = preset.marginMm + row * (cellHeight + preset.gapMm);
      const x = cellX + (cellWidth - labelWidth) / 2;
      const y = cellY + (cellHeight - labelHeight) / 2;
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
