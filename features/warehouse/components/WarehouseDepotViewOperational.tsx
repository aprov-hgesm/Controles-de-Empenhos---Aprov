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
  listWarehouseDepotLayouts,
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
      const [active, history, materials, depots, locations, balances] = await Promise.all([
        getActiveWarehouseDepotLayout(workspaceId),
        listWarehouseDepotLayouts(workspaceId, 100),
        listWarehouseMaterials(workspaceId, 250),
        listWarehouseDepots(workspaceId, 250),
        listWarehouseLocations(workspaceId, 500),
        listWarehouseLocationBalances(workspaceId, 500),
      ]);
      setData({
        loading: false,
        error: null,
        active: active?.layout || null,
        history,
        materials,
        depots: depots.map((item) => item.depot),
        locations: locations.map((item) => item.location),
        balances: balances.map((item) => item.balance),
      });
      if (active?.layout) {
        setDraftObjects(active.layout.objects);
        setDraftName(active.layout.name);
        setDraftDepotId(active.layout.depotId || '');
        setDraftWidth(active.layout.logicalWidth);
        setDraftHeight(active.layout.logicalHeight);
      }
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
        id: data.active?.id || 'lay_00000000000000000000000000000000',
        workspaceId,
        ug: data.active?.ug || '160416',
        name: draftName,
        depotId: draftDepotId || null,
        logicalWidth: draftWidth,
        logicalHeight: draftHeight,
        objects: draftObjects,
        version: data.active?.version || 0,
        status: 'active' as const,
        previousVersionId: data.active?.previousVersionId || null,
        createdBy: data.active?.createdBy || 'draft',
        updatedBy: data.active?.updatedBy || 'draft',
      }
    : data.active;

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
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
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
              <div className="flex flex-wrap gap-2">
                {data.active && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        downloadText(
                          'warehouse-layout-v' + data.active!.version + '.json',
                          JSON.stringify(data.active, null, 2),
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
                          'warehouse-layout-v' + data.active!.version + '.svg',
                          renderWarehouseDepotLayoutSvg(data.active!),
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
                      setDraftObjects(data.active?.objects || []);
                      setDraftName(data.active?.name || 'Croqui principal');
                      setDraftDepotId(data.active?.depotId || '');
                      setDraftWidth(data.active?.logicalWidth || DEFAULT_WIDTH);
                      setDraftHeight(data.active?.logicalHeight || DEFAULT_HEIGHT);
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
            <WarehouseCanvas
              layout={currentLayout}
              objects={mode === 'edit' ? draftObjects : currentLayout.objects}
              mode={mode}
              selectedObjectId={selectedObjectId}
              highlightedLocationIds={highlightedLocationIds}
              fefoLocationId={fefoLocationId}
              onSelect={(id) => { if (mode === 'edit') setSelectedObjectId(id); }}
              onMove={(id, x, y) => updateObject(id, { x, y })}
            />
          ) : (
            <div className="grid min-h-[360px] place-items-center rounded-2xl border border-dashed border-blue-300/15 bg-blue-400/[0.025] p-8 text-center">
              <div>
                <BoxSelect className="mx-auto h-8 w-8 text-blue-200/60" />
                <p className="mt-4 text-sm font-black text-slate-200">Nenhum layout ativo</p>
                <p className="mt-2 max-w-md text-xs leading-6 text-slate-500">
                  Entre no modo de edição para criar a primeira representação visual. O estoque existente não será alterado.
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
            <p className="mt-3 text-sm font-bold text-white">{data.active?.name || 'Ainda não criado'}</p>
            <p className="mt-1 font-mono text-[10px] text-slate-600">
              {data.active ? 'versão ' + data.active.version + ' · ' + data.active.id : 'primeira versão pendente'}
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              {data.history.length} versão(ões) preservada(s). Alterar geometria nunca movimenta estoque.
            </p>
          </div>

          {mode === 'edit' && (
            <div className="space-y-4 rounded-2xl border border-blue-300/10 bg-blue-400/[0.025] p-4" data-testid="warehouse-layout-editor">
              <div>
                <p className="text-xs font-black text-blue-100">Editor simplificado</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">Arraste objetos no croqui ou ajuste os campos. Salvar cria nova versão.</p>
              </div>

              <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Nome
                <input data-testid="warehouse-layout-name" value={draftName} onChange={(e) => setDraftName(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 text-xs text-slate-200 outline-none" />
              </label>
              <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Depósito relacionado
                <select data-testid="warehouse-layout-depot" value={draftDepotId} onChange={(e) => setDraftDepotId(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-white/[0.08] bg-[#08101f] px-3 text-xs text-slate-200">
                  <option value="">Layout geral da UG</option>
                  {data.depots.filter((depot) => depot.status === 'active').map((depot) => (
                    <option key={depot.id} value={depot.id}>{depot.code} · {depot.name}</option>
                  ))}
                </select>
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

              <button
                type="button"
                data-testid="warehouse-layout-add-object"
                onClick={() => {
                  const object = createWarehouseDepotLayoutObject({ kind: 'SHELF', label: 'Nova estrutura', x: 40 + draftObjects.length * 12, y: 40 + draftObjects.length * 12 });
                  setDraftObjects((items) => [...items, object]);
                  setSelectedObjectId(object.id);
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2.5 text-xs font-black text-slate-200"
              >
                <Plus className="h-4 w-4" /> Adicionar objeto
              </button>

              {selectedObject && (
                <div className="space-y-3 rounded-xl border border-white/[0.07] bg-black/15 p-3" data-testid="warehouse-layout-object-editor">
                  <input data-testid="warehouse-layout-object-label" value={selectedObject.label} onChange={(e) => updateObject(selectedObject.id, { label: e.target.value })} className="h-9 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 text-xs text-slate-200" />
                  <select value={selectedObject.kind} onChange={(e) => updateObject(selectedObject.id, { kind: e.target.value as WarehouseDepotLayoutObjectKind })} className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#08101f] px-3 text-xs text-slate-200">
                    {['WALL','CORRIDOR','AREA','SHELF','RACK','CABINET','CHAMBER','FREEZER','BENCH','ZONE','OTHER'].map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                  </select>
                  <select data-testid="warehouse-layout-object-location" value={selectedObject.warehouseLocationId || ''} onChange={(e) => updateObject(selectedObject.id, { warehouseLocationId: e.target.value || null })} className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#08101f] px-3 text-xs text-slate-200">
                    <option value="">Sem vínculo logístico</option>
                    {activeLocations.map((location) => (
                      <option key={location.id} value={location.id}>{location.code} · {location.name}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ['x','X'],['y','Y'],['width','Largura'],['height','Altura']
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
                  setDraftObjects(data.active?.objects || []);
                  setDraftName(data.active?.name || 'Croqui principal');
                  setDraftDepotId(data.active?.depotId || '');
                  setDraftWidth(data.active?.logicalWidth || DEFAULT_WIDTH);
                  setDraftHeight(data.active?.logicalHeight || DEFAULT_HEIGHT);
                  setSelectedObjectId(null);
                }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2.5 text-xs font-bold text-slate-300">
                  <RotateCcw className="h-4 w-4" /> Cancelar
                </button>
                <button
                  type="button"
                  data-testid="warehouse-layout-save"
                  disabled={saving}
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
                        baseLayoutId: data.active?.id || null,
                        expectedVersion: data.active?.version || null,
                      });
                      setMessage('Layout salvo como versão ' + saved.version + '. Nenhum saldo ou movimento de estoque foi alterado.');
                      setMode('view');
                      setSelectedObjectId(null);
                      await reload();
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
