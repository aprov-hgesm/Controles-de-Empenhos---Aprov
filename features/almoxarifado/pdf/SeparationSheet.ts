'use client';

import type { jsPDF as JsPDF } from 'jspdf';

import { loadJsPdf } from '../../../lib/pdfToolkit';
import {
  ALMOX_REQUEST_SCHEMA_VERSION,
  ALMOX_PLAN_SCHEMA_VERSION,
  ALMOX_SHEET_SCHEMA_VERSION,
  type ImportedRequestV1,
  type RequestLineV1,
  type SeparationPdfResultV1,
  type SeparationPlanLineV1,
  type SeparationSheetV1,
  type TypedIssueV1,
} from '../../../lib/almoxarifado/contracts';
import type { WarehouseDepot, WarehouseLocation, WarehouseStockPosition } from '../../../lib/warehouse/location';

/**
 * Snapshot exclusivamente de leitura. W5 fornece os dados já autorizados do
 * mesmo workspace; W4 não consulta serviços, banco, saldo ou SISCOFIS.
 */
export interface SeparationSheetPdfInput {
  sheet: Readonly<SeparationSheetV1>;
  request: Readonly<ImportedRequestV1>;
  depots: ReadonlyArray<Pick<WarehouseDepot, 'id' | 'workspaceId' | 'code' | 'name'>>;
  locations: ReadonlyArray<Pick<WarehouseLocation, 'id' | 'workspaceId' | 'depotId' | 'parentLocationId' | 'kind' | 'code' | 'name'>>;
  almoxarifadoName?: string;
  issuedByName?: string;
}

export type SeparationSheetPdfDocument = SeparationPdfResultV1 & { doc: JsPDF };

const WIDTH = 210;
const HEIGHT = 297;
const LEFT = 13;
const RIGHT = 197;
const CONTENT = RIGHT - LEFT;
const BOTTOM = 274;
const NOTICE = 'Documento auxiliar: NÃO substitui registro ou autorização no SISCOFIS.';
const TOLERANCE = 0.000001;

interface PrintableParcel {
  planRow: Readonly<SeparationPlanLineV1>;
  requestRow: Readonly<RequestLineV1>;
  location: { depot: string; local: string; subposition: string } | null;
  plannedParcel: number;
  sequence: number;
  allocationId: string | null;
}

