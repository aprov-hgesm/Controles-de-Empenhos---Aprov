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
  validateWarehouseDepot,
  validateWarehouseLocation,
  type WarehouseDepot,
  type WarehouseLocation,
  type WarehouseStockPosition,
} from './location';

export const WAREHOUSE_LOCATION_BARCODE_VERSION = 1 as const;
export const WAREHOUSE_LOCATION_BARCODE_PREFIX = 'EPX1' as const;
export const WAREHOUSE_LOCATION_BARCODE_DECIMAL_WIDTH = 39;
export const WAREHOUSE_LOCATION_BARCODE_TOTAL_DIGITS = 40;

export type WarehouseLocationBarcodeEntityKind = 'DEPOT' | 'LOCAL' | 'SUBPOSITION';

export interface WarehouseLocationBarcodeIdentity {
  version: typeof WAREHOUSE_LOCATION_BARCODE_VERSION;
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
}

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
  if (!normalized || normalized.length > 64 || /[\u0000-\u001f\u007f]/.test(normalized)) {
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
  return decodeWarehouseLocationBarcode(value).ok;
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
