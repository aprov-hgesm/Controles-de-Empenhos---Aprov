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
  type WarehouseStockPosition,
} from './location';

export const WAREHOUSE_DEPOT_LAYOUT_SCHEMA_VERSION = 'warehouse_depot_layout_v1' as const;
export const WAREHOUSE_DEPOT_LAYOUT_OBJECT_KINDS = [
  'WALL',
  'CORRIDOR',
  'AREA',
  'SHELF',
  'RACK',
  'CABINET',
  'CHAMBER',
  'FREEZER',
  'BENCH',
  'ZONE',
  'OTHER',
] as const;

export type WarehouseDepotLayoutObjectKind =
  (typeof WAREHOUSE_DEPOT_LAYOUT_OBJECT_KINDS)[number];
export type WarehouseDepotLayoutStatus = 'active' | 'archived';
export type WarehouseDepotLayoutVisualVariant = 'solid' | 'outline' | 'zone';

export interface WarehouseDepotLayoutObject {
  id: string;
  kind: WarehouseDepotLayoutObjectKind;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  layer: number;
  elevation: number;
  visualVariant: WarehouseDepotLayoutVisualVariant;
  warehouseLocationId: string | null;
}

export interface WarehouseDepotLayout {
  schemaVersion: typeof WAREHOUSE_DEPOT_LAYOUT_SCHEMA_VERSION;
  id: string;
  workspaceId: string;
  ug: string;
  name: string;
  depotId: string | null;
  logicalWidth: number;
  logicalHeight: number;
  objects: WarehouseDepotLayoutObject[];
  version: number;
  status: WarehouseDepotLayoutStatus;
  previousVersionId: string | null;
  createdBy: string;
  updatedBy: string;
}

export interface WarehouseDepotLayoutValidationIssue {
  code: string;
  path: string;
  message: string;
}

const LAYOUT_ID_PATTERN = /^lay_[a-f0-9]{32}$/;
const OBJECT_ID_PATTERN = /^obj_[a-f0-9]{32}$/;
const MIN_DIMENSION = 240;
const MAX_DIMENSION = 5000;
const MAX_OBJECTS = 160;

function randomHex32(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').toLowerCase();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeText(value: unknown, max = 120): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized && normalized.length <= max ? normalized : null;
}

function finiteNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return Math.round(value * 100) / 100;
}

export function createWarehouseDepotLayoutId(): string {
  return 'lay_' + randomHex32();
}

export function createWarehouseDepotLayoutObjectId(): string {
  return 'obj_' + randomHex32();
}

export function isValidWarehouseDepotLayoutId(value: unknown): value is string {
  return typeof value === 'string' && LAYOUT_ID_PATTERN.test(value);
}

export function isValidWarehouseDepotLayoutObjectId(value: unknown): value is string {
  return typeof value === 'string' && OBJECT_ID_PATTERN.test(value);
}

export function isValidWarehouseVisualLocationId(value: unknown): value is string {
  return isValidWarehouseLocationId(value) || isValidWarehouseSubpositionId(value);
}

export function warehouseLocationIdForPosition(
  position: WarehouseStockPosition
): string | null {
  if (position.kind === 'UNASSIGNED') return null;
  return position.kind === 'SUBPOSITION'
    ? position.subpositionId
    : position.locationId;
}

