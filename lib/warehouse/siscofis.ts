import {
  createWarehouseMaterial,
  isValidWarehouseMaterialId,
  normalizeWarehouseMaterialUnit,
  warehouseMaterialUnitKey,
  type WarehouseMaterial,
  type WarehouseMaterialUnit,
} from './material';
import {
  normalizeWarehouseQuantity,
  type WarehouseBalance,
} from './movement';

export const WAREHOUSE_SISCOFIS_IMPORT_SCHEMA_VERSION = 'warehouse_siscofis_import_v1' as const;
export const EMPROVEX_SISCOFIS_INVENTORY_SCHEMA_VERSION = 'emprovex_siscofis_inventory_v1' as const;
export const WAREHOUSE_SISCOFIS_SNAPSHOT_SCHEMA_VERSION_V1 = 'warehouse_siscofis_snapshot_v1' as const;
export const WAREHOUSE_SISCOFIS_SNAPSHOT_SCHEMA_VERSION = 'warehouse_siscofis_snapshot_v2' as const;
export const WAREHOUSE_SISCOFIS_MAX_ROWS = 500;

export type WarehouseSiscofisImportKind = 'MARCO_ZERO' | 'SNAPSHOT';
export type WarehouseSiscofisReconciliationState =
  | 'MATCHED'
  | 'DIVERGENT'
  | 'UNRESOLVED';

export interface WarehouseSiscofisImportRow {
  rowId: string;
  materialId: string | null;
  description: string;
  unit: WarehouseMaterialUnit;
  quantity: number;
  unitValue: number | null;
  totalValue: number | null;
  sourceItemNumber?: string | null;
}

export interface WarehouseSiscofisImport {
  schemaVersion: typeof WAREHOUSE_SISCOFIS_IMPORT_SCHEMA_VERSION;
  ug: string;
  referenceDate: string;
  sourceLabel: string;
  rows: WarehouseSiscofisImportRow[];
}

export interface WarehouseSiscofisIssue {
  severity: 'error' | 'warning';
  code: string;
  path: string;
  message: string;
}

export interface WarehouseSiscofisValidationResult {
  ok: boolean;
  data: WarehouseSiscofisImport | null;
  issues: WarehouseSiscofisIssue[];
}

export interface WarehouseSiscofisPreviewRow {
  rowId: string;
  materialId: string | null;
  description: string;
  unit: WarehouseMaterialUnit;
  siscofisQuantity: number;
  emprovexQuantity: number;
  projectedQuantity: number;
  difference: number;
  state: WarehouseSiscofisReconciliationState;
  createsMaterial: boolean;
  issue: string | null;
  sourceItemNumber?: string | null;
}

export interface WarehouseSiscofisPreview {
  kind: WarehouseSiscofisImportKind;
  import: WarehouseSiscofisImport;
  sourceHash: string;
  cutoffAt: string | null;
  canConfirm: boolean;
  issues: WarehouseSiscofisIssue[];
  rows: WarehouseSiscofisPreviewRow[];
  summary: {
    totalRows: number;
    matchedRows: number;
    unresolvedRows: number;
    divergentRows: number;
    createsMaterials: number;
  };
}

type UnknownObject = Record<string, unknown>;

const ROOT_FIELDS = new Set(['schemaVersion', 'ug', 'referenceDate', 'sourceLabel', 'rows']);
const ROW_FIELDS = new Set([
  'rowId',
  'materialId',
  'description',
  'unit',
  'quantity',
  'unitValue',
  'totalValue',
]);

function isPlainObject(value: unknown): value is UnknownObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyFields(value: UnknownObject, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function lookupText(value: string): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function pushIssue(
  issues: WarehouseSiscofisIssue[],
  severity: WarehouseSiscofisIssue['severity'],
  code: string,
  path: string,
  message: string
): void {
  issues.push({ severity, code, path, message });
}

function normalizeMoney(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  const rounded = Math.round(value * 100) / 100;
  return Math.abs(rounded - value) <= 1e-9 ? rounded : undefined;
}

function parseReferenceDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const parsed = Date.parse(normalized + 'T00:00:00.000Z');
  if (!Number.isFinite(parsed)) return null;
  const reconstructed = new Date(parsed).toISOString().slice(0, 10);
  return reconstructed === normalized ? normalized : null;
}

function materialLookupKey(description: string, unit: WarehouseMaterialUnit): string {
  return lookupText(description) + '|' + warehouseMaterialUnitKey(unit);
}

