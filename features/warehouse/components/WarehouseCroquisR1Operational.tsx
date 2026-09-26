'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BoxSelect,
  CheckCircle2,
  History,
  Link2,
  Plus,
  Save,
  Warehouse,
} from 'lucide-react';

import {
  createWarehouseDepotLayoutObject,
  type WarehouseDepotLayout,
  type WarehouseDepotLayoutObject,
} from '../../../lib/warehouse/layout';
import {
  getActiveWarehouseDepotLayout,
  listWarehouseDepotLayoutsForDepot,
  saveWarehouseDepotLayoutVersion,
  type WarehouseDepotLayoutListItem,
} from '../../../lib/warehouse/layoutRepository';
import {
  listWarehouseDepots,
  listWarehouseLocations,
  type WarehouseDepotListItem,
  type WarehouseLocationListItem,
} from '../../../lib/warehouse/locationRepository';
import {
  WAREHOUSE_STRUCTURE_LIBRARY,
  type WarehouseStructureDefinition,
} from '../../../lib/warehouse/structureLibrary';
import { WarehouseDepotLayoutEditor } from './WarehouseDepotLayoutEditor';

const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 620;

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function cloneObjects(objects: WarehouseDepotLayoutObject[]): WarehouseDepotLayoutObject[] {
  return objects.map((item) => ({ ...item }));
}

function labelForLocation(
  item: WarehouseLocationListItem,
  locations: WarehouseLocationListItem[]
): string {
  const location = item.location;
  if (location.kind === 'LOCAL') return location.code + ' · ' + location.name;
  const parent = locations.find((candidate) => candidate.location.id === location.parentLocationId)?.location;
  return (parent ? parent.code + ' → ' : '') + location.code + ' · ' + location.name;
}