export function validateWarehouseDepotLayout(
  input: unknown,
  options: { expectedWorkspaceId?: string; expectedUg?: string | number } = {}
):
  | { ok: true; data: WarehouseDepotLayout; issues: [] }
  | { ok: false; issues: WarehouseDepotLayoutValidationIssue[] } {
  const issues: WarehouseDepotLayoutValidationIssue[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      issues: [{ code: 'invalid_root', path: '$', message: 'Layout deve ser um objeto.' }],
    };
  }
  const raw = input as Record<string, unknown>;
  const allowed = new Set([
    'schemaVersion', 'id', 'workspaceId', 'ug', 'name', 'depotId',
    'logicalWidth', 'logicalHeight', 'objects', 'version', 'status',
    'previousVersionId', 'createdBy', 'updatedBy',
  ]);
  if (Object.keys(raw).some((key) => !allowed.has(key))) {
    issues.push({ code: 'unexpected_field', path: '$', message: 'Layout contém campos fora do contrato.' });
  }
  if (raw.schemaVersion !== WAREHOUSE_DEPOT_LAYOUT_SCHEMA_VERSION) {
    issues.push({ code: 'invalid_schema_version', path: '$.schemaVersion', message: 'schemaVersion inválido.' });
  }

  const id = typeof raw.id === 'string' ? raw.id.trim().toLowerCase() : '';
  if (!isValidWarehouseDepotLayoutId(id)) {
    issues.push({ code: 'invalid_layout_id', path: '$.id', message: 'ID de layout inválido.' });
  }

  const workspaceId =
    typeof raw.workspaceId === 'string' ? normalizeWorkspaceId(raw.workspaceId) : '';
  if (!isValidWorkspaceId(workspaceId)) {
    issues.push({ code: 'invalid_workspace', path: '$.workspaceId', message: 'workspaceId inválido.' });
  }
  if (
    options.expectedWorkspaceId
    && workspaceId !== normalizeWorkspaceId(options.expectedWorkspaceId)
  ) {
    issues.push({ code: 'workspace_mismatch', path: '$.workspaceId', message: 'Layout pertence a outro workspace.' });
  }

  const ug = normalizeUnitUg(
    typeof raw.ug === 'string' || typeof raw.ug === 'number' ? raw.ug : null
  );
  if (!isValidUnitUg(ug)) {
    issues.push({ code: 'invalid_ug', path: '$.ug', message: 'UG inválida.' });
  }
  if (options.expectedUg && ug !== normalizeUnitUg(options.expectedUg)) {
    issues.push({ code: 'ug_mismatch', path: '$.ug', message: 'Layout pertence a outra UG.' });
  }

  const name = normalizeText(raw.name, 120);
  if (!name) issues.push({ code: 'invalid_name', path: '$.name', message: 'Nome do layout inválido.' });

  const depotId =
    raw.depotId === null || raw.depotId === undefined
      ? null
      : typeof raw.depotId === 'string'
        ? raw.depotId.trim().toLowerCase()
        : '';
  if (depotId !== null && !isValidWarehouseDepotId(depotId)) {
    issues.push({ code: 'invalid_depot_id', path: '$.depotId', message: 'depotId inválido.' });
  }

  const logicalWidth = finiteNumber(raw.logicalWidth, MIN_DIMENSION, MAX_DIMENSION);
  const logicalHeight = finiteNumber(raw.logicalHeight, MIN_DIMENSION, MAX_DIMENSION);
  if (logicalWidth === null) issues.push({ code: 'invalid_width', path: '$.logicalWidth', message: 'Largura lógica inválida.' });
  if (logicalHeight === null) issues.push({ code: 'invalid_height', path: '$.logicalHeight', message: 'Altura lógica inválida.' });

  const version = raw.version;
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1 || version > 100000) {
    issues.push({ code: 'invalid_version', path: '$.version', message: 'Versão inválida.' });
  }
  const status = raw.status;
  if (status !== 'active' && status !== 'archived') {
    issues.push({ code: 'invalid_status', path: '$.status', message: 'Status inválido.' });
  }

  const previousVersionId =
    raw.previousVersionId === null || raw.previousVersionId === undefined
      ? null
      : typeof raw.previousVersionId === 'string'
        ? raw.previousVersionId.trim().toLowerCase()
        : '';
  if (
    previousVersionId !== null
    && !isValidWarehouseDepotLayoutId(previousVersionId)
  ) {
    issues.push({ code: 'invalid_previous_version', path: '$.previousVersionId', message: 'Versão anterior inválida.' });
  }
  if (version === 1 && previousVersionId !== null) {
    issues.push({ code: 'unexpected_previous_version', path: '$.previousVersionId', message: 'Primeira versão não possui versão anterior.' });
  }
  if (typeof version === 'number' && version > 1 && previousVersionId === null) {
    issues.push({ code: 'missing_previous_version', path: '$.previousVersionId', message: 'Versão posterior exige referência anterior.' });
  }

  const createdBy = normalizeText(raw.createdBy, 160);
  const updatedBy = normalizeText(raw.updatedBy, 160);
  if (!createdBy) issues.push({ code: 'invalid_created_by', path: '$.createdBy', message: 'createdBy inválido.' });
  if (!updatedBy) issues.push({ code: 'invalid_updated_by', path: '$.updatedBy', message: 'updatedBy inválido.' });

  const rawObjects = Array.isArray(raw.objects) ? raw.objects : null;
  if (!rawObjects || rawObjects.length > MAX_OBJECTS) {
    issues.push({ code: 'invalid_objects', path: '$.objects', message: 'Objetos do layout inválidos ou acima do limite.' });
  }

  const objects: WarehouseDepotLayoutObject[] = [];
  const objectIds = new Set<string>();
  for (const [index, candidate] of (rawObjects || []).entries()) {
    const path = '$.objects[' + index + ']';
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      issues.push({ code: 'invalid_object', path, message: 'Objeto visual inválido.' });
      continue;
    }
    const object = candidate as Record<string, unknown>;
    const objectAllowed = new Set([
      'id', 'kind', 'label', 'x', 'y', 'width', 'height', 'rotation',
      'layer', 'elevation', 'visualVariant', 'warehouseLocationId',
    ]);
    if (Object.keys(object).some((key) => !objectAllowed.has(key))) {
      issues.push({ code: 'unexpected_object_field', path, message: 'Objeto contém campo inesperado.' });
    }

    const objectId = typeof object.id === 'string' ? object.id.trim().toLowerCase() : '';
    if (!isValidWarehouseDepotLayoutObjectId(objectId) || objectIds.has(objectId)) {
      issues.push({ code: 'invalid_object_id', path: path + '.id', message: 'ID visual inválido ou duplicado.' });
    }
    objectIds.add(objectId);

    const kind = WAREHOUSE_DEPOT_LAYOUT_OBJECT_KINDS.includes(
      object.kind as WarehouseDepotLayoutObjectKind
    )
      ? object.kind as WarehouseDepotLayoutObjectKind
      : null;
    if (!kind) issues.push({ code: 'invalid_object_kind', path: path + '.kind', message: 'Tipo visual inválido.' });

    const label = normalizeText(object.label, 100);
    if (!label) issues.push({ code: 'invalid_object_label', path: path + '.label', message: 'Rótulo visual inválido.' });

    const x = finiteNumber(object.x, 0, MAX_DIMENSION);
    const y = finiteNumber(object.y, 0, MAX_DIMENSION);
    const width = finiteNumber(object.width, 12, MAX_DIMENSION);
    const height = finiteNumber(object.height, 12, MAX_DIMENSION);
    const rotation = finiteNumber(object.rotation, -180, 180);
    const layer = typeof object.layer === 'number' && Number.isSafeInteger(object.layer) && object.layer >= 0 && object.layer <= 1000
      ? object.layer
      : null;
    const elevation = typeof object.elevation === 'number' && Number.isSafeInteger(object.elevation) && object.elevation >= 0 && object.elevation <= 4
      ? object.elevation
      : null;
    const visualVariant =
      object.visualVariant === 'solid' || object.visualVariant === 'outline' || object.visualVariant === 'zone'
        ? object.visualVariant
        : null;
    const warehouseLocationId =
      object.warehouseLocationId === null || object.warehouseLocationId === undefined
        ? null
        : typeof object.warehouseLocationId === 'string'
          ? object.warehouseLocationId.trim().toLowerCase()
          : '';

    if (x === null) issues.push({ code: 'invalid_x', path: path + '.x', message: 'X inválido.' });
    if (y === null) issues.push({ code: 'invalid_y', path: path + '.y', message: 'Y inválido.' });
    if (width === null) issues.push({ code: 'invalid_object_width', path: path + '.width', message: 'Largura inválida.' });
    if (height === null) issues.push({ code: 'invalid_object_height', path: path + '.height', message: 'Altura inválida.' });
    if (rotation === null) issues.push({ code: 'invalid_rotation', path: path + '.rotation', message: 'Rotação inválida.' });
    if (layer === null) issues.push({ code: 'invalid_layer', path: path + '.layer', message: 'Camada inválida.' });
    if (elevation === null) issues.push({ code: 'invalid_elevation', path: path + '.elevation', message: 'Elevação inválida.' });
    if (!visualVariant) issues.push({ code: 'invalid_visual_variant', path: path + '.visualVariant', message: 'Estilo inválido.' });
    if (warehouseLocationId !== null && !isValidWarehouseVisualLocationId(warehouseLocationId)) {
      issues.push({ code: 'invalid_warehouse_location_id', path: path + '.warehouseLocationId', message: 'warehouseLocationId inválido.' });
    }

    if (
      x !== null && y !== null && width !== null && height !== null
      && logicalWidth !== null && logicalHeight !== null
      && (x + width > logicalWidth || y + height > logicalHeight)
    ) {
      issues.push({ code: 'object_out_of_bounds', path, message: 'Objeto excede os limites lógicos do layout.' });
    }

    if (
      kind && label && x !== null && y !== null && width !== null && height !== null
      && rotation !== null && layer !== null && elevation !== null && visualVariant
      && (warehouseLocationId === null || isValidWarehouseVisualLocationId(warehouseLocationId))
    ) {
      objects.push({
        id: objectId,
        kind,
        label,
        x,
        y,
        width,
        height,
        rotation,
        layer,
        elevation,
        visualVariant,
        warehouseLocationId,
      });
    }
  }

  if (
    issues.length
    || !name
    || logicalWidth === null
    || logicalHeight === null
    || typeof version !== 'number'
    || (status !== 'active' && status !== 'archived')
    || !createdBy
    || !updatedBy
  ) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    issues: [],
    data: {
      schemaVersion: WAREHOUSE_DEPOT_LAYOUT_SCHEMA_VERSION,
      id,
      workspaceId,
      ug,
      name,
      depotId,
      logicalWidth,
      logicalHeight,
      objects,
      version,
      status,
      previousVersionId,
      createdBy,
      updatedBy,
    },
  };
}