export function parseWarehouseSiscofisJson(
  raw: string,
  expectedUg?: string
): WarehouseSiscofisValidationResult {
  const issues: WarehouseSiscofisIssue[] = [];
  let input: unknown;

  try {
    input = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      data: null,
      issues: [{
        severity: 'error',
        code: 'invalid_json',
        path: '$',
        message: 'O conteúdo não é um JSON válido.',
      }],
    };
  }

  if (!isPlainObject(input)) {
    return {
      ok: false,
      data: null,
      issues: [{
        severity: 'error',
        code: 'invalid_root',
        path: '$',
        message: 'A importação deve ser um objeto JSON.',
      }],
    };
  }

  if (!hasOnlyFields(input, ROOT_FIELDS)) {
    pushIssue(
      issues,
      'error',
      'unexpected_root_field',
      '$',
      'O JSON possui campos não previstos no contrato versionado.'
    );
  }

  if (input.schemaVersion !== WAREHOUSE_SISCOFIS_IMPORT_SCHEMA_VERSION) {
    pushIssue(
      issues,
      'error',
      'invalid_schema_version',
      '$.schemaVersion',
      'schemaVersion deve ser warehouse_siscofis_import_v1.'
    );
  }

  const ug = typeof input.ug === 'string' ? input.ug.trim() : '';
  if (!/^\d{6}$/.test(ug)) {
    pushIssue(issues, 'error', 'invalid_ug', '$.ug', 'UG deve possuir 6 dígitos.');
  } else if (expectedUg && ug !== expectedUg.trim()) {
    pushIssue(
      issues,
      'error',
      'ug_mismatch',
      '$.ug',
      'A UG do relatório não corresponde ao workspace autenticado.'
    );
  }

  const referenceDate = parseReferenceDate(input.referenceDate);
  if (!referenceDate) {
    pushIssue(
      issues,
      'error',
      'invalid_reference_date',
      '$.referenceDate',
      'referenceDate deve usar o formato YYYY-MM-DD.'
    );
  } else if (
    Date.parse(referenceDate + 'T00:00:00.000Z')
      > Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')
  ) {
    pushIssue(
      issues,
      'error',
      'future_reference_date',
      '$.referenceDate',
      'A data-base do SISCOFIS não pode estar no futuro.'
    );
  }

  const sourceLabel =
    typeof input.sourceLabel === 'string' ? normalizeText(input.sourceLabel) : '';
  if (!sourceLabel || sourceLabel.length > 120) {
    pushIssue(
      issues,
      'error',
      'invalid_source_label',
      '$.sourceLabel',
      'sourceLabel deve possuir entre 1 e 120 caracteres.'
    );
  }

  const rows: WarehouseSiscofisImportRow[] = [];
  const rowIds = new Set<string>();
  const explicitMaterialIds = new Set<string>();

  if (
    !Array.isArray(input.rows)
    || input.rows.length < 1
    || input.rows.length > WAREHOUSE_SISCOFIS_MAX_ROWS
  ) {
    pushIssue(
      issues,
      'error',
      'invalid_rows',
      '$.rows',
      'rows deve conter entre 1 e ' + WAREHOUSE_SISCOFIS_MAX_ROWS + ' linhas.'
    );
  } else {
    input.rows.forEach((candidate, index) => {
      const path = '$.rows[' + index + ']';
      if (!isPlainObject(candidate) || !hasOnlyFields(candidate, ROW_FIELDS)) {
        pushIssue(
          issues,
          'error',
          'invalid_row_shape',
          path,
          'A linha possui estrutura ou campos fora do contrato.'
        );
        return;
      }

      const rowId =
        typeof candidate.rowId === 'string' ? normalizeText(candidate.rowId) : '';
      if (!rowId || rowId.length > 80 || /[\u0000-\u001f\u007f/]/.test(rowId)) {
        pushIssue(
          issues,
          'error',
          'invalid_row_id',
          path + '.rowId',
          'rowId deve ser um identificador textual simples de até 80 caracteres.'
        );
      } else if (rowIds.has(rowId)) {
        pushIssue(
          issues,
          'error',
          'duplicate_row_id',
          path + '.rowId',
          'rowId duplicado dentro da mesma importação.'
        );
      } else {
        rowIds.add(rowId);
      }

      let materialId: string | null = null;
      if (candidate.materialId !== null && candidate.materialId !== undefined) {
        if (!isValidWarehouseMaterialId(candidate.materialId)) {
          pushIssue(
            issues,
            'error',
            'invalid_material_id',
            path + '.materialId',
            'materialId deve ser nulo ou apontar para um material canônico mat_<32 hex>.'
          );
        } else {
          materialId = candidate.materialId;
          if (explicitMaterialIds.has(materialId)) {
            pushIssue(
              issues,
              'warning',
              'repeated_material_id',
              path + '.materialId',
              'O mesmo material canônico aparece em mais de uma linha e será agregado.'
            );
          }
          explicitMaterialIds.add(materialId);
        }
      }

      const description =
        typeof candidate.description === 'string'
          ? normalizeText(candidate.description)
          : '';
      if (!description || description.length > 240) {
        pushIssue(
          issues,
          'error',
          'invalid_description',
          path + '.description',
          'Descrição deve possuir entre 1 e 240 caracteres.'
        );
      }

      const unit = normalizeWarehouseMaterialUnit(candidate.unit);
      if (!unit) {
        pushIssue(
          issues,
          'error',
          'invalid_unit',
          path + '.unit',
          'Unidade inválida. Para apresentação desconhecida use code=other e informe label.'
        );
      }

      const quantity = normalizeWarehouseQuantity(candidate.quantity);
      if (quantity === null || quantity < 0) {
        pushIssue(
          issues,
          'error',
          'invalid_quantity',
          path + '.quantity',
          'Quantidade deve ser finita, não negativa e possuir até 6 casas decimais.'
        );
      }

      const unitValue = normalizeMoney(candidate.unitValue);
      if (unitValue === undefined) {
        pushIssue(
          issues,
          'error',
          'invalid_unit_value',
          path + '.unitValue',
          'unitValue deve ser nulo ou um valor monetário não negativo com até 2 casas.'
        );
      }

      const totalValue = normalizeMoney(candidate.totalValue);
      if (totalValue === undefined) {
        pushIssue(
          issues,
          'error',
          'invalid_total_value',
          path + '.totalValue',
          'totalValue deve ser nulo ou um valor monetário não negativo com até 2 casas.'
        );
      }

      if (
        quantity !== null
        && quantity >= 0
        && unitValue !== undefined
        && unitValue !== null
        && totalValue !== undefined
        && totalValue !== null
      ) {
        const expected = Math.round(quantity * unitValue * 100) / 100;
        if (Math.abs(expected - totalValue) > 0.02) {
          pushIssue(
            issues,
            'warning',
            'value_inconsistency',
            path + '.totalValue',
            'Valor total diverge de quantidade × valor unitário; confira a linha antes de confirmar.'
          );
        }
      }

      if (
        rowId
        && description
        && unit
        && quantity !== null
        && quantity >= 0
        && unitValue !== undefined
        && totalValue !== undefined
      ) {
        rows.push({
          rowId,
          materialId,
          description,
          unit,
          quantity,
          unitValue,
          totalValue,
        });
      }
    });
  }

  const hasErrors = issues.some((item) => item.severity === 'error');
  if (hasErrors || !referenceDate || !sourceLabel || !/^\d{6}$/.test(ug)) {
    return { ok: false, data: null, issues };
  }

  return {
    ok: true,
    issues,
    data: {
      schemaVersion: WAREHOUSE_SISCOFIS_IMPORT_SCHEMA_VERSION,
      ug,
      referenceDate,
      sourceLabel,
      rows,
    },
  };
}

