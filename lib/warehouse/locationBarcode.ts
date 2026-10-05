import {
  isValidUnitUg,
  isValidWorkspaceId,
  normalizeUnitUg,
  normalizeWorkspaceId,
} from '../platformIdentity';
import {
  isValidWarehouseDepotId,
  isValidWarehouseLocationId,
  isValidWarehouseSubpositionId,
  normalizeWarehouseLogicalCode,
  validateWarehouseDepot,
  validateWarehouseLocation,
  type WarehouseDepot,
  type WarehouseLocation,
  type WarehouseStockPosition,
} from './location';

export const WAREHOUSE_LOCATION_BARCODE_VERSION = 1 as const;
export const WAREHOUSE_LOCATION_BARCODE_PREFIX = 'EPX1' as const;
export const WAREHOUSE_LOCATION_BARCODE_COMPACT_VERSION = 2 as const;
export const WAREHOUSE_LOCATION_BARCODE_COMPACT_PREFIX = 'EPX2' as const;
export const WAREHOUSE_LOCATION_BARCODE_NUMERIC_VERSION = 3 as const;
export const WAREHOUSE_LOCATION_BARCODE_NUMERIC_PREFIX = '981' as const;
export const WAREHOUSE_LOCATION_BARCODE_NUMERIC_LENGTH = 13;
export const WAREHOUSE_LOCATION_BARCODE_DECIMAL_WIDTH = 39;
export const WAREHOUSE_LOCATION_BARCODE_TOTAL_DIGITS = 40;

export type WarehouseLocationBarcodeEntityKind = 'DEPOT' | 'LOCAL' | 'SUBPOSITION';

export interface WarehouseLocationBarcodeIdentity {
  version:
    | typeof WAREHOUSE_LOCATION_BARCODE_VERSION
    | typeof WAREHOUSE_LOCATION_BARCODE_COMPACT_VERSION
    | typeof WAREHOUSE_LOCATION_BARCODE_NUMERIC_VERSION;
  kind: WarehouseLocationBarcodeEntityKind;
  entityId: string;
  code: string;
}

export type WarehouseLocationBarcodeDecodeError =
  | 'NOT_LOCATION_CODE'
  | 'MALFORMED_LOCATION_CODE';

export type WarehouseLocationBarcodeDecodeResult =
  | { ok: true; value: WarehouseLocationBarcodeIdentity }
  | { ok: false; error: WarehouseLocationBarcodeDecodeError };

export interface WarehouseLocationBarcodeResolverSource {
  getDepot(depotId: string): Promise<WarehouseDepot | null>;
  getLocation(locationId: string): Promise<WarehouseLocation | null>;
  getDepotByCode?(depotCode: string): Promise<WarehouseDepot | null>;
  getLocationByCode?(input: {
    depotId: string;
    kind: 'LOCAL' | 'SUBPOSITION';
    parentLocationId: string | null;
    code: string;
  }): Promise<WarehouseLocation | null>;
}

interface WarehouseCompactLocationBarcodeIdentity {
  version: typeof WAREHOUSE_LOCATION_BARCODE_COMPACT_VERSION;
  kind: WarehouseLocationBarcodeEntityKind;
  depotCode: string;
  parentCode: string | null;
  locationCode: string | null;
  code: string;
}

type WarehouseCompactLocationBarcodeDecodeResult =
  | { ok: true; value: WarehouseCompactLocationBarcodeIdentity }
  | { ok: false; error: WarehouseLocationBarcodeDecodeError };

interface WarehouseNumericLocationBarcodeIdentity {
  version: typeof WAREHOUSE_LOCATION_BARCODE_NUMERIC_VERSION;
  kind: WarehouseLocationBarcodeEntityKind;
  depotCodeCandidates: string[];
  parentCodeCandidates: string[];
  locationCodeCandidates: string[];
  code: string;
}

type WarehouseNumericLocationBarcodeDecodeResult =
  | { ok: true; value: WarehouseNumericLocationBarcodeIdentity }
  | { ok: false; error: WarehouseLocationBarcodeDecodeError };

export type WarehouseLocationBarcodeResolveError =
  | 'INVALID_CONTEXT'
  | 'NOT_LOCATION_CODE'
  | 'MALFORMED_LOCATION_CODE'
  | 'ENTITY_NOT_FOUND'
  | 'ENTITY_INVALID'
  | 'WORKSPACE_MISMATCH'
  | 'UG_MISMATCH'
  | 'ENTITY_INACTIVE'
  | 'ENTITY_KIND_MISMATCH'
  | 'HIERARCHY_INVALID'
  | 'DEPOT_NOT_STOCK_POSITION';

export interface WarehousePhysicalIdentityResolution {
  identity: WarehouseLocationBarcodeIdentity;
  depot: WarehouseDepot;
  location: WarehouseLocation | null;
  parentLocation: WarehouseLocation | null;
  position: WarehouseStockPosition | null;
}

export type WarehousePhysicalIdentityResolveResult =
  | { ok: true; value: WarehousePhysicalIdentityResolution }
  | { ok: false; error: WarehouseLocationBarcodeResolveError };

