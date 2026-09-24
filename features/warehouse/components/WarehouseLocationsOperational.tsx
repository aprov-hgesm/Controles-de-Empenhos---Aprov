'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CheckCircle2, MapPinned, RefreshCw } from 'lucide-react';

import { listWarehouseBalances } from '../../../lib/warehouse/ledgerRepository';
import {
  deriveUnassignedQuantity,
  warehouseStockPositionKey,
  type WarehouseStockPosition,
} from '../../../lib/warehouse/location';
import {
  buildWarehousePositionLabel,
  createWarehouseDepot,
  createWarehouseLocation,
  createWarehouseTransferIdempotencyKey,
  listWarehouseDepots,
  listWarehouseLocationBalances,
  listWarehouseLocations,
  transferWarehouseStock,
  updateWarehouseDepot,
  updateWarehouseLocation,
  type WarehouseDepotListItem,
  type WarehouseLocationBalanceListItem,
  type WarehouseLocationListItem,
} from '../../../lib/warehouse/locationRepository';
import { listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import type { WarehouseBalance } from '../../../lib/warehouse/movement';

interface WarehouseLocationsOperationalProps {
  workspaceId: string;
}

interface Phase6State {
  loading: boolean;
  depots: WarehouseDepotListItem[];
  locations: WarehouseLocationListItem[];
  materials: WarehouseMaterial[];
  balances: WarehouseBalance[];
  locationBalances: WarehouseLocationBalanceListItem[];
}

interface DistributionRow {
  position: WarehouseStockPosition;
  quantity: number;
  virtual: boolean;
}

interface TransferReview {
  materialId: string;
  quantity: number;
  from: WarehouseStockPosition;
  to: WarehouseStockPosition;
  idempotencyKey: string;
}

interface EditTarget {
  kind: 'depot' | 'location';
  id: string;
  name: string;
  description: string;
}

const fieldClass =
  'h-10 w-full rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-700 focus:border-blue-300/30';
const primaryButton =
  'inline-flex h-10 items-center justify-center rounded-xl bg-blue-500/90 px-4 text-xs font-black text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40';
const secondaryButton =
  'inline-flex h-9 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.035] px-3 text-xs font-bold text-slate-300 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40';

function phase6Message(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('WAREHOUSE_DEPOT_CODE_ALREADY_EXISTS')) return 'Já existe um depósito com esse código lógico.';
  if (raw.includes('WAREHOUSE_LOCATION_CODE_ALREADY_EXISTS')) return 'Já existe uma posição irmã com esse código lógico.';
  if (raw.includes('WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK')) return 'A quantidade informada é maior que o saldo disponível na origem.';
  if (raw.includes('WAREHOUSE_TRANSFER_SAME_POSITION')) return 'Origem e destino precisam ser diferentes.';
  if (raw.includes('WAREHOUSE_TRANSFER_INVALID_QUANTITY')) return 'Informe uma quantidade maior que zero, com até seis casas decimais.';
  if (raw.includes('WAREHOUSE_POSITION_INACTIVE') || raw.includes('WAREHOUSE_SUBPOSITION_INACTIVE')) return 'A origem ou o destino está inativo.';
  if (raw.includes('WAREHOUSE_POSITION_NOT_FOUND') || raw.includes('WAREHOUSE_LOCATION_NOT_FOUND')) return 'A localização selecionada não existe mais. Atualize a tela.';
  if (raw.includes('WAREHOUSE_MATERIAL_NOT_FOUND')) return 'O material selecionado não existe mais.';
  return raw;
}

