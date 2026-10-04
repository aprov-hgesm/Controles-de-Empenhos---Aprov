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
  compact: boolean
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
    compact ? 3.2 : 4,
    compact ? 2.35 : 2.8,
    'normal'
  );
  doc.setFontSize(textSize);
  doc.text(value, x + width / 2, textY, { align: 'center' });
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

  const codeY = y + (compact ? 11.8 : large ? 18 : 14.5);
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

  const nameY = codeY + (compact ? 4.4 : large ? 7.2 : 5.7);
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

  let cursorY = nameY + (compact ? 3.4 : large ? 5.5 : 4.2);

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
  const separatorY = footerY - (compact ? 2.2 : 2.8);
  const barcodeTextY = separatorY - (compact ? 1 : 1.2);
  const barcodeHeight = compact ? 5.2 : large ? 10 : 6.6;
  const barcodeGap = compact ? 1.8 : large ? 2.6 : 2.1;
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
    compact ? 4.2 : 5,
    compact ? 3.2 : 3.7,
    'normal'
  );
  doc.setFontSize(footerSize);
  doc.text(footerText, innerX, footerY);

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
