import { normalizeWarehouseLogicalCode } from './location';

export const WAREHOUSE_STRUCTURE_IMPORT_VERSION = 'emprovex_warehouse_import_v1' as const;
export const WAREHOUSE_STRUCTURE_IMPORT_MAX_LOCATIONS = 400;

export interface WarehouseStructureImportSubposition {
  code: string;
  name: string;
  kind: 'SUBPOSITION';
  description: string | null;
}

export interface WarehouseStructureImportLocal {
  code: string;
  name: string;
  kind: 'LOCAL';
  description: string | null;
  children: WarehouseStructureImportSubposition[];
}

export interface WarehouseStructureImportPayload {
  version: typeof WAREHOUSE_STRUCTURE_IMPORT_VERSION;
  depot: {
    code: string;
    name: string;
    description: string | null;
  };
  locations: WarehouseStructureImportLocal[];
}

export interface WarehouseStructureImportSummary {
  localCount: number;
  subpositionCount: number;
  totalCount: number;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, field: string, max = 120): string {
  if (typeof value !== 'string') throw new Error('Campo inválido: ' + field);
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized || normalized.length > max) throw new Error('Campo inválido: ' + field);
  return normalized;
}

function description(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return text(value, field, 240);
}

function code(value: unknown, field: string): string {
  const normalized = normalizeWarehouseLogicalCode(value);
  if (!normalized) throw new Error('Código lógico inválido: ' + field);
  return normalized;
}

export function parseWarehouseStructureImport(raw: string): WarehouseStructureImportPayload {
  if (!raw.trim()) throw new Error('Cole o JSON retornado pela IA.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    throw new Error('JSON inválido. Peça à IA para retornar somente JSON válido.');
  }

  if (!isRecord(parsed)) throw new Error('O JSON precisa ter um objeto na raiz.');
  if (parsed.version !== WAREHOUSE_STRUCTURE_IMPORT_VERSION) {
    throw new Error('Versão de importação incompatível.');
  }
  if (!isRecord(parsed.depot)) throw new Error('O JSON precisa conter depot.');
  if (!Array.isArray(parsed.locations)) throw new Error('O JSON precisa conter locations.');

  const depot = {
    code: code(parsed.depot.code, 'depot.code'),
    name: text(parsed.depot.name, 'depot.name'),
    description: description(parsed.depot.description, 'depot.description'),
  };

  const localCodes = new Set<string>();
  let totalCount = 0;

  const locations = parsed.locations.map((item, localIndex) => {
    if (!isRecord(item)) throw new Error('Local inválido na posição ' + (localIndex + 1));
    if (item.kind !== 'LOCAL') throw new Error('locations deve conter somente itens kind=LOCAL.');

    const localCode = code(item.code, 'locations[' + localIndex + '].code');
    if (localCodes.has(localCode)) throw new Error('Código de Local duplicado no JSON: ' + localCode);
    localCodes.add(localCode);

    const rawChildren = item.children ?? [];
    if (!Array.isArray(rawChildren)) throw new Error('children inválido em ' + localCode);

    const childCodes = new Set<string>();
    const children = rawChildren.map((child, childIndex) => {
      if (!isRecord(child) || child.kind !== 'SUBPOSITION') {
        throw new Error('Subposição inválida em ' + localCode + ', posição ' + (childIndex + 1));
      }

      const childCode = code(
        child.code,
        'locations[' + localIndex + '].children[' + childIndex + '].code'
      );
      if (childCodes.has(childCode)) {
        throw new Error('Código de Subposição duplicado em ' + localCode + ': ' + childCode);
      }
      childCodes.add(childCode);
      totalCount += 1;

      return {
        code: childCode,
        name: text(child.name, 'subposition.name'),
        kind: 'SUBPOSITION' as const,
        description: description(child.description, 'subposition.description'),
      };
    });

    totalCount += 1;
    return {
      code: localCode,
      name: text(item.name, 'location.name'),
      kind: 'LOCAL' as const,
      description: description(item.description, 'location.description'),
      children,
    };
  });

  if (totalCount === 0) throw new Error('O JSON não contém nenhuma localização.');
  if (totalCount > WAREHOUSE_STRUCTURE_IMPORT_MAX_LOCATIONS) {
    throw new Error(
      'Importação excede o limite de ' + WAREHOUSE_STRUCTURE_IMPORT_MAX_LOCATIONS + ' localizações por operação.'
    );
  }

  return {
    version: WAREHOUSE_STRUCTURE_IMPORT_VERSION,
    depot,
    locations,
  };
}

export function summarizeWarehouseStructureImport(
  payload: WarehouseStructureImportPayload
): WarehouseStructureImportSummary {
  const localCount = payload.locations.length;
  const subpositionCount = payload.locations.reduce((sum, item) => sum + item.children.length, 0);
  return { localCount, subpositionCount, totalCount: localCount + subpositionCount };
}

export function buildWarehouseStructureAiPrompt(userDescription: string): string {
  const source = userDescription.trim();
  if (!source) throw new Error('Descreva o depósito antes de copiar o prompt.');

  return [
    'Você é um conversor de estrutura física de depósito para o formato EMPROVEX.',
    'Interprete SOMENTE a descrição fornecida pelo usuário.',
    '',
    'REGRAS OBRIGATÓRIAS:',
    '1. Retorne somente JSON válido, sem markdown, comentários ou texto antes/depois.',
    '2. Use exatamente version = "' + WAREHOUSE_STRUCTURE_IMPORT_VERSION + '".',
    '3. Não inclua IDs internos, workspaceId, UG, estoque, materiais, saldos, lotes, códigos de barras ou movimentações.',
    '4. Estruturas físicas principais (estante, freezer, geladeira, palete, armário etc.) são kind="LOCAL".',
    '5. Divisões internas explicitamente informadas (prateleira, nível, nicho etc.) são kind="SUBPOSITION" dentro de children.',
    '6. Quando houver quantidades, expanda cada estrutura individualmente. Ex.: 3 estantes = EST-01, EST-02, EST-03.',
    '7. Gere códigos curtos, únicos, em maiúsculas, com letras, números, ponto, hífen ou sublinhado; máximo 32 caracteres.',
    '8. Não invente divisões internas que o usuário não informou.',
    '9. Se o usuário não informar nome/código do depósito, use code="DEP-01" e name="Depósito Principal".',
    '10. description pode ser null quando não houver informação útil.',
    '',
    'FORMATO EXATO:',
    JSON.stringify({
      version: WAREHOUSE_STRUCTURE_IMPORT_VERSION,
      depot: { code: 'DEP-01', name: 'Depósito Principal', description: null },
      locations: [{
        code: 'EST-01',
        name: 'Estante 01',
        kind: 'LOCAL',
        description: null,
        children: [{
          code: 'PRAT-01',
          name: 'Prateleira 01',
          kind: 'SUBPOSITION',
          description: null,
        }],
      }],
    }, null, 2),
    '',
    'DESCRIÇÃO DO USUÁRIO:',
    source,
  ].join('\n');
}