export function WarehouseLocationsOperational({
  workspaceId,
}: WarehouseLocationsOperationalProps) {
  const [state, setState] = useState<Phase6State>({
    loading: true,
    depots: [],
    locations: [],
    materials: [],
    balances: [],
    locationBalances: [],
  });
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [selectedDepotId, setSelectedDepotId] = useState('');
  const [depotCode, setDepotCode] = useState('');
  const [depotName, setDepotName] = useState('');
  const [depotDescription, setDepotDescription] = useState('');

  const [locationKind, setLocationKind] = useState<'LOCAL' | 'SUBPOSITION'>('LOCAL');
  const [locationCode, setLocationCode] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [parentLocationId, setParentLocationId] = useState('');

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const [transferMaterialId, setTransferMaterialId] = useState('');
  const [transferFromKey, setTransferFromKey] = useState('');
  const [transferToKey, setTransferToKey] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('');
  const [transferReview, setTransferReview] = useState<TransferReview | null>(null);

  const refresh = async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      const [depots, locations, materials, balances, locationBalances] =
        await Promise.all([
          listWarehouseDepots(workspaceId, 250),
          listWarehouseLocations(workspaceId, 500),
          listWarehouseMaterials(workspaceId, 250),
          listWarehouseBalances(workspaceId, 250),
          listWarehouseLocationBalances(workspaceId, 500),
        ]);
      setState({
        loading: false,
        depots,
        locations,
        materials,
        balances,
        locationBalances,
      });
      setSelectedDepotId((current) =>
        current && depots.some((item) => item.depot.id === current)
          ? current
          : depots[0]?.depot.id || ''
      );
      setTransferMaterialId((current) =>
        current && balances.some((item) => item.materialId === current)
          ? current
          : balances.find((item) => item.quantity > 0)?.materialId || ''
      );
    } catch (error) {
      setState((current) => ({ ...current, loading: false }));
      setMessage(phase6Message(error));
    }
  };

  useEffect(() => {
    void refresh();
  }, [workspaceId]);

  const materialById = useMemo(
    () => new Map(state.materials.map((material) => [material.id, material])),
    [state.materials]
  );
  const activeDepotIds = useMemo(
    () =>
      new Set(
        state.depots
          .filter((item) => item.depot.status === 'active')
          .map((item) => item.depot.id)
      ),
    [state.depots]
  );
  const locals = useMemo(
    () => state.locations.filter((item) => item.location.kind === 'LOCAL'),
    [state.locations]
  );

  const positions = useMemo(() => {
    const next = new Map<string, WarehouseStockPosition>();
    for (const item of state.locations) {
      const location = item.location;
      if (
        location.status !== 'active'
        || !activeDepotIds.has(location.depotId)
      ) {
        continue;
      }
      if (location.kind === 'LOCAL') {
        const position: WarehouseStockPosition = {
          kind: 'LOCATION',
          depotId: location.depotId,
          locationId: location.id,
          subpositionId: null,
        };
        next.set(warehouseStockPositionKey(position), position);
        continue;
      }
      const parent = state.locations.find(
        (candidate) => candidate.location.id === location.parentLocationId
      )?.location;
      if (!parent || parent.status !== 'active') continue;
      const position: WarehouseStockPosition = {
        kind: 'SUBPOSITION',
        depotId: location.depotId,
        locationId: parent.id,
        subpositionId: location.id,
      };
      next.set(warehouseStockPositionKey(position), position);
    }
    return next;
  }, [activeDepotIds, state.locations]);

  const distributionByMaterial = useMemo(() => {
    const grouped = new Map<string, DistributionRow[]>();
    for (const balance of state.balances) {
      const explicit = state.locationBalances
        .filter((item) => item.balance.materialId === balance.materialId)
        .map((item) => item.balance);
      const explicitUnassigned = explicit.find(
        (item) => item.position.kind === 'UNASSIGNED'
      );
      const physical = explicit.filter(
        (item) => item.position.kind !== 'UNASSIGNED'
      );
      const unassignedQuantity = explicitUnassigned
        ? explicitUnassigned.quantity
        : deriveUnassignedQuantity(balance.quantity, physical);
      const rows: DistributionRow[] = [
        {
          position: { kind: 'UNASSIGNED' },
          quantity: unassignedQuantity,
          virtual: !explicitUnassigned,
        },
        ...physical.map((item) => ({
          position: item.position,
          quantity: item.quantity,
          virtual: false,
        })),
      ];
      grouped.set(balance.materialId, rows);
    }
    return grouped;
  }, [state.balances, state.locationBalances]);

  const selectedDepot = state.depots.find(
    (item) => item.depot.id === selectedDepotId
  )?.depot;
  const selectedDepotLocals = locals.filter(
    (item) => item.location.depotId === selectedDepotId
  );

  const sourceOptions = useMemo(
    () =>
      (distributionByMaterial.get(transferMaterialId) || []).filter(
        (row) =>
          row.quantity > 0
          && (
            row.position.kind === 'UNASSIGNED'
            || positions.has(warehouseStockPositionKey(row.position))
          )
      ),
    [distributionByMaterial, positions, transferMaterialId]
  );

  const destinationOptions = useMemo(
    () =>
      Array.from(positions.entries()).filter(([key]) => key !== transferFromKey),
    [positions, transferFromKey]
  );

  useEffect(() => {
    if (
      !transferFromKey
      || !sourceOptions.some(
        (row) => warehouseStockPositionKey(row.position) === transferFromKey
      )
    ) {
      setTransferFromKey(
        sourceOptions[0]
          ? warehouseStockPositionKey(sourceOptions[0].position)
          : ''
      );
    }
  }, [sourceOptions, transferFromKey]);

  useEffect(() => {
    if (
      !transferToKey
      || !destinationOptions.some(([key]) => key === transferToKey)
    ) {
      setTransferToKey(destinationOptions[0]?.[0] || '');
    }
  }, [destinationOptions, transferToKey]);

  const createDepot = async (event: FormEvent) => {
    event.preventDefault();
    setWorking(true);
    setMessage(null);
    try {
      const depot = await createWarehouseDepot(workspaceId, {
        code: depotCode,
        name: depotName,
        description: depotDescription || null,
      });
      setDepotCode('');
      setDepotName('');
      setDepotDescription('');
      setSelectedDepotId(depot.id);
      setMessage('Depósito criado com identidade lógica estável.');
      await refresh();
    } catch (error) {
      setMessage(phase6Message(error));
    } finally {
      setWorking(false);
    }
  };

  const createLocation = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedDepotId) {
      setMessage('Selecione um depósito antes de criar uma localização.');
      return;
    }
    setWorking(true);
    setMessage(null);
    try {
      await createWarehouseLocation(workspaceId, {
        kind: locationKind,
        depotId: selectedDepotId,
        parentLocationId:
          locationKind === 'SUBPOSITION' ? parentLocationId : null,
        code: locationCode,
        name: locationName,
        description: locationDescription || null,
      });
      setLocationCode('');
      setLocationName('');
      setLocationDescription('');
      setParentLocationId('');
      setMessage(
        locationKind === 'LOCAL'
          ? 'Local criado no depósito selecionado.'
          : 'Subposição criada no local selecionado.'
      );
      await refresh();
    } catch (error) {
      setMessage(phase6Message(error));
    } finally {
      setWorking(false);
    }
  };

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editTarget) return;
    setWorking(true);
    setMessage(null);
    try {
      if (editTarget.kind === 'depot') {
        await updateWarehouseDepot(workspaceId, editTarget.id, {
          name: editTarget.name,
          description: editTarget.description || null,
        });
      } else {
        await updateWarehouseLocation(workspaceId, editTarget.id, {
          name: editTarget.name,
          description: editTarget.description || null,
        });
      }
      setEditTarget(null);
      setMessage('Descrição visível atualizada. O ID e o código lógico foram preservados.');
      await refresh();
    } catch (error) {
      setMessage(phase6Message(error));
    } finally {
      setWorking(false);
    }
  };

  const toggleDepot = async (item: WarehouseDepotListItem) => {
    if (
      item.depot.status === 'active'
      && !window.confirm('Excluir este depósito da operação? O histórico será preservado e ele poderá ser restaurado depois.')
    ) return;
    setWorking(true);
    setMessage(null);
    try {
      await updateWarehouseDepot(workspaceId, item.depot.id, {
        status: item.depot.status === 'active' ? 'inactive' : 'active',
      });
      await refresh();
    } catch (error) {
      setMessage(phase6Message(error));
    } finally {
      setWorking(false);
    }
  };

  const toggleLocation = async (item: WarehouseLocationListItem) => {
    if (
      item.location.status === 'active'
      && !window.confirm('Remover esta localização da operação? O histórico será preservado.')
    ) return;
    setWorking(true);
    setMessage(null);
    try {
      await updateWarehouseLocation(workspaceId, item.location.id, {
        status: item.location.status === 'active' ? 'inactive' : 'active',
      });
      await refresh();
    } catch (error) {
      setMessage(phase6Message(error));
    } finally {
      setWorking(false);
    }
  };

  const startTransfer = (event: FormEvent) => {
    event.preventDefault();
    const quantity = Number(transferQuantity.replace(',', '.'));
    const sourceRow = sourceOptions.find(
      (row) => warehouseStockPositionKey(row.position) === transferFromKey
    );
    const destination = positions.get(transferToKey);
    if (!transferMaterialId || !sourceRow || !destination) {
      setMessage('Selecione material, origem e destino válidos.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > sourceRow.quantity) {
      setMessage('Informe uma quantidade válida, limitada ao saldo disponível na origem.');
      return;
    }
    if (transferFromKey === transferToKey) {
      setMessage('Origem e destino precisam ser diferentes.');
      return;
    }
    setMessage(null);
    setTransferReview({
      materialId: transferMaterialId,
      quantity,
      from: sourceRow.position,
      to: destination,
      idempotencyKey: createWarehouseTransferIdempotencyKey(),
    });
  };

  const confirmTransfer = async () => {
    if (!transferReview) return;
    setWorking(true);
    setMessage(null);
    try {
      const result = await transferWarehouseStock(workspaceId, {
        ...transferReview,
        note: 'Transferência interna pela interface da FASE 6',
      });
      setMessage(
        result.applied
          ? 'Transferência concluída. O saldo total da OM foi preservado.'
          : 'A mesma transferência já havia sido processada; nenhum estoque foi movimentado novamente.'
      );
      setTransferReview(null);
      setTransferQuantity('');
      await refresh();
    } catch (error) {
      setMessage(phase6Message(error));
    } finally {
      setWorking(false);
    }
  };

  if (state.loading && state.depots.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-white/[0.07] bg-black/10 p-5 text-sm text-slate-400">
        Carregando depósitos, localizações e distribuição física…
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6" data-testid="warehouse-locations-operational">
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-blue-300/10 bg-blue-400/[0.035] p-4">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-blue-300/70">Estrutura física</p>
          <p className="mt-2 text-sm font-black text-slate-200">Depósito → Local → Subposição opcional</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">IDs permanecem estáveis mesmo quando o nome visível é alterado.</p>
        </div>
        <div className="rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.035] p-4">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-300/70">Distribuição</p>
          <p className="mt-2 text-sm font-black text-slate-200">1 material → N localizações</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">A projeção física não substitui o saldo geral derivado do ledger.</p>
        </div>
        <div className="rounded-2xl border border-amber-300/10 bg-amber-400/[0.035] p-4">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-amber-300/70">Migração segura</p>
          <p className="mt-2 text-sm font-black text-slate-200">Sem localização</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">Saldos anteriores à FASE 6 permanecem íntegros até serem organizados fisicamente.</p>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-xs leading-5 text-slate-300" data-testid="warehouse-phase6-message">
          {message}
        </div>
      )}

      <section className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-200">
              <MapPinned className="h-4 w-4 text-blue-200" aria-hidden="true" />
              <h3 className="text-sm font-black">Depósitos e localizações</h3>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Códigos lógicos não são alterados depois da criação. Use inativação em vez de exclusão física.</p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={working} className={secondaryButton} aria-label="Atualizar localizações">
            <RefreshCw className={state.loading ? 'mr-2 h-3.5 w-3.5 animate-spin' : 'mr-2 h-3.5 w-3.5'} aria-hidden="true" />
            Atualizar
          </button>
        </div>

        <form onSubmit={createDepot} className="mt-5 grid gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
          <input value={depotCode} onChange={(event) => setDepotCode(event.target.value)} className={fieldClass} placeholder="DEP-01" aria-label="Código do depósito" required />
          <input value={depotName} onChange={(event) => setDepotName(event.target.value)} className={fieldClass} placeholder="Nome do depósito" aria-label="Nome do depósito" required />
          <input value={depotDescription} onChange={(event) => setDepotDescription(event.target.value)} className={fieldClass} placeholder="Descrição opcional" aria-label="Descrição do depósito" />
          <button type="submit" disabled={working} className={primaryButton} data-testid="warehouse-depot-create">Criar depósito</button>
        </form>

        {state.depots.length === 0 ? (
          <p className="mt-5 text-sm text-slate-500">Nenhum depósito cadastrado. Crie o primeiro depósito acima.</p>
        ) : (
          <div className="mt-5 grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-2">
              {state.depots.map((item) => {
                const selected = item.depot.id === selectedDepotId;
                return (
                  <button
                    key={item.depot.id}
                    type="button"
                    onClick={() => setSelectedDepotId(item.depot.id)}
                    className={selected ? 'w-full rounded-xl border border-blue-300/20 bg-blue-400/[0.08] p-3 text-left' : 'w-full rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left hover:bg-white/[0.04]'}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <code className="text-[10px] font-bold text-blue-200">{item.depot.code}</code>
                      <span className={item.depot.status === 'active' ? 'text-[9px] font-bold uppercase text-emerald-300' : 'text-[9px] font-bold uppercase text-slate-600'}>
                        {item.depot.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-300">{item.depot.name}</p>
                  </button>
                );
              })}
            </div>

            {selectedDepot && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <code className="text-[10px] font-bold text-blue-200">{selectedDepot.code}</code>
                    <p className="mt-1 text-base font-black text-slate-200">{selectedDepot.name}</p>
                    <p className="mt-1 text-xs text-slate-600">{selectedDepot.description || 'Sem descrição.'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className={secondaryButton} onClick={() => setEditTarget({ kind: 'depot', id: selectedDepot.id, name: selectedDepot.name, description: selectedDepot.description || '' })}>Editar</button>
                    <button type="button" className={secondaryButton} disabled={working} onClick={() => void toggleDepot(state.depots.find((item) => item.depot.id === selectedDepot.id)!)}>
                      {selectedDepot.status === 'active' ? 'Excluir da operação' : 'Restaurar'}
                    </button>
                  </div>
                </div>

                <form onSubmit={createLocation} className="mt-5 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-2 xl:grid-cols-5">
                  <select value={locationKind} onChange={(event) => { setLocationKind(event.target.value as 'LOCAL' | 'SUBPOSITION'); setParentLocationId(''); }} className={fieldClass} aria-label="Tipo de localização">
                    <option value="LOCAL">Local</option>
                    <option value="SUBPOSITION">Subposição</option>
                  </select>
                  <input value={locationCode} onChange={(event) => setLocationCode(event.target.value)} className={fieldClass} placeholder={locationKind === 'LOCAL' ? 'EST-03' : 'PRAT-B'} aria-label="Código da localização" required />
                  <input value={locationName} onChange={(event) => setLocationName(event.target.value)} className={fieldClass} placeholder="Nome da localização" aria-label="Nome da localização" required />
                  {locationKind === 'SUBPOSITION' ? (
                    <select value={parentLocationId} onChange={(event) => setParentLocationId(event.target.value)} className={fieldClass} aria-label="Local pai" required>
                      <option value="">Local pai…</option>
                      {selectedDepotLocals.filter((item) => item.location.status === 'active').map((item) => (
                        <option key={item.location.id} value={item.location.id}>{item.location.code} · {item.location.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input value={locationDescription} onChange={(event) => setLocationDescription(event.target.value)} className={fieldClass} placeholder="Descrição opcional" aria-label="Descrição da localização" />
                  )}
                  <button type="submit" disabled={working || selectedDepot.status !== 'active'} className={primaryButton} data-testid="warehouse-location-create">
                    Criar {locationKind === 'LOCAL' ? 'local' : 'subposição'}
                  </button>
                  {locationKind === 'SUBPOSITION' && (
                    <input value={locationDescription} onChange={(event) => setLocationDescription(event.target.value)} className={fieldClass + ' sm:col-span-2 xl:col-span-5'} placeholder="Descrição opcional da subposição" aria-label="Descrição da subposição" />
                  )}
                </form>

                <div className="mt-5 space-y-3">
                  {selectedDepotLocals.length === 0 ? (
                    <p className="text-xs text-slate-600">Nenhum local cadastrado neste depósito.</p>
                  ) : selectedDepotLocals.map((item) => {
                    const children = state.locations.filter(
                      (candidate) =>
                        candidate.location.kind === 'SUBPOSITION'
                        && candidate.location.parentLocationId === item.location.id
                    );
                    return (
                      <div key={item.location.id} className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <code className="text-[10px] font-bold text-blue-200">{item.location.code}</code>
                              <span className={item.location.status === 'active' ? 'text-[9px] font-bold uppercase text-emerald-300' : 'text-[9px] font-bold uppercase text-slate-600'}>{item.location.status === 'active' ? 'Ativo' : 'Inativo'}</span>
                            </div>
                            <p className="mt-1 text-xs font-bold text-slate-300">{item.location.name}</p>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" className={secondaryButton} onClick={() => setEditTarget({ kind: 'location', id: item.location.id, name: item.location.name, description: item.location.description || '' })}>Editar</button>
                            <button type="button" className={secondaryButton} disabled={working} onClick={() => void toggleLocation(item)}>{item.location.status === 'active' ? 'Remover da operação' : 'Restaurar'}</button>
                          </div>
                        </div>
                        {children.length > 0 && (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {children.map((child) => (
                              <div key={child.location.id} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <code className="text-[9px] text-blue-200/80">{child.location.code}</code>
                                  <span className={child.location.status === 'active' ? 'text-[8px] font-bold uppercase text-emerald-300' : 'text-[8px] font-bold uppercase text-slate-600'}>{child.location.status === 'active' ? 'Ativa' : 'Inativa'}</span>
                                </div>
                                <p className="mt-1 text-xs text-slate-400">{child.location.name}</p>
                                <div className="mt-2 flex gap-2">
                                  <button type="button" className={secondaryButton} onClick={() => setEditTarget({ kind: 'location', id: child.location.id, name: child.location.name, description: child.location.description || '' })}>Editar</button>
                                  <button type="button" className={secondaryButton} disabled={working} onClick={() => void toggleLocation(child)}>{child.location.status === 'active' ? 'Remover da operação' : 'Restaurar'}</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {editTarget && (
          <form onSubmit={saveEdit} className="mt-5 grid gap-3 rounded-xl border border-blue-300/10 bg-blue-400/[0.025] p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto_auto]">
            <input value={editTarget.name} onChange={(event) => setEditTarget({ ...editTarget, name: event.target.value })} className={fieldClass} aria-label="Novo nome" required />
            <input value={editTarget.description} onChange={(event) => setEditTarget({ ...editTarget, description: event.target.value })} className={fieldClass} aria-label="Nova descrição" placeholder="Descrição opcional" />
            <button type="submit" disabled={working} className={primaryButton}>Salvar edição</button>
            <button type="button" className={secondaryButton} onClick={() => setEditTarget(null)}>Cancelar</button>
          </form>
        )}
      </section>

      <section className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-blue-200" aria-hidden="true" />
          <h3 className="text-sm font-black text-slate-200">Transferência interna</h3>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">A operação registra TRANSFER no ledger, reduz a origem, aumenta o destino e mantém o saldo total da OM inalterado.</p>

        <form onSubmit={startTransfer} className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_120px_minmax(0,1.2fr)_auto]">
          <select value={transferMaterialId} onChange={(event) => { setTransferMaterialId(event.target.value); setTransferFromKey(''); setTransferReview(null); }} className={fieldClass} aria-label="Material da transferência" data-testid="warehouse-transfer-material" required>
            <option value="">Material…</option>
            {state.balances.filter((balance) => balance.quantity > 0).map((balance) => (
              <option key={balance.materialId} value={balance.materialId}>
                {materialById.get(balance.materialId)?.description || balance.materialId} · total {balance.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
              </option>
            ))}
          </select>
          <select value={transferFromKey} onChange={(event) => { setTransferFromKey(event.target.value); setTransferReview(null); }} className={fieldClass} aria-label="Origem da transferência" data-testid="warehouse-transfer-from" required>
            <option value="">Origem…</option>
            {sourceOptions.map((row) => {
              const key = warehouseStockPositionKey(row.position);
              return <option key={key} value={key}>{buildWarehousePositionLabel(row.position, state.depots, state.locations)} · {row.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}</option>;
            })}
          </select>
          <input value={transferQuantity} onChange={(event) => { setTransferQuantity(event.target.value); setTransferReview(null); }} className={fieldClass} inputMode="decimal" placeholder="Qtd." aria-label="Quantidade da transferência" data-testid="warehouse-transfer-quantity" required />
          <select value={transferToKey} onChange={(event) => { setTransferToKey(event.target.value); setTransferReview(null); }} className={fieldClass} aria-label="Destino da transferência" data-testid="warehouse-transfer-to" required>
            <option value="">Destino…</option>
            {destinationOptions.map(([key, position]) => (
              <option key={key} value={key}>{buildWarehousePositionLabel(position, state.depots, state.locations)}</option>
            ))}
          </select>
          <button type="submit" disabled={working || destinationOptions.length === 0} className={primaryButton} data-testid="warehouse-transfer-start">Revisar</button>
        </form>

        {transferReview && (
          <div className="mt-4 rounded-xl border border-emerald-300/10 bg-emerald-400/[0.03] p-4" data-testid="warehouse-transfer-review">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-300/70">Revisão antes de confirmar</p>
            <p className="mt-2 text-sm font-bold text-slate-200">
              {transferReview.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} · {materialById.get(transferReview.materialId)?.description || transferReview.materialId}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {buildWarehousePositionLabel(transferReview.from, state.depots, state.locations)}
              {' → '}
              {buildWarehousePositionLabel(transferReview.to, state.depots, state.locations)}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => void confirmTransfer()} disabled={working} className={primaryButton} data-testid="warehouse-transfer-confirm">
                <CheckCircle2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                Confirmar transferência
              </button>
              <button type="button" onClick={() => setTransferReview(null)} disabled={working} className={secondaryButton}>Voltar e editar</button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
        <h3 className="text-sm font-black text-slate-200">Distribuição física do estoque</h3>
        <p className="mt-2 text-xs leading-5 text-slate-500">“Sem localização” representa saldo real ainda não organizado fisicamente; não é um segundo estoque.</p>
        {state.balances.length === 0 ? (
          <p className="mt-4 text-xs text-slate-600">Ainda não há saldo de materiais para distribuir.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {state.balances.map((balance) => {
              const rows = distributionByMaterial.get(balance.materialId) || [];
              const material = materialById.get(balance.materialId);
              const locatedTotal = rows.reduce((sum, row) => sum + row.quantity, 0);
              const coherent = Math.abs(locatedTotal - balance.quantity) < 0.000001;
              return (
                <div key={balance.materialId} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4" data-testid={'warehouse-distribution-' + balance.materialId}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black text-slate-300">{material?.description || balance.materialId}</p>
                      <p className="mt-1 font-mono text-[9px] text-slate-700">{balance.materialId}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-black text-emerald-200">{balance.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} {material?.unit.label || material?.unit.code || ''}</p>
                      <p className={coherent ? 'mt-1 text-[9px] font-bold uppercase text-emerald-300/70' : 'mt-1 text-[9px] font-bold uppercase text-amber-300'}>
                        {coherent ? 'Distribuição coerente' : 'Distribuição requer revisão'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {rows.map((row) => {
                      const key = warehouseStockPositionKey(row.position);
                      return (
                        <div key={key} className="rounded-lg border border-white/[0.05] bg-black/10 px-3 py-2">
                          <p className="text-[10px] font-bold text-slate-400">{buildWarehousePositionLabel(row.position, state.depots, state.locations)}</p>
                          <p className="mt-1 text-sm font-black text-slate-200">{row.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}</p>
                          {row.virtual && <p className="mt-1 text-[8px] uppercase tracking-[0.12em] text-amber-300/60">saldo legado ainda não materializado</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="rounded-xl border border-slate-300/10 bg-slate-400/[0.025] px-4 py-3 text-xs leading-5 text-slate-500">
        Lotes, validade/FEFO, scanner, saída expressa, inventário e Visão do Depósito permanecem fora desta fase.
      </div>
    </div>
  );
}
