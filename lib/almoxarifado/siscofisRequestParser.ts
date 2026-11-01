/**
 * W2 R1-A — normalização isolada do Pedido de Material SISCOFIS.
 * SOMENTE layout sintético documentado. Nenhum layout real foi homologado.
 * Não consulta nem altera estoque; a autorização e o workspace vêm do servidor.
 */
import { createHash } from 'node:crypto';
import {
  ALMOX_REQUEST_SCHEMA_VERSION,
  type ImportedRequestV1,
  type RequestLineV1,
  type SourceFormatV1,
  type TypedIssueCodeV1,
  type TypedIssueV1,
} from './contracts';

export const SYNTHETIC_REQUEST_LAYOUT = 'EMPROVEX_SISCOFIS_REQUEST_SYNTHETIC_R1' as const;
export const MAX_REQUEST_SOURCE_BYTES = 2 * 1024 * 1024;
export const MAX_REQUEST_LINES = 1000;
const MAX_ITEMS = 250;
const MAX_LINE_LENGTH = 512;

export interface RequestImportOptions {
  /** Resolvido e autorizado no servidor, jamais a partir do PDF/TXT. */
  workspaceId: string;
  originalFilename?: string | null;
  /** Apenas registros previamente consultados NO MESMO workspace no servidor. */
  previousImports?: ReadonlyArray<Pick<ImportedRequestV1, 'workspaceId' | 'externalRequestNumber' | 'source'>>;
}
export interface RequestImportInput extends RequestImportOptions {
  bytes: Uint8Array;
}
export type RequestParseResult =
  | { ok: true; data: ImportedRequestV1 }
  | { ok: false; issue: TypedIssueV1 };

export interface RequestTextLine {
  sourceRowId: string;
  text: string;
}

export function requestFailure(
  code: TypedIssueCodeV1,
  details: string,
  sourceRowId?: string
): RequestParseResult {
  return { ok: false, issue: { code, severity: 'BLOCKING', details, ...(sourceRowId ? { sourceRowId } : {}) } };
}

export function sha256OfRequest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function validateImportInput(input: RequestImportInput): RequestParseResult | null {
  if (
    !input
    || !(input.bytes instanceof Uint8Array)
    || input.bytes.byteLength === 0
    || input.bytes.byteLength > MAX_REQUEST_SOURCE_BYTES
  ) {
    return requestFailure('UNREADABLE_SOURCE', 'Arquivo vazio, inválido ou acima do limite de 2 MiB.');
  }
  if (
    typeof input.workspaceId !== 'string'
    || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.workspaceId)
  ) {
    return requestFailure('CROSS_WORKSPACE_ACCESS', 'Contexto de workspace inválido; resolver autorização no servidor.');
  }
  if (input.previousImports?.some(item => item.workspaceId !== input.workspaceId)) {
    return requestFailure('CROSS_WORKSPACE_ACCESS', 'A consulta de reimportações deve ser isolada por workspace.');
  }
  return null;
}

function normalized(value: string): string {
  return value.normalize('NFC').trim().replace(/[ \t]+/g, ' ');
}

function field(value: string, max = 160): string | null {
  const text = normalized(value);
  return text.length > 0 && text.length <= max && !/[\u0000-\u001F\u007F]/.test(text) ? text : null;
}

function validDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const d = Number(match[1]), m = Number(match[2]), y = Number(match[3]);
  const actual = new Date(Date.UTC(y, m - 1, d));
  return actual.getUTCFullYear() === y && actual.getUTCMonth() === m - 1
    && actual.getUTCDate() === d ? match[3] + '-' + match[2] + '-' + match[1] : null;
}