export async function hashWarehouseSiscofisImport(
  input: WarehouseSiscofisImport
): Promise<string> {
  const canonical = JSON.stringify({
    schemaVersion: input.schemaVersion,
    ug: input.ug,
    referenceDate: input.referenceDate,
    sourceLabel: input.sourceLabel,
    rows: input.rows.map((row) => ({
      rowId: row.rowId,
      materialId: row.materialId,
      description: row.description,
      unit: row.unit,
      quantity: row.quantity,
      unitValue: row.unitValue,
      totalValue: row.totalValue,
      sourceItemNumber: row.sourceItemNumber ?? null,
    })),
  });
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonical)
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function deriveSiscofisMarcoZeroMaterialId(
  workspaceId: string,
  description: string,
  unit: WarehouseMaterialUnit
): Promise<string> {
  const payload = [
    workspaceId.trim().toLowerCase(),
    'SISCOFIS_MARCO_ZERO',
    lookupText(description),
    warehouseMaterialUnitKey(unit),
  ].join('\n');
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(payload)
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return 'mat_' + hex.slice(0, 32);
}

export function createMaterialFromSiscofisRow(input: {
  workspaceId: string;
  ug: string;
  materialId: string;
  row: WarehouseSiscofisImportRow;
}): WarehouseMaterial {
  const result = createWarehouseMaterial({
    id: input.materialId,
    workspaceId: input.workspaceId,
    ug: input.ug,
    description: input.row.description,
    aliases: [],
    unit: input.row.unit,
    status: 'active',
    conversions: [],
  });
  if (!result.ok) {
    throw new Error(
      'WAREHOUSE_SISCOFIS_INVALID_MATERIAL: '
      + result.issues.map((item) => item.path + ': ' + item.message).join('; ')
    );
  }
  return result.data;
}