function safe(value: string | null | undefined): string {
  return (value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim() || 'Não informado';
}

function displayQuantity(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}

function displayDate(value: string | null | undefined): string {
  if (!value) return 'Não informada';
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return 'Não informada';
  return match[3] + '/' + match[2] + '/' + match[1];
}

function label(code: string, name: string): string {
  const normalizedCode = safe(code);
  const normalizedName = safe(name);
  return normalizedName === normalizedCode ? normalizedCode : normalizedCode + ' - ' + normalizedName;
}

function compare(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

function validateAndProject(input: SeparationSheetPdfInput): PrintableParcel[] {
  const { sheet, request, depots, locations } = input;
  const plan = sheet.plan;

  if (sheet.schemaVersion !== ALMOX_SHEET_SCHEMA_VERSION ||
      plan.schemaVersion !== ALMOX_PLAN_SCHEMA_VERSION ||
      request.schemaVersion !== ALMOX_REQUEST_SCHEMA_VERSION ||
      sheet.auxiliaryDocumentNotice !== NOTICE) {
    throw new Error('ALMOX_SEPARATION_PDF_INVALID_CONTRACT');
  }
  if (!sheet.workspaceId || !sheet.sheetId || !sheet.planId || !sheet.requestId ||
      !sheet.organizationName || !sheet.requestingUnit ||
      sheet.planId !== plan.planId || sheet.requestId !== request.requestId ||
      plan.requestId !== sheet.requestId || plan.workspaceId !== sheet.workspaceId ||
      request.workspaceId !== sheet.workspaceId ||
      plan.revision !== sheet.planRevision ||
      sheet.externalRequestNumber !== request.externalRequestNumber ||
      plan.status === 'CANCELLED') {
    throw new Error('ALMOX_SEPARATION_PDF_IDENTITY_MISMATCH');
  }
  if (plan.rows.length === 0) throw new Error('ALMOX_SEPARATION_PDF_EMPTY');

  const bySourceRow = new Map<string, Readonly<RequestLineV1>>();
  for (const row of request.rows) {
    if (bySourceRow.has(row.sourceRowId)) throw new Error('ALMOX_SEPARATION_PDF_DUPLICATE_ROW');
    bySourceRow.set(row.sourceRowId, row);
  }

  const depotById = new Map<string, (typeof depots)[number]>();
  for (const depot of depots) {
    if (depot.workspaceId !== sheet.workspaceId) throw new Error('ALMOX_SEPARATION_PDF_CROSS_WORKSPACE');
    depotById.set(depot.id, depot);
  }
  const locationById = new Map<string, (typeof locations)[number]>();
  for (const location of locations) {
    if (location.workspaceId !== sheet.workspaceId) throw new Error('ALMOX_SEPARATION_PDF_CROSS_WORKSPACE');
    locationById.set(location.id, location);
  }

  function readPosition(position: WarehouseStockPosition): PrintableParcel['location'] {
    if (position.kind === 'UNASSIGNED') throw new Error('ALMOX_SEPARATION_PDF_UNASSIGNED_POSITION');
    const depot = depotById.get(position.depotId);
    const local = locationById.get(position.locationId);
    if (!depot || !local || local.depotId !== depot.id || local.kind !== 'LOCAL') {
      throw new Error('ALMOX_SEPARATION_PDF_POSITION_NOT_FOUND');
    }
    let subposition = '—';
    if (position.kind === 'SUBPOSITION') {
      const sub = locationById.get(position.subpositionId);
      if (!sub || sub.kind !== 'SUBPOSITION' || sub.depotId !== depot.id ||
          sub.parentLocationId !== local.id) {
        throw new Error('ALMOX_SEPARATION_PDF_POSITION_NOT_FOUND');
      }
      subposition = label(sub.code, sub.name);
    }
    return { depot: label(depot.code, depot.name), local: label(local.code, local.name), subposition };
  }

  const parcels: PrintableParcel[] = [];
  let sequence = 0;
  const planRowIds = new Set<string>();
  for (const planRow of plan.rows) {
    const source = bySourceRow.get(planRow.sourceRowId);
    if (!source || planRowIds.has(planRow.sourceRowId) ||
        !Number.isFinite(planRow.requestedBaseQuantity) ||
        !Number.isFinite(planRow.plannedBaseQuantity) ||
        planRow.plannedBaseQuantity < 0 || planRow.requestedBaseQuantity < 0 ||
        planRow.plannedBaseQuantity > planRow.requestedBaseQuantity + TOLERANCE) {
      throw new Error('ALMOX_SEPARATION_PDF_INVALID_LINE');
    }
    planRowIds.add(planRow.sourceRowId);
    const allocations = planRow.allocations;
    const plannedTotal = allocations.reduce((sum, allocation) => {
      if (!Number.isFinite(allocation.plannedBaseQuantity) || allocation.plannedBaseQuantity <= 0) {
        throw new Error('ALMOX_SEPARATION_PDF_INVALID_ALLOCATION');
      }
      return sum + allocation.plannedBaseQuantity;
    }, 0);
    if (Math.abs(plannedTotal - planRow.plannedBaseQuantity) > TOLERANCE) {
      throw new Error('ALMOX_SEPARATION_PDF_ALLOCATION_SUM_MISMATCH');
    }
    if (!allocations.length) {
      parcels.push({ planRow, requestRow: source, location: null,
        plannedParcel: 0, sequence: sequence++, allocationId: null });
    }
    for (const allocation of allocations) {
      parcels.push({ planRow, requestRow: source,
        location: readPosition(allocation.position.position),
        plannedParcel: allocation.plannedBaseQuantity,
        sequence: sequence++, allocationId: allocation.allocationId });
    }
  }

  // Ordenação física estável; pendências sem posição ficam no final.
  return parcels.sort((a, b) => {
    if (!a.location) return b.location ? 1 : a.sequence - b.sequence;
    if (!b.location) return -1;
    return compare(a.location.depot, b.location.depot) ||
      compare(a.location.local, b.location.local) ||
      compare(a.location.subposition, b.location.subposition) ||
      compare(safe(a.requestRow.sourceItemCode), safe(b.requestRow.sourceItemCode)) ||
      a.sequence - b.sequence;
  });
}

function documentFilename(sheet: SeparationSheetV1): string {
  const part = sheet.sheetId.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80) || 'ficha';
  return 'EMPROVEX_Ficha_Separacao_' + part + '.pdf';
}

function printHeader(doc: JsPDF, input: SeparationSheetPdfInput, continuation: boolean): number {
  const { sheet } = input;
  doc.setTextColor(15);
  doc.setDrawColor(70);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('EMPROVEX | ALMOXARIFADO', LEFT, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('FICHA DE SEPARAÇÃO DE MATERIAL' + (continuation ? ' - CONTINUAÇÃO' : ''),
    LEFT, 18);

  doc.setFontSize(7.5);
  const rows = [
    'OM: ' + safe(sheet.organizationName) + '    SETOR: ' + safe(input.almoxarifadoName || 'Almoxarifado'),
    'FICHA: ' + safe(sheet.sheetId) + '    PLANO: ' + safe(sheet.planId) +
      ' / revisão ' + String(sheet.planRevision),
    'PEDIDO SISCOFIS: ' + safe(sheet.externalRequestNumber) + '    SOLICITANTE: ' + safe(sheet.requestingUnit),
    'DATA DO PEDIDO: ' + displayDate(input.request.referenceDate) +
      '    EMISSÃO: ' + displayDate(sheet.issuedAt) + '    SITUAÇÃO DO PLANO: ' + safe(sheet.plan.status),
  ];

  let y = 24;
  for (const row of rows) {
    const lines: string[] = doc.splitTextToSize(row, CONTENT);
    for (const oneLine of lines) {
      doc.text(oneLine, LEFT, y);
      y += 3.7;
    }
  }

  doc.setLineWidth(0.3);
  doc.line(LEFT, y + 1, RIGHT, y + 1);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.text('ROTEIRO FÍSICO | Depósito > local > subposição | quantidades em unidade-base', LEFT, y);
  return y + 6;
}

function printFooters(doc: JsPDF, sheet: SeparationSheetV1): void {
  const count = doc.getNumberOfPages();
  for (let page = 1; page <= count; page += 1) {
    doc.setPage(page);
    doc.setLineWidth(0.2);
    doc.setDrawColor(130);
    doc.line(LEFT, 277, RIGHT, 277);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.setFontSize(7);
    doc.text(NOTICE, LEFT, 281, { maxWidth: CONTENT });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.7);
    doc.text('Ficha ' + safe(sheet.sheetId) + ' | Não é comprovante de entrega ou baixa.',
      LEFT, 288, { maxWidth: CONTENT - 43 });
    doc.text('Página ' + page + ' de ' + count, RIGHT, 288, { align: 'right' });
  }
}

/**
 * Cria somente o PDF, sem .save(), fetch(), escrita operacional ou mutation.
 * O consumidor pode usar doc.output('blob'), doc.save(filename) ou imprimir.
 */
export async function createSeparationSheetPdf(
  input: SeparationSheetPdfInput
): Promise<SeparationSheetPdfDocument> {
  const parcels = validateAndProject(input);
  const JsPdf = await loadJsPdf();
  const doc = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  let y = printHeader(doc, input, false);

  function nextPage(): void {
    doc.addPage();
    y = printHeader(doc, input, true);
  }
  function reserve(mm: number): void {
    if (y + mm > BOTTOM) nextPage();
  }
  function wrapped(value: string, fontSize = 7.5, indent = 0, bold = false): void {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    const lines: string[] = doc.splitTextToSize(safe(value), CONTENT - indent);
    const lineHeight = fontSize <= 7 ? 3.3 : 3.8;
    for (const line of lines) {
      reserve(lineHeight + 1);
      doc.text(line, LEFT + indent, y);
      y += lineHeight;
    }
  }
  function section(title: string): void {
    reserve(11);
    y += 2;
    doc.setFillColor(235, 235, 235);
    doc.rect(LEFT, y - 3, CONTENT, 7, 'F');
    doc.setTextColor(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(title, LEFT + 2, y + 1.7, { maxWidth: CONTENT - 4 });
    y += 8;
  }

  let currentDepot: string | null = null;
  for (const [index, parcel] of parcels.entries()) {
    const { planRow, requestRow, location } = parcel;
    const depotName = location?.depot || 'SEM POSIÇÃO - PENDÊNCIA';
    if (currentDepot !== depotName) {
      section('DEPÓSITO: ' + depotName);
      currentDepot = depotName;
    }

    reserve(24);
    doc.setDrawColor(175);
    doc.line(LEFT, y - 1, RIGHT, y - 1);
    wrapped(String(index + 1) + '. CÓDIGO: ' + safe(requestRow.sourceItemCode) +
      '  |  LINHA DO PEDIDO: ' + safe(planRow.sourceRowId), 7.6, 0, true);
    wrapped('MATERIAL: ' + safe(requestRow.description), 7.6);
    wrapped('LOCAL: ' + (location ? location.local : 'Não atribuído') +
      '   |   SUBPOSIÇÃO: ' + (location ? location.subposition : 'Não atribuída'), 7.2);
    wrapped('SOLICITADA: ' + displayQuantity(planRow.requestedBaseQuantity) +
      '  |  PLANEJADA: ' + displayQuantity(planRow.plannedBaseQuantity) +
      '  |  PARCELA: ' + displayQuantity(parcel.plannedParcel), 7.7, 0, true);
    wrapped('UNIDADE DA ORIGEM: ' + safe(requestRow.sourceUnit) +
      '  |  ID PARCELA: ' + safe(parcel.allocationId), 7);
    wrapped('[ ] Separado   Quantidade conferida: __________   Falta física: __________', 7.1);
    wrapped('Divergência / observação: ________________________________________________________', 7);
    y += 3;
  }

  section('FALTAS E PENDÊNCIAS DO PLANEJAMENTO');
  const uniqueRows = new Map(input.sheet.plan.rows.map(row => [row.sourceRowId, row]));
  let hasPending = false;
  for (const row of uniqueRows.values()) {
    const missing = Math.max(0, row.requestedBaseQuantity - row.plannedBaseQuantity);
    if (missing > TOLERANCE) {
      hasPending = true;
      wrapped('Linha ' + safe(row.sourceRowId) + ': falta planejada de ' +
        displayQuantity(missing) + ' unidade(s)-base.', 7.4);
    }
    for (const issue of row.issues) {
      hasPending = true;
      wrapped('Linha ' + safe(row.sourceRowId) + ': ' + formatIssue(issue), 7.1);
    }
  }
  for (const issue of input.sheet.plan.issues) {
    hasPending = true;
    wrapped('Plano: ' + formatIssue(issue), 7.1);
  }
  if (!hasPending) wrapped('Não há faltas nem pendências informadas no plano.', 7.4);

  section('CONFERÊNCIA MANUAL DA SEPARAÇÃO');
  wrapped('Separado por: _____________________________________  Data: ____/____/________  Hora: ____:____', 7.5);
  wrapped('Conferido por: ____________________________________  Data: ____/____/________  Hora: ____:____', 7.5);
  wrapped('Responsável pela emissão: ' + safe(input.issuedByName || input.sheet.issuedByUid), 7.4);
  wrapped('Conferência final: [ ] Sem divergências    [ ] Com divergências / faltas', 7.4);
  wrapped('Observações: ______________________________________________________________________________', 7.2);
  wrapped('____________________________________________________________________________________________', 7.2);

  printFooters(doc, input.sheet);
  return {
    doc,
    filename: documentFilename(input.sheet),
    mimeType: 'application/pdf',
    pageCount: doc.getNumberOfPages(),
    sourceSheetId: input.sheet.sheetId,
  };
}

function formatIssue(issue: TypedIssueV1): string {
  return safe(issue.code) + ' (' + safe(issue.severity) + ')' +
    (issue.details ? ': ' + safe(issue.details) : '');
}