export type WarehouseStockPositionResolveResult =
  | {
      ok: true;
      value: WarehousePhysicalIdentityResolution & { position: WarehouseStockPosition };
    }
  | { ok: false; error: WarehouseLocationBarcodeResolveError };

export interface WarehouseCode128Bar {
  offsetModules: number;
  widthModules: number;
}

export interface WarehouseCode128Pattern {
  value: string;
  codewords: number[];
  bars: WarehouseCode128Bar[];
  totalModules: number;
  quietZoneModules: number;
}

const KIND_TO_DIGIT: Record<WarehouseLocationBarcodeEntityKind, string> = {
  DEPOT: '1',
  LOCAL: '2',
  SUBPOSITION: '3',
};

const DIGIT_TO_KIND: Record<string, WarehouseLocationBarcodeEntityKind | undefined> = {
  '1': 'DEPOT',
  '2': 'LOCAL',
  '3': 'SUBPOSITION',
};

const MAX_128_BIT_VALUE = (BigInt(1) << BigInt(128)) - BigInt(1);
const LOCATION_CODE_PATTERN = /^EPX1[123][0-9]{39}$/;
const NUMERIC_LOCATION_CODE_PATTERN = /^981[123][0-9]{9}$/;

const LOCAL_FAMILY_PREFIXES: Record<string, readonly string[]> = {
  '1': ['PAL', 'PALETE'],
  '2': ['EST', 'ESTANTE'],
  '3': ['FRZ', 'FREEZER'],
  '4': ['GEL', 'GELADEIRA'],
  '5': ['MES', 'MESA'],
  '6': ['ARM', 'ARMARIO'],
  '7': ['CONT', 'CONTAINER'],
  '8': ['LOC', 'LOCAL'],
  '9': ['NIC', 'NICHO'],
};

const SUBPOSITION_FAMILY_PREFIXES: Record<string, readonly string[]> = {
  '1': ['PRAT', 'PRATELEIRA'],
  '2': ['NIV', 'NIVEL'],
  '3': ['POS', 'POSICAO'],
  '4': ['SUB', 'SUBPOSICAO'],
  '5': ['GAV', 'GAVETA'],
  '6': ['CX', 'CAIXA'],
  '7': ['SET', 'SETOR'],
  '8': ['ESP', 'ESPACO'],
  '9': ['DIV', 'DIVISAO'],
};

const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
] as const;

function entityIdPrefix(kind: WarehouseLocationBarcodeEntityKind): 'dep_' | 'loc_' | 'sub_' {
  if (kind === 'DEPOT') return 'dep_';
  if (kind === 'LOCAL') return 'loc_';
  return 'sub_';
}

function entityIdMatchesKind(kind: WarehouseLocationBarcodeEntityKind, entityId: string): boolean {
  if (kind === 'DEPOT') return isValidWarehouseDepotId(entityId);
  if (kind === 'LOCAL') return isValidWarehouseLocationId(entityId);
  return isValidWarehouseSubpositionId(entityId);
}

function normalizeLocationCodeInput(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized || normalized.length > 128 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    return null;
  }
  return normalized;
}

function technicalIdHex(kind: WarehouseLocationBarcodeEntityKind, entityId: string): string | null {
  const normalized = entityId.trim().toLowerCase();
  if (!entityIdMatchesKind(kind, normalized)) return null;
  return normalized.slice(4);
}

function decimalIdentity(hex: string): string {
  return BigInt('0x' + hex)
    .toString(10)
    .padStart(WAREHOUSE_LOCATION_BARCODE_DECIMAL_WIDTH, '0');
}

function technicalIdFromDecimal(
  kind: WarehouseLocationBarcodeEntityKind,
  decimal: string
): string | null {
  try {
    const numeric = BigInt(decimal);
    if (numeric < BigInt(0) || numeric > MAX_128_BIT_VALUE) return null;
    const hex = numeric.toString(16).padStart(32, '0');
    const id = entityIdPrefix(kind) + hex;
    return entityIdMatchesKind(kind, id) ? id : null;
  } catch {
    return null;
  }
}

export function encodeWarehouseLocationBarcode(input: {
  kind: WarehouseLocationBarcodeEntityKind;
  entityId: string;
}): string {
  const hex = technicalIdHex(input.kind, input.entityId);
  if (!hex) throw new Error('WAREHOUSE_LOCATION_BARCODE_IDENTITY_INVALID');
  return WAREHOUSE_LOCATION_BARCODE_PREFIX
    + KIND_TO_DIGIT[input.kind]
    + decimalIdentity(hex);
}

function splitWarehouseLogicalCodeSequence(
  value: unknown,
  maxSequence: number
): { prefix: string; sequence: number } | null {
  const normalized = normalizeWarehouseLogicalCode(value);
  if (!normalized) return null;
  const match = /^([A-Z][A-Z0-9._-]*?)[._-]?(\d{1,3})$/.exec(normalized);
  if (!match) return null;
  const prefix = match[1].replace(/[._-]+$/g, '');
  const sequence = Number(match[2]);
  if (!prefix || !Number.isInteger(sequence) || sequence <= 0 || sequence > maxSequence) {
    return null;
  }
  return { prefix, sequence };
}