export interface EmprovexSiscofisInventoryItem {
  numeroItem: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
}

export interface EmprovexSiscofisInventory {
  schemaVersion: typeof EMPROVEX_SISCOFIS_INVENTORY_SCHEMA_VERSION;
  items: EmprovexSiscofisInventoryItem[];
}

export interface EmprovexSiscofisInventoryValidationResult {
  ok: boolean;
  data: EmprovexSiscofisInventory | null;
  issues: WarehouseSiscofisIssue[];
}

const EXTERNAL_ROOT_FIELDS = new Set(['schemaVersion', 'items']);
const EXTERNAL_ITEM_FIELDS = new Set(['numeroItem', 'descricao', 'quantidade', 'valorUnitario']);

function parseLegacyBrazilianMoney(value: string): number | null {
  const text = value.trim();
  if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+),\d{1,2}$/.test(text)) return null;
  const parsed = Number(text.replace(/\./g, '').replace(',', '.'));
  const normalized = normalizeMoney(parsed);
  return normalized === undefined || normalized === null ? null : normalized;
}

export function parseEmprovexSiscofisInventoryJson(raw: string): EmprovexSiscofisInventoryValidationResult {
  const issues: WarehouseSiscofisIssue[] = [];
  let input: unknown;
  try { input = JSON.parse(raw); } catch {
    return { ok: false, data: null, issues: [{ severity: 'error', code: 'invalid_json', path: '$', message: 'O conteúdo não é um JSON válido.' }] };
  }
  if (Array.isArray(input)) {
    input = { schemaVersion: EMPROVEX_SISCOFIS_INVENTORY_SCHEMA_VERSION, items: input };
    pushIssue(issues, 'warning', 'legacy_root_array', '$', 'Array legado normalizado para o contrato oficial.');
  }
  if (!isPlainObject(input) || !hasOnlyFields(input, EXTERNAL_ROOT_FIELDS)) {
    return { ok: false, data: null, issues: [...issues, { severity: 'error', code: 'invalid_external_root', path: '$', message: 'A raiz deve conter somente schemaVersion e items.' }] };
  }
  if (input.schemaVersion !== EMPROVEX_SISCOFIS_INVENTORY_SCHEMA_VERSION) {
    pushIssue(issues, 'error', 'invalid_external_schema', '$.schemaVersion', 'schemaVersion deve ser emprovex_siscofis_inventory_v1.');
  }
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > WAREHOUSE_SISCOFIS_MAX_ROWS) {
    pushIssue(issues, 'error', 'invalid_external_items', '$.items', 'items deve conter entre 1 e 500 linhas.');
    return { ok: false, data: null, issues };
  }
  const items: EmprovexSiscofisInventoryItem[] = [];
  const exactRows = new Set<string>();
  input.items.forEach((candidate, index) => {
    const path = '$.items[' + index + ']';
    if (!isPlainObject(candidate) || !hasOnlyFields(candidate, EXTERNAL_ITEM_FIELDS)) {
      pushIssue(issues, 'error', 'invalid_external_item_shape', path, 'Cada item deve conter somente numeroItem, descricao, quantidade e valorUnitario.');
      return;
    }
    const numeroItem = typeof candidate.numeroItem === 'string' ? candidate.numeroItem.trim() : '';
    const descricao = typeof candidate.descricao === 'string' ? normalizeText(candidate.descricao) : '';
    const quantidade = normalizeWarehouseQuantity(candidate.quantidade);
    let valorUnitario = normalizeMoney(candidate.valorUnitario);
    if (typeof candidate.valorUnitario === 'string') {
      const legacy = parseLegacyBrazilianMoney(candidate.valorUnitario);
      if (legacy !== null) {
        valorUnitario = legacy;
        pushIssue(issues, 'warning', 'legacy_brazilian_money', path + '.valorUnitario', 'Valor monetário legado foi normalizado deterministicamente.');
      }
    }
    if (!numeroItem || numeroItem.length > 80 || /[\u0000-\u001f\u007f]/.test(numeroItem)) pushIssue(issues, 'error', 'invalid_numero_item', path + '.numeroItem', 'Nº Ficha deve ser texto não vazio de até 80 caracteres.');
    if (!descricao || descricao.length > 240) pushIssue(issues, 'error', 'invalid_external_description', path + '.descricao', 'Descrição deve possuir entre 1 e 240 caracteres.');
    if (quantidade === null || quantidade <= 0) pushIssue(issues, 'error', 'invalid_external_quantity', path + '.quantidade', 'Quantidade deve ser número finito maior que zero.');
    if (valorUnitario === undefined || valorUnitario === null) pushIssue(issues, 'error', 'invalid_external_unit_value', path + '.valorUnitario', 'Valor unitário deve ser número não negativo com até 2 casas.');
    if (numeroItem && descricao && quantidade !== null && quantidade > 0 && valorUnitario !== undefined && valorUnitario !== null) {
      const signature = JSON.stringify([numeroItem, descricao, quantidade, valorUnitario]);
      if (exactRows.has(signature)) pushIssue(issues, 'warning', 'duplicate_source_row', path, 'Linha exatamente repetida preservada para revisão humana.');
      exactRows.add(signature);
      items.push({ numeroItem, descricao, quantidade, valorUnitario });
    }
  });
  if (issues.some((issue) => issue.severity === 'error')) return { ok: false, data: null, issues };
  return { ok: true, data: { schemaVersion: EMPROVEX_SISCOFIS_INVENTORY_SCHEMA_VERSION, items }, issues };
}

