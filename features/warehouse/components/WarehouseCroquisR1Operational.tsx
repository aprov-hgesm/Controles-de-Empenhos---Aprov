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
  Printer,
  Settings2,
  Archive,
  X,
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
  updateWarehouseDepot,
  archiveWarehouseStructure,
  listWarehouseDepots,
  listWarehousePositiveLocationBalances,
  listWarehouseLocations,
  updateWarehouseLocation,
  type WarehouseDepotListItem,
  type WarehouseLocationListItem,
} from '../../../lib/warehouse/locationRepository';
import { listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import { listWarehouseLots, listWarehouseVisualExpiryLots } from '../../../lib/warehouse/lotRepository';
import type { WarehouseLot } from '../../../lib/warehouse/lot';
import type { WarehouseInspectionLotState } from './WarehouseLocationInspection';
import type { WarehouseLocationBalance } from '../../../lib/warehouse/location';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import { applyWarehouseCroquiStructure } from '../../../lib/warehouse/croquiStructureRepository';
import { readWarehouseCroquiCatalog, readWarehouseCroquiLayouts } from '../../../lib/warehouse/croquiReadRepository';
import { warehouseObjectFaceLabels } from '../../../lib/warehouse/layoutOrientation';
import { warehouseNextAvailableLocationCode, warehouseCodeFromVisualLabel } from '../../../lib/warehouse/locationCodeSequence';
import { warehouseFindFreePosition, warehouseFindOverlappingLocals, warehouseLocalHasCollision } from '../../../lib/warehouse/layoutCollision';
import { WarehouseDepotQuickCreate } from './WarehouseDepotQuickCreate';
import { WarehouseLabelsR1 } from './WarehouseLabelsR1';
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
  sourceLocationId: string | null;
  code: string;
  name: string;
  description: string | null;
  subpositionCount: number;
};


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
  const [localEdits, setLocalEdits] = useState<Record<string, {name:string;description:string|null}>>({});
  const [newKind, setNewKind] = useState<CanonicalWarehouseVisualKind>('SHELF');
  const [showDepotRegistration, setShowDepotRegistration] = useState(false);
  const [showDepotSettings, setShowDepotSettings] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [depotWorking, setDepotWorking] = useState(false);
  const [depotEdit, setDepotEdit] = useState<{
    name: string; description: string; visualType: 'STANDARD'|'CONTAINER'|'COLD_CONTAINER';
    sizeProfile: 'SMALL'|'MEDIUM'|'LARGE';
  } | null>(null);
  const [newSubpositions, setNewSubpositions] = useState<Array<{
    parentLocationId:string;code:string;name:string;description:string|null;
  }>>([]);
  const [removedSubpositionIds, setRemovedSubpositionIds] = useState<string[]>([]);
  const saveOperationRef = useRef<string | null>(null);
  const [croquiMode, setCroquiMode] = useState<'edit' | 'preview'>('edit');
  const [previewMaterials, setPreviewMaterials] = useState<WarehouseMaterial[]>([]);
  const [previewBalances, setPreviewBalances] = useState<WarehouseLocationBalance[]>([]);
  const [previewQuery, setPreviewQuery] = useState('');
  const [previewMaterialId, setPreviewMaterialId] = useState('');
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewInventoryComplete, setPreviewInventoryComplete] = useState(false);
  const [previewLots, setPreviewLots] = useState<WarehouseLot[]>([]);
  const [visualExpiryLots, setVisualExpiryLots] = useState<WarehouseLot[]>([]);
  const [visualExpiryComplete, setVisualExpiryComplete] = useState(true);
  const [previewLotState, setPreviewLotState] = useState<WarehouseInspectionLotState>('idle');
  const [previewLotError, setPreviewLotError] = useState<string | null>(null);
  const [previewLotsComplete, setPreviewLotsComplete] = useState(true);
  const lotRequestRef = useRef(0);
  const navigationRef = useRef<string | null>(null);
  const [focusedLocationId, setFocusedLocationId] = useState<string | null>(null);

  useEffect(()=>{saveOperationRef.current=null;},[
    draftObjects,pendingDuplicatedLocals,pendingRemovedLocationIds,localEdits,
    newSubpositions,removedSubpositionIds,draftName,draftWidth,draftHeight,
  ]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reloadBase = useCallback(async () => {
    setLoading(true);
    try {
      const {depots:depotRows, locations:locationRows} = await readWarehouseCroquiCatalog(workspaceId);
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

    void readWarehouseCroquiLayouts(workspaceId,selectedDepotId).then(({active,layouts:versions}) => {
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
      setLocalEdits({});
      setNewSubpositions([]);
      setRemovedSubpositionIds([]);
      saveOperationRef.current = null;
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
        setVisualExpiryLots([]);
        setVisualExpiryComplete(true);
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

    // Leitura indexada só de lotes vencidos e até +14d para o 3D.
    // Lotes completos para relatório só depois do primeiro hover/clique.
    setPreviewLotState('idle');
    setPreviewLotError(null);
    void Promise.all([
      listWarehouseMaterials(workspaceId, 500),
      listWarehousePositiveLocationBalances(workspaceId, 500),
      listWarehouseVisualExpiryLots(workspaceId, 500),
    ]).then(([materials, balances, visualLotItems]) => {
      if (cancelled) return;
      setPreviewMaterials(materials);
      setPreviewInventoryComplete(materials.length < 500 && balances.length < 500);
      setVisualExpiryLots(visualLotItems.map((item) => item.lot));
      setVisualExpiryComplete(visualLotItems.length < 500);
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
        setVisualExpiryLots([]);
        setVisualExpiryComplete(false);
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

  function openDepotSettings() {
    if (!selectedDepot) return;
    setDepotEdit({
      name: selectedDepot.name,
      description: selectedDepot.description || '',
      visualType: selectedDepot.visualType,
      sizeProfile: selectedDepot.sizeProfile,
    });
    setShowDepotRegistration(false);
    setShowLabels(false);
    setShowDepotSettings(true);
  }

  async function saveDepotSettings() {
    if (!selectedDepot || !depotEdit || depotWorking) return;
    setDepotWorking(true);
    setMessage(null);
    try {
      await updateWarehouseDepot(workspaceId, selectedDepot.id, {
        name: depotEdit.name, description: depotEdit.description.trim() || null,
        visualType: depotEdit.visualType, sizeProfile: depotEdit.sizeProfile,
      });
      await reloadBase();
      setShowDepotSettings(false);
      setDepotEdit(null);
      setMessage('Dados do depósito atualizados. Código e histórico preservados.');
    } catch (error) { setMessage('Não foi possível atualizar o depósito: ' + messageFrom(error)); }
    finally { setDepotWorking(false); }
  }

  async function archiveSelectedDepot() {
    if (!selectedDepot || depotWorking || saving) return;
    const hasUncommitted = pendingRemovedLocationIds.length > 0
      || Object.keys(pendingDuplicatedLocals).length > 0
      || newSubpositions.length > 0 || removedSubpositionIds.length > 0
      || Object.keys(localEdits).length > 0 || draftHistory.past.length > 0;
    if (hasUncommitted) {
      setMessage('Salve ou descarte as alterações do croqui antes de inativar o depósito.');
      return;
    }
    if (!window.confirm('Inativar ' + selectedDepot.code + ' e seus locais? '
      + 'Não será permitido se houver saldos ou lotes ativos. '
      + 'Os históricos e etiquetas antigas continuarão preservados.')) return;
    setDepotWorking(true);
    setMessage(null);
    try {
      await archiveWarehouseStructure(workspaceId, {kind:'DEPOT',id:selectedDepot.id});
      setShowDepotSettings(false);
      setDepotEdit(null);
      setSelectedDepotId('');
      await reloadBase();
      setMessage('Depósito e suas estruturas inativados, sem excluir o histórico.');
    } catch (error) {setMessage('Inativação não realizada: ' + messageFrom(error));}
    finally {setDepotWorking(false);}
  }

  const depotLocals = useMemo(
    () => locations.filter(
      (item) =>
        item.location.depotId === selectedDepotId
        && item.location.status === 'active'
        && item.location.kind === 'LOCAL'
    ).sort((a,b)=>a.location.code.localeCompare(b.location.code,'pt-BR',{numeric:true})),
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
    const scaled = previous.map((object) => {
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
    });
    if(warehouseFindOverlappingLocals(scaled).length){
      setMessage('Essas dimensões causariam sobreposição de locais. '
        +'Mantenha as medidas atuais e reposicione as estruturas antes de redimensionar.');
      return;
    }
    checkpoint(previous);
    setDraftObjects(scaled);

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
    const position=warehouseFindFreePosition(next,draftObjects,draftWidth,draftHeight,{x:30,y:30});
    if(!position){
      setMessage('Não existe espaço livre para inserir '+item.location.code+'. Reorganize o depósito.');
      return;
    }
    checkpoint(draftObjects);
    setDraftObjects([...draftObjects,{...next,...position}]);
    setPendingRemovedLocationIds((current) => current.filter((id) => id !== item.location.id));
    setSelectedObjectId(next.id);
  }

  const selectedLayoutObject = draftObjects.find((object) => object.id === selectedObjectId) || null;
  const selectedFaces = selectedLayoutObject ? warehouseObjectFaceLabels(selectedLayoutObject) : null;
  const selectedLocation = selectedLayoutObject?.warehouseLocationId
    ? locations.find((row) => row.location.id === selectedLayoutObject.warehouseLocationId)?.location || null
    : null;
  const selectedPending = selectedLayoutObject
    ? pendingDuplicatedLocals[selectedLayoutObject.id] || null : null;
  const selectedCode = selectedPending?.code || selectedLocation?.code || '';
  const selectedName = selectedPending?.name
    || (selectedLocation ? localEdits[selectedLocation.id]?.name || selectedLocation.name : '');
  const selectedChildren = selectedLocation
    ? locations.filter((row) => row.location.parentLocationId === selectedLocation.id
      && row.location.kind === 'SUBPOSITION' && row.location.status === 'active'
      && !removedSubpositionIds.includes(row.location.id))
    : [];
  function addCroquiSubposition(parentId:string,code:string) {
    const used=new Set([
      ...locations.filter(row=>row.location.parentLocationId===parentId&&row.location.status==='active')
        .map(row=>row.location.code),
      ...newSubpositions.filter(row=>row.parentLocationId===parentId).map(row=>row.code),
    ]);
    const nextCode=warehouseNextAvailableLocationCode(code+'-00',used);
    const sequence=nextCode.split('-').at(-1)||'01';
    setNewSubpositions(current=>[...current,{
      parentLocationId:parentId,code:nextCode,name:'Subposição '+sequence,description:null,
    }]);
    setMessage(nextCode+' preparada. A nova subposição será cadastrada ao salvar.');
  }

  function addSubpositionFromContext(object: WarehouseDepotLayoutObject) {
    const pending = pendingDuplicatedLocals[object.id];
    if (pending) {
      const copiedCount = pending.sourceLocationId
        ? locations.filter(row => row.location.parentLocationId === pending.sourceLocationId
          && row.location.kind === 'SUBPOSITION' && row.location.status === 'active').length
        : 0;
      if (copiedCount + pending.subpositionCount >= 30) {
        setMessage('Este local já alcançou o limite de 30 subposições.');
        return;
      }
      setPendingDuplicatedLocals(current => {
        const existing = current[object.id];
        return existing ? {
          ...current,
          [object.id]: { ...existing, subpositionCount: existing.subpositionCount + 1 },
        } : current;
      });
      setMessage('Uma subposição adicional foi preparada para ' + pending.code
        + '. Salve o croqui para concluir o cadastro.');
      return;
    }
    const location = object.warehouseLocationId
      ? locations.find(row => row.location.id === object.warehouseLocationId)?.location
      : null;
    if (location && location.kind === 'LOCAL' && location.status === 'active'
      && !pendingRemovedLocationIds.includes(location.id)) {
      const existingCount = locations.filter(row => row.location.parentLocationId === location.id
        && row.location.kind === 'SUBPOSITION' && row.location.status === 'active'
        && !removedSubpositionIds.includes(row.location.id)).length;
      const addedCount = newSubpositions.filter(row => row.parentLocationId === location.id).length;
      if (existingCount + addedCount >= 30) {
        setMessage('Este local já alcançou o limite de 30 subposições.');
        return;
      }
      addCroquiSubposition(location.id, location.code);
      return;
    }
    setMessage('Este objeto ainda não está cadastrado. Cadastre o local antes de incluir subposições.');
  }

  const usedCroquiCodes = () => new Set([
    ...locations.filter((row) => row.location.depotId === selectedDepotId && row.location.status === 'active'
      && (!pendingRemovedLocationIds.includes(row.location.id)
        || draftObjects.some(object=>object.warehouseLocationId===row.location.id)))
      .map((row) => row.location.code),
    ...Object.values(pendingDuplicatedLocals)
      .filter(entry=>draftObjects.some(object=>object.id===entry.objectId))
      .map((entry) => entry.code),
  ]);

  function addNewCroquiLocal(kind: CanonicalWarehouseVisualKind) {
    if(!selectedDepotId || !setupReady || saving) return;
    const prefixes:Record<CanonicalWarehouseVisualKind,string> = {
      SHELF:'EST-',PALLET:'PAL-',FREEZER:'FRZ-',REFRIGERATOR:'GEL-',BENCH:'MES-',
    };
    const labelPrefix=prefixes[kind];
    const code=warehouseNextAvailableLocationCode(labelPrefix+'00',usedCroquiCodes());
    const name=kindLabel(kind)+' '+code.split('-').at(-1);
    const dims=defaultSize(kind);
    const width=Math.min(dims.widthCm,draftWidth-20);
    const height=Math.min(dims.depthCm,draftHeight-20);
    const draft=createWarehouseDepotLayoutObject({
      kind,label:code+' · '+name,width,height,
      x:20,y:20,rotation:0,elevation:1,visualVariant:'solid',
      warehouseLocationId:null,layer:Math.max(0,...draftObjects.map(x=>x.layer))+1,
    });
    const free=warehouseFindFreePosition(draft,draftObjects,draftWidth,draftHeight,
      {x:20,y:20});
    if(!free){
      setMessage('Não há espaço livre para um novo local com essas dimensões. '
        +'Reorganize o croqui antes de cadastrar.');
      return;
    }
    const object={...draft,...free};
    checkpoint(draftObjects);
    setDraftObjects([...draftObjects,object]);
    setPendingDuplicatedLocals(current=>({...current,[object.id]:{
      objectId:object.id,sourceLocationId:null,code,name,description:null,
      subpositionCount:kind==='SHELF'?4:0,
    }}));
    setSelectedObjectId(object.id);
    setMessage('Novo local '+code+' preparado. Posicione-o no croqui e salve para cadastrar.');
  }

  function activateLegacyVisualCopy(object:WarehouseDepotLayoutObject) {
    if(object.warehouseLocationId||pendingDuplicatedLocals[object.id]
      ||!CANONICAL_VISUAL_KINDS.includes(object.kind as CanonicalWarehouseVisualKind))return;
    const kind=object.kind as CanonicalWarehouseVisualKind;
    const prefixes:Record<CanonicalWarehouseVisualKind,string>={
      SHELF:'EST-',PALLET:'PAL-',FREEZER:'FRZ-',REFRIGERATOR:'GEL-',BENCH:'MES-',
    };
    const code=warehouseNextAvailableLocationCode(prefixes[kind]+'00',usedCroquiCodes());
    const name=kindLabel(kind)+' '+code.split('-').at(-1);
    setPendingDuplicatedLocals(current=>({...current,[object.id]:{
      objectId:object.id,sourceLocationId:null,code,name,description:null,
      subpositionCount:kind==='SHELF'?4:0,
    }}));
    setDraftObjects(current=>current.map(item=>item.id===object.id
      ?{...item,label:code+' · '+name}:item));
    setMessage('Cópia visual convertida em novo local provisório: '+code+'. Salve para cadastrar.');
  }

  function prepareDuplicatedObject(
    source:WarehouseDepotLayoutObject, copy:WarehouseDepotLayoutObject
  ):WarehouseDepotLayoutObject {
    const parent=source.warehouseLocationId
      ? locations.find(row=>row.location.id===source.warehouseLocationId)?.location : null;
    const prepared=pendingDuplicatedLocals[source.id];
    const familyPrefix:Record<CanonicalWarehouseVisualKind,string>={
      SHELF:'EST-',PALLET:'PAL-',FREEZER:'FRZ-',REFRIGERATOR:'GEL-',BENCH:'MES-',
    };
    const kind=source.kind as CanonicalWarehouseVisualKind;
    if(!parent && !prepared && !CANONICAL_VISUAL_KINDS.includes(kind)){
      setMessage('Elemento ilustrativo duplicado. Ele não corresponde a um local de estoque.');
      return {...copy,warehouseLocationId:null,label:'Elemento visual · '+source.label.slice(0,65)};
    }
    const sourceCode=parent?.code || prepared?.code
      || warehouseCodeFromVisualLabel(source.label,familyPrefix[kind]||'LOC-');
    const code=warehouseNextAvailableLocationCode(sourceCode,usedCroquiCodes());
    const name=nextDuplicatedName(parent?.name || prepared?.name || kindLabel(kind),code);
    const sourceLocationId=parent?.id || prepared?.sourceLocationId || null;
    const subpositionCount=sourceLocationId?0:prepared?.subpositionCount || 0;
    const pending:PendingDuplicatedLocal={
      objectId:copy.id,sourceLocationId,code,name,
      description:parent?.description || prepared?.description || null,subpositionCount,
    };
    setPendingDuplicatedLocals(current=>({...current,[copy.id]:pending}));
    setMessage(code+' preparado. O novo local e suas subposições serão cadastrados ao salvar.');
    return {...copy,warehouseLocationId:null,label:code+' · '+name};
  }

  function handleRemoveObject(object:WarehouseDepotLayoutObject):boolean {
    if(!object.warehouseLocationId) {
      setMessage('Elemento retirado do croqui. Nenhum cadastro foi alterado.');
      return true;
    }
    const location=locations.find(row=>row.location.id===object.warehouseLocationId)?.location;
    if(!location)return false;
    if(!window.confirm('Inativar '+location.code+' e suas subposições ao salvar? '
      +'O servidor recusará se houver estoque ou lotes ativos.'))return false;
    setPendingRemovedLocationIds(current=>[...new Set([...current,location.id])]);
    setMessage(location.code+' marcado para inativação. A alteração só ocorrerá ao salvar.');
    return true;
  }

  async function saveLayout() {
    if(!selectedDepotId || !selectedDepot || !setupReady || saving) return;
    const overlaps=warehouseFindOverlappingLocals(draftObjects);
    if(overlaps.length){
      const byId=new Map(draftObjects.map(object=>[object.id,object.label]));
      const first=overlaps[0];
      setMessage('Salvamento bloqueado: '+(byId.get(first.firstId)||'Local')
        +' está sobreposto a '+(byId.get(first.secondId)||'outro local')
        +'. Separe os locais no Croqui 2D e tente novamente.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const visibleIds=new Set(draftObjects.map(o=>o.id));
      const createLocals=Object.values(pendingDuplicatedLocals)
        .filter(item=>visibleIds.has(item.objectId)).map(item=>({
          objectId:item.objectId,sourceLocationId:item.sourceLocationId,code:item.code,
          name:item.name,description:item.description,subpositionCount:item.subpositionCount,
        }));
      // Objetos já cadastrados removidos pelo usuario exigem inativação protegida.
      const represented=new Set(draftObjects.map(o=>o.warehouseLocationId).filter(Boolean));
      const archiveLocationIds=pendingRemovedLocationIds
        .filter(id=>!represented.has(id));
      const editLocals=Object.entries(localEdits)
        .filter(([id])=>{
          const parent=locations.find(row=>row.location.id===id)?.location.parentLocationId;
          return !archiveLocationIds.includes(id)
            &&!removedSubpositionIds.includes(id)
            &&(!parent||!archiveLocationIds.includes(parent));
        })
        .map(([id,item])=>({id,name:item.name,description:item.description}));
      if(!saveOperationRef.current)saveOperationRef.current=crypto.randomUUID();
      const result=await applyWarehouseCroquiStructure(workspaceId,{
        operationId:saveOperationRef.current,
        name:draftName.trim()||'Croqui principal',depotId:selectedDepotId,
        logicalWidth:draftWidth,logicalHeight:draftHeight,objects:cloneObjects(draftObjects),
        baseLayoutId:activeLayout?.id||null,expectedVersion:activeLayout?.version??null,
        createLocals,createSubpositions:newSubpositions,editLocals,archiveLocationIds,
        archiveSubpositionIds:removedSubpositionIds,
      });
      setActiveLayout(result.layout);
      setDraftObjects(cloneObjects(result.layout.objects));
      setPendingDuplicatedLocals({});
      setPendingRemovedLocationIds([]);
      setLocalEdits({});
      setNewSubpositions([]);
      setRemovedSubpositionIds([]);
      setDraftHistory({past:[],future:[]});
      setPreviewLoaded(false);
      setMessage('Estrutura e croqui salvos juntos. Versão '+result.layout.version+' ativa. '
        +result.createdLocations.length+' locais cadastrados.');
      saveOperationRef.current=null;
      const {active,layouts:versions}=await readWarehouseCroquiLayouts(workspaceId,selectedDepotId);
      setActiveLayout(active?.layout||result.layout);
      setHistory(versions);
      await reloadBase();
    }catch(error){
      setMessage('Salvamento não concluído. Nenhuma edição parcial deve ser aplicada. '
        +messageFrom(error));
    }finally{setSaving(false);}
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
      <section data-testid="warehouse-croqui-first-depot" className="space-y-4">
        <h2 className="text-lg font-black text-[#00288e]">Gerenciar Depósito</h2>
        <p className="text-xs text-slate-600">Cadastre o primeiro depósito para começar a montar sua estrutura no Croqui 2D.</p>
        <WarehouseDepotQuickCreate workspaceId={workspaceId} depots={depots}
          onRegistered={async depotId=>{await reloadBase();setSelectedDepotId(depotId);}}/>
      </section>
    );
  }

  return (
    <section className="space-y-4" data-testid="warehouse-r1-croquis">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[#00288e]">Gerenciar Depósito · Croqui 2D</h2>
          <p className="text-xs text-slate-600">Crie, duplique, edite e inative locais em um único mapa.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => {setShowDepotRegistration(current=>!current);setShowDepotSettings(false);setShowLabels(false);}}
            data-testid="warehouse-croqui-new-depot"
            className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-[#00288e]">
            {showDepotRegistration?'Fechar cadastro':'+ Cadastrar depósito'}
          </button>
          <button type="button" onClick={openDepotSettings} disabled={!selectedDepot || depotWorking}
            data-testid="warehouse-croqui-manage-depot"
            className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-[#00288e] disabled:opacity-40">
            <Settings2 className="h-3.5 w-3.5" /> Gerenciar depósito
          </button>
          <button type="button" onClick={() => {setShowLabels(current=>!current);setShowDepotSettings(false);setShowDepotRegistration(false);}}
            data-testid="warehouse-croqui-show-labels"
            className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-[#00288e]">
            <Printer className="h-3.5 w-3.5"/> {showLabels?'Fechar etiquetas':'Etiquetas'}
          </button>
        </div>
      </div>
      {showDepotRegistration&&(
        <WarehouseDepotQuickCreate workspaceId={workspaceId} depots={depots}
          onRegistered={async depotId=>{
            await reloadBase();setSelectedDepotId(depotId);setShowDepotRegistration(false);
          }}/>
      )}
      {showDepotSettings && selectedDepot && depotEdit && (
        <section className="space-y-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm"
          data-testid="warehouse-croqui-depot-settings">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#00288e]">Gerenciar {selectedDepot.code}</h3>
            <button type="button" aria-label="Fechar gestão do depósito"
              onClick={() => setShowDepotSettings(false)}><X className="h-4 w-4"/></button>
          </div>
          <p className="text-xs text-slate-600">O código do depósito é permanente para preservar as etiquetas e os históricos.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-700">Nome do depósito
              <input required minLength={2} maxLength={120} value={depotEdit.name}
                onChange={event=>setDepotEdit(current=>current&&({...current,name:event.target.value}))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"/>
            </label>
            <label className="text-xs font-bold text-slate-700">Descrição
              <input maxLength={240} value={depotEdit.description}
                onChange={event=>setDepotEdit(current=>current&&({...current,description:event.target.value}))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"/>
            </label>
            <label className="text-xs font-bold text-slate-700">Tipo de depósito
              <select value={depotEdit.visualType}
                onChange={event=>setDepotEdit(current=>current&&({...current,visualType:event.target.value as typeof current.visualType}))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
                <option value="STANDARD">Padrão</option>
                <option value="CONTAINER">Contêiner</option>
                <option value="COLD_CONTAINER">Contêiner frigorífico</option>
              </select>
            </label>
            <label className="text-xs font-bold text-slate-700">Porte
              <select value={depotEdit.sizeProfile}
                onChange={event=>setDepotEdit(current=>current&&({...current,sizeProfile:event.target.value as typeof current.sizeProfile}))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
                <option value="SMALL">Pequeno</option>
                <option value="MEDIUM">Médio</option>
                <option value="LARGE">Grande</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" disabled={depotWorking || saving}
              data-testid="warehouse-croqui-archive-depot"
              onClick={()=>void archiveSelectedDepot()}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-extrabold text-rose-700 disabled:opacity-40">
              <Archive className="h-4 w-4"/> Inativar depósito
            </button>
            <button type="button" disabled={depotWorking || saving || !depotEdit.name.trim()}
              data-testid="warehouse-croqui-save-depot"
              onClick={()=>void saveDepotSettings()}
              className="rounded-xl bg-[#00288e] px-4 py-2 text-xs font-extrabold text-white disabled:opacity-40">
              {depotWorking?'Processando…':'Salvar dados do depósito'}
            </button>
          </div>
        </section>
      )}

      {showLabels && (
        <section data-testid="warehouse-croqui-labels" className="rounded-2xl border border-blue-200 bg-white p-3">
          <WarehouseLabelsR1 depots={depots} locations={locations}
            selectedDepotId={selectedDepotId}
            selectedLocationId={selectedLayoutObject?.warehouseLocationId || ''}/>
        </section>
      )}

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
                <select aria-label="Tipo do novo local" value={newKind}
                  onChange={event=>setNewKind(event.target.value as CanonicalWarehouseVisualKind)}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700">
                  {CANONICAL_VISUAL_KINDS.map(kind=><option key={kind} value={kind}>{kindLabel(kind)}</option>)}
                </select>
                <button type="button" data-testid="warehouse-croqui-primary-new-local"
                  onClick={()=>addNewCroquiLocal(newKind)} disabled={saving}
                  className="inline-flex h-10 items-center gap-1 rounded-xl bg-[#00288e] px-4 text-xs font-extrabold text-white disabled:opacity-40">
                  <Plus className="h-4 w-4"/> Novo local
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

          {warehouseFindOverlappingLocals(draftObjects).length > 0 && (
            <div role="alert" data-testid="warehouse-croqui-existing-overlaps"
              className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
              Atenção: {warehouseFindOverlappingLocals(draftObjects).length} par(es) de locais
              estão sobrepostos neste croqui. Selecione e reposicione os elementos no mapa
              antes de salvar. Nenhum local existente foi movido automaticamente.
            </div>
          )}

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

          {croquiMode === 'preview' && !visualExpiryComplete && (
            <p role="status" className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              Os alertas de validade 3D podem estar incompletos (limite de 500 lotes).
              Consulte os detalhes do local para verificar o conteúdo.
            </p>
          )}
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
              workspaceId={workspaceId}
              onMaterialUpdated={(updated) => {
                setPreviewMaterials((current) => current.map((material) =>
                  material.id === updated.id ? updated : material
                ));
              }}
              lots={visualExpiryLots}
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
                  <h3 className="text-sm font-black text-slate-900">Locais disponíveis</h3>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">
                  Crie um local novo ou posicione um local existente. O cadastro é efetivado pelo servidor ao salvar.
                </p>

                <p className="mt-3 rounded-lg bg-blue-50 p-2 text-[11px] font-bold text-[#00288e]">
                  Para criar, escolha o tipo e clique em Novo local na barra superior do croqui.
                </p>
                <p className="mt-2 text-[10px] text-slate-500">Locais já cadastrados podem ser inseridos no mapa sem novo cadastro.</p>
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
                            {localDraft.kind === 'REFRIGERATOR' && (
                              <p className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-2 text-[10px] font-semibold leading-4 text-blue-800">
                                Frente padronizada: as portas da geladeira serão desenhadas sempre
                                no lado de maior medida, independentemente da orientação no croqui.
                                As dimensões cadastradas serão preservadas.
                              </p>
                            )}
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
                preventLocalOverlap
                onDuplicateObject={prepareDuplicatedObject}
                onRemoveObject={handleRemoveObject}
                onAddSubposition={addSubpositionFromContext}
              />
            </div>

            <aside className="space-y-3">
              <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm"
                data-testid="warehouse-croqui-structure-editor">
                <h3 className="text-sm font-black text-[#00288e]">Editar cadastro do local</h3>
                {selectedFaces && (
                  <div data-testid="warehouse-croqui-faces" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                    <p className="mb-2 text-[10px] font-black text-emerald-800">
                      Orientação física (acompanha a rotação do local)
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <span className="font-bold text-emerald-800">Frente: {selectedFaces.frontLabel}</span>
                      <span className="text-slate-600">Costas: {selectedFaces.backLabel}</span>
                      <span className="text-slate-600">Direita: {selectedFaces.rightLabel}</span>
                      <span className="text-slate-600">Esquerda: {selectedFaces.leftLabel}</span>
                    </div>
                    <p className="mt-2 text-[10px] text-slate-600">
                      No croqui, a faixa verde indica a frente. Para girar, selecione o local e use
                      os botões de rotação de 90° abaixo do desenho.
                    </p>
                  </div>
                )}
                {selectedPending || selectedLocation ? (
                  <div className="mt-3 space-y-3">
                    <label className="block text-[10px] font-bold text-slate-600">Código
                      <input value={selectedCode} readOnly className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs"/>
                    </label>
                    <label className="block text-[10px] font-bold text-slate-600">Tipo visual
                      <select value={selectedLayoutObject?.kind||'SHELF'} disabled={saving}
                        onChange={event=>{
                          if(!selectedLayoutObject)return;
                          setDraftObjects(current=>current.map(item=>item.id===selectedLayoutObject.id
                            ?{...item,kind:event.target.value as CanonicalWarehouseVisualKind}:item));
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs">
                        {CANONICAL_VISUAL_KINDS.map(kind=><option key={kind} value={kind}>{kindLabel(kind)}</option>)}
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        ['width','Comprimento (cm)'],['height','Profundidade (cm)'],
                      ] as const).map(([field,label])=>(
                        <label key={field} className="block text-[10px] font-bold text-slate-600">
                          {label}
                          <input type="number" min={20} step={1} disabled={saving}
                            value={selectedLayoutObject?.[field]??20}
                            onChange={event=>{
                              if(!selectedLayoutObject)return;
                              const value=Number(event.target.value);
                              if(!Number.isFinite(value))return;
                              const max=(field==='width'
                                ?draftWidth-selectedLayoutObject.x:draftHeight-selectedLayoutObject.y);
                              const candidate={
                                ...selectedLayoutObject,
                                [field]:Math.max(20,Math.min(max,Math.round(value))),
                              };
                              if(warehouseLocalHasCollision(candidate,draftObjects)){
                                setMessage('Medida recusada: o local ocuparia o espaço de outra estrutura.');
                                return;
                              }
                              checkpoint(draftObjects);
                              setDraftObjects(current=>current.map(item=>
                                item.id===selectedLayoutObject.id?candidate:item));
                              setMessage(null);
                            }}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"/>
                        </label>
                      ))}
                    </div>
                    <label className="block text-[10px] font-bold text-slate-600">Nome
                      <input value={selectedName} maxLength={120} disabled={saving}
                        onChange={event=>{
                          const name=event.target.value;
                          if(selectedPending) setPendingDuplicatedLocals(current=>({
                            ...current,[selectedPending.objectId]:{...selectedPending,name},
                          }));
                          else if(selectedLocation) setLocalEdits(current=>({
                            ...current,[selectedLocation.id]:{
                              name,description:current[selectedLocation.id]?.description??selectedLocation.description??null,
                            },
                          }));
                          if(selectedLayoutObject) setDraftObjects(current=>current.map(item=>item.id===selectedLayoutObject.id
                            ?{...item,label:selectedCode+' · '+name}:item));
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"/>
                    </label>
                    <label className="block text-[10px] font-bold text-slate-600">Descrição
                      <textarea rows={2} disabled={saving}
                        value={selectedPending?.description??(
                          selectedLocation?localEdits[selectedLocation.id]?.description??selectedLocation.description:''
                        )??''}
                        onChange={event=>{
                          const description=event.target.value||null;
                          if(selectedPending) setPendingDuplicatedLocals(current=>({
                            ...current,[selectedPending.objectId]:{...selectedPending,description},
                          }));
                          else if(selectedLocation) setLocalEdits(current=>({
                            ...current,[selectedLocation.id]:{
                              name:current[selectedLocation.id]?.name||selectedLocation.name,description,
                            },
                          }));
                        }}
                        className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white p-2 text-xs"/>
                    </label>
                    {selectedPending?.sourceLocationId && (
                      <p data-testid="warehouse-croqui-extra-subpositions"
                        className="rounded-lg bg-blue-50 p-2 text-[10px] text-blue-800">
                        Copia as subposições da origem e acrescenta
                        {' '}{selectedPending.subpositionCount} nova(s) ao salvar.
                      </p>
                    )}
                    {selectedPending && !selectedPending.sourceLocationId && (
                      <label className="block text-[10px] font-bold text-slate-600">Subposições (0–30)
                        <input type="number" min={0} max={30} step={1}
                          value={selectedPending.subpositionCount}
                          onChange={event=>setPendingDuplicatedLocals(current=>({
                            ...current,[selectedPending.objectId]:{
                              ...selectedPending,subpositionCount:Math.max(0,Math.min(30,
                                Math.trunc(Number(event.target.value)||0))),
                            },
                          }))}
                          className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"/>
                      </label>
                    )}
                    {selectedLocation && (
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-[10px] font-black text-slate-600">
                          {selectedChildren.length} subposição(ões) cadastradas
                        </p>
                        {selectedChildren.map(child=>(
                          <div key={child.location.id} className="mt-2 flex items-center gap-1">
                            <span className="w-16 shrink-0 truncate font-mono text-[9px]">{child.location.code}</span>
                            <input maxLength={120} aria-label={'Nome '+child.location.code}
                              value={localEdits[child.location.id]?.name||child.location.name}
                              onChange={event=>setLocalEdits(current=>({
                                ...current,[child.location.id]:{
                                  name:event.target.value,
                                  description:current[child.location.id]?.description??child.location.description??null,
                                },
                              }))}
                              className="min-w-0 flex-1 rounded border border-slate-200 p-1 text-[10px]"/>
                            <button type="button" title={'Inativar '+child.location.code}
                              onClick={()=>{
                                if(window.confirm('Inativar '+child.location.code+' ao salvar? '
                                  +'Somente se não possuir estoque ativo.')){
                                  setRemovedSubpositionIds(current=>[...current,child.location.id]);
                                }
                              }}
                              className="rounded border border-red-200 px-2 py-1 text-[10px] font-bold text-red-700">×</button>
                          </div>
                        ))}
                        {newSubpositions.filter(child=>child.parentLocationId===selectedLocation.id)
                          .map(child=>(
                            <div key={child.code} className="mt-2 flex items-center gap-1">
                              <span className="w-16 shrink-0 truncate font-mono text-[9px]">{child.code}</span>
                              <input maxLength={120} aria-label={'Nome '+child.code}
                                value={child.name}
                                onChange={event=>setNewSubpositions(current=>current.map(row=>
                                  row.parentLocationId===child.parentLocationId&&row.code===child.code
                                  ?{...row,name:event.target.value}:row))}
                                className="min-w-0 flex-1 rounded border border-blue-200 bg-blue-50 p-1 text-[10px]"/>
                              <button type="button" title={'Descartar '+child.code}
                                onClick={()=>setNewSubpositions(current=>current.filter(row=>row!==child))}
                                className="rounded border border-slate-200 px-2 py-1 text-[10px]">×</button>
                            </div>
                          ))}
                        <button type="button" onClick={()=>addCroquiSubposition(selectedLocation.id,selectedLocation.code)}
                          disabled={saving}
                          data-testid="warehouse-croqui-create-subposition"
                          className="mt-3 rounded-lg bg-blue-100 px-3 py-1.5 text-[10px] font-bold text-[#00288e]">
                          + Nova subposição
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-500">
                      Cadastro e desenho são gravados juntos ao salvar.
                      O servidor não permite inativar locais com estoque ou lotes ativos.
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 space-y-3">
                    <p className="text-xs text-slate-500">
                      Este elemento ainda não possui cadastro operacional.
                    </p>
                    {selectedLayoutObject&&!selectedLayoutObject.warehouseLocationId
                      &&CANONICAL_VISUAL_KINDS.includes(selectedLayoutObject.kind as CanonicalWarehouseVisualKind)
                      &&(
                      <button type="button" data-testid="warehouse-croqui-adopt-visual"
                        onClick={()=>activateLegacyVisualCopy(selectedLayoutObject)}
                        className="rounded-lg bg-blue-100 px-3 py-2 text-xs font-bold text-[#00288e]">
                        Cadastrar este elemento como local
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#00288e]" />
                  <h3 className="text-sm font-black text-slate-900">Orientação</h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  O Croqui 2D administra a estrutura real, o desenho e suas cópias. Salve para efetivar as alterações.
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Para reposicionar um local, arraste no mapa. Para remover, confirme a inativação; saldos e lotes ativos bloqueiam a operação.
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Ao duplicar um local, o novo cadastro recebe código único e, se houver, as subposições da origem. Nenhum estoque é copiado.
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  A inativação acontece somente no servidor, durante o salvamento conjunto da estrutura e do croqui.
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