export function WarehouseCroquisR1Operational({ workspaceId }: { workspaceId: string }) {
  const [depots, setDepots] = useState<WarehouseDepotListItem[]>([]);
  const [locations, setLocations] = useState<WarehouseLocationListItem[]>([]);
  const [selectedDepotId, setSelectedDepotId] = useState('');
  const [activeLayout, setActiveLayout] = useState<WarehouseDepotLayout | null>(null);
  const [history, setHistory] = useState<WarehouseDepotLayoutListItem[]>([]);
  const [draftName, setDraftName] = useState('Croqui principal');
  const [draftWidth, setDraftWidth] = useState(DEFAULT_WIDTH);
  const [draftHeight, setDraftHeight] = useState(DEFAULT_HEIGHT);
  const [draftObjects, setDraftObjects] = useState<WarehouseDepotLayoutObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [draftHistory, setDraftHistory] = useState<{
    past: WarehouseDepotLayoutObject[][];
    future: WarehouseDepotLayoutObject[][];
  }>({ past: [], future: [] });
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
      return () => { cancelled = true; };
    }

    void Promise.all([
      getActiveWarehouseDepotLayout(workspaceId, selectedDepotId),
      listWarehouseDepotLayoutsForDepot(workspaceId, selectedDepotId, 100),
    ]).then(([active, versions]) => {
      if (cancelled) return;
      setActiveLayout(active?.layout || null);
      setHistory(versions);
      const layout = active?.layout || null;
      setDraftName(layout?.name || 'Croqui principal');
      setDraftWidth(layout?.logicalWidth || DEFAULT_WIDTH);
      setDraftHeight(layout?.logicalHeight || DEFAULT_HEIGHT);
      setDraftObjects(cloneObjects(layout?.objects || []));
      setSelectedObjectId(null);
      setDraftHistory({ past: [], future: [] });
    }).catch((error) => {
      if (!cancelled) setMessage(messageFrom(error));
    });

    return () => { cancelled = true; };
  }, [selectedDepotId, workspaceId]);

  const selectedDepot = useMemo(
    () => depots.find((item) => item.depot.id === selectedDepotId)?.depot || null,
    [depots, selectedDepotId]
  );

  const availableLocations = useMemo(
    () => locations.filter(
      (item) =>
        item.location.depotId === selectedDepotId
        && item.location.status === 'active'
    ),
    [locations, selectedDepotId]
  );

  const selectedObject = useMemo(
    () => draftObjects.find((item) => item.id === selectedObjectId) || null,
    [draftObjects, selectedObjectId]
  );

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

  function addStructure(definition: WarehouseStructureDefinition) {
    const next = createWarehouseDepotLayoutObject({
      kind: definition.kind,
      label: definition.name,
      width: Math.min(definition.defaultWidth, draftWidth - 40),
      height: Math.min(definition.defaultHeight, draftHeight - 40),
      rotation: definition.defaultRotation,
      visualVariant: definition.visualVariant,
      layer: Math.max(0, ...draftObjects.map((item) => item.layer)) + 1,
      x: 40,
      y: 40,
    });
    checkpoint(draftObjects);
    setDraftObjects([...draftObjects, next]);
    setSelectedObjectId(next.id);
  }

  function patchSelected(patch: Partial<WarehouseDepotLayoutObject>) {
    if (!selectedObject) return;
    checkpoint(draftObjects);
    setDraftObjects((current) =>
      current.map((item) => item.id === selectedObject.id ? { ...item, ...patch } : item)
    );
  }

  async function saveLayout() {
    if (!selectedDepotId || !selectedDepot) return;
    setSaving(true);
    setMessage(null);
    try {
      const saved = await saveWarehouseDepotLayoutVersion(workspaceId, {
        name: draftName.trim() || 'Croqui principal',
        depotId: selectedDepotId,
        logicalWidth: draftWidth,
        logicalHeight: draftHeight,
        objects: draftObjects,
        baseLayoutId: activeLayout?.id || null,
        expectedVersion: activeLayout?.version ?? null,
      });
      setMessage('Croqui salvo com sucesso. Versão ' + saved.version + ' ativa.');
      const [active, versions] = await Promise.all([
        getActiveWarehouseDepotLayout(workspaceId, selectedDepotId),
        listWarehouseDepotLayoutsForDepot(workspaceId, selectedDepotId, 100),
      ]);
      setActiveLayout(active?.layout || saved);
      setHistory(versions);
      setDraftHistory({ past: [], future: [] });
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

  if (!depots.some((item) => item.depot.status === 'active')) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="font-black text-amber-900">Cadastre um depósito antes de desenhar o croqui.</p>
        <p className="mt-2 text-sm text-amber-800">
          O croqui sempre pertence a um depósito real e utiliza as Localizações já cadastradas.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4" data-testid="warehouse-r1-croquis">
      <div className="rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#00288e]/70">
              Croqui operacional
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-900">
              Desenhar depósito
            </h2>
            <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-slate-600">
              Selecione um depósito cadastrado, insira as estruturas físicas e vincule cada objeto ao Local real correspondente.
              Alterar o desenho não movimenta estoque.
            </p>
          </div>

          <label className="min-w-0 xl:w-[360px]">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">
              Depósito
            </span>
            <select
              value={selectedDepotId}
              onChange={(event) => setSelectedDepotId(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            >
              {depots.filter((item) => item.depot.status === 'active').map((item) => (
                <option key={item.depot.id} value={item.depot.id}>
                  {item.depot.code} · {item.depot.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedDepot && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 font-black text-[#00288e]">
              <Warehouse className="mr-1.5 inline h-3.5 w-3.5" />
              {selectedDepot.code}
            </span>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-600">
              {availableLocations.filter((item) => item.location.kind === 'LOCAL').length} Locais
            </span>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-600">
              {availableLocations.filter((item) => item.location.kind === 'SUBPOSITION').length} Subposições
            </span>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-600">
              {activeLayout ? 'Versão ativa ' + activeLayout.version : 'Sem croqui salvo'}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-4 2xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <aside className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-[#00288e]" />
              <h3 className="text-sm font-black text-slate-900">Estruturas</h3>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">
              Clique para inserir no desenho.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
              {WAREHOUSE_STRUCTURE_LIBRARY.map((definition) => (
                <button
                  key={definition.id}
                  type="button"
                  onClick={() => addStructure(definition)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-blue-200 hover:bg-blue-50"
                >
                  <span className="block text-xs font-black text-slate-800">{definition.name}</span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">
                    {definition.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_120px_auto] sm:items-end">
              <label>
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">Nome do croqui</span>
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800"
                />
              </label>
              <label>
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">Largura</span>
                <input
                  type="number"
                  min={240}
                  max={5000}
                  value={draftWidth}
                  onChange={(event) => setDraftWidth(Math.max(240, Math.min(5000, Number(event.target.value) || DEFAULT_WIDTH)))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800"
                />
              </label>
              <label>
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">Altura</span>
                <input
                  type="number"
                  min={240}
                  max={5000}
                  value={draftHeight}
                  onChange={(event) => setDraftHeight(Math.max(240, Math.min(5000, Number(event.target.value) || DEFAULT_HEIGHT)))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800"
                />
              </label>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveLayout()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Salvando…' : 'Salvar versão'}
              </button>
            </div>
          </div>

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
          />
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <BoxSelect className="h-4 w-4 text-[#00288e]" />
              <h3 className="text-sm font-black text-slate-900">Objeto selecionado</h3>
            </div>

            {!selectedObject ? (
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Selecione uma estrutura no croqui para editar o nome e vinculá-la a um Local cadastrado.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">Nome visual</span>
                  <input
                    value={selectedObject.label}
                    onChange={(event) => patchSelected({ label: event.target.value })}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                    <Link2 className="h-3 w-3" /> Local vinculado
                  </span>
                  <select
                    value={selectedObject.warehouseLocationId || ''}
                    onChange={(event) => patchSelected({ warehouseLocationId: event.target.value || null })}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800"
                  >
                    <option value="">Sem vínculo</option>
                    {availableLocations.map((item) => (
                      <option
                        key={item.location.id}
                        value={item.location.id}
                        disabled={draftObjects.some(
                          (object) =>
                            object.id !== selectedObject.id
                            && object.warehouseLocationId === item.location.id
                        )}
                      >
                        {labelForLocation(item, availableLocations)}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedObject.warehouseLocationId && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-black text-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Vinculado ao cadastro físico
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-[#00288e]" />
              <h3 className="text-sm font-black text-slate-900">Versões</h3>
            </div>
            {history.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">Nenhuma versão salva para este depósito.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {history.slice(0, 8).map((item) => (
                  <div
                    key={item.layout.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <p className="text-xs font-black text-slate-800">
                      v{item.layout.version} · {item.layout.name}
                    </p>
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

      {message && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-slate-700">
          {message}
        </div>
      )}
    </section>
  );
}
