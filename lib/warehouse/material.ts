import {
  isValidUnitUg,
  isValidWorkspaceId,
  normalizeUnitUg,
  normalizeWorkspaceId,
} from '../platformIdentity';

export const WAREHOUSE_MATERIAL_SCHEMA_VERSION = 'warehouse_material_v1' as const;

export const WAREHOUSE_MATERIAL_STATUSES = ['active', 'inactive'] as const;
export type WarehouseMaterialStatus = (typeof WAREHOUSE_MATERIAL_STATUSES)[number];

export const WAREHOUSE_MATERIAL_UNIT_CODES = [
  'unit',
  'kg',
  'g',
  'l',
  'ml',
  'package',
  'box',
  'bundle',
  'other',
] as const;

export type WarehouseMaterialUnitCode =
  (typeof WAREHOUSE_MATERIAL_UNIT_CODES)[number];

export interface WarehouseMaterialUnit {
  code: WarehouseMaterialUnitCode;
  /**
   * Rótulo livre da apresentação. É obrigatório para "other" e opcional para
   * códigos conhecidos quando a apresentação precisa ser distinguida
   * (ex.: "Caixa 12 x 1 L").
   */
  label: string | null;
}

export interface WarehouseMaterialConversion {
  /**
   * Apresentação alternativa convertida para a unidade canônica do material.
   * factorToBaseUnit=12 significa que 1 apresentação equivale a 12 unidades-base.
   */
  presentation: WarehouseMaterialUnit;
  factorToBaseUnit: number;
}

export interface WarehouseMaterial {
  schemaVersion: typeof WAREHOUSE_MATERIAL_SCHEMA_VERSION;
  id: string;
  workspaceId: string;
  ug: string;
  description: string;
  aliases: string[];
  unit: WarehouseMaterialUnit;
  status: WarehouseMaterialStatus;
  conversions: WarehouseMaterialConversion[];
}

export interface CreateWarehouseMaterialInput {
  id?: string;
  workspaceId: string;
  ug: string | number;
  description: string;
  aliases?: string[];
  unit: WarehouseMaterialUnit;
  status?: WarehouseMaterialStatus;
  conversions?: WarehouseMaterialConversion[];
}

export interface WarehouseMaterialValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface WarehouseMaterialValidationOptions {
  expectedWorkspaceId?: string;
  expectedUg?: string | number;
}

export type WarehouseMaterialValidationResult =
  | { ok: true; data: WarehouseMaterial; issues: [] }
  | { ok: false; issues: WarehouseMaterialValidationIssue[] };

type UnknownObject = Record<string, unknown>;

const MATERIAL_ID_PATTERN = /^mat_[a-f0-9]{32}$/;
const MATERIAL_FIELDS = new Set([
  'schemaVersion',
  'id',
  'workspaceId',
  'ug',
  'description',
  'aliases',
  'unit',
  'status',
  'conversions',
]);
const MATERIAL_UNIT_FIELDS = new Set(['code', 'label']);
const MATERIAL_CONVERSION_FIELDS = new Set(['presentation', 'factorToBaseUnit']);

function isPlainObject(value: unknown): value is UnknownObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeLookupText(value: string): string {
  return normalizeText(value).toLocaleLowerCase('pt-BR');
}