function familyDigitForPrefix(
  prefix: string,
  families: Record<string, readonly string[]>
): string | null {
  for (const [digit, prefixes] of Object.entries(families)) {
    if (prefixes.includes(prefix)) return digit;
  }
  return null;
}

function codesForFamily(
  digit: string,
  sequence: number,
  families: Record<string, readonly string[]>
): string[] {
  const prefixes = families[digit];
  if (!prefixes) return [];
  const suffix = String(sequence).padStart(2, '0');
  return prefixes.map((prefix) => prefix + '-' + suffix);
}

function depotCodeCandidates(sequence: number): string[] {
  const suffix = String(sequence).padStart(3, '0');
  return ['DEP-' + suffix, 'DEPOSITO-' + suffix];
}

export function tryEncodeWarehouseNumericLocationBarcode(input: {
  kind: WarehouseLocationBarcodeEntityKind;
  depotCode: string;
  locationCode?: string | null;
  parentCode?: string | null;
}): string | null {
  const depot = splitWarehouseLogicalCodeSequence(input.depotCode, 999);
  if (!depot || !['DEP', 'DEPOSITO'].includes(depot.prefix)) return null;

  let localFamily = '0';
  let localSequence = 0;
  let subFamily = '0';
  let subSequence = 0;

  if (input.kind === 'LOCAL') {
    const local = splitWarehouseLogicalCodeSequence(input.locationCode, 99);
    if (!local) return null;
    const family = familyDigitForPrefix(local.prefix, LOCAL_FAMILY_PREFIXES);
    if (!family) return null;
    localFamily = family;
    localSequence = local.sequence;
  }

  if (input.kind === 'SUBPOSITION') {
    const parent = splitWarehouseLogicalCodeSequence(input.parentCode, 99);
    const location = splitWarehouseLogicalCodeSequence(input.locationCode, 99);
    if (!parent || !location) return null;
    const parentFamily = familyDigitForPrefix(parent.prefix, LOCAL_FAMILY_PREFIXES);
    const locationFamily = familyDigitForPrefix(
      location.prefix,
      SUBPOSITION_FAMILY_PREFIXES
    );
    if (!parentFamily || !locationFamily) return null;
    localFamily = parentFamily;
    localSequence = parent.sequence;
    subFamily = locationFamily;
    subSequence = location.sequence;
  }

  return WAREHOUSE_LOCATION_BARCODE_NUMERIC_PREFIX
    + KIND_TO_DIGIT[input.kind]
    + String(depot.sequence).padStart(3, '0')
    + localFamily
    + String(localSequence).padStart(2, '0')
    + subFamily
    + String(subSequence).padStart(2, '0');
}

export function encodeWarehouseNumericLocationBarcode(input: {
  kind: WarehouseLocationBarcodeEntityKind;
  depotCode: string;
  locationCode?: string | null;
  parentCode?: string | null;
}): string {
  const encoded = tryEncodeWarehouseNumericLocationBarcode(input);
  if (!encoded) throw new Error('WAREHOUSE_LOCATION_BARCODE_NUMERIC_IDENTITY_INVALID');
  return encoded;
}

function decodeWarehouseNumericLocationBarcode(
  value: unknown
): WarehouseNumericLocationBarcodeDecodeResult {
  const normalized = normalizeLocationCodeInput(value);
  if (!normalized || !normalized.startsWith(WAREHOUSE_LOCATION_BARCODE_NUMERIC_PREFIX)) {
    return { ok: false, error: 'NOT_LOCATION_CODE' };
  }
  if (!NUMERIC_LOCATION_CODE_PATTERN.test(normalized)) {
    return { ok: false, error: 'MALFORMED_LOCATION_CODE' };
  }

  const kind = DIGIT_TO_KIND[normalized.charAt(3)];
  if (!kind) return { ok: false, error: 'MALFORMED_LOCATION_CODE' };

  const depotSequence = Number(normalized.slice(4, 7));
  const localFamily = normalized.charAt(7);
  const localSequence = Number(normalized.slice(8, 10));
  const subFamily = normalized.charAt(10);
  const subSequence = Number(normalized.slice(11, 13));

  if (!Number.isInteger(depotSequence) || depotSequence <= 0) {
    return { ok: false, error: 'MALFORMED_LOCATION_CODE' };
  }

  if (kind === 'DEPOT') {
    if (localFamily !== '0' || localSequence !== 0 || subFamily !== '0' || subSequence !== 0) {
      return { ok: false, error: 'MALFORMED_LOCATION_CODE' };
    }
    return {
      ok: true,
      value: {
        version: WAREHOUSE_LOCATION_BARCODE_NUMERIC_VERSION,
        kind,
        depotCodeCandidates: depotCodeCandidates(depotSequence),
        parentCodeCandidates: [],
        locationCodeCandidates: [],
        code: normalized,
      },
    };
  }

  const localCodes = codesForFamily(localFamily, localSequence, LOCAL_FAMILY_PREFIXES);
  if (localCodes.length === 0 || localSequence <= 0) {
    return { ok: false, error: 'MALFORMED_LOCATION_CODE' };
  }

  if (kind === 'LOCAL') {
    if (subFamily !== '0' || subSequence !== 0) {
      return { ok: false, error: 'MALFORMED_LOCATION_CODE' };
    }
    return {
      ok: true,
      value: {
        version: WAREHOUSE_LOCATION_BARCODE_NUMERIC_VERSION,
        kind,
        depotCodeCandidates: depotCodeCandidates(depotSequence),
        parentCodeCandidates: [],
        locationCodeCandidates: localCodes,
        code: normalized,
      },
    };
  }

  const subCodes = codesForFamily(
    subFamily,
    subSequence,
    SUBPOSITION_FAMILY_PREFIXES
  );
  if (subCodes.length === 0 || subSequence <= 0) {
    return { ok: false, error: 'MALFORMED_LOCATION_CODE' };
  }

  return {
    ok: true,
    value: {
      version: WAREHOUSE_LOCATION_BARCODE_NUMERIC_VERSION,
      kind,
      depotCodeCandidates: depotCodeCandidates(depotSequence),
      parentCodeCandidates: localCodes,
      locationCodeCandidates: subCodes,
      code: normalized,
    },
  };
}

