'use client';

import { loadJsPdfWithAutoTable } from '../../../lib/pdfToolkit';
import {
  warehouseLocationExpiry,
  warehouseLocationQuantity,
  type LocationContents,
} from '../../../lib/warehouse/locationContents';

function filenamePart(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 55) || 'local';
}

export async function downloadWarehouseLocationContentsPdf(input: {
  depotName: string;
  contents: LocationContents;
  generatedAt: Date;
}): Promise<void> {
  const { jsPDF, autoTable } = await loadJsPdfWithAutoTable();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { contents, depotName } = input;
  const location = contents.location;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(17, 42, 93);
  doc.text('EMPROVEX | RELATORIO DO LOCAL', 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 50, 65);
  doc.setFontSize(10);
  doc.text('Deposito: ' + depotName, 14, 27);
  doc.text('Local: ' + location.code + ' - ' + location.name, 14, 33);
  doc.setFontSize(9);
  doc.text('Emitido em: ' + input.generatedAt.toLocaleString('pt-BR'), 14, 39);
  doc.text(
    'Materiais distintos: ' + contents.materialCount
      + ' | Registros com saldo: ' + contents.rowCount,
    14, 45
  );

  const body: string[][] = [];
  for (const group of contents.groups) {
    for (const row of group.rows) {
      const validity = row.lots.length === 0
        ? 'Sem lote/validade informados'
        : row.lots.map((lot) =>
          lot.code + ': ' + warehouseLocationExpiry(lot.expiresOn)
          + ' (' + warehouseLocationQuantity(lot.quantity) + ')'
        ).join('; ');
      const attribution = row.quantityWithoutLot > 0.000001
        ? '; saldo sem atribuicao a lote: ' + warehouseLocationQuantity(row.quantityWithoutLot)
        : '';
      body.push([
        group.direct ? 'Sem prateleira' : group.code + ' - ' + group.name,
        row.description,
        warehouseLocationQuantity(row.quantity),
        row.unit,
        validity + attribution + (row.lotQuantityExceedsBalance ? '; DIVERGENCIA DE LOTES' : ''),
      ]);
    }
  }

  autoTable(doc, {
    startY: 51,
    head: [['Prateleira / posicao', 'Material', 'Saldo fisico', 'Un.', 'Lotes e validades']],
    body: body.length ? body : [['-', 'Local sem materiais com saldo positivo', '-', '-', '-']],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [17, 42, 93], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 36 },
      1: { cellWidth: 52 },
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 14 },
      4: { cellWidth: 56 },
    },
    margin: { left: 14, right: 14, bottom: 20 },
  });

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(95, 105, 118);
    doc.text(
      'Consulta informativa: saldos fisicos prevalecem sobre lotes. Nenhuma movimentacao foi realizada.',
      14, 282
    );
    doc.text('Pagina ' + page + '/' + totalPages, 196, 288, { align: 'right' });
  }

  doc.save(
    'emprovex-local-' + filenamePart(location.code)
    + '-' + input.generatedAt.toISOString().slice(0, 10) + '.pdf'
  );
}