export function adaptEmprovexSiscofisInventory(input: {
  inventory: EmprovexSiscofisInventory;
  ug: string;
  referenceDate: string;
  sourceLabel?: string;
  materials: WarehouseMaterial[];
}): { importData: WarehouseSiscofisImport; issues: WarehouseSiscofisIssue[] } {
  const issues: WarehouseSiscofisIssue[] = [];
  const byDescription = new Map<string, WarehouseMaterial[]>();
  for (const material of input.materials) {
    const key = lookupText(material.description);
    byDescription.set(key, [...(byDescription.get(key) || []), material]);
  }
  const rows: WarehouseSiscofisImportRow[] = input.inventory.items.map((item, index) => {
    const matches = (byDescription.get(lookupText(item.descricao)) || []).filter((material) => material.status === 'active');
    const matched = matches.length === 1 ? matches[0] : null;
    if (matches.length > 1) pushIssue(issues, 'warning', 'ambiguous_material_match', '$.items[' + index + ']', 'Mais de um material canônico possui a mesma descrição; vínculo exige revisão humana.');
    if (!matched) pushIssue(issues, 'warning', 'unit_review_required', '$.items[' + index + ']', 'Material novo/não resolvido: unidade local precisa ser revisada antes da confirmação.');
    return {
      rowId: 'siscofis-' + String(index + 1).padStart(4, '0'),
      materialId: matched?.id || null,
      description: item.descricao,
      unit: matched?.unit || { code: 'unit', label: null },
      quantity: item.quantidade,
      unitValue: item.valorUnitario,
      totalValue: Math.round(item.quantidade * item.valorUnitario * 100) / 100,
      sourceItemNumber: item.numeroItem,
    };
  });
  return {
    importData: {
      schemaVersion: WAREHOUSE_SISCOFIS_IMPORT_SCHEMA_VERSION,
      ug: input.ug,
      referenceDate: input.referenceDate,
      sourceLabel: normalizeText(input.sourceLabel || 'Inventário SISCOFIS — Migração inicial'),
      rows,
    },
    issues,
  };
}