export function createWarehouseDepotLayoutObject(
  input: Partial<WarehouseDepotLayoutObject> & Pick<WarehouseDepotLayoutObject, 'kind' | 'label'>
): WarehouseDepotLayoutObject {
  return {
    id: input.id || createWarehouseDepotLayoutObjectId(),
    kind: input.kind,
    label: input.label,
    x: input.x ?? 32,
    y: input.y ?? 32,
    width: input.width ?? 120,
    height: input.height ?? 72,
    rotation: input.rotation ?? 0,
    layer: input.layer ?? 1,
    elevation: input.elevation ?? 1,
    visualVariant: input.visualVariant ?? 'solid',
    warehouseLocationId: input.warehouseLocationId ?? null,
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function renderWarehouseDepotLayoutSvg(layout: WarehouseDepotLayout): string {
  const objects = [...layout.objects]
    .sort((a, b) => a.layer - b.layer || a.id.localeCompare(b.id))
    .map((object) => {
      const opacity = object.visualVariant === 'zone' ? 0.18 : 0.52;
      const fill = object.visualVariant === 'outline' ? 'none' : '#334155';
      const stroke = object.warehouseLocationId ? '#93c5fd' : '#64748b';
      const textY = object.y + Math.min(object.height / 2 + 4, 24);
      return [
        '<g data-object-id="' + escapeXml(object.id) + '">',
        '<rect x="' + object.x + '" y="' + object.y + '" width="' + object.width + '" height="' + object.height + '" rx="8"',
        ' fill="' + fill + '" fill-opacity="' + opacity + '" stroke="' + stroke + '" stroke-width="2"',
        ' transform="rotate(' + object.rotation + ' ' + (object.x + object.width / 2) + ' ' + (object.y + object.height / 2) + ')" />',
        '<text x="' + (object.x + 8) + '" y="' + textY + '" fill="#e2e8f0" font-size="12" font-family="system-ui, sans-serif">',
        escapeXml(object.label),
        '</text></g>',
      ].join('');
    })
    .join('');

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + layout.logicalWidth + ' ' + layout.logicalHeight + '">',
    '<rect width="100%" height="100%" fill="#020817"/>',
    objects,
    '</svg>',
  ].join('');
}