export function encodeWarehouseCompactLocationBarcode(input: {
  kind: WarehouseLocationBarcodeEntityKind;
  depotCode: string;
  locationCode?: string | null;
  parentCode?: string | null;
}): string {
  const depotCode = normalizeWarehouseLogicalCode(input.depotCode);
  const locationCode = input.locationCode
    ? normalizeWarehouseLogicalCode(input.locationCode)
    : null;
  const parentCode = input.parentCode
    ? normalizeWarehouseLogicalCode(input.parentCode)
    : null;

  if (!depotCode) throw new Error('WAREHOUSE_LOCATION_BARCODE_COMPACT_DEPOT_CODE_INVALID');

  if (input.kind === 'DEPOT') {
    return WAREHOUSE_LOCATION_BARCODE_COMPACT_PREFIX + 'D:' + depotCode;
  }

  if (input.kind === 'LOCAL') {
    if (!locationCode) {
      throw new Error('WAREHOUSE_LOCATION_BARCODE_COMPACT_LOCATION_CODE_INVALID');
    }
    return WAREHOUSE_LOCATION_BARCODE_COMPACT_PREFIX
      + 'L:' + depotCode + ':' + locationCode;
  }

  if (!parentCode || !locationCode) {
    throw new Error('WAREHOUSE_LOCATION_BARCODE_COMPACT_SUBPOSITION_CODE_INVALID');
  }
  return WAREHOUSE_LOCATION_BARCODE_COMPACT_PREFIX
    + 'S:' + depotCode + ':' + parentCode + ':' + locationCode;
}

function decodeWarehouseCompactLocationBarcode(
  value: unknown
): WarehouseCompactLocationBarcodeDecodeResult {
  const normalized = normalizeLocationCodeInput(value);
  if (!normalized || !normalized.startsWith(WAREHOUSE_LOCATION_BARCODE_COMPACT_PREFIX)) {
    return { ok: false, error: 'NOT_LOCATION_CODE' };
  }

  const payload = normalized.slice(WAREHOUSE_LOCATION_BARCODE_COMPACT_PREFIX.length);
  const parts = payload.split(':');
  const marker = parts[0];
  const depotCode = normalizeWarehouseLogicalCode(parts[1]);

  if (!depotCode) {
    return { ok: false, error: 'MALFORMED_LOCATION_CODE' };
  }

  if (marker === 'D' && parts.length === 2) {
    return {
      ok: true,
      value: {
        version: WAREHOUSE_LOCATION_BARCODE_COMPACT_VERSION,
        kind: 'DEPOT',
        depotCode,
        parentCode: null,
        locationCode: null,
        code: normalized,
      },
    };
  }

  const locationCode = normalizeWarehouseLogicalCode(parts[parts.length - 1]);
  if (!locationCode) {
    return { ok: false, error: 'MALFORMED_LOCATION_CODE' };
  }

  if (marker === 'L' && parts.length === 3) {
    return {
      ok: true,
      value: {
        version: WAREHOUSE_LOCATION_BARCODE_COMPACT_VERSION,
        kind: 'LOCAL',
        depotCode,
        parentCode: null,
        locationCode,
        code: normalized,
      },
    };
  }

  const parentCode = normalizeWarehouseLogicalCode(parts[2]);
  if (marker === 'S' && parts.length === 4 && parentCode) {
    return {
      ok: true,
      value: {
        version: WAREHOUSE_LOCATION_BARCODE_COMPACT_VERSION,
        kind: 'SUBPOSITION',
        depotCode,
        parentCode,
        locationCode,
        code: normalized,
      },
    };
  }

  return { ok: false, error: 'MALFORMED_LOCATION_CODE' };
}