function requestedQuantity(text: string): number | null {
  // Separador decimal brasileiro sempre vírgula. Ponto isolado é ambíguo e bloqueado.
  if (!/^(?:[1-9]\d*|0|[1-9]\d{0,2}(?:\.\d{3})+)(?:,\d{1,3})?$/.test(text)) return null;
  const value = Number(text.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(value) && value > 0 && value <= 1_000_000_000 ? value : null;
}

const KNOWN_UNITS = new Set([
  'UN', 'UND', 'UNIDADE', 'KG', 'G', 'L', 'ML', 'M', 'M2', 'M3',
  'CX', 'PCT', 'RESMA', 'ROLO', 'FRASCO', 'PAR', 'PC',
]);

function unit(value: string): string | null {
  const text = normalized(value).toUpperCase();
  return KNOWN_UNITS.has(text) ? text : null;
}

function lineIssue(code: TypedIssueCodeV1, detail: string, line: RequestTextLine): RequestParseResult {
  return requestFailure(code, detail, line.sourceRowId);
}

function verifyExisting(
  input: RequestImportOptions,
  sha: string,
  externalNumber: string
): RequestParseResult | null {
  const previous = input.previousImports ?? [];
  if (previous.some(entry => entry.source.sha256 === sha)) {
    return requestFailure('DUPLICATE_REQUEST', 'Arquivo já importado neste workspace. A importação não deve gerar novo pedido.');
  }
  if (previous.some(entry => entry.externalRequestNumber === externalNumber)) {
    return requestFailure('IDEMPOTENCY_CONFLICT', 'Mesmo número de pedido, porém arquivo diferente. Revisão requer aprovação e diff no integrador W5.');
  }
  return null;
}

/** Mantém sourceRowId físico, inclusive quando códigos de material se repetem. */
export function parseRequestTextLines(
  input: RequestImportInput,
  format: SourceFormatV1,
  lines: readonly RequestTextLine[]
): RequestParseResult {
  const invalid = validateImportInput(input);
  if (invalid) return invalid;
  if (!Array.isArray(lines) || lines.length < 5 || lines.length > MAX_REQUEST_LINES) {
    return requestFailure('UNREADABLE_SOURCE', 'Documento vazio ou excedeu o limite de linhas.');
  }
  if (lines.some(line => !line || !line.sourceRowId || line.text.length > MAX_LINE_LENGTH
    || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(line.text))) {
    return requestFailure('UNREADABLE_SOURCE', 'Linha ilegível ou excede o limite seguro.');
  }
  const dataLines = lines.filter(line => normalized(line.text) !== '');
  if (dataLines[0]?.text.trim() !== 'SISCOFIS|PEDIDO_DE_MATERIAL|EMPROVEX_FIXTURE_R1') {
    return requestFailure('UNSUPPORTED_LAYOUT', 'Layout não homologado. Somente fixture sintética R1 suportada nesta fase.');
  }

  let pedido: string | null = null;
  let solicitante: string | null = null;
  let date: string | null = null;
  let status: string | null = null;
  let heading = -1;
  const seen = new Set<string>();
  for (let i = 1; i < dataLines.length; i += 1) {
    const line = dataLines[i];
    if (line.text.startsWith('Item|')) { heading = i; break; }
    const match = /^(Pedido|Solicitante|Data|Situacao):\s*(.*)$/.exec(line.text.trim());
    if (!match || seen.has(match[1])) return lineIssue('UNSUPPORTED_LAYOUT', 'Cabeçalho desconhecido ou duplicado.', line);
    seen.add(match[1]);
    if (match[1] === 'Pedido') pedido = field(match[2], 80);
    if (match[1] === 'Solicitante') solicitante = field(match[2]);
    if (match[1] === 'Data') {
      date = validDate(match[2].trim());
      if (!date) return lineIssue('UNSUPPORTED_LAYOUT', 'Data inválida no cabeçalho.', line);
    }
    if (match[1] === 'Situacao') {
      status = field(match[2], 80);
      if (!status) return lineIssue('UNSUPPORTED_LAYOUT', 'Situação ilegível.', line);
    }
  }
  if (!pedido) return requestFailure('MISSING_REQUEST_ID', 'Número de pedido ausente ou inválido.');
  if (!/^[A-Za-z0-9][A-Za-z0-9./_-]{0,79}$/.test(pedido)) {
    return requestFailure('MISSING_REQUEST_ID', 'Número de pedido contém caracteres incompatíveis.');
  }
  if (!solicitante) return requestFailure('MISSING_REQUESTING_UNIT', 'Dependência solicitante ausente ou inválida.');
  if (heading < 0) return requestFailure('UNSUPPORTED_LAYOUT', 'Tabela de itens não identificada.');

  const tableHeading = dataLines[heading].text.trim();
  const quantityMeaning = tableHeading === 'Item|Codigo|Descricao|Qtd Solicitada|Unidade'
    ? 'REQUESTED'
    : tableHeading === 'Item|Codigo|Descricao|Qtd Autorizada|Unidade' ? 'AUTHORIZED' : null;
  if (!quantityMeaning) {
    return lineIssue('UNKNOWN_QUANTITY_MEANING', 'Coluna de quantidade desconhecida ou ambígua.', dataLines[heading]);
  }
  const rows: RequestLineV1[] = [];
  const identifiers = new Set<string>();
  let ended = false;
  for (const line of dataLines.slice(heading + 1)) {
    if (line.text.trim() === 'FIM_ITENS') {
      ended = true;
      continue;
    }
    if (ended) return lineIssue('UNSUPPORTED_LAYOUT', 'Conteúdo desconhecido após o fim da tabela.', line);
    const parts = line.text.split('|').map(part => part.trim());
    if (parts.length !== 5 || !/^\d{1,5}$/.test(parts[0])
      || identifiers.has(parts[0])) {
      return lineIssue('UNSUPPORTED_LAYOUT', 'Linha de item ambígua ou identificador repetido.', line);
    }
    identifiers.add(parts[0]);
    const code = field(parts[1], 64);
    const description = field(parts[2], 240);
    if (!code || !/^[A-Za-z0-9][A-Za-z0-9./_-]{0,63}$/.test(code) || !description) {
      return lineIssue('MATERIAL_UNRESOLVED', 'Código ou descrição do material ausente/inválido.', line);
    }
    const qty = requestedQuantity(parts[3]);
    if (qty === null) return lineIssue('INVALID_QUANTITY', 'Quantidade inválida ou ambígua.', line);
    const sourceUnit = unit(parts[4]);
    if (!sourceUnit) return lineIssue('UNIT_INCOMPATIBLE', 'Unidade desconhecida; não inferir conversões.', line);
    if (rows.length >= MAX_ITEMS) return lineIssue('UNSUPPORTED_LAYOUT', 'Mais de 250 itens no documento.', line);
    rows.push({
      sourceRowId: line.sourceRowId, sourceText: line.text,
      sourceItemCode: code, description, sourceQuantity: qty,
      quantityMeaning, sourceUnit, canonicalMaterialId: null,
      factorToBaseUnit: null, canonicalQuantity: null, matchStatus: 'UNRESOLVED',
    });
  }
  if (!ended || rows.length === 0) {
    return requestFailure('UNSUPPORTED_LAYOUT', 'Tabela incompleta, sem itens ou sem terminador.');
  }
  const sha = sha256OfRequest(input.bytes);
  const existingIssue = verifyExisting(input, sha, pedido);
  if (existingIssue) return existingIssue;
  const requestId = 'almoxreq_' + createHash('sha256')
    .update(input.workspaceId + '\u0000' + sha).digest('hex').slice(0, 32);
  return {
    ok: true,
    data: {
      schemaVersion: ALMOX_REQUEST_SCHEMA_VERSION,
      requestId, workspaceId: input.workspaceId,
      source: {
        system: 'SISCOFIS', format, sha256: sha, layoutId: SYNTHETIC_REQUEST_LAYOUT,
        originalFilename: input.originalFilename ?? null,
      },
      externalRequestNumber: pedido, requestingUnit: solicitante,
      referenceDate: date, officialStatus: status, revision: 1,
      rows,
      issues: rows.map(row => ({
        code: 'MATERIAL_UNRESOLVED' as const, severity: 'WARNING' as const,
        sourceRowId: row.sourceRowId,
        details: 'Correspondência canônica e conversão de unidade dependem de conferência humana.',
      })),
    },
  };
}