export function buildWarehouseSiscofisPrompt(): string {
  return [
    'PROMPT OFICIAL EMPROVEX — EXTRAÇÃO SISCOFIS',
    '',
    'Você receberá um PDF de inventário ou relatório de materiais emitido pelo SISCOFIS.',
    'Sua tarefa é extrair TODOS os itens materiais do documento e retornar SOMENTE JSON válido compatível com o EMPROVEX.',
    '',
    'Extraia SOMENTE:',
    '1. numeroItem — origem: Nr Ficha',
    '2. descricao — origem: ESPECIFICAÇÃO',
    '3. quantidade — origem: QTDE',
    '4. valorUnitario — origem: VALOR UNITÁRIO',
    '',
    'Estrutura obrigatória:',
    '{"schemaVersion":"emprovex_siscofis_inventory_v1","items":[{"numeroItem":"CODIGO","descricao":"DESCRIÇÃO","quantidade":1,"valorUnitario":10.50}]}',
    '',
    'A raiz deve ser um objeto com somente schemaVersion e items. Cada item deve conter somente os quatro campos acima.',
    'numeroItem: preserve exatamente pontos, letras, zeros à esquerda, prefixos e sufixos; sempre string.',
    'descricao: transcreva fielmente; apenas una quebras de linha e remova espaços duplicados artificiais. Não resuma, corrija ou reescreva.',
    'quantidade: número JSON, nunca string, maior que zero.',
    'valorUnitario: número JSON, nunca string. Converta notação brasileira: 1.944,00 → 1944.00 e 15.231,67 → 15231.67.',
    'NÃO CONSOLIDAR ITENS. Mesmo Nr Ficha e descrição devem permanecer como linhas independentes. Não some, não calcule média, não elimine e não agrupe.',
    'IGNORE NR ORD, conta contábil, unidade de medida, valor total, situação, subtotais, totais, UG, exercício, dependência, responsáveis, datas, cabeçalhos e rodapés.',
    'Use NR ORD apenas internamente para conferir cobertura; nunca o inclua no JSON.',
    'Percorra TODAS as páginas. Não forneça amostra, não trunque, não escreva continua e nunca invente informações.',
    'Se um dos quatro campos realmente não puder ser identificado, use null em vez de adivinhar.',
    'Responda SOMENTE com o objeto JSON: sem Markdown, sem comentários, sem introdução e sem conclusão.',
    'A primeira caractere deve ser { e a última deve ser }.',
    'Antes de responder, confira internamente que todas as páginas e itens foram processados, fichas repetidas continuam separadas, números estão no formato JSON e JSON.parse() aceitaria o conteúdo.',
  ].join('\n');
}