export function decodeWarehouseLocationBarcode(
  value: unknown
): WarehouseLocationBarcodeDecodeResult {
  const normalized = normalizeLocationCodeInput(value);
  if (!normalized || !normalized.startsWith(WAREHOUSE_LOCATION_BARCODE_PREFIX)) {
    return { ok: false, error: 'NOT_LOCATION_CODE' };
  }
  if (!LOCATION_CODE_PATTERN.test(normalized)) {
    return { ok: false, error: 'MALFORMED_LOCATION_CODE' };
  }

  const kind = DIGIT_TO_KIND[normalized.charAt(WAREHOUSE_LOCATION_BARCODE_PREFIX.length)];
  if (!kind) return { ok: false, error: 'MALFORMED_LOCATION_CODE' };

  const decimal = normalized.slice(WAREHOUSE_LOCATION_BARCODE_PREFIX.length + 1);
  const entityId = technicalIdFromDecimal(kind, decimal);
  if (!entityId) return { ok: false, error: 'MALFORMED_LOCATION_CODE' };

  return {
    ok: true,
    value: {
      version: WAREHOUSE_LOCATION_BARCODE_VERSION,
      kind,
      entityId,
      code: normalized,
    },
  };
}

export function isWarehouseLocationBarcode(value: unknown): boolean {
  return decodeWarehouseLocationBarcode(value).ok
    || decodeWarehouseCompactLocationBarcode(value).ok
    || decodeWarehouseNumericLocationBarcode(value).ok;
}

function validationFailure(
  issues: Array<{ code: string }>
): WarehouseLocationBarcodeResolveError {
  if (issues.some((item) => item.code === 'workspace_mismatch')) return 'WORKSPACE_MISMATCH';
  if (issues.some((item) => item.code === 'ug_mismatch')) return 'UG_MISMATCH';
  return 'ENTITY_INVALID';
}

function validateContext(input: {
  workspaceId: string;
  ug: string | number;
}): { workspaceId: string; ug: string } | null {
  const workspaceId = normalizeWorkspaceId(input.workspaceId);
  const ug = normalizeUnitUg(input.ug);
  if (!isValidWorkspaceId(workspaceId) || !isValidUnitUg(ug)) return null;
  return { workspaceId, ug };
}

async function resolveDepot(
  depotId: string,
  context: { workspaceId: string; ug: string },
  source: WarehouseLocationBarcodeResolverSource
): Promise<
  | { ok: true; depot: WarehouseDepot }
  | { ok: false; error: WarehouseLocationBarcodeResolveError }
> {
  const raw = await source.getDepot(depotId);
  if (!raw) return { ok: false, error: 'ENTITY_NOT_FOUND' };
  const validated = validateWarehouseDepot(raw, {
    expectedWorkspaceId: context.workspaceId,
    expectedUg: context.ug,
  });
  if (!validated.ok) {
    return { ok: false, error: validationFailure(validated.issues) };
  }
  if (validated.data.id !== depotId) return { ok: false, error: 'ENTITY_INVALID' };
  if (validated.data.status !== 'active') return { ok: false, error: 'ENTITY_INACTIVE' };
  return { ok: true, depot: validated.data };
}

async function resolveLocationEntity(
  locationId: string,
  expectedKind: 'LOCAL' | 'SUBPOSITION',
  context: { workspaceId: string; ug: string },
  source: WarehouseLocationBarcodeResolverSource
): Promise<
  | { ok: true; location: WarehouseLocation }
  | { ok: false; error: WarehouseLocationBarcodeResolveError }
> {
  const raw = await source.getLocation(locationId);
  if (!raw) return { ok: false, error: 'ENTITY_NOT_FOUND' };
  const validated = validateWarehouseLocation(raw, {
    expectedWorkspaceId: context.workspaceId,
    expectedUg: context.ug,
  });
  if (!validated.ok) {
    return { ok: false, error: validationFailure(validated.issues) };
  }
  if (validated.data.id !== locationId) return { ok: false, error: 'ENTITY_INVALID' };
  if (validated.data.kind !== expectedKind) {
    return { ok: false, error: 'ENTITY_KIND_MISMATCH' };
  }
  if (validated.data.status !== 'active') return { ok: false, error: 'ENTITY_INACTIVE' };
  return { ok: true, location: validated.data };
}

async function findUniqueDepotByCodes(
  source: WarehouseLocationBarcodeResolverSource,
  codes: readonly string[]
): Promise<WarehouseDepot | null> {
  if (!source.getDepotByCode) return null;
  let found: WarehouseDepot | null = null;
  for (const code of codes) {
    const candidate = await source.getDepotByCode(code);
    if (!candidate) continue;
    if (found && found.id !== candidate.id) return null;
    found = candidate;
  }
  return found;
}

async function findUniqueLocationByCodes(
  source: WarehouseLocationBarcodeResolverSource,
  input: {
    depotId: string;
    kind: 'LOCAL' | 'SUBPOSITION';
    parentLocationId: string | null;
    codes: readonly string[];
  }
): Promise<WarehouseLocation | null> {
  if (!source.getLocationByCode) return null;
  let found: WarehouseLocation | null = null;
  for (const code of input.codes) {
    const candidate = await source.getLocationByCode({
      depotId: input.depotId,
      kind: input.kind,
      parentLocationId: input.parentLocationId,
      code,
    });
    if (!candidate) continue;
    if (found && found.id !== candidate.id) return null;
    found = candidate;
  }
  return found;
}

