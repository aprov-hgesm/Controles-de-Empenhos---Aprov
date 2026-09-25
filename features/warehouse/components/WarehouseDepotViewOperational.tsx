'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BoxSelect,
  CheckCircle2,
  Download,
  Edit3,
  Layers3,
  LocateFixed,
  Plus,
  RotateCcw,
  Save,
  Search,
  X,
} from 'lucide-react';

import {
  createWarehouseDepotLayoutObject,
  renderWarehouseDepotLayoutSvg,
  warehouseLocationIdForPosition,
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
import { listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import {
  listWarehouseDepots,
  listWarehouseLocationBalances,
  listWarehouseLocations,
} from '../../../lib/warehouse/locationRepository';
import { listWarehouseLots } from '../../../lib/warehouse/lotRepository';
import { selectWarehouseFefoLot } from '../../../lib/warehouse/lot';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import type {
  WarehouseDepot,
  WarehouseLocation,
  WarehouseLocationBalance,
} from '../../../lib/warehouse/location';
import {
  WAREHOUSE_STRUCTURE_LIBRARY,
  type WarehouseStructureDefinition,
} from '../../../lib/warehouse/structureLibrary';
import { WarehouseDepotLayoutEditor } from './WarehouseDepotLayoutEditor';

type Mode = 'view' | 'edit';

interface WarehouseViewData {
  loading: boolean;
  error: string | null;
  active: WarehouseDepotLayout | null;
  history: WarehouseDepotLayoutListItem[];
  materials: WarehouseMaterial[];
  depots: WarehouseDepot[];
  locations: WarehouseLocation[];
  balances: WarehouseLocationBalance[];
}

const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 620;

const STRUCTURE_LABELS: Record<WarehouseDepotLayoutObjectKind, string> = {
  WALL: 'Limite / parede',
  CORRIDOR: 'Corredor',
  AREA: 'Área livre',
  SHELF: 'Estante',
  RACK: 'Rack',
  CABINET: 'Armário',
  CHAMBER: 'Câmara',
  FREEZER: 'Freezer',
  REFRIGERATOR: 'Geladeira',
  PALLET: 'Palete',
  BENCH: 'Bancada',
  ZONE: 'Zona',
  OTHER: 'Outra estrutura',
};

const STRUCTURE_KINDS = Object.keys(STRUCTURE_LABELS) as WarehouseDepotLayoutObjectKind[];

function downloadText(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function objectClass(
  object: WarehouseDepotLayoutObject,
  highlighted: boolean,
  fefo: boolean,
  selected: boolean,
  dimmed: boolean
): string {
  const base = 'absolute rounded-xl border transition duration-200 select-none';
  if (selected) return base + ' border-blue-200 bg-blue-400/25 ring-2 ring-blue-300/30';
  if (fefo) return base + ' border-amber-200 bg-amber-400/25 ring-2 ring-amber-300/25 shadow-[0_10px_28px_rgba(251,191,36,0.18)]';
  if (highlighted) return base + ' border-emerald-200 bg-emerald-400/25 ring-2 ring-emerald-300/25 shadow-[0_10px_28px_rgba(52,211,153,0.18)]';
  if (dimmed) return base + ' border-white/[0.05] bg-slate-700/20 opacity-35';
  if (object.visualVariant === 'outline') return base + ' border-slate-500 bg-transparent';
  if (object.visualVariant === 'zone') return base + ' border-slate-500/60 bg-slate-500/10';
  return base + ' border-slate-500/50 bg-slate-700/35 shadow-[0_10px_22px_rgba(2,8,23,0.28)]';
}

function WarehouseCanvas({
  layout,
  objects,
  mode,
  selectedObjectId,
  highlightedLocationIds,
  fefoLocationId,
  onSelect,
  onMove,
}: {
  layout: Pick<WarehouseDepotLayout, 'logicalWidth' | 'logicalHeight'>;
  objects: WarehouseDepotLayoutObject[];
  mode: Mode;
  selectedObjectId: string | null;
  highlightedLocationIds: Set<string>;
  fefoLocationId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    width: number;
    height: number;
    rectWidth: number;
    rectHeight: number;
  } | null>(null);
  const searchActive = highlightedLocationIds.size > 0;

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[linear-gradient(rgba(148,163,184,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.045)_1px,transparent_1px),radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.08),transparent_44%),#030a18] bg-[size:32px_32px,32px_32px,auto,auto]"
      data-testid="warehouse-layout-canvas"
      style={{ aspectRatio: layout.logicalWidth + ' / ' + layout.logicalHeight }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const scaleX = layout.logicalWidth / drag.rectWidth;
        const scaleY = layout.logicalHeight / drag.rectHeight;
        const x = Math.max(0, Math.min(
          layout.logicalWidth - drag.width,
          drag.startX + (event.clientX - drag.startClientX) * scaleX
        ));
        const y = Math.max(0, Math.min(
          layout.logicalHeight - drag.height,
          drag.startY + (event.clientY - drag.startClientY) * scaleY
        ));
        onMove(drag.id, Math.round(x), Math.round(y));
      }}
      onPointerUp={() => { dragRef.current = null; }}
      onPointerCancel={() => { dragRef.current = null; }}
    >
      <div
        className="absolute inset-0 origin-center"
        style={{ transform: 'perspective(1200px) rotateX(1.8deg)', transformStyle: 'preserve-3d' }}
      >
        {[...objects].sort((a, b) => a.layer - b.layer).map((object) => {
          const highlighted = Boolean(
            object.warehouseLocationId
            && highlightedLocationIds.has(object.warehouseLocationId)
          );
          const fefo = Boolean(
            object.warehouseLocationId
            && object.warehouseLocationId === fefoLocationId
          );
          return (
            <button
              key={object.id}
              type="button"
              data-testid={'warehouse-layout-object-' + object.id}
              data-location-id={object.warehouseLocationId || ''}
              data-highlighted={highlighted ? 'true' : 'false'}
              data-fefo-highlighted={fefo ? 'true' : 'false'}
              className={objectClass(
                object,
                highlighted,
                fefo,
                selectedObjectId === object.id,
                searchActive && !highlighted
              )}
              style={{
                left: (object.x / layout.logicalWidth * 100) + '%',
                top: (object.y / layout.logicalHeight * 100) + '%',
                width: (object.width / layout.logicalWidth * 100) + '%',
                height: (object.height / layout.logicalHeight * 100) + '%',
                zIndex: object.layer + 1,
                transform: 'rotate(' + object.rotation + 'deg) translateZ(' + (object.elevation * 2) + 'px)',
              }}
              onClick={() => onSelect(object.id)}
              onPointerDown={(event) => {
                if (mode !== 'edit') return;
                const rect = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
                if (!rect) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                dragRef.current = {
                  id: object.id,
                  pointerId: event.pointerId,
                  startClientX: event.clientX,
                  startClientY: event.clientY,
                  startX: object.x,
                  startY: object.y,
                  width: object.width,
                  height: object.height,
                  rectWidth: rect.width,
                  rectHeight: rect.height,
                };
              }}
            >
              <span className="block truncate px-2 text-left text-[10px] font-black text-slate-100 sm:text-xs">
                {object.label}
              </span>
              {object.warehouseLocationId && (
                <span className="mt-1 hidden truncate px-2 font-mono text-[8px] text-slate-400 sm:block">
                  {object.warehouseLocationId}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WarehouseDepotViewOperational({ workspaceId }: { workspaceId: string }) {
  const [data, setData] = useState<WarehouseViewData>({
    loading: true,
    error: null,
    active: null,
    history: [],
    materials: [],
    depots: [],
    locations: [],
    balances: [],
  });
  const [mode, setMode] = useState<Mode>('view');
  const [draftObjects, setDraftObjects] = useState<WarehouseDepotLayoutObject[]>([]);
  const [draftName, setDraftName] = useState('Croqui principal');
  const [selectedDepotId, setSelectedDepotId] = useState<string>('');
  const [draftDepotId, setDraftDepotId] = useState<string>('');
  const [draftWidth, setDraftWidth] = useState(DEFAULT_WIDTH);
  const [draftHeight, setDraftHeight] = useState(DEFAULT_HEIGHT);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [queryText, setQueryText] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setData((current) => ({ ...current, loading: true, error: null }));
    try {
      const [materials, depots, locations, balances] = await Promise.all([
        listWarehouseMaterials(workspaceId, 250),
        listWarehouseDepots(workspaceId, 250),
        listWarehouseLocations(workspaceId, 500),
        listWarehouseLocationBalances(workspaceId, 500),
      ]);
      const depotList = depots.map((item) => item.depot);
      setData((current) => ({
        ...current,
        loading: false,
        error: null,
        materials,
        depots: depotList,
        locations: locations.map((item) => item.location),
        balances: balances.map((item) => item.balance),
      }));
      setSelectedDepotId((current) => {
        if (current && depotList.some((depot) => depot.id === current && depot.status === 'active')) {
          return current;
        }
        return depotList.find((depot) => depot.status === 'active')?.id || '';
      });
    } catch (error) {
      setData((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'Falha ao carregar a Visão do Depósito.',
      }));
    }
  };

  useEffect(() => {
    void reload();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedDepotId) {
      setData((current) => ({ ...current, active: null, history: [] }));
      return () => { cancelled = true; };
    }

    void Promise.all([
      getActiveWarehouseDepotLayout(workspaceId, selectedDepotId),
      listWarehouseDepotLayoutsForDepot(workspaceId, selectedDepotId, 100),
    ]).then(([active, history]) => {
      if (cancelled) return;
      setData((current) => ({
        ...current,
        active: active?.layout || null,
        history,
      }));
    }).catch((error) => {
      if (cancelled) return;
      setData((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Falha ao carregar o histórico deste depósito.',
      }));
    });

    return () => { cancelled = true; };
  }, [selectedDepotId, workspaceId]);

  const materialMatches = useMemo(() => {
    const normalized = queryText.trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return data.materials.slice(0, 12);
    return data.materials.filter((material) =>
      [material.id, material.description, ...material.aliases]
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(normalized)
    ).slice(0, 12);
  }, [data.materials, queryText]);

  const highlightedBalances = useMemo(
    () => data.balances.filter(
      (balance) => balance.materialId === selectedMaterialId && balance.quantity > 0
    ),
    [data.balances, selectedMaterialId]
  );

  const highlightedLocationIds = useMemo(
    () => new Set(
      highlightedBalances
        .map((balance) => warehouseLocationIdForPosition(balance.position))
        .filter(Boolean) as string[]
    ),
    [highlightedBalances]
  );

  const selectedActiveLayout = useMemo(
    () =>
      data.history
        .filter(
          (item) =>
            item.layout.status === 'active'
            && (item.layout.depotId || '') === selectedDepotId
        )
        .sort((left, right) => right.layout.version - left.layout.version)[0]?.layout
      || (
        data.active && (data.active.depotId || '') === selectedDepotId
          ? data.active
          : null
      ),
    [data.active, data.history, selectedDepotId]
  );

  const selectedDepotHistory = useMemo(
    () =>
      data.history
        .filter((item) => (item.layout.depotId || '') === selectedDepotId)
        .sort((left, right) => right.layout.version - left.layout.version),
    [data.history, selectedDepotId]
  );

  useEffect(() => {
    if (mode !== 'view') return;
    if (selectedActiveLayout) {
      setDraftObjects(selectedActiveLayout.objects);
      setDraftName(selectedActiveLayout.name);
      setDraftDepotId(selectedActiveLayout.depotId || '');
      setDraftWidth(selectedActiveLayout.logicalWidth);
      setDraftHeight(selectedActiveLayout.logicalHeight);
    } else {
      setDraftObjects([]);
      setDraftName('Croqui principal');
      setDraftDepotId(selectedDepotId);
      setDraftWidth(DEFAULT_WIDTH);
      setDraftHeight(DEFAULT_HEIGHT);
    }
    setSelectedObjectId(null);
  }, [mode, selectedActiveLayout, selectedDepotId]);

  const [fefoLocationId, setFefoLocationId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!selectedMaterialId) {
      setFefoLocationId(null);
      return;
    }
    void listWarehouseLots(workspaceId, 500, selectedMaterialId).then((lots) => {
      if (!active) return;
      const lot = selectWarehouseFefoLot(lots.map((item) => item.lot));
      setFefoLocationId(lot ? warehouseLocationIdForPosition(lot.position) : null);
    }).catch(() => {
      if (active) setFefoLocationId(null);
    });
    return () => { active = false; };
  }, [selectedMaterialId, workspaceId]);

  const currentLayout = mode === 'edit'
    ? {
        schemaVersion: 'warehouse_depot_layout_v1' as const,
        id: selectedActiveLayout?.id || 'lay_00000000000000000000000000000000',
        workspaceId,
        ug: selectedActiveLayout?.ug || '160416',
        name: draftName,
        depotId: draftDepotId || null,
        logicalWidth: draftWidth,
        logicalHeight: draftHeight,
        objects: draftObjects,
        version: selectedActiveLayout?.version || 0,
        status: 'active' as const,
        previousVersionId: selectedActiveLayout?.previousVersionId || null,
        createdBy: selectedActiveLayout?.createdBy || 'draft',
        updatedBy: selectedActiveLayout?.updatedBy || 'draft',
      }
    : selectedActiveLayout;

  const selectedObject = draftObjects.find((item) => item.id === selectedObjectId) || null;
  const activeLocations = data.locations.filter((item) =>
    item.status === 'active' && (!draftDepotId || item.depotId === draftDepotId)
  );

  const updateObject = (id: string, patch: Partial<WarehouseDepotLayoutObject>) => {
    setDraftObjects((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  if (data.loading) {
    return <div className="mt-6 rounded-2xl border border-white/[0.07] bg-black/10 p-5 text-sm text-slate-400">Carregando layout e posições reais…</div>;
  }

  if (data.error) {
    return <div className="mt-6 rounded-2xl border border-rose-300/10 bg-rose-400/[0.04] p-5 text-sm text-rose-200">{data.error}</div>;
  }

  return (
    <div className="mt-6 space-y-5" data-testid="warehouse-depot-view-operational">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Pesquisar material</label>
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-3">
                  <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  <input
                    data-testid="warehouse-layout-material-search"
                    value={queryText}
                    onChange={(event) => setQueryText(event.target.value)}
                    placeholder="Descrição, alias ou ID"
                    className="h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
                  />
                </div>
                {queryText && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {materialMatches.map((material) => (
                      <button
                        type="button"
                        key={material.id}
                        data-testid={'warehouse-layout-material-' + material.id}
                        onClick={() => {
                          setSelectedMaterialId(material.id);
                          setQueryText(material.description);
                          setMessage(null);
                        }}
                        className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/[0.05]"
                      >
                        {material.description}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-2 lg:pt-[18px]">
                <label className="min-w-[220px]">
                  <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-slate-600">Depósito do croqui</span>
                  <select
                    value={selectedDepotId}
                    onChange={(event) => {
                      const next = event.target.value;
                      setSelectedDepotId(next);
                      if (mode === 'edit') setMode('view');
                    }}
                    className="h-9 w-full rounded-xl border border-white/[0.08] bg-[#08101f] px-3 text-xs font-bold text-slate-200"
                    aria-label="Selecionar depósito do croqui"
                  >
                    {!data.depots.some((depot) => depot.status === 'active') && <option value="">Nenhum depósito ativo</option>}
                    {data.depots.filter((depot) => depot.status === 'active').map((depot) => (
                      <option key={depot.id} value={depot.id}>{depot.code} · {depot.name}</option>
                    ))}
                  </select>
                </label>
                {selectedActiveLayout && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        downloadText(
                          'warehouse-layout-v' + selectedActiveLayout!.version + '.json',
                          JSON.stringify(selectedActiveLayout, null, 2),
                          'application/json'
                        );
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-bold text-slate-300"
                    >
                      <Download className="h-4 w-4" /> JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        downloadText(
                          'warehouse-layout-v' + selectedActiveLayout!.version + '.svg',
                          renderWarehouseDepotLayoutSvg(selectedActiveLayout!),
                          'image/svg+xml'
                        );
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-bold text-slate-300"
                    >
                      <Download className="h-4 w-4" /> SVG
                    </button>
                  </>
                )}
                <button
                  type="button"
                  data-testid="warehouse-layout-toggle-edit"
                  onClick={() => {
                    if (mode === 'view') {
                      setDraftObjects(selectedActiveLayout?.objects || []);
                      setDraftName(selectedActiveLayout?.name || 'Croqui principal');
                      setDraftDepotId(selectedDepotId);
                      setDraftWidth(selectedActiveLayout?.logicalWidth || DEFAULT_WIDTH);
                      setDraftHeight(selectedActiveLayout?.logicalHeight || DEFAULT_HEIGHT);
                      setMode('edit');
                    } else {
                      setMode('view');
                      setSelectedObjectId(null);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-300/15 bg-blue-400/[0.07] px-3 py-2 text-xs font-black text-blue-100"
                >
                  {mode === 'edit' ? <X className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                  {mode === 'edit' ? 'Sair da edição' : 'Editar layout'}
                </button>
              </div>
            </div>

            {selectedMaterialId && (
              <div data-testid="warehouse-layout-highlight-summary" className="mt-4 rounded-xl border border-emerald-300/10 bg-emerald-400/[0.035] px-4 py-3 text-xs text-slate-300">
                <div className="flex items-center gap-2 font-bold text-emerald-200">
                  <LocateFixed className="h-4 w-4" />
                  {highlightedLocationIds.size} posição(ões) real(is) destacada(s)
                </div>
                <p className="mt-1 text-slate-500">
                  FEFO {fefoLocationId ? 'também sinaliza a posição prioritária em âmbar.' : 'não possui posição prioritária aplicável.'}
                </p>
              </div>
            )}
          </div>

          {currentLayout ? (
            mode === 'edit' ? (
              <WarehouseDepotLayoutEditor
                logicalWidth={draftWidth}
                logicalHeight={draftHeight}
                objects={draftObjects}
                selectedObjectId={selectedObjectId}
                onSelectedObjectIdChange={setSelectedObjectId}
                onObjectsChange={setDraftObjects}
              />
            ) : (
              <WarehouseCanvas
                layout={currentLayout}
                objects={currentLayout.objects}
                mode={mode}
                selectedObjectId={selectedObjectId}
                highlightedLocationIds={highlightedLocationIds}
                fefoLocationId={fefoLocationId}
                onSelect={() => undefined}
                onMove={() => undefined}
              />
            )
          ) : (
            <div className="grid min-h-[360px] place-items-center rounded-2xl border border-dashed border-blue-300/15 bg-blue-400/[0.025] p-8 text-center">
              <div>
                <BoxSelect className="mx-auto h-8 w-8 text-blue-200/60" />
                <p className="mt-4 text-sm font-black text-slate-200">Este depósito ainda não possui layout.</p>
                <p className="mt-2 max-w-md text-xs leading-6 text-slate-500">
                  Entre no modo de edição para criar a primeira representação visual deste depósito. O estoque existente não será alterado.
                </p>
              </div>
            </div>
          )}

          {message && (
            <div data-testid="warehouse-layout-message" className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-xs text-slate-300">
              {message}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-4">
            <div className="flex items-center gap-2 text-slate-200">
              <Layers3 className="h-4 w-4 text-blue-200" />
              <p className="text-xs font-black">Layout ativo</p>
            </div>
            <p className="mt-3 text-sm font-bold text-white">{selectedActiveLayout?.name || 'Ainda não criado'}</p>
            <p className="mt-1 font-mono text-[10px] text-slate-600">
              {selectedActiveLayout ? 'versão ' + selectedActiveLayout.version + ' · ' + selectedActiveLayout.id : 'primeira versão pendente'}
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              {selectedDepotHistory.length} versão(ões) deste depósito preservada(s). Alterar geometria nunca movimenta estoque.
            </p>
          </div>

          {selectedDepotHistory.length > 0 && (
            <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-4" data-testid="warehouse-layout-history">
              <p className="text-xs font-black text-slate-200">Histórico de versões</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-600">Versões anteriores permanecem auditáveis e podem servir de base para uma nova versão.</p>
              <div className="mt-3 space-y-2">
                {selectedDepotHistory.slice(0, 8).map((item) => (
                  <div key={item.layout.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold text-slate-300">v{item.layout.version} · {item.layout.name}</p>
                      <p className="mt-0.5 font-mono text-[9px] text-slate-600">{item.layout.status}</p>
                    </div>
                    {mode === 'edit' && item.layout.status === 'archived' && (
                      <button
                        type="button"
                        data-testid={'warehouse-layout-restore-' + item.layout.version}
                        onClick={() => {
                          setDraftObjects(item.layout.objects);
                          setDraftName(item.layout.name + ' · recuperada');
                          setDraftDepotId(item.layout.depotId || '');
                          setDraftWidth(item.layout.logicalWidth);
                          setDraftHeight(item.layout.logicalHeight);
                          setSelectedObjectId(null);
                          setMessage('Versão ' + item.layout.version + ' carregada como base. Salve para criar uma nova versão ativa.');
                        }}
                        className="shrink-0 rounded-lg border border-white/[0.08] px-2 py-1 text-[9px] font-bold text-slate-400 hover:text-slate-200"
                      >
                        Usar como base
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode === 'edit' && (
            <div className="space-y-4 rounded-2xl border border-blue-300/10 bg-blue-400/[0.025] p-4" data-testid="warehouse-layout-editor">
              <div>
                <p className="text-xs font-black text-blue-100">Editor visual</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">Edite em planta superior 2D com grade, snap, zoom, pan, resize, rotação e undo/redo. A prévia 2.5D usa os mesmos objetos. Salvar cria uma nova versão.</p>
              </div>

              <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Nome
                <input data-testid="warehouse-layout-name" value={draftName} onChange={(e) => setDraftName(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 text-xs text-slate-200 outline-none" />
              </label>
              <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Depósito relacionado
                <select data-testid="warehouse-layout-depot" value={draftDepotId} disabled className="mt-1 h-9 w-full rounded-lg border border-white/[0.08] bg-[#08101f] px-3 text-xs text-slate-400 disabled:opacity-80">
                  <option value="">Selecione um depósito</option>
                  {data.depots.filter((depot) => depot.status === 'active').map((depot) => (
                    <option key={depot.id} value={depot.id}>{depot.code} · {depot.name}</option>
                  ))}
                </select>
                <span className="mt-1 block text-[9px] normal-case tracking-normal text-slate-600">Troque o depósito pelo seletor superior antes de entrar na edição.</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Largura
                  <input type="number" min="240" max="5000" value={draftWidth} onChange={(e) => setDraftWidth(Number(e.target.value))} className="mt-1 h-9 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 text-xs text-slate-200" />
                </label>
                <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Altura
                  <input type="number" min="240" max="5000" value={draftHeight} onChange={(e) => setDraftHeight(Number(e.target.value))} className="mt-1 h-9 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 text-xs text-slate-200" />
                </label>
              </div>

              <div className="space-y-2" data-testid="warehouse-structure-library">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Biblioteca de estruturas</p>
                  <p className="mt-1 text-[10px] leading-5 text-slate-600">
                    Os tamanhos são proporções iniciais do croqui, não medidas arquitetônicas.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {WAREHOUSE_STRUCTURE_LIBRARY.map((definition: WarehouseStructureDefinition) => (
                    <button
                      key={definition.id}
                      type="button"
                      data-testid={'warehouse-structure-' + definition.id}
                      onClick={() => {
                        const object = createWarehouseDepotLayoutObject({
                          kind: definition.kind,
                          label: definition.name,
                          x: 40 + draftObjects.length * 12,
                          y: 40 + draftObjects.length * 12,
                          width: definition.defaultWidth,
                          height: definition.defaultHeight,
                          rotation: definition.defaultRotation,
                          visualVariant: definition.visualVariant,
                        });
                        setDraftObjects((items) => [...items, object]);
                        setSelectedObjectId(object.id);
                      }}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-left transition hover:bg-white/[0.05]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-black text-slate-200">{definition.name}</span>
                        <Plus className="h-3.5 w-3.5 text-blue-200/70" aria-hidden="true" />
                      </div>
                      <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-slate-600">{definition.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[8px] font-bold uppercase tracking-[0.08em] text-slate-600">
                        <span>{definition.defaultWidth}×{definition.defaultHeight}</span>
                        {definition.acceptsLevels && <span>· níveis</span>}
                        {definition.acceptsSubpositions && <span>· subposições</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedObject && (
                <div className="space-y-3 rounded-xl border border-white/[0.07] bg-black/15 p-3" data-testid="warehouse-layout-object-editor">
                  <input data-testid="warehouse-layout-object-label" value={selectedObject.label} onChange={(e) => updateObject(selectedObject.id, { label: e.target.value })} className="h-9 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 text-xs text-slate-200" />
                  <select value={selectedObject.kind} onChange={(e) => updateObject(selectedObject.id, { kind: e.target.value as WarehouseDepotLayoutObjectKind })} className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#08101f] px-3 text-xs text-slate-200">
                    {STRUCTURE_KINDS.map((kind) => <option key={kind} value={kind}>{STRUCTURE_LABELS[kind]}</option>)}
                  </select>
                  <select data-testid="warehouse-layout-object-location" value={selectedObject.warehouseLocationId || ''} onChange={(e) => updateObject(selectedObject.id, { warehouseLocationId: e.target.value || null })} className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#08101f] px-3 text-xs text-slate-200">
                    <option value="">Sem vínculo logístico</option>
                    {activeLocations.map((location) => (
                      <option key={location.id} value={location.id}>{location.code} · {location.name}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ['x','X'],['y','Y'],['width','Largura'],['height','Profundidade'],
                      ['rotation','Rotação'],['elevation','Elevação visual']
                    ] as const).map(([key,label]) => (
                      <label key={key} className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-600">
                        {label}
                        <input
                          data-testid={'warehouse-layout-object-' + key}
                          type="number"
                          value={selectedObject[key]}
                          onChange={(e) => updateObject(selectedObject.id, { [key]: Number(e.target.value) })}
                          className="mt-1 h-8 w-full rounded-lg border border-white/[0.07] bg-black/20 px-2 text-xs text-slate-300"
                        />
                      </label>
                    ))}
                  </div>
                  <button type="button" onClick={() => {
                    setDraftObjects((items) => items.filter((item) => item.id !== selectedObject.id));
                    setSelectedObjectId(null);
                  }} className="w-full rounded-lg border border-rose-300/10 px-3 py-2 text-[11px] font-bold text-rose-200">
                    Remover somente do croqui
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => {
                  setDraftObjects(selectedActiveLayout?.objects || []);
                  setDraftName(selectedActiveLayout?.name || 'Croqui principal');
                  setDraftDepotId(selectedDepotId);
                  setDraftWidth(selectedActiveLayout?.logicalWidth || DEFAULT_WIDTH);
                  setDraftHeight(selectedActiveLayout?.logicalHeight || DEFAULT_HEIGHT);
                  setSelectedObjectId(null);
                }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2.5 text-xs font-bold text-slate-300">
                  <RotateCcw className="h-4 w-4" /> Cancelar
                </button>
                <button
                  type="button"
                  data-testid="warehouse-layout-save"
                  disabled={saving || !draftDepotId}
                  onClick={async () => {
                    setSaving(true);
                    setMessage(null);
                    try {
                      const saved = await saveWarehouseDepotLayoutVersion(workspaceId, {
                        name: draftName,
                        depotId: draftDepotId || null,
                        logicalWidth: draftWidth,
                        logicalHeight: draftHeight,
                        objects: draftObjects,
                        baseLayoutId: selectedActiveLayout?.depotId === (draftDepotId || null) ? selectedActiveLayout.id : null,
                        expectedVersion: selectedActiveLayout?.depotId === (draftDepotId || null) ? selectedActiveLayout.version : null,
                      });
                      const savedDepotId = saved.depotId || draftDepotId;
                      setSelectedDepotId(savedDepotId);
                      setMessage('Layout salvo como versão ' + saved.version + '. Nenhum saldo ou movimento de estoque foi alterado.');
                      setMode('view');
                      setSelectedObjectId(null);
                      await reload();
                      const [active, history] = await Promise.all([
                        getActiveWarehouseDepotLayout(workspaceId, savedDepotId),
                        listWarehouseDepotLayoutsForDepot(workspaceId, savedDepotId, 100),
                      ]);
                      setData((current) => ({
                        ...current,
                        active: active?.layout || null,
                        history,
                      }));
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : 'Falha ao salvar o layout.');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.07] px-3 py-2.5 text-xs font-black text-emerald-100 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" /> Salvar versão
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.025] p-4">
            <div className="flex items-center gap-2 text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-xs font-black">Fonte de verdade preservada</p>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              O croqui referencia IDs reais. Saldo continua em warehouse_balance_v1, distribuição em warehouse_location_balance_v1 e movimentos no ledger.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