export async function buildWarehouseSiscofisPreview(input: {
  workspaceId: string;
  importData: WarehouseSiscofisImport;
  materials: WarehouseMaterial[];
  balances: WarehouseBalance[];
  hasMarcoZero: boolean;
  cutoffAt: string | null;
  priorIssues?: WarehouseSiscofisIssue[];
}): Promise<WarehouseSiscofisPreview> {
  const sourceHash = await hashWarehouseSiscofisImport(input.importData);
  const issues: WarehouseSiscofisIssue[] = [...(input.priorIssues || [])];
  const kind: WarehouseSiscofisImportKind =
    input.hasMarcoZero ? 'SNAPSHOT' : 'MARCO_ZERO';
  const materialById = new Map(input.materials.map((material) => [material.id, material]));
  const balanceByMaterial = new Map(
    input.balances.map((balance) => [balance.materialId, balance])
  );
  const newMaterialByLookup = new Map<string, string>();
  const rows: WarehouseSiscofisPreviewRow[] = [];

  const referenceDay = Date.parse(input.importData.referenceDate + 'T00:00:00.000Z');
  const cutoffDay = input.cutoffAt
    ? Date.parse(input.cutoffAt.slice(0, 10) + 'T00:00:00.000Z')
    : Number.NaN;
  const hasCurrentBalance = input.balances.some((balance) => balance.quantity !== 0);

  if (
    kind === 'MARCO_ZERO'
    && input.cutoffAt
    && hasCurrentBalance
    && Number.isFinite(cutoffDay)
    && referenceDay >= cutoffDay
  ) {
    pushIssue(
      issues,
      'error',
      'marco_zero_cutoff_overlap',
      '$.referenceDate',
      'Com estoque já integrado após o cutoff, o Marco Zero deve ter data-base anterior ao dia do cutoff para impedir duplicidade histórica.'
    );
  }

  for (const row of input.importData.rows) {
    let materialId = row.materialId;
    let createsMaterial = false;
    let rowIssue: string | null = null;

    if (materialId) {
      const material = materialById.get(materialId);
      if (!material) {
        rowIssue = 'materialId não existe no catálogo canônico deste workspace.';
        pushIssue(issues, 'error', 'unknown_material_id', '$.rows.' + row.rowId + '.materialId', rowIssue);
      } else if (material.ug !== input.importData.ug) {
        rowIssue = 'materialId pertence a outra UG.';
        pushIssue(issues, 'error', 'material_ug_mismatch', '$.rows.' + row.rowId + '.materialId', rowIssue);
      } else if (warehouseMaterialUnitKey(material.unit) !== warehouseMaterialUnitKey(row.unit)) {
        rowIssue = 'Unidade do SISCOFIS diverge da unidade canônica do material.';
        pushIssue(issues, 'error', 'material_unit_mismatch', '$.rows.' + row.rowId + '.unit', rowIssue);
      }
    } else if (kind === 'MARCO_ZERO') {
      const key = materialLookupKey(row.description, row.unit);
      materialId = newMaterialByLookup.get(key) || await deriveSiscofisMarcoZeroMaterialId(
        input.workspaceId,
        row.description,
        row.unit
      );
      newMaterialByLookup.set(key, materialId);
      createsMaterial = !materialById.has(materialId);
    } else {
      rowIssue = 'Linha sem materialId canônico; snapshot será preservado como não conciliado.';
      pushIssue(
        issues,
        'warning',
        'unresolved_material',
        '$.rows.' + row.rowId + '.materialId',
        rowIssue
      );
    }

    const emprovexQuantity = materialId
      ? balanceByMaterial.get(materialId)?.quantity || 0
      : 0;
    const projectedQuantity = kind === 'MARCO_ZERO'
      ? emprovexQuantity + row.quantity
      : emprovexQuantity;
    const difference = kind === 'SNAPSHOT'
      ? Number((row.quantity - emprovexQuantity).toFixed(6))
      : 0;
    const state: WarehouseSiscofisReconciliationState = !materialId || rowIssue
      ? 'UNRESOLVED'
      : kind === 'SNAPSHOT' && difference !== 0
        ? 'DIVERGENT'
        : 'MATCHED';

    rows.push({
      rowId: row.rowId,
      materialId,
      description: row.description,
      unit: row.unit,
      siscofisQuantity: row.quantity,
      emprovexQuantity,
      projectedQuantity,
      difference,
      state,
      createsMaterial,
      issue: rowIssue,
      sourceItemNumber: row.sourceItemNumber ?? null,
    });
  }

  const errors = issues.filter((item) => item.severity === 'error');
  return {
    kind,
    import: input.importData,
    sourceHash,
    cutoffAt: input.cutoffAt,
    canConfirm: errors.length === 0,
    issues,
    rows,
    summary: {
      totalRows: rows.length,
      matchedRows: rows.filter((row) => row.state === 'MATCHED').length,
      unresolvedRows: rows.filter((row) => row.state === 'UNRESOLVED').length,
      divergentRows: rows.filter((row) => row.state === 'DIVERGENT').length,
      createsMaterials: rows.filter((row) => row.createsMaterial).length,
    },
  };
}

export function aggregateMarcoZeroRows(
  preview: WarehouseSiscofisPreview
): Array<{
  materialId: string;
  quantity: number;
  rowIds: string[];
  representativeRow: WarehouseSiscofisImportRow;
}> {
  if (preview.kind !== 'MARCO_ZERO') return [];

  const sourceByRow = new Map(preview.import.rows.map((row) => [row.rowId, row]));
  const aggregate = new Map<string, {
    materialId: string;
    quantity: number;
    rowIds: string[];
    representativeRow: WarehouseSiscofisImportRow;
  }>();

  for (const row of preview.rows) {
    if (!row.materialId || row.state === 'UNRESOLVED' || row.siscofisQuantity <= 0) continue;
    const source = sourceByRow.get(row.rowId);
    if (!source) continue;
    const current = aggregate.get(row.materialId);
    if (current) {
      current.quantity = Number((current.quantity + row.siscofisQuantity).toFixed(6));
      current.rowIds.push(row.rowId);
    } else {
      aggregate.set(row.materialId, {
        materialId: row.materialId,
        quantity: row.siscofisQuantity,
        rowIds: [row.rowId],
        representativeRow: source,
      });
    }
  }

  return Array.from(aggregate.values()).sort((a, b) =>
    a.materialId.localeCompare(b.materialId)
  );
}
