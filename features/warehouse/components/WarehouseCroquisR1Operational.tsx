'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  DoorOpen,
  History,
  MapPinned,
  Plus,
  Ruler,
  Save,
  Warehouse,
} from 'lucide-react';

import {
  WAREHOUSE_LAYOUT_MAX_DIMENSION,
  createWarehouseDepotLayoutObject,
  type WarehouseDepotLayout,
  type WarehouseDepotLayoutObject,
  type WarehouseDepotLayoutObjectKind,
} from '../../../lib/warehouse/layout';
import {
  getActiveWarehouseDepotLayout,
  listWarehouseDepotLayoutsForDepot,
  saveWarehouseDepotLayoutVersion,
  type WarehouseDepotLayoutListItem,
} from '../../../lib/warehouse/layoutRepository';
import {
  createWarehouseLocation,
  listWarehouseDepots,
  listWarehousePositiveLocationBalances,
  listWarehouseLocations,
  updateWarehouseLocation,
  type WarehouseDepotListItem,
  type WarehouseLocationListItem,
} from '../../../lib/warehouse/locationRepository';
import { listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import { listWarehouseLots } from '../../../lib/warehouse/lotRepository';
import type { WarehouseLot } from '../../../lib/warehouse/lot';
import type { WarehouseInspectionLotState } from './WarehouseLocationInspection';
import type { WarehouseLocationBalance } from '../../../lib/warehouse/location';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import { WarehouseDepotLayoutEditor } from './WarehouseDepotLayoutEditor';
import { WarehouseIsometricPreview } from './WarehouseIsometricPreview';

const MIN_ROOM_CM = 240;
const DEFAULT_ROOM_LENGTH_CM = 1000;
const DEFAULT_ROOM_WIDTH_CM = 620;

type CanonicalWarehouseVisualKind =
  | 'SHELF'
  | 'PALLET'
  | 'FREEZER'
  | 'REFRIGERATOR'
  | 'BENCH';

const CANONICAL_VISUAL_KINDS: CanonicalWarehouseVisualKind[] = [
  'SHELF',
  'PALLET',
  'FREEZER',
  'REFRIGERATOR',
  'BENCH',
];

type LocalDraft = {
  widthCm: number;
  depthCm: number;
  kind: CanonicalWarehouseVisualKind;
};

type PendingDuplicatedLocal = {
  objectId: string;
  sourceLocationId: string;
  code: string;
  name: string;
  description: string | null;
};

function nextDuplicatedCode(sourceCode: string, usedCodes: Set<string>): string {
  const match = sourceCode.match(/^(.*?)(\d+)$/);
  const rawPrefix = match ? match[1] : sourceCode + '-';
  const digits = match?.[2] || '01';
  const width = Math.max(2, digits.length);
  let number = match ? Number(digits) + 1 : 2;

  for (let attempts = 0; attempts < 999; attempts += 1, number += 1) {
    const suffix = String(number).padStart(width, '0');
    const prefix = rawPrefix.slice(0, Math.max(1, 32 - suffix.length));
    const candidate = prefix + suffix;
    if (!usedCodes.has(candidate)) return candidate;
  }

  throw new Error('Não foi possível gerar um código único para o Local duplicado.');
}

function nextDuplicatedName(sourceName: string, code: string): string {
  const match = sourceName.match(/^(.*?)(\d+)$/);
  if (match) {
    const width = match[2].length;
    const codeNumber = code.match(/(\d+)$/)?.[1];
    if (codeNumber) return (match[1] + codeNumber.padStart(width, '0')).slice(0, 120);
  }
  return (sourceName + ' ' + (code.match(/(\d+)$/)?.[1] || '02')).slice(0, 120);
}

function duplicatedSubpositionCode(
  sourceChildCode: string,
  sourceLocalCode: string,
  targetLocalCode: string
): string {
  if (sourceChildCode.startsWith(sourceLocalCode)) {
    return (targetLocalCode + sourceChildCode.slice(sourceLocalCode.length)).slice(0, 32);
  }
  return sourceChildCode.slice(0, 32);
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function cloneObjects(objects: WarehouseDepotLayoutObject[]): WarehouseDepotLayoutObject[] {
  return objects.map((item) => ({ ...item }));
}

function inferKind(name: string): CanonicalWarehouseVisualKind {
  const normalized = name.toLocaleLowerCase('pt-BR');
  if (normalized.includes('freezer') || normalized.includes('câmara') || normalized.includes('camara')) {
    return 'FREEZER';
  }
  if (normalized.includes('geladeira') || normalized.includes('refrigerador')) return 'REFRIGERATOR';
  if (normalized.includes('palete') || normalized.includes('pallet')) return 'PALLET';
  if (
    normalized.includes('mesa')
    || normalized.includes('bancada')
    || normalized.includes('armário')
    || normalized.includes('armario')
  ) {
    return 'BENCH';
  }
  if (normalized.includes('estante') || normalized.includes('rack')) return 'SHELF';
  return 'SHELF';
}

function defaultSize(kind: CanonicalWarehouseVisualKind): { widthCm: number; depthCm: number } {
  if (kind === 'SHELF') return { widthCm: 180, depthCm: 50 };
  if (kind === 'FREEZER') return { widthCm: 140, depthCm: 75 };
  if (kind === 'REFRIGERATOR') return { widthCm: 90, depthCm: 75 };
  if (kind === 'PALLET') return { widthCm: 120, depthCm: 100 };
  return { widthCm: 180, depthCm: 70 };
}

function kindLabel(kind: CanonicalWarehouseVisualKind): string {
  const labels: Record<CanonicalWarehouseVisualKind, string> = {
    SHELF: 'Estante',
    PALLET: 'Palete',
    FREEZER: 'Freezer',
    REFRIGERATOR: 'Geladeira industrial',
    BENCH: 'Mesa / bancada',
  };
  return labels[kind];
}

function clampDimension(value: number, roomLimit: number): number {
  return Math.max(20, Math.min(roomLimit, Math.round(value || 20)));
}

export function WarehouseCroquisR1Operational({ workspaceId }: { workspaceId: string }) {
  const [depots, setDepots] = useState<WarehouseDepotListItem[]>([]);
  const [locations, setLocations] = useState<WarehouseLocationListItem[]>([]);
  const [selectedDepotId, setSelectedDepotId] = useState('');
  const [activeLayout, setActiveLayout] = useState<WarehouseDepotLayout | null>(null);
  const [history, setHistory] = useState<WarehouseDepotLayoutListItem[]>([]);

  const [draftName, setDraftName] = useState('Croqui principal');
  const [draftWidth, setDraftWidth] = useState(DEFAULT_ROOM_LENGTH_CM);
  const [draftHeight, setDraftHeight] = useState(DEFAULT_ROOM_WIDTH_CM);
  const [draftObjects, setDraftObjects] = useState<WarehouseDepotLayoutObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [draftHistory, setDraftHistory] = useState<{
    past: WarehouseDepotLayoutObject[][];
    future: WarehouseDepotLayoutObject[][];
  }>({ past: [], future: [] });

  const [setupLengthCm, setSetupLengthCm] = useState(DEFAULT_ROOM_LENGTH_CM);
  const [setupWidthCm, setSetupWidthCm] = useState(DEFAULT_ROOM_WIDTH_CM);
  const [editingDimensions, setEditingDimensions] = useState(false);
  const [doorWidths, setDoorWidths] = useState<number[]>([90]);
  const [setupReady, setSetupReady] = useState(false);
  const [localDrafts, setLocalDrafts] = useState<Record<string, LocalDraft>>({});
  const [pendingDuplicatedLocals, setPendingDuplicatedLocals] = useState<Record<string, PendingDuplicatedLocal>>({});
  const [pendingRemovedLocationIds, setPendingRemovedLocationIds] = useState<string[]>([]);
  const [croquiMode, setCroquiMode] = useState<'edit' | 'preview'>('edit');
  const [previewMaterials, setPreviewMaterials] = useState<WarehouseMaterial[]>([]);
  const [previewBalances, setPreviewBalances] = useState<WarehouseLocationBalance[]>([]);
  const [previewQuery, setPreviewQuery] = useState('');
  const [previewMaterialId, setPreviewMaterialId] = useState('');
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewInventoryComplete, setPreviewInventoryComplete] = useState(false);
  const [previewLots, setPreviewLots] = useState<WarehouseLot[]>([]);
  const [previewLotState, setPreviewLotState] = useState<WarehouseInspectionLotState>('idle');
  const [previewLotError, setPreviewLotError] = useState<string | null>(null);
  const [previewLotsComplete, setPreviewLotsComplete] = useState(true);
  const lotRequestRef = useRef(0);
  const navigationRef = useRef<string | null>(null);
  const [focusedLocationId, setFocusedLocationId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reloadBase = useCallback(async () => {
    setLoading(true);
    try {
      const [depotRows, locationRows] = await Promise.all([
        listWarehouseDepots(workspaceId, 250),
        listWarehouseLocations(workspaceId, 500),
      ]);
      setDepots(depotRows);
      setLocations(locationRows);
      const activeDepots = depotRows.filter((item) => item.depot.status === 'active');
      setSelectedDepotId((current) =>
        current && activeDepots.some((item) => item.depot.id === current)
          ? current
          : activeDepots[0]?.depot.id || ''
      );
    } catch (error) {
      setMessage(messageFrom(error));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void reloadBase();
  }, [reloadBase]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedDepotId) {
      setActiveLayout(null);
      setHistory([]);
      setDraftObjects([]);
      setSetupReady(false);
      return () => { cancelled = true; };
    }

    void Promise.all([
      getActiveWarehouseDepotLayout(workspaceId, selectedDepotId),
      listWarehouseDepotLayoutsForDepot(workspaceId, selectedDepotId, 100),
    ]).then(([active, versions]) => {
      if (cancelled) return;
      const layout = active?.layout || null;
      setActiveLayout(layout);
      setHistory(versions);
      setDraftName(layout?.name || 'Croqui principal');
      setDraftWidth(layout?.logicalWidth || DEFAULT_ROOM_LENGTH_CM);
      setDraftHeight(layout?.logicalHeight || DEFAULT_ROOM_WIDTH_CM);
      setDraftObjects(cloneObjects(layout?.objects || []));
      setSetupLengthCm(layout?.logicalWidth || DEFAULT_ROOM_LENGTH_CM);
      setSetupWidthCm(layout?.logicalHeight || DEFAULT_ROOM_WIDTH_CM);
      setSetupReady(Boolean(layout));
      setEditingDimensions(false);
      setSelectedObjectId(null);
      setDraftHistory({ past: [], future: [] });
      setPendingDuplicatedLocals({});
      setPendingRemovedLocationIds([]);
      const globalJump = navigationRef.current === selectedDepotId;
      navigationRef.current = null;
      // O salto global conserva o material escolhido e o índice de saldos já lido.
      if (!globalJump) {
        setCroquiMode('edit');
        setPreviewQuery('');
        setPreviewMaterialId('');
        setFocusedLocationId(null);
        setPreviewLoaded(false);
        setPreviewInventoryComplete(false);
        setPreviewLots([]);
        setPreviewLotState('idle');
        setPreviewLotError(null);
        setPreviewLotsComplete(true);
        lotRequestRef.current += 1;
      } else {
        setCroquiMode('preview');
      }
    }).catch((error) => {
      if (!cancelled) setMessage(messageFrom(error));
    });

    return () => { cancelled = true; };
  }, [selectedDepotId, workspaceId]);

  useEffect(() => {
    if (croquiMode !== 'preview' || previewLoaded) return;
    let cancelled = false;

    setPreviewLotState('loading');
    setPreviewLotError(null);
    // Compartilha os lotes com a inspeção já aprovada: UMA consulta por abertura
    // da prévia 3D, em vez de consultar novamente a cada hover.
    void Promise.all([
      listWarehouseMaterials(workspaceId, 500),
      listWarehousePositiveLocationBalances(workspaceId, 500),
      listWarehouseLots(workspaceId, 500),
    ]).then(([materials, balances, lotItems]) => {
      if (cancelled) return;
      setPreviewMaterials(materials);
      setPreviewInventoryComplete(materials.length < 500 && balances.length < 500);
      setPreviewLots(lotItems.map((item) => item.lot));
      setPreviewLotsComplete(lotItems.length < 500);
      setPreviewLotState('ready');
      setPreviewBalances(
        balances.map((item) => item.balance).filter((balance) =>
          balance.quantity > 0 && balance.position.kind !== 'UNASSIGNED'
        )
      );
      setPreviewLoaded(true);
    }).catch((error) => {
      if (!cancelled) {
        setMessage(
          'A prévia 3D estrutural continua disponível, mas a ocupação por estoque não pôde ser carregada. '
          + messageFrom(error)
        );
        setPreviewMaterials([]);
        setPreviewBalances([]);
        setPreviewInventoryComplete(false);
        setPreviewLots([]);
        setPreviewLotsComplete(false);
        setPreviewLotState('error');
        setPreviewLotError(messageFrom(error));
        setPreviewLoaded(true);
      }
    });

    return () => { cancelled = true; };
  }, [croquiMode, previewLoaded, selectedDepotId, workspaceId]);

  // Validades sob demanda: uma leitura de lotes por sessão de consulta, nunca por movimento do mouse.
  const loadPreviewLots = useCallback(async (refresh = false) => {
    if (!selectedDepotId || (!refresh && previewLotState !== 'idle')) return;
    const request = ++lotRequestRef.current;
    setPreviewLotState('loading');
    setPreviewLotError(null);
    try {
      const items = await listWarehouseLots(workspaceId, 500);
      if (request !== lotRequestRef.current) return;
      setPreviewLots(items.map((item) => item.lot));
      setPreviewLotsComplete(items.length < 500);
      setPreviewLotState('ready');
    } catch (error) {
      if (request !== lotRequestRef.current) return;
      setPreviewLotState('error');
      setPreviewLotError(messageFrom(error));
    }
  }, [previewLotState, selectedDepotId, workspaceId]);

  const refreshPreviewInspection = useCallback(async () => {
    if (!selectedDepotId) return;
    const request = ++lotRequestRef.current;
    setPreviewLotState('loading');
    setPreviewLotError(null);
    try {
      const [materials, balances, items] = await Promise.all([
        listWarehouseMaterials(workspaceId, 500),
        listWarehousePositiveLocationBalances(workspaceId, 500),
        listWarehouseLots(workspaceId, 500),
      ]);
      if (request !== lotRequestRef.current) return;
      setPreviewMaterials(materials);
      setPreviewBalances(
        balances.map((item) => item.balance).filter((balance) =>
          balance.quantity > 0 && balance.position.kind !== 'UNASSIGNED'
        )
      );
      setPreviewInventoryComplete(materials.length < 500 && balances.length < 500);
      setPreviewLots(items.map((item) => item.lot));
      setPreviewLotsComplete(items.length < 500);
      setPreviewLotState('ready');
    } catch (error) {
      if (request !== lotRequestRef.current) return;
      setPreviewLotError(messageFrom(error));
      setPreviewLotState('error');
    }
  }, [selectedDepotId, workspaceId]);

  const navigateToSearchResult = useCallback((depotId: string, locationId: string) => {
    setFocusedLocationId(locationId);
    if (depotId === selectedDepotId) return;
    navigationRef.current = depotId;
    setSelectedDepotId(depotId);
  }, [selectedDepotId]);

  const selectedDepot = useMemo(
    () => depots.find((item) => item.depot.id === selectedDepotId)?.depot || null,
    [depots, selectedDepotId]
  );

  const depotLocals = useMemo(
    () => locations.filter(
      (item) =>
        item.location.depotId === selectedDepotId
        && item.location.status === 'active'
        && item.location.kind === 'LOCAL'
    ),
    [locations, selectedDepotId]
  );

  const activeLocationIdsForSelectedDepot = useMemo(
    () => new Set(
      locations
        .filter(
          (item) =>
            item.location.depotId === selectedDepotId
            && item.location.status === 'active'
        )
        .map((item) => item.location.id)
    ),
    [locations, selectedDepotId]
  );

  useEffect(() => {
    if (!selectedDepotId || locations.length === 0) return;

    setDraftObjects((current) => {
      const next = current.filter(
        (object) =>
          !object.warehouseLocationId
          || activeLocationIdsForSelectedDepot.has(object.warehouseLocationId)
      );

      if (next.length === current.length) return current;

      setSelectedObjectId((selectedId) =>
        selectedId && next.some((object) => object.id === selectedId)
          ? selectedId
          : null
      );

      return next;
    });
  }, [activeLocationIdsForSelectedDepot, locations.length, selectedDepotId]);

  const previewObjects = useMemo(
    () => draftObjects.filter(
      (object) =>
        !object.warehouseLocationId
        || activeLocationIdsForSelectedDepot.has(object.warehouseLocationId)
    ),
    [activeLocationIdsForSelectedDepot, draftObjects]
  );

  const subpositionsByParent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of locations) {
      if (
        item.location.depotId === selectedDepotId
        && item.location.status === 'active'
        && item.location.kind === 'SUBPOSITION'
        && item.location.parentLocationId
      ) {
        counts.set(
          item.location.parentLocationId,
          (counts.get(item.location.parentLocationId) || 0) + 1
        );
      }
    }
    return counts;
  }, [locations, selectedDepotId]);

  const representedLocationIds = useMemo(
    () => new Set(
      draftObjects
        .map((object) => object.warehouseLocationId)
        .filter(Boolean) as string[]
    ),
    [draftObjects]
  );

  useEffect(() => {
    setPendingRemovedLocationIds((current) => {
      const next = current.filter((locationId) => !representedLocationIds.has(locationId));
      return next.length === current.length && next.every((value, index) => value === current[index])
        ? current
        : next;
    });
  }, [representedLocationIds]);

  useEffect(() => {
    const next: Record<string, LocalDraft> = {};
    for (const item of depotLocals) {
      const kind = inferKind(item.location.name + ' ' + item.location.code);
      const size = defaultSize(kind);
      next[item.location.id] = {
        widthCm: size.widthCm,
        depthCm: size.depthCm,
        kind,
      };
    }
    setLocalDrafts(next);
  }, [depotLocals]);

  const checkpoint = useCallback((previous: WarehouseDepotLayoutObject[]) => {
    setDraftHistory((current) => ({
      past: [...current.past.slice(-49), cloneObjects(previous)],
      future: [],
    }));
  }, []);

  const undo = useCallback(() => {
    setDraftHistory((current) => {
      const previous = current.past[current.past.length - 1];
      if (!previous) return current;
      setDraftObjects(cloneObjects(previous));
      setSelectedObjectId(null);
      return {
        past: current.past.slice(0, -1),
        future: [cloneObjects(draftObjects), ...current.future.slice(0, 49)],
      };
    });
  }, [draftObjects]);

  const redo = useCallback(() => {
    setDraftHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      setDraftObjects(cloneObjects(next));
      setSelectedObjectId(null);
      return {
        past: [...current.past.slice(-49), cloneObjects(draftObjects)],
        future: current.future.slice(1),
      };
    });
  }, [draftObjects]);

  function generateInitialCroqui() {
    const length = Math.max(MIN_ROOM_CM, Math.min(WAREHOUSE_LAYOUT_MAX_DIMENSION, Math.round(setupLengthCm || DEFAULT_ROOM_LENGTH_CM)));
    const width = Math.max(MIN_ROOM_CM, Math.min(WAREHOUSE_LAYOUT_MAX_DIMENSION, Math.round(setupWidthCm || DEFAULT_ROOM_WIDTH_CM)));
    const doors = doorWidths.map((door, index) => {
      const doorWidth = clampDimension(door, length - 20);
      const slot = length / (doorWidths.length + 1);
      return createWarehouseDepotLayoutObject({
        kind: 'OTHER',
        label: 'Porta ' + String(index + 1).padStart(2, '0'),
        width: doorWidth,
        height: 20,
        x: Math.max(10, Math.min(length - doorWidth - 10, Math.round(slot * (index + 1) - doorWidth / 2))),
        y: width - 20,
        rotation: 0,
        elevation: 0,
        visualVariant: 'outline',
        warehouseLocationId: null,
        layer: index + 1,
      });
    });

    setDraftWidth(length);
    setDraftHeight(width);
    setDraftObjects(doors);
    setDraftName('Croqui principal');
    setSelectedObjectId(null);
    setDraftHistory({ past: [], future: [] });
    setSetupReady(true);
    setEditingDimensions(false);
    setMessage('Croqui inicial criado em escala proporcional. Posicione as portas e depois insira os Locais cadastrados.');
  }

  function applyRoomDimensions() {
    const length = Math.max(
      MIN_ROOM_CM,
      Math.min(WAREHOUSE_LAYOUT_MAX_DIMENSION, Math.round(setupLengthCm || draftWidth))
    );
    const width = Math.max(
      MIN_ROOM_CM,
      Math.min(WAREHOUSE_LAYOUT_MAX_DIMENSION, Math.round(setupWidthCm || draftHeight))
    );

    if (length === draftWidth && width === draftHeight) {
      setEditingDimensions(false);
      setMessage('As medidas informadas já correspondem ao croqui atual.');
      return;
    }

    const widthRatio = length / Math.max(1, draftWidth);
    const heightRatio = width / Math.max(1, draftHeight);
    const previous = cloneObjects(draftObjects);
    checkpoint(previous);

    setDraftObjects(previous.map((object) => {
      const x = Math.min(
        Math.round(object.x * widthRatio * 100) / 100,
        Math.max(0, length - 12)
      );
      const y = Math.min(
        Math.round(object.y * heightRatio * 100) / 100,
        Math.max(0, width - 12)
      );
      const objectWidth = Math.min(
        Math.max(12, Math.round(object.width * widthRatio * 100) / 100),
        Math.max(12, length - x)
      );
      const objectHeight = Math.min(
        Math.max(12, Math.round(object.height * heightRatio * 100) / 100),
        Math.max(12, width - y)
      );
      return {
        ...object,
        x,
        y,
        width: objectWidth,
        height: objectHeight,
      };
    }));

    setDraftWidth(length);
    setDraftHeight(width);
    setSetupLengthCm(length);
    setSetupWidthCm(width);
    setSelectedObjectId(null);
    setPreviewLoaded(false);
    setEditingDimensions(false);
    setMessage(
      'Dimensões atualizadas para ' + length + ' × ' + width
      + '. Os elementos foram reposicionados proporcionalmente. Salve uma nova versão para persistir.'
    );
  }

  function addLocalToCroqui(item: WarehouseLocationListItem) {
    const draft = localDrafts[item.location.id];
    if (!draft || representedLocationIds.has(item.location.id)) return;
    const widthCm = clampDimension(draft.widthCm, draftWidth - 20);
    const depthCm = clampDimension(draft.depthCm, draftHeight - 20);
    const next = createWarehouseDepotLayoutObject({
      kind: draft.kind,
      label: item.location.code + ' · ' + item.location.name,
      width: widthCm,
      height: depthCm,
      x: 30,
      y: 30,
      rotation: 0,
      elevation: 1,
      visualVariant: 'solid',
      warehouseLocationId: item.location.id,
      layer: Math.max(0, ...draftObjects.map((object) => object.layer)) + 1,
    });
    checkpoint(draftObjects);
    setDraftObjects([...draftObjects, next]);
    setPendingRemovedLocationIds((current) => current.filter((id) => id !== item.location.id));
    setSelectedObjectId(next.id);
  }

  function handleRemoveObject(object: WarehouseDepotLayoutObject) {
    if (object.warehouseLocationId) {
      setMessage('O local foi retirado apenas do desenho. O cadastro e seu estoque continuam preservados. Para inativar, use o cadastro operacional.');
    }
  }

  function prepareDuplicatedObject(
    _source: WarehouseDepotLayoutObject,
    copy: WarehouseDepotLayoutObject
  ): WarehouseDepotLayoutObject {
    setMessage('Cópia visual criada sem novo cadastro. Cadastre outros locais somente em Cadastramento de Depósito.');
    return { ...copy, warehouseLocationId: null, label: 'Cópia visual · ' + copy.label.slice(0, 75) };
  }

  async function saveLayout() {
    if (!selectedDepotId || !selectedDepot || !setupReady) return;
    setSaving(true);
    setMessage(null);
    try {
      let objectsForSave = cloneObjects(draftObjects);
      // Croquis edita apenas geometria. Não cria Local ou Prateleira.
      const saved = await saveWarehouseDepotLayoutVersion(workspaceId, {
        name: draftName.trim() || 'Croqui principal',
        depotId: selectedDepotId,
        logicalWidth: draftWidth,
        logicalHeight: draftHeight,
        objects: objectsForSave,
        baseLayoutId: activeLayout?.id || null,
        expectedVersion: activeLayout?.version ?? null,
      });

      // Retirar um objeto do croqui nunca desativa uma posição com estoque.
      setMessage(
        'Croqui salvo com sucesso. Versão ' + saved.version + ' ativa.'

      );
      const [active, versions] = await Promise.all([
        getActiveWarehouseDepotLayout(workspaceId, selectedDepotId),
        listWarehouseDepotLayoutsForDepot(workspaceId, selectedDepotId, 100),
      ]);
      setActiveLayout(active?.layout || saved);
      setHistory(versions);
      setDraftObjects(objectsForSave);
      setPendingDuplicatedLocals({});
      setPendingRemovedLocationIds([]);
      setDraftHistory({ past: [], future: [] });
      setPreviewLoaded(false);
      await reloadBase();
    } catch (error) {
      setMessage('Não foi possível salvar o croqui. ' + messageFrom(error));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">
        Carregando depósitos e localizações…
      </div>
    );
  }

  const activeDepots = depots.filter((item) => item.depot.status === 'active');
  if (!activeDepots.length) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="font-black text-amber-900">Cadastre um depósito antes de desenhar o croqui.</p>
      </div>
    );
  }

  return (
    <section className="space-y-4" data-testid="warehouse-r1-croquis">
      <div className="rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#00288e]/70">
              Croqui operacional
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-900">Desenhar depósito</h2>
            <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-slate-600">
              O croqui usa centímetros como unidade lógica. Assim, o ambiente e as estruturas mantêm proporção real sem virar uma planta arquitetônica complexa.
            </p>
          </div>

          <label className="xl:w-[360px]">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">
              1. Selecione o depósito
            </span>
            <select
              value={selectedDepotId}
              onChange={(event) => setSelectedDepotId(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            >
              {activeDepots.map((item) => (
                <option key={item.depot.id} value={item.depot.id}>
                  {item.depot.code} · {item.depot.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {!setupReady ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-[#00288e]" />
              <h3 className="text-sm font-black text-slate-900">2. Medidas do depósito</h3>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Informe as medidas internas aproximadas em centímetros. O croqui será criado na mesma proporção.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">Comprimento (cm)</span>
                <input
                  type="number"
                  min={MIN_ROOM_CM}
                  max={WAREHOUSE_LAYOUT_MAX_DIMENSION}
                  value={setupLengthCm}
                  onChange={(event) => setSetupLengthCm(Number(event.target.value))}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800"
                />
              </label>
              <label>
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">Largura (cm)</span>
                <input
                  type="number"
                  min={MIN_ROOM_CM}
                  max={WAREHOUSE_LAYOUT_MAX_DIMENSION}
                  value={setupWidthCm}
                  onChange={(event) => setSetupWidthCm(Number(event.target.value))}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-[#00288e]" />
              <h3 className="text-sm font-black text-slate-900">3. Portas</h3>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              As portas são os primeiros elementos do croqui. Informe quantas existem e a largura aproximada de cada uma.
            </p>

            <label className="mt-4 block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">Quantidade de portas</span>
              <select
                value={doorWidths.length}
                onChange={(event) => {
                  const count = Number(event.target.value);
                  setDoorWidths((current) =>
                    Array.from({ length: count }, (_, index) => current[index] || 90)
                  );
                }}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800"
              >
                {[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}
              </select>
            </label>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {doorWidths.map((width, index) => (
                <label key={index}>
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    Porta {index + 1} · largura (cm)
                  </span>
                  <input
                    type="number"
                    min={50}
                    max={500}
                    value={width}
                    onChange={(event) =>
                      setDoorWidths((current) =>
                        current.map((item, doorIndex) =>
                          doorIndex === index ? Number(event.target.value) : item
                        )
                      )
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800"
                  />
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={generateInitialCroqui}
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-[#00288e] px-5 text-xs font-black text-white shadow-sm hover:bg-blue-800"
            >
              <MapPinned className="h-4 w-4" />
              Gerar base do croqui
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 font-black text-[#00288e]">
                  <Warehouse className="mr-1.5 inline h-3.5 w-3.5" />
                  {selectedDepot?.code}
                </span>
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-600">
                  {draftWidth} × {draftHeight} cm
                </span>
                <button
                  type="button"
                  data-testid="warehouse-r1-edit-dimensions"
                  onClick={() => {
                    setSetupLengthCm(draftWidth);
                    setSetupWidthCm(draftHeight);
                    setEditingDimensions((current) => !current);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-black text-[#00288e] hover:bg-blue-100"
                >
                  <Ruler className="h-3.5 w-3.5" />
                  Editar dimensões
                </button>
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-600">
                  {depotLocals.length} Locais cadastrados
                </span>
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-600">
                  {activeLayout ? 'Versão ativa ' + activeLayout.version : 'Novo croqui'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  className="h-10 w-44 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800"
                  aria-label="Nome do croqui"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveLayout()}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white shadow-sm hover:bg-blue-800 disabled:opacity-40"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Salvando…' : 'Salvar versão'}
                </button>
              </div>
            </div>
          </div>

          {editingDimensions && (
            <div
              className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm"
              data-testid="warehouse-r1-dimension-editor"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <label className="flex-1">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    Comprimento (cm)
                  </span>
                  <input
                    type="number"
                    min={MIN_ROOM_CM}
                    max={WAREHOUSE_LAYOUT_MAX_DIMENSION}
                    value={setupLengthCm}
                    onChange={(event) => setSetupLengthCm(Number(event.target.value))}
                    className="h-10 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm font-bold text-slate-800"
                  />
                </label>
                <label className="flex-1">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    Largura (cm)
                  </span>
                  <input
                    type="number"
                    min={MIN_ROOM_CM}
                    max={WAREHOUSE_LAYOUT_MAX_DIMENSION}
                    value={setupWidthCm}
                    onChange={(event) => setSetupWidthCm(Number(event.target.value))}
                    className="h-10 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm font-bold text-slate-800"
                  />
                </label>
                <button
                  type="button"
                  onClick={applyRoomDimensions}
                  className="h-10 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white hover:bg-blue-800"
                >
                  Aplicar e preservar proporções
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSetupLengthCm(draftWidth);
                    setSetupWidthCm(draftHeight);
                    setEditingDimensions(false);
                  }}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
              <p className="mt-2 text-[10px] leading-5 text-slate-500">
                A alteração redimensiona e reposiciona os elementos proporcionalmente. O estoque e os vínculos logísticos não são alterados.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <button
              type="button"
              onClick={() => setCroquiMode('edit')}
              className={
                croquiMode === 'edit'
                  ? 'h-10 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white shadow-sm'
                  : 'h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-blue-50'
              }
            >
              Edição 2D
            </button>
            <button
              type="button"
              onClick={() => setCroquiMode('preview')}
              className={
                croquiMode === 'preview'
                  ? 'h-10 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white shadow-sm'
                  : 'h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-blue-50'
              }
            >
              Prévia 3D
            </button>
            <p className="ml-1 text-[11px] font-semibold text-slate-500">
              A prévia deriva do mesmo croqui; editar continua sendo feito no modo 2D.
            </p>
          </div>

          {croquiMode === 'preview' ? (
            <WarehouseIsometricPreview
              logicalWidth={draftWidth}
              logicalHeight={draftHeight}
              objects={previewObjects}
              locations={locations
                .filter(
                  (item) =>
                    item.location.depotId === selectedDepotId
                    && item.location.status === 'active'
                )
                .map((item) => item.location)}
              balances={previewBalances.filter((balance) =>
                balance.position.kind !== 'UNASSIGNED'
                && balance.position.depotId === selectedDepotId
              )}
              materials={previewMaterials}
              globalDepots={depots.map((item) => item.depot)}
              globalLocations={locations.map((item) => item.location)}
              globalBalances={previewBalances}
              globalLoaded={previewLoaded}
              globalComplete={
                previewInventoryComplete
                && depots.length < 250
                && locations.length < 500
              }
              focusedLocationId={focusedLocationId}
              onNavigateToGlobalLocation={(depotId, locationId) =>
                navigateToSearchResult(depotId, locationId)
              }
              depotId={selectedDepotId}
              inspectionLots={previewLots}
              inspectionLotState={previewLotState}
              inspectionError={previewLotError}
              inspectionComplete={previewInventoryComplete && previewLotsComplete}
              inspectionAvailable={previewLoaded}
              depotName={selectedDepot?.name || 'Depósito'}
              onInspectLocation={() => { void loadPreviewLots(); }}
              onRefreshInspection={() => { void refreshPreviewInspection(); }}
              selectedMaterialId={previewMaterialId}
              queryText={previewQuery}
              onQueryTextChange={setPreviewQuery}
              onSelectedMaterialIdChange={setPreviewMaterialId}
            />
          ) : (
          <div className="grid gap-4 2xl:grid-cols-[320px_minmax(0,1fr)_260px]">
            <aside className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-[#00288e]" />
                  <h3 className="text-sm font-black text-slate-900">Locais do depósito</h3>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">
                  Somente os Locais já cadastrados podem ser inseridos. O tipo visual é padronizado em cinco modelos: Estante, Palete, Freezer, Geladeira industrial e Mesa / bancada.
                </p>

                <div className="mt-3 max-h-[640px] space-y-3 overflow-y-auto pr-1">
                  {depotLocals.map((item) => {
                    const inserted = representedLocationIds.has(item.location.id);
                    const localDraft = localDrafts[item.location.id];
                    if (!localDraft) return null;
                    return (
                      <div key={item.location.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-black text-slate-800">{item.location.code} · {item.location.name}</p>
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              {subpositionsByParent.get(item.location.id) || 0} subposição(ões)
                            </p>
                          </div>
                          {inserted && (
                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black text-emerald-700">
                              Inserido
                            </span>
                          )}
                        </div>

                        {!inserted && (
                          <>
                            <label className="mt-3 block">
                              <span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-500">Tipo visual</span>
                              <select
                                value={localDraft.kind}
                                onChange={(event) =>
                                  setLocalDrafts((current) => ({
                                    ...current,
                                    [item.location.id]: {
                                      ...current[item.location.id],
                                      kind: event.target.value as CanonicalWarehouseVisualKind,
                                    },
                                  }))
                                }
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700"
                              >
                                {CANONICAL_VISUAL_KINDS.map((kind) => (
                                  <option key={kind} value={kind}>{kindLabel(kind)}</option>
                                ))}
                              </select>
                            </label>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <label>
                                <span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-500">Comp. (cm)</span>
                                <input
                                  type="number"
                                  min={20}
                                  value={localDraft.widthCm}
                                  onChange={(event) =>
                                    setLocalDrafts((current) => ({
                                      ...current,
                                      [item.location.id]: {
                                        ...current[item.location.id],
                                        widthCm: Number(event.target.value),
                                      },
                                    }))
                                  }
                                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700"
                                />
                              </label>
                              <label>
                                <span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-500">Larg. (cm)</span>
                                <input
                                  type="number"
                                  min={20}
                                  value={localDraft.depthCm}
                                  onChange={(event) =>
                                    setLocalDrafts((current) => ({
                                      ...current,
                                      [item.location.id]: {
                                        ...current[item.location.id],
                                        depthCm: Number(event.target.value),
                                      },
                                    }))
                                  }
                                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700"
                                />
                              </label>
                            </div>
                            <button
                              type="button"
                              onClick={() => addLocalToCroqui(item)}
                              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#00288e] px-3 text-[10px] font-black text-white hover:bg-blue-800"
                            >
                              <Plus className="h-3.5 w-3.5" /> Inserir no croqui
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>

            <div className="min-w-0">
              <WarehouseDepotLayoutEditor
                logicalWidth={draftWidth}
                logicalHeight={draftHeight}
                objects={draftObjects}
                selectedObjectId={selectedObjectId}
                onSelectedObjectIdChange={setSelectedObjectId}
                onObjectsChange={setDraftObjects}
                onHistoryCheckpoint={checkpoint}
                canUndo={draftHistory.past.length > 0}
                canRedo={draftHistory.future.length > 0}
                onUndo={undo}
                onRedo={redo}
                scopeKey={selectedDepotId + ':' + (activeLayout?.id || 'new')}
                lightTheme
                allowResize={false}
                onDuplicateObject={prepareDuplicatedObject}
                onRemoveObject={handleRemoveObject}
              />
            </div>

            <aside className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#00288e]" />
                  <h3 className="text-sm font-black text-slate-900">Orientação</h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Os objetos já entram dimensionados. No desenho você pode mover e girar, mas não redimensionar livremente.
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Para corrigir o tamanho de um Local já inserido, remova-o do croqui e insira novamente com as medidas corretas.
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Ao duplicar um Local, a cópia recebe um novo código e também replica suas Subposições. Ao salvar o croqui, toda essa nova estrutura é cadastrada automaticamente em Depósitos e localizações.
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Ao remover do croqui um Local já cadastrado, a exclusão fica pendente. Ao salvar, o Local e suas Subposições são excluídos da operação também em Depósitos e localizações.
                </p>
                {Object.values(pendingDuplicatedLocals).filter((pending) =>
                  draftObjects.some((object) => object.id === pending.objectId)
                ).length > 0 && (
                  <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[#00288e]">
                      Novos Locais ao salvar
                    </p>
                    <div className="mt-2 space-y-1">
                      {Object.values(pendingDuplicatedLocals)
                        .filter((pending) => draftObjects.some((object) => object.id === pending.objectId))
                        .map((pending) => (
                          <p key={pending.objectId} className="text-[11px] font-bold text-slate-700">
                            {pending.code} · {pending.name}
                          </p>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-[#00288e]" />
                  <h3 className="text-sm font-black text-slate-900">Versões</h3>
                </div>
                {history.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-500">Nenhuma versão salva.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {history.slice(0, 8).map((item) => (
                      <div key={item.layout.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-xs font-black text-slate-800">v{item.layout.version} · {item.layout.name}</p>
                        <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                          {item.layout.status === 'active' ? 'Ativa' : 'Arquivada'} · {item.layout.objects.length} objeto(s)
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
          )}
        </>
      )}

      {message && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-slate-700">
          {message}
        </div>
      )}
    </section>
  );
}
