'use client';

import { loadJsPdfWithAutoTable } from '../../../lib/pdfToolkit';
import type { WarehouseBarcodeAssociation } from '../../../lib/warehouse/barcode';
import {
  warehouseLocationExpiry,
  warehouseLocationExpiryStatus,
  warehouseLocationQuantity,
  type LocationContents,
} from '../../../lib/warehouse/locationContents';

function filenamePart(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 55) || 'local';
}

type AlertState = 'expired' | 'soon' | 'normal' | 'none';

function rowValidity(
  row: LocationContents['groups'][number]['rows'][number],
  today: Date
): { text: string; state: AlertState } {
  if (row.lots.length === 0) return { text: 'Não informada', state: 'none' };
  const values = row.lots.map((lot) => {
    const state = warehouseLocationExpiryStatus(lot.expiresOn, today);
    const suffix = state === 'expired' ? ' - VENCIDO'
      : state === 'soon' ? ' - A VENCER' : '';
    const quantity = row.lots.length > 1
      ? ' (' + warehouseLocationQuantity(lot.quantity) + ' ' + row.unit + ')'
      : '';
    return { state, label: warehouseLocationExpiry(lot.expiresOn) + quantity + suffix };
  });
  if (row.quantityWithoutLot > 0.000001) {
    values.push({ state: 'none', label: 'Parte sem validade' });
  }
  const state: AlertState = values.some((item) => item.state === 'expired') ? 'expired'
    : values.some((item) => item.state === 'soon') ? 'soon'
      : values.some((item) => item.state === 'normal') ? 'normal' : 'none';
  return { text: values.map((item) => item.label).join('\n'), state };
}

export async function downloadWarehouseLocationContentsPdf(input: {
  depotName: string;
  contents: LocationContents;
  barcodes?: WarehouseBarcodeAssociation[];
  generatedAt: Date;
}): Promise<void> {
  const { jsPDF, autoTable } = await loadJsPdfWithAutoTable();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { contents, depotName } = input;
  const location = contents.location;
  const rows: string[][] = [];
  const validityStates: AlertState[] = [];
  const activeBarcodes = (input.barcodes || []).filter((association) => association.status === 'active');

  for (const group of contents.groups) {
    for (const row of group.rows) {
      const validity = rowValidity(row, input.generatedAt);
      const barcode = activeBarcodes.find((item) =>
        item.materialId === row.materialId && item.factorToBaseUnit === 1
      ) || activeBarcodes.find((item) => item.materialId === row.materialId);
      rows.push([
        group.direct ? 'Direto no local' : group.name,
        row.description,
        warehouseLocationQuantity(row.quantity) + ' ' + row.unit,
        validity.text,
        barcode?.barcode || '',
      ]);
      validityStates.push(validity.state);
    }
  }
  if (rows.length === 0) {
    rows.push(['-', 'Sem materiais neste local', '-', '-', '']);
    validityStates.push('none');
  }

  const counts = validityStates.reduce((summary, state) => {
    if (state === 'expired') summary.expired += 1;
    if (state === 'soon') summary.soon += 1;
    return summary;
  }, { expired: 0, soon: 0 });

  // Faixa de identidade visual e hierarquia clara para impressão em A4.
  doc.setFillColor(5, 30, 97);
  doc.rect(0, 0, 210, 25, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('EMPROVEX', 14, 15);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('RELATÓRIO DE MATERIAIS POR LOCAL', 196, 15, { align: 'right' });

  doc.setTextColor(18, 33, 57);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(location.code + '  |  ' + location.name, 14, 36, { maxWidth: 182 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(88, 102, 122);
  doc.text('Depósito: ' + depotName, 14, 43, { maxWidth: 182 });

  const metrics = [
    { title: 'MATERIAIS', value: String(contents.materialCount), color: [5, 40, 142] },
    { title: 'A VENCER EM 14 DIAS', value: String(counts.soon), color: [147, 89, 0] },
    { title: 'VENCIDOS', value: String(counts.expired), color: [159, 18, 57] },
  ];
  for (let i = 0; i < metrics.length; i += 1) {
    const item = metrics[i];
    const x = 14 + i * 62.5;
    doc.setFillColor(246, 248, 252);
    doc.setDrawColor(224, 232, 244);
    doc.roundedRect(x, 48, 57.5, 16, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(104, 117, 136);
    doc.text(item.title, x + 3.5, 54);
    doc.setFontSize(15);
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(item.value, x + 3.5, 61);
  }

  autoTable(doc, {
    startY: 70,
    head: [['Prateleira', 'Descrição do item', 'Quantidade', 'Validade', 'Código de barras']],
    body: rows,
    theme: 'striped',
    styles: {
      font: 'helvetica', fontSize: 8, cellPadding: { top: 3.2, right: 2.4, bottom: 3.2, left: 2.4 },
      overflow: 'linebreak', textColor: [37, 52, 74], lineColor: [229, 234, 241], lineWidth: 0.1,
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: [248, 250, 254] },
    headStyles: { fillColor: [5, 40, 142], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 33 },
      1: { cellWidth: 51 },
      2: { cellWidth: 23, halign: 'right' },
      3: { cellWidth: 43 },
      4: { cellWidth: 32 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 3) return;
      const state = validityStates[data.row.index];
      if (state === 'expired') {
        data.cell.styles.fillColor = [255, 237, 239];
        data.cell.styles.textColor = [159, 18, 57];
        data.cell.styles.fontStyle = 'bold';
      }
      if (state === 'soon') {
        data.cell.styles.fillColor = [255, 249, 225];
        data.cell.styles.textColor = [147, 89, 0];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { top: 17, left: 14, right: 14, bottom: 24 },
    showHead: 'everyPage',
  });

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(219, 227, 240);
    doc.line(14, 277, 196, 277);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(94, 108, 128);
    doc.text(
      'Consulta informativa. Quantidades alteradas somente por movimentações oficiais.',
      14, 283
    );
    doc.text('Emitido em ' + input.generatedAt.toLocaleString('pt-BR'), 14, 288);
    doc.text('Página ' + page + '/' + totalPages, 196, 288, { align: 'right' });
  }

  doc.save(
    'emprovex-local-' + filenamePart(location.code)
    + '-' + input.generatedAt.toISOString().slice(0, 10) + '.pdf'
  );
}