export async function resolveWarehousePhysicalIdentityCode(
  input: {
    code: string;
    workspaceId: string;
    ug: string | number;
  },
  source: WarehouseLocationBarcodeResolverSource
): Promise<WarehousePhysicalIdentityResolveResult> {
  const context = validateContext(input);
  if (!context) return { ok: false, error: 'INVALID_CONTEXT' };

  const numeric = decodeWarehouseNumericLocationBarcode(input.code);
  if (numeric.ok) {
    const rawDepot = await findUniqueDepotByCodes(
      source,
      numeric.value.depotCodeCandidates
    );
    if (!rawDepot) return { ok: false, error: 'ENTITY_NOT_FOUND' };
    const depotValidated = validateWarehouseDepot(rawDepot, {
      expectedWorkspaceId: context.workspaceId,
      expectedUg: context.ug,
    });
    if (!depotValidated.ok) {
      return { ok: false, error: validationFailure(depotValidated.issues) };
    }
    const depot = depotValidated.data;
    if (depot.status !== 'active') return { ok: false, error: 'ENTITY_INACTIVE' };

    if (numeric.value.kind === 'DEPOT') {
      return {
        ok: true,
        value: {
          identity: {
            version: WAREHOUSE_LOCATION_BARCODE_NUMERIC_VERSION,
            kind: 'DEPOT',
            entityId: depot.id,
            code: numeric.value.code,
          },
          depot,
          location: null,
          parentLocation: null,
          position: null,
        },
      };
    }

    if (numeric.value.kind === 'LOCAL') {
      const rawLocation = await findUniqueLocationByCodes(source, {
        depotId: depot.id,
        kind: 'LOCAL',
        parentLocationId: null,
        codes: numeric.value.locationCodeCandidates,
      });
      if (!rawLocation) return { ok: false, error: 'ENTITY_NOT_FOUND' };
      const validated = validateWarehouseLocation(rawLocation, {
        expectedWorkspaceId: context.workspaceId,
        expectedUg: context.ug,
      });
      if (!validated.ok) {
        return { ok: false, error: validationFailure(validated.issues) };
      }
      const location = validated.data;
      if (
        location.status !== 'active'
        || location.kind !== 'LOCAL'
        || location.depotId !== depot.id
        || location.parentLocationId !== null
      ) {
        return { ok: false, error: 'HIERARCHY_INVALID' };
      }
      return {
        ok: true,
        value: {
          identity: {
            version: WAREHOUSE_LOCATION_BARCODE_NUMERIC_VERSION,
            kind: 'LOCAL',
            entityId: location.id,
            code: numeric.value.code,
          },
          depot,
          location,
          parentLocation: null,
          position: {
            kind: 'LOCATION',
            depotId: depot.id,
            locationId: location.id,
            subpositionId: null,
          },
        },
      };
    }

    const rawParent = await findUniqueLocationByCodes(source, {
      depotId: depot.id,
      kind: 'LOCAL',
      parentLocationId: null,
      codes: numeric.value.parentCodeCandidates,
    });
    if (!rawParent) return { ok: false, error: 'ENTITY_NOT_FOUND' };
    const parentValidated = validateWarehouseLocation(rawParent, {
      expectedWorkspaceId: context.workspaceId,
      expectedUg: context.ug,
    });
    if (!parentValidated.ok) {
      return { ok: false, error: validationFailure(parentValidated.issues) };
    }
    const parent = parentValidated.data;

    const rawLocation = await findUniqueLocationByCodes(source, {
      depotId: depot.id,
      kind: 'SUBPOSITION',
      parentLocationId: parent.id,
      codes: numeric.value.locationCodeCandidates,
    });
    if (!rawLocation) return { ok: false, error: 'ENTITY_NOT_FOUND' };
    const locationValidated = validateWarehouseLocation(rawLocation, {
      expectedWorkspaceId: context.workspaceId,
      expectedUg: context.ug,
    });
    if (!locationValidated.ok) {
      return { ok: false, error: validationFailure(locationValidated.issues) };
    }
    const location = locationValidated.data;
    if (
      parent.status !== 'active'
      || parent.kind !== 'LOCAL'
      || parent.depotId !== depot.id
      || parent.parentLocationId !== null
      || location.status !== 'active'
      || location.kind !== 'SUBPOSITION'
      || location.depotId !== depot.id
      || location.parentLocationId !== parent.id
    ) {
      return { ok: false, error: 'HIERARCHY_INVALID' };
    }

    return {
      ok: true,
      value: {
        identity: {
          version: WAREHOUSE_LOCATION_BARCODE_NUMERIC_VERSION,
          kind: 'SUBPOSITION',
          entityId: location.id,
          code: numeric.value.code,
        },
        depot,
        location,
        parentLocation: parent,
        position: {
          kind: 'SUBPOSITION',
          depotId: depot.id,
          locationId: parent.id,
          subpositionId: location.id,
        },
      },
    };
  }

  const compact = decodeWarehouseCompactLocationBarcode(input.code);
  if (compact.ok) {
    if (!source.getDepotByCode || !source.getLocationByCode) {
      return { ok: false, error: 'ENTITY_NOT_FOUND' };
    }

    const rawDepot = await source.getDepotByCode(compact.value.depotCode);
    if (!rawDepot) return { ok: false, error: 'ENTITY_NOT_FOUND' };
    const depotValidated = validateWarehouseDepot(rawDepot, {
      expectedWorkspaceId: context.workspaceId,
      expectedUg: context.ug,
    });
    if (!depotValidated.ok) {
      return { ok: false, error: validationFailure(depotValidated.issues) };
    }
    if (depotValidated.data.status !== 'active') {
      return { ok: false, error: 'ENTITY_INACTIVE' };
    }

    const depot = depotValidated.data;

    if (compact.value.kind === 'DEPOT') {
      return {
        ok: true,
        value: {
          identity: {
            version: WAREHOUSE_LOCATION_BARCODE_COMPACT_VERSION,
            kind: 'DEPOT',
            entityId: depot.id,
            code: compact.value.code,
          },
          depot,
          location: null,
          parentLocation: null,
          position: null,
        },
      };
    }

    if (compact.value.kind === 'LOCAL' && compact.value.locationCode) {
      const rawLocation = await source.getLocationByCode({
        depotId: depot.id,
        kind: 'LOCAL',
        parentLocationId: null,
        code: compact.value.locationCode,
      });
      if (!rawLocation) return { ok: false, error: 'ENTITY_NOT_FOUND' };
      const locationValidated = validateWarehouseLocation(rawLocation, {
        expectedWorkspaceId: context.workspaceId,
        expectedUg: context.ug,
      });
      if (!locationValidated.ok) {
        return { ok: false, error: validationFailure(locationValidated.issues) };
      }
      const location = locationValidated.data;
      if (
        location.status !== 'active'
        || location.kind !== 'LOCAL'
        || location.depotId !== depot.id
        || location.parentLocationId !== null
      ) {
        return { ok: false, error: 'HIERARCHY_INVALID' };
      }
      return {
        ok: true,
        value: {
          identity: {
            version: WAREHOUSE_LOCATION_BARCODE_COMPACT_VERSION,
            kind: 'LOCAL',
            entityId: location.id,
            code: compact.value.code,
          },
          depot,
          location,
          parentLocation: null,
          position: {
            kind: 'LOCATION',
            depotId: depot.id,
            locationId: location.id,
            subpositionId: null,
          },
        },
      };
    }

    if (
      compact.value.kind === 'SUBPOSITION'
      && compact.value.parentCode
      && compact.value.locationCode
    ) {
      const rawParent = await source.getLocationByCode({
        depotId: depot.id,
        kind: 'LOCAL',
        parentLocationId: null,
        code: compact.value.parentCode,
      });
      if (!rawParent) return { ok: false, error: 'ENTITY_NOT_FOUND' };
      const parentValidated = validateWarehouseLocation(rawParent, {
        expectedWorkspaceId: context.workspaceId,
        expectedUg: context.ug,
      });
      if (!parentValidated.ok) {
        return { ok: false, error: validationFailure(parentValidated.issues) };
      }
      const parent = parentValidated.data;
      if (
        parent.status !== 'active'
        || parent.kind !== 'LOCAL'
        || parent.depotId !== depot.id
        || parent.parentLocationId !== null
      ) {
        return { ok: false, error: 'HIERARCHY_INVALID' };
      }

      const rawLocation = await source.getLocationByCode({
        depotId: depot.id,
        kind: 'SUBPOSITION',
        parentLocationId: parent.id,
        code: compact.value.locationCode,
      });
      if (!rawLocation) return { ok: false, error: 'ENTITY_NOT_FOUND' };
      const locationValidated = validateWarehouseLocation(rawLocation, {
        expectedWorkspaceId: context.workspaceId,
        expectedUg: context.ug,
      });
      if (!locationValidated.ok) {
        return { ok: false, error: validationFailure(locationValidated.issues) };
      }
      const location = locationValidated.data;
      if (
        location.status !== 'active'
        || location.kind !== 'SUBPOSITION'
        || location.depotId !== depot.id
        || location.parentLocationId !== parent.id
      ) {
        return { ok: false, error: 'HIERARCHY_INVALID' };
      }

      return {
        ok: true,
        value: {
          identity: {
            version: WAREHOUSE_LOCATION_BARCODE_COMPACT_VERSION,
            kind: 'SUBPOSITION',
            entityId: location.id,
            code: compact.value.code,
          },
          depot,
          location,
          parentLocation: parent,
          position: {
            kind: 'SUBPOSITION',
            depotId: depot.id,
            locationId: parent.id,
            subpositionId: location.id,
          },
        },
      };
    }

    return { ok: false, error: 'MALFORMED_LOCATION_CODE' };
  }

  const decoded = decodeWarehouseLocationBarcode(input.code);
  if (decoded.ok === false) return decoded;

  const identity = decoded.value;
  if (identity.kind === 'DEPOT') {
    const depotResult = await resolveDepot(identity.entityId, context, source);
    if (depotResult.ok === false) return depotResult;
    return {
      ok: true,
      value: {
        identity,
        depot: depotResult.depot,
        location: null,
        parentLocation: null,
        position: null,
      },
    };
  }

  const expectedKind = identity.kind === 'LOCAL' ? 'LOCAL' : 'SUBPOSITION';
  const locationResult = await resolveLocationEntity(
    identity.entityId,
    expectedKind,
    context,
    source
  );
  if (locationResult.ok === false) return locationResult;

  const depotResult = await resolveDepot(locationResult.location.depotId, context, source);
  if (depotResult.ok === false) return depotResult;

  if (identity.kind === 'LOCAL') {
    if (locationResult.location.parentLocationId !== null) {
      return { ok: false, error: 'HIERARCHY_INVALID' };
    }
    return {
      ok: true,
      value: {
        identity,
        depot: depotResult.depot,
        location: locationResult.location,
        parentLocation: null,
        position: {
          kind: 'LOCATION',
          depotId: depotResult.depot.id,
          locationId: locationResult.location.id,
          subpositionId: null,
        },
      },
    };
  }

  const parentId = locationResult.location.parentLocationId;
  if (!parentId || !isValidWarehouseLocationId(parentId)) {
    return { ok: false, error: 'HIERARCHY_INVALID' };
  }

  const parentResult = await resolveLocationEntity(parentId, 'LOCAL', context, source);
  if (parentResult.ok === false) return parentResult;
  if (
    parentResult.location.depotId !== depotResult.depot.id
    || locationResult.location.depotId !== depotResult.depot.id
  ) {
    return { ok: false, error: 'HIERARCHY_INVALID' };
  }

  return {
    ok: true,
    value: {
      identity,
      depot: depotResult.depot,
      location: locationResult.location,
      parentLocation: parentResult.location,
      position: {
        kind: 'SUBPOSITION',
        depotId: depotResult.depot.id,
        locationId: parentResult.location.id,
        subpositionId: locationResult.location.id,
      },
    },
  };
}