function hasOnlyFields(value: UnknownObject, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function issue(code: string, path: string, message: string): WarehouseMaterialValidationIssue {
  return { code, path, message };
}

export function createWarehouseMaterialId(
  randomUuid: () => string = () => crypto.randomUUID()
): string {
  const compact = randomUuid().trim().toLowerCase().replace(/-/g, '');
  if (!/^[a-f0-9]{32}$/.test(compact)) {
    throw new Error('WAREHOUSE_INVALID_UUID_SOURCE');
  }
  return `mat_${compact}`;
}

export function isValidWarehouseMaterialId(value: unknown): value is string {
  return typeof value === 'string' && MATERIAL_ID_PATTERN.test(value);
}

export function normalizeWarehouseMaterialUnit(
  input: unknown
): WarehouseMaterialUnit | null {
  if (!isPlainObject(input) || !hasOnlyFields(input, MATERIAL_UNIT_FIELDS)) {
    return null;
  }

  const code = typeof input.code === 'string' ? input.code.trim().toLowerCase() : '';
  if (!WAREHOUSE_MATERIAL_UNIT_CODES.includes(code as WarehouseMaterialUnitCode)) {
    return null;
  }

  let label: string | null = null;
  if (input.label !== null && input.label !== undefined) {
    if (typeof input.label !== 'string') return null;
    label = normalizeText(input.label);
    if (!label || label.length > 80) return null;
  }

  if (code === 'other' && !label) return null;

  return {
    code: code as WarehouseMaterialUnitCode,
    label,
  };
}

export function warehouseMaterialUnitKey(unit: WarehouseMaterialUnit): string {
  return `${unit.code}:${normalizeLookupText(unit.label || '')}`;
}

export function validateWarehouseMaterial(
  input: unknown,
  options: WarehouseMaterialValidationOptions = {}
): WarehouseMaterialValidationResult {
  const issues: WarehouseMaterialValidationIssue[] = [];

  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: [issue('invalid_root', '$', 'Material deve ser um objeto.')],
    };
  }

  if (!hasOnlyFields(input, MATERIAL_FIELDS)) {
    issues.push(
      issue(
        'unexpected_field',
        '$',
        'Material contém campos fora do contrato warehouse_material_v1.'
      )
    );
  }

  if (input.schemaVersion !== WAREHOUSE_MATERIAL_SCHEMA_VERSION) {
    issues.push(
      issue(
        'invalid_schema_version',
        '$.schemaVersion',
        `schemaVersion deve ser ${WAREHOUSE_MATERIAL_SCHEMA_VERSION}.`
      )
    );
  }

  const id = typeof input.id === 'string' ? input.id.trim().toLowerCase() : '';
  if (!isValidWarehouseMaterialId(id)) {
    issues.push(
      issue(
        'invalid_material_id',
        '$.id',
        'ID interno deve seguir o formato estável mat_<uuid sem hífens>.'
      )
    );
  }

  const workspaceId =
    typeof input.workspaceId === 'string'
      ? normalizeWorkspaceId(input.workspaceId)
      : '';
  if (!isValidWorkspaceId(workspaceId)) {
    issues.push(
      issue('invalid_workspace', '$.workspaceId', 'workspaceId do material é inválido.')
    );
  }

  if (
    options.expectedWorkspaceId &&
    workspaceId !== normalizeWorkspaceId(options.expectedWorkspaceId)
  ) {
    issues.push(
      issue(
        'workspace_mismatch',
        '$.workspaceId',
        'Material não pertence ao workspace esperado.'
      )
    );
  }

  const ug = normalizeUnitUg(
    typeof input.ug === 'string' || typeof input.ug === 'number' ? input.ug : null
  );
  if (!isValidUnitUg(ug)) {
    issues.push(issue('invalid_ug', '$.ug', 'UG deve possuir exatamente 6 dígitos.'));
  }

  if (options.expectedUg && ug !== normalizeUnitUg(options.expectedUg)) {
    issues.push(issue('ug_mismatch', '$.ug', 'Material não pertence à UG esperada.'));
  }

  const description =
    typeof input.description === 'string' ? normalizeText(input.description) : '';
  if (!description || description.length > 240) {
    issues.push(
      issue(
        'invalid_description',
        '$.description',
        'Descrição principal deve possuir entre 1 e 240 caracteres.'
      )
    );
  }

  const aliases: string[] = [];
  const aliasKeys = new Set<string>();
  if (!Array.isArray(input.aliases) || input.aliases.length > 32) {
    issues.push(
      issue(
        'invalid_aliases',
        '$.aliases',
        'aliases deve ser uma lista com no máximo 32 entradas.'
      )
    );
  } else {
    input.aliases.forEach((alias, index) => {
      if (typeof alias !== 'string') {
        issues.push(
          issue('invalid_alias', `$.aliases[${index}]`, 'Alias deve ser texto.')
        );
        return;
      }

      const normalized = normalizeText(alias);
      if (!normalized || normalized.length > 120) {
        issues.push(
          issue(
            'invalid_alias',
            `$.aliases[${index}]`,
            'Alias deve possuir entre 1 e 120 caracteres.'
          )
        );
        return;
      }

      const key = normalizeLookupText(normalized);
      if (key === normalizeLookupText(description)) return;
      if (!aliasKeys.has(key)) {
        aliasKeys.add(key);
        aliases.push(normalized);
      }
    });
  }

  const unit = normalizeWarehouseMaterialUnit(input.unit);
  if (!unit) {
    issues.push(
      issue('invalid_unit', '$.unit', 'Unidade canônica do material é inválida.')
    );
  }

  const status =
    typeof input.status === 'string' ? input.status.trim().toLowerCase() : '';
  if (!WAREHOUSE_MATERIAL_STATUSES.includes(status as WarehouseMaterialStatus)) {
    issues.push(
      issue('invalid_status', '$.status', 'Status deve ser active ou inactive.')
    );
  }

  const conversions: WarehouseMaterialConversion[] = [];
  const conversionKeys = new Set<string>();
  if (!Array.isArray(input.conversions) || input.conversions.length > 32) {
    issues.push(
      issue(
        'invalid_conversions',
        '$.conversions',
        'conversions deve ser uma lista com no máximo 32 apresentações.'
      )
    );
  } else {
    input.conversions.forEach((conversion, index) => {
      const path = `$.conversions[${index}]`;
      if (
        !isPlainObject(conversion) ||
        !hasOnlyFields(conversion, MATERIAL_CONVERSION_FIELDS)
      ) {
        issues.push(
          issue(
            'invalid_conversion',
            path,
            'Conversão contém campos inválidos.'
          )
        );
        return;
      }

      const presentation = normalizeWarehouseMaterialUnit(conversion.presentation);
      if (!presentation) {
        issues.push(
          issue(
            'invalid_conversion_unit',
            `${path}.presentation`,
            'Apresentação da conversão é inválida.'
          )
        );
        return;
      }

      const factor =
        typeof conversion.factorToBaseUnit === 'number'
          ? conversion.factorToBaseUnit
          : Number.NaN;
      if (!Number.isFinite(factor) || factor <= 0 || factor > 1_000_000_000) {
        issues.push(
          issue(
            'invalid_conversion_factor',
            `${path}.factorToBaseUnit`,
            'Fator de conversão deve ser positivo, finito e operacionalmente razoável.'
          )
        );
        return;
      }

      const key = warehouseMaterialUnitKey(presentation);
      if (unit && key === warehouseMaterialUnitKey(unit)) {
        issues.push(
          issue(
            'redundant_conversion',
            path,
            'A unidade canônica não deve ser repetida como conversão.'
          )
        );
        return;
      }

      if (conversionKeys.has(key)) {
        issues.push(
          issue(
            'duplicate_conversion',
            path,
            'Cada apresentação alternativa deve aparecer uma única vez.'
          )
        );
        return;
      }

      conversionKeys.add(key);
      conversions.push({
        presentation,
        factorToBaseUnit: factor,
      });
    });
  }

  if (issues.length || !unit) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    issues: [],
    data: {
      schemaVersion: WAREHOUSE_MATERIAL_SCHEMA_VERSION,
      id,
      workspaceId,
      ug,
      description,
      aliases,
      unit,
      status: status as WarehouseMaterialStatus,
      conversions,
    },
  };
}