export async function resolveWarehouseStockPositionCode(
  input: {
    code: string;
    workspaceId: string;
    ug: string | number;
  },
  source: WarehouseLocationBarcodeResolverSource
): Promise<WarehouseStockPositionResolveResult> {
  const resolved = await resolveWarehousePhysicalIdentityCode(input, source);
  if (resolved.ok === false) return resolved;
  if (!resolved.value.position) {
    return { ok: false, error: 'DEPOT_NOT_STOCK_POSITION' };
  }
  return {
    ok: true,
    value: {
      ...resolved.value,
      position: resolved.value.position,
    },
  };
}

function countDigitRun(value: string, start: number): number {
  let index = start;
  while (index < value.length && value.charCodeAt(index) >= 48 && value.charCodeAt(index) <= 57) {
    index += 1;
  }
  return index - start;
}

function code128Codewords(value: string): number[] {
  if (!value || value.length > 128) throw new Error('WAREHOUSE_CODE128_VALUE_INVALID');
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 32 || code > 126) throw new Error('WAREHOUSE_CODE128_VALUE_INVALID');
  }

  const START_B = 104;
  const CODE_B = 100;
  const CODE_C = 99;
  const STOP = 106;
  const codewords: number[] = [START_B];

  let mode: 'B' | 'C' = 'B';
  let index = 0;
  while (index < value.length) {
    if (mode === 'B') {
      const digitRun = countDigitRun(value, index);
      if (digitRun >= 4) {
        if (digitRun % 2 === 1) {
          codewords.push(value.charCodeAt(index) - 32);
          index += 1;
          continue;
        }
        codewords.push(CODE_C);
        mode = 'C';
        continue;
      }

      codewords.push(value.charCodeAt(index) - 32);
      index += 1;
      continue;
    }

    if (
      index + 1 < value.length
      && value.charCodeAt(index) >= 48
      && value.charCodeAt(index) <= 57
      && value.charCodeAt(index + 1) >= 48
      && value.charCodeAt(index + 1) <= 57
    ) {
      codewords.push(Number(value.slice(index, index + 2)));
      index += 2;
      continue;
    }

    codewords.push(CODE_B);
    mode = 'B';
  }

  let checksum = codewords[0];
  for (let position = 1; position < codewords.length; position += 1) {
    checksum += codewords[position] * position;
  }
  codewords.push(checksum % 103);
  codewords.push(STOP);
  return codewords;
}

export function buildWarehouseCode128Pattern(value: string): WarehouseCode128Pattern {
  const codewords = code128Codewords(value);
  const quietZoneModules = 10;
  const bars: WarehouseCode128Bar[] = [];
  let cursor = quietZoneModules;

  codewords.forEach((codeword) => {
    const pattern = CODE128_PATTERNS[codeword];
    if (!pattern) throw new Error('WAREHOUSE_CODE128_PATTERN_INVALID');
    let black = true;
    for (const widthText of pattern) {
      const widthModules = Number(widthText);
      if (black) {
        bars.push({ offsetModules: cursor, widthModules });
      }
      cursor += widthModules;
      black = !black;
    }
  });

  return {
    value,
    codewords,
    bars,
    totalModules: cursor + quietZoneModules,
    quietZoneModules,
  };
}