export function createWarehouseMaterial(
  input: CreateWarehouseMaterialInput
): WarehouseMaterialValidationResult {
  return validateWarehouseMaterial({
    schemaVersion: WAREHOUSE_MATERIAL_SCHEMA_VERSION,
    id: input.id || createWarehouseMaterialId(),
    workspaceId: input.workspaceId,
    ug: input.ug,
    description: input.description,
    aliases: input.aliases || [],
    unit: input.unit,
    status: input.status || 'active',
    conversions: input.conversions || [],
  });
}

export function convertWarehouseMaterialQuantityToBase(
  material: WarehouseMaterial,
  quantity: number,
  presentation: WarehouseMaterialUnit
): number {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error('WAREHOUSE_INVALID_MATERIAL_QUANTITY');
  }

  const normalizedPresentation = normalizeWarehouseMaterialUnit(presentation);
  if (!normalizedPresentation) {
    throw new Error('WAREHOUSE_INVALID_MATERIAL_UNIT');
  }

  if (
    warehouseMaterialUnitKey(normalizedPresentation) ===
    warehouseMaterialUnitKey(material.unit)
  ) {
    return quantity;
  }

  const conversion = material.conversions.find(
    (candidate) =>
      warehouseMaterialUnitKey(candidate.presentation) ===
      warehouseMaterialUnitKey(normalizedPresentation)
  );

  if (!conversion) {
    throw new Error('WAREHOUSE_MATERIAL_CONVERSION_NOT_FOUND');
  }

  return quantity * conversion.factorToBaseUnit;
}
