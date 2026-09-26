'use client';

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Box,
  ChevronRight,
  Container,
  MapPin,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Snowflake,
  Trash2,
  Warehouse,
  X,
} from 'lucide-react';

import { WarehouseStructureImportR1 } from './WarehouseStructureImportR1';

import {
  createWarehouseDepot,
  createWarehouseLocation,
  listWarehouseDepots,
  listWarehouseLocations,
  updateWarehouseDepot,
  updateWarehouseLocation,
  type WarehouseDepotListItem,
  type WarehouseLocationListItem,
} from '../../../lib/warehouse/locationRepository';
import type {
  WarehouseDepotSizeProfile,
  WarehouseDepotVisualType,
} from '../../../lib/warehouse/location';

type State = {
  loading: boolean;
  depots: WarehouseDepotListItem[];
  locations: WarehouseLocationListItem[];
};

type CreatePanel = 'depot' | 'location' | 'subposition' | 'editDepot' | 'editLocation' | 'editSubposition' | null;

function messageFromError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('WAREHOUSE_DEPOT_CODE_ALREADY_EXISTS')) {
    return 'Já existe um depósito com esse código lógico.';
  }
  if (raw.includes('WAREHOUSE_LOCATION_CODE_ALREADY_EXISTS')) {
    return 'Já existe uma localização irmã com esse código lógico.';
  }
  return raw;
}

function depotVisualLabel(value: WarehouseDepotVisualType): string {
  if (value === 'CONTAINER') return 'Contêiner';
  if (value === 'COLD_CONTAINER') return 'Contêiner frigorífico';
  return 'Depósito padrão';
}

function depotSizeLabel(value: WarehouseDepotSizeProfile): string {
  if (value === 'SMALL') return 'Pequeno';
  if (value === 'LARGE') return 'Grande';
  return 'Médio';
}

function depotVisualIcon(value: WarehouseDepotVisualType, className = 'h-8 w-8'): ReactNode {
  if (value === 'CONTAINER') return <Container className={className} aria-hidden="true" />;
  if (value === 'COLD_CONTAINER') {
    return (
      <span className="relative inline-flex">
        <Container className={className} aria-hidden="true" />
        <Snowflake className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-white p-0.5 text-cyan-600" aria-hidden="true" />
      </span>
    );
  }
  return <Warehouse className={className} aria-hidden="true" />;
}

function locationIcon(name: string, code: string): ReactNode {
  const normalized = (name + ' ' + code).toLocaleLowerCase('pt-BR');
  if (normalized.includes('freezer') || normalized.includes('geladeira') || normalized.includes('frigor')) {
    return <Snowflake className="h-5 w-5" aria-hidden="true" />;
  }
  if (normalized.includes('palete') || normalized.includes('pallet')) {
    return <Package className="h-5 w-5" aria-hidden="true" />;
  }
  if (normalized.includes('estante') || normalized.includes('prateleira') || normalized.includes('armário') || normalized.includes('armario')) {
    return <Archive className="h-5 w-5" aria-hidden="true" />;
  }
  return <Box className="h-5 w-5" aria-hidden="true" />;
}

export function WarehouseLocationsR1Operational({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const [state, setState] = useState<State>({ loading: true, depots: [], locations: [] });
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [createPanel, setCreatePanel] = useState<CreatePanel>(null);

  const [selectedDepotId, setSelectedDepotId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');

  const [depotCode, setDepotCode] = useState('');
  const [depotName, setDepotName] = useState('');
  const [depotDescription, setDepotDescription] = useState('');
  const [depotVisualType, setDepotVisualType] = useState<WarehouseDepotVisualType>('STANDARD');
  const [depotSizeProfile, setDepotSizeProfile] = useState<WarehouseDepotSizeProfile>('MEDIUM');

  const [locationCode, setLocationCode] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationDescription, setLocationDescription] = useState('');

  const refresh = async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      const [depots, locations] = await Promise.all([
        listWarehouseDepots(workspaceId, 250),
        listWarehouseLocations(workspaceId, 500),
      ]);
      setState({ loading: false, depots, locations });
      setSelectedDepotId((current) =>
        current && depots.some((item) => item.depot.id === current)
          ? current
          : depots.find((item) => item.depot.status === 'active')?.depot.id || ''
      );
    } catch (error) {
      setState((current) => ({ ...current, loading: false }));
      setMessage(messageFromError(error));
    }
  };

  useEffect(() => {
    void refresh();
  }, [workspaceId]);

  const activeDepots = useMemo(
    () => state.depots.filter((item) => item.depot.status === 'active'),
    [state.depots]
  );

  const selectedDepot = useMemo(
    () => state.depots.find((item) => item.depot.id === selectedDepotId)?.depot ?? null,
    [selectedDepotId, state.depots]
  );

  const localItems = useMemo(
    () =>
      state.locations.filter(
        (item) =>
          item.location.depotId === selectedDepotId
          && item.location.status === 'active'
          && item.location.kind === 'LOCAL'
      ),
    [selectedDepotId, state.locations]
  );

  const selectedLocation = useMemo(
    () => localItems.find((item) => item.location.id === selectedLocationId)?.location ?? null,
    [localItems, selectedLocationId]
  );

  const subpositions = useMemo(
    () =>
      state.locations.filter(
        (item) =>
          item.location.depotId === selectedDepotId
          && item.location.status === 'active'
          && item.location.kind === 'SUBPOSITION'
          && item.location.parentLocationId === selectedLocationId
      ),
    [selectedDepotId, selectedLocationId, state.locations]
  );

  const totalLocals = useMemo(
    () => state.locations.filter((item) => item.location.kind === 'LOCAL' && item.location.status === 'active').length,
    [state.locations]
  );
  const totalSubpositions = useMemo(
    () => state.locations.filter((item) => item.location.kind === 'SUBPOSITION' && item.location.status === 'active').length,
    [state.locations]
  );

  useEffect(() => {
    if (!localItems.some((item) => item.location.id === selectedLocationId)) {
      setSelectedLocationId(localItems[0]?.location.id ?? '');
    }
  }, [localItems, selectedLocationId]);

  function openPanel(panel: CreatePanel) {
    setCreatePanel(panel);
    setMessage(null);

    if (panel === 'editDepot' && selectedDepot) {
      setDepotCode(selectedDepot.code);
      setDepotName(selectedDepot.name);
      setDepotDescription(selectedDepot.description || '');
      setDepotVisualType(selectedDepot.visualType);
      setDepotSizeProfile(selectedDepot.sizeProfile);
      return;
    }

    if ((panel === 'editLocation' || panel === 'editSubposition') && selectedLocation) {
      setLocationCode(selectedLocation.code);
      setLocationName(selectedLocation.name);
      setLocationDescription(selectedLocation.description || '');
      return;
    }

    setLocationCode('');
    setLocationName('');
    setLocationDescription('');
    if (panel === 'depot') {
      setDepotCode('');
      setDepotName('');
      setDepotDescription('');
      setDepotVisualType('STANDARD');
      setDepotSizeProfile('MEDIUM');
    }
  }

  async function submitDepot(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setMessage(null);
    try {
      const depot = await createWarehouseDepot(workspaceId, {
        code: depotCode,
        name: depotName,
        description: depotDescription || null,
        visualType: depotVisualType,
        sizeProfile: depotSizeProfile,
      });
      setDepotCode('');
      setDepotName('');
      setDepotDescription('');
      setDepotVisualType('STANDARD');
      setDepotSizeProfile('MEDIUM');
      setSelectedDepotId(depot.id);
      setSelectedLocationId('');
      setCreatePanel(null);
      setMessage('Depósito criado com sucesso.');
      await refresh();
    } catch (error) {
      setMessage(messageFromError(error));
    } finally {
      setWorking(false);
    }
  }

  async function submitLocation(event: FormEvent, kind: 'LOCAL' | 'SUBPOSITION') {
    event.preventDefault();
    if (!selectedDepotId) {
      setMessage('Selecione um depósito primeiro.');
      return;
    }
    if (kind === 'SUBPOSITION' && !selectedLocationId) {
      setMessage('Selecione um Local antes de criar a subposição.');
      return;
    }

    setWorking(true);
    setMessage(null);
    try {
      const created = await createWarehouseLocation(workspaceId, {
        kind,
        depotId: selectedDepotId,
        parentLocationId: kind === 'SUBPOSITION' ? selectedLocationId : null,
        code: locationCode,
        name: locationName,
        description: locationDescription || null,
      });
      setLocationCode('');
      setLocationName('');
      setLocationDescription('');
      setCreatePanel(null);
      if (kind === 'LOCAL') setSelectedLocationId(created.id);
      setMessage(kind === 'LOCAL' ? 'Local criado com sucesso.' : 'Subposição criada com sucesso.');
      await refresh();
    } catch (error) {
      setMessage(messageFromError(error));
    } finally {
      setWorking(false);
    }
  }

  async function saveDepotEdits(event: FormEvent) {
    event.preventDefault();
    if (!selectedDepot) return;

    setWorking(true);
    setMessage(null);
    try {
      await updateWarehouseDepot(workspaceId, selectedDepot.id, {
        code: depotCode,
        name: depotName,
        description: depotDescription || null,
        visualType: depotVisualType,
        sizeProfile: depotSizeProfile,
      });
      setCreatePanel(null);
      setMessage('Depósito atualizado com sucesso.');
      await refresh();
    } catch (error) {
      setMessage(messageFromError(error));
    } finally {
      setWorking(false);
    }
  }

  async function archiveDepot() {
    if (!selectedDepot) return;
    const children = state.locations.filter(
      (item) => item.location.depotId === selectedDepot.id && item.location.status === 'active'
    );
    if (children.length > 0) {
      setMessage('O depósito só pode ser excluído quando estiver vazio. Remova primeiro todos os Locais e Subposições ativos.');
      return;
    }
    if (!window.confirm('Excluir este depósito da operação? O EMPROVEX preservará o registro histórico como inativo.')) return;

    setWorking(true);
    try {
      await updateWarehouseDepot(workspaceId, selectedDepot.id, { status: 'inactive' });
      setCreatePanel(null);
      setSelectedDepotId('');
      setSelectedLocationId('');
      setMessage('Depósito excluído da operação e preservado no histórico.');
      await refresh();
    } catch (error) {
      setMessage(messageFromError(error));
    } finally {
      setWorking(false);
    }
  }

  async function saveLocationEdits(event: FormEvent) {
    event.preventDefault();
    if (!selectedLocation) return;

    setWorking(true);
    setMessage(null);
    try {
      await updateWarehouseLocation(workspaceId, selectedLocation.id, {
        code: locationCode,
        name: locationName,
        description: locationDescription || null,
      });
      setCreatePanel(null);
      setMessage(selectedLocation.kind === 'LOCAL' ? 'Local atualizado com sucesso.' : 'Subposição atualizada com sucesso.');
      await refresh();
    } catch (error) {
      setMessage(messageFromError(error));
    } finally {
      setWorking(false);
    }
  }

  async function archiveSelectedLocation() {
    if (!selectedLocation) return;

    if (selectedLocation.kind === 'LOCAL') {
      const children = state.locations.filter(
        (item) =>
          item.location.kind === 'SUBPOSITION'
          && item.location.parentLocationId === selectedLocation.id
          && item.location.status === 'active'
      );
      if (children.length > 0) {
        setMessage('Este Local ainda possui Subposições. Remova as Subposições antes de excluir o Local.');
        return;
      }
    }

    const label = selectedLocation.kind === 'LOCAL' ? 'Local' : 'Subposição';
    if (!window.confirm('Excluir ' + label.toLowerCase() + ' da operação? O registro histórico será preservado como inativo.')) return;

    setWorking(true);
    try {
      await updateWarehouseLocation(workspaceId, selectedLocation.id, { status: 'inactive' });
      setCreatePanel(null);
      setSelectedLocationId('');
      setMessage(label + ' excluído(a) da operação e preservado(a) no histórico.');
      await refresh();
    } catch (error) {
      setMessage(messageFromError(error));
    } finally {
      setWorking(false);
    }
  }

  const fieldClass =
    'h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

  return (
    <div className="mt-6 space-y-6" data-testid="warehouse-locations-r1-operational">
      <section className="rounded-2xl border border-blue-100/80 bg-white/75 p-5 shadow-sm backdrop-blur-md">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="font-mono text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#00288e]/65">
              Estrutura física
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-[#00288e]">
              Mapa estrutural dos depósitos
            </h2>
            <p className="mt-1 max-w-2xl text-sm font-medium text-gray-500">
              Navegue do depósito para seus locais e, em seguida, para as subposições. O cadastro só aparece quando você precisar dele.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              ['Depósitos', activeDepots.length],
              ['Locais', totalLocals],
              ['Subposições', totalSubpositions],
            ].map(([label, value]) => (
              <div key={label} className="min-w-[105px] rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2 text-center">
                <p className="text-lg font-black text-[#00288e]">{value}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openPanel('depot')}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#00288e] px-3 text-xs font-black text-white shadow-sm transition hover:bg-blue-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo depósito
          </button>
          <button
            type="button"
            onClick={() => openPanel('location')}
            disabled={!selectedDepotId}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-black text-[#00288e] transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo local
          </button>
          <button
            type="button"
            onClick={() => openPanel('subposition')}
            disabled={!selectedLocationId}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-black text-gray-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#00288e] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova subposição
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={state.loading || working}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </button>
        </div>
      </section>

      {message && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm font-medium text-gray-700">
          {message}
        </div>
      )}

      {createPanel && (
        <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#00288e]/60">
                Cadastro rápido
              </p>
              <h3 className="mt-1 text-base font-black text-[#00288e]">
                {createPanel === 'depot'
                  ? 'Novo depósito'
                  : createPanel === 'location'
                    ? 'Novo local'
                    : createPanel === 'subposition'
                      ? 'Nova subposição'
                      : createPanel === 'editDepot'
                        ? 'Editar depósito'
                        : createPanel === 'editLocation'
                          ? 'Editar local'
                          : 'Editar subposição'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setCreatePanel(null)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50"
              aria-label="Fechar cadastro"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {createPanel === 'depot' || createPanel === 'editDepot' ? (
            <form onSubmit={createPanel === 'editDepot' ? saveDepotEdits : submitDepot} className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              <input value={depotCode} onChange={(event) => setDepotCode(event.target.value)} placeholder="Código · DEP-01" className={fieldClass} required />
              <input value={depotName} onChange={(event) => setDepotName(event.target.value)} placeholder="Nome do depósito" className={fieldClass} required />
              <input value={depotDescription} onChange={(event) => setDepotDescription(event.target.value)} placeholder="Descrição opcional" className={fieldClass} />
              <select value={depotVisualType} onChange={(event) => setDepotVisualType(event.target.value as WarehouseDepotVisualType)} className={fieldClass}>
                <option value="STANDARD">Depósito padrão</option>
                <option value="CONTAINER">Contêiner</option>
                <option value="COLD_CONTAINER">Contêiner frigorífico</option>
              </select>
              <select value={depotSizeProfile} onChange={(event) => setDepotSizeProfile(event.target.value as WarehouseDepotSizeProfile)} className={fieldClass}>
                <option value="SMALL">Pequeno</option>
                <option value="MEDIUM">Médio</option>
                <option value="LARGE">Grande</option>
              </select>
              <button type="submit" disabled={working} className="h-11 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-40">
                {createPanel === 'editDepot' ? 'Salvar alterações' : 'Criar depósito'}
              </button>
              {createPanel === 'editDepot' && (
                <button type="button" onClick={() => void archiveDepot()} disabled={working} className="h-11 rounded-xl border border-rose-200 bg-rose-50 px-4 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-40">
                  Excluir depósito
                </button>
              )}
            </form>
          ) : (
            <form
              onSubmit={
                createPanel === 'editLocation' || createPanel === 'editSubposition'
                  ? saveLocationEdits
                  : (event) => void submitLocation(event, createPanel === 'location' ? 'LOCAL' : 'SUBPOSITION')
              }
              className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3"
            >
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2">
                <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Depósito</p>
                <p className="mt-0.5 text-xs font-black text-[#00288e]">{selectedDepot?.code} · {selectedDepot?.name}</p>
              </div>
              {(createPanel === 'subposition' || createPanel === 'editSubposition') && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Local pai</p>
                  <p className="mt-0.5 text-xs font-black text-[#00288e]">{selectedLocation?.code} · {selectedLocation?.name}</p>
                </div>
              )}
              <input value={locationCode} onChange={(event) => setLocationCode(event.target.value)} placeholder={createPanel === 'location' ? 'Código · EST-01' : 'Código · PRAT-01'} className={fieldClass} required />
              <input value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder={createPanel === 'location' ? 'Nome do local' : 'Nome da subposição'} className={fieldClass} required />
              <input value={locationDescription} onChange={(event) => setLocationDescription(event.target.value)} placeholder="Descrição opcional" className={fieldClass} />
              <button type="submit" disabled={working} className="h-11 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-40">
                {createPanel === 'editLocation' || createPanel === 'editSubposition'
                  ? 'Salvar alterações'
                  : createPanel === 'location'
                    ? 'Criar local'
                    : 'Criar subposição'}
              </button>
              {(createPanel === 'editLocation' || createPanel === 'editSubposition') && (
                <button type="button" onClick={() => void archiveSelectedLocation()} disabled={working} className="h-11 rounded-xl border border-rose-200 bg-rose-50 px-4 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-40">
                  {createPanel === 'editLocation' ? 'Excluir local' : 'Excluir subposição'}
                </button>
              )}
            </form>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-blue-100/80 bg-white/75 p-5 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[9px] font-extrabold uppercase tracking-[0.16em] text-gray-400">1 · Depósitos</p>
            <h3 className="mt-1 text-base font-black text-[#00288e]">Escolha o ambiente físico</h3>
          </div>
        </div>

        {activeDepots.length === 0 && !state.loading ? (
          <div className="mt-4 rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 p-8 text-center">
            <Warehouse className="mx-auto h-8 w-8 text-blue-300" />
            <p className="mt-3 text-sm font-black text-gray-700">Nenhum depósito ativo</p>
            <p className="mt-1 text-xs text-gray-500">Crie o primeiro depósito para começar a organizar a estrutura física.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {activeDepots.map((item) => {
              const depotLocals = state.locations.filter(
                (location) =>
                  location.location.depotId === item.depot.id
                  && location.location.kind === 'LOCAL'
                  && location.location.status === 'active'
              );
              const depotLocalIds = new Set(depotLocals.map((location) => location.location.id));
              const depotSubs = state.locations.filter(
                (location) =>
                  location.location.kind === 'SUBPOSITION'
                  && location.location.status === 'active'
                  && Boolean(location.location.parentLocationId)
                  && depotLocalIds.has(location.location.parentLocationId!)
              );
              const active = item.depot.id === selectedDepotId;

              return (
                <button
                  key={item.depot.id}
                  type="button"
                  onClick={() => {
                    setSelectedDepotId(item.depot.id);
                    setSelectedLocationId('');
                  }}
                  className={
                    active
                      ? 'group relative overflow-hidden rounded-2xl border border-blue-300 bg-blue-50 p-4 text-left shadow-md ring-2 ring-[#00288e]/10 transition'
                      : 'group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md'
                  }
                >
                  <div className="absolute right-3 top-3 h-20 w-20 rounded-full bg-blue-100/50 blur-2xl" />
                  <div className="relative flex items-start gap-4">
                    <div
                      className={
                        'grid shrink-0 place-items-center rounded-2xl border ' +
                        (item.depot.sizeProfile === 'LARGE'
                          ? 'h-16 w-16 border-blue-200 bg-blue-100 text-[#00288e]'
                          : item.depot.sizeProfile === 'SMALL'
                            ? 'h-12 w-12 border-gray-200 bg-gray-50 text-gray-600'
                            : 'h-14 w-14 border-blue-100 bg-blue-50 text-[#00288e]')
                      }
                    >
                      {depotVisualIcon(
                        item.depot.visualType,
                        item.depot.sizeProfile === 'LARGE' ? 'h-9 w-9' : item.depot.sizeProfile === 'SMALL' ? 'h-6 w-6' : 'h-8 w-8'
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-[#00288e]/8 px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-wide text-[#00288e]">
                          {item.depot.code}
                        </span>
                        <span className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[9px] font-bold text-gray-500">
                          {depotVisualLabel(item.depot.visualType)}
                        </span>
                        <span className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[9px] font-bold text-gray-500">
                          {depotSizeLabel(item.depot.sizeProfile)}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-base font-black text-gray-900">{item.depot.name}</p>
                      {item.depot.description && (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{item.depot.description}</p>
                      )}
                      <div className="mt-3 flex items-center gap-4 text-[10px] font-bold text-gray-500">
                        <span><strong className="text-gray-800">{depotLocals.length}</strong> locais</span>
                        <span><strong className="text-gray-800">{depotSubs.length}</strong> subposições</span>
                      </div>
                    </div>

                    <ChevronRight className={active ? 'mt-1 h-5 w-5 text-[#00288e]' : 'mt-1 h-5 w-5 text-gray-300 transition group-hover:text-blue-400'} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-blue-100/80 bg-white/75 p-5 shadow-sm backdrop-blur-md">
        <div>
          <p className="font-mono text-[9px] font-extrabold uppercase tracking-[0.16em] text-gray-400">2 · Locais</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-[#00288e]">
              {selectedDepot ? selectedDepot.name : 'Selecione um depósito'}
            </h3>
            {selectedDepot && (
              <>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#00288e]">
                  {localItems.length} locais
                </span>
                <button type="button" onClick={() => openPanel('editDepot')} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-black text-gray-600 transition hover:border-blue-200 hover:text-[#00288e]">
                  <Pencil className="h-3 w-3" />
                  Editar depósito
                </button>
              </>
            )}
          </div>
        </div>

        {!selectedDepot ? (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
            Selecione um depósito acima para visualizar seus locais.
          </div>
        ) : localItems.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 p-8 text-center">
            <MapPin className="mx-auto h-7 w-7 text-blue-300" />
            <p className="mt-3 text-sm font-black text-gray-700">Este depósito ainda não possui locais</p>
            <button type="button" onClick={() => openPanel('location')} className="mt-3 text-xs font-black text-[#00288e] hover:underline">
              Criar primeiro local
            </button>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {localItems.map((item) => {
              const count = state.locations.filter(
                (candidate) =>
                  candidate.location.kind === 'SUBPOSITION'
                  && candidate.location.status === 'active'
                  && candidate.location.parentLocationId === item.location.id
              ).length;
              const active = item.location.id === selectedLocationId;

              return (
                <button
                  type="button"
                  key={item.location.id}
                  onClick={() => setSelectedLocationId(item.location.id)}
                  className={
                    active
                      ? 'rounded-2xl border border-blue-300 bg-blue-50 p-4 text-left shadow-sm ring-2 ring-[#00288e]/10'
                      : 'rounded-2xl border border-gray-200 bg-white p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-sm'
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={active ? 'grid h-10 w-10 place-items-center rounded-xl bg-[#00288e] text-white' : 'grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#00288e]'}>
                      {locationIcon(item.location.name, item.location.code)}
                    </div>
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[9px] font-black text-gray-500">
                      {item.location.code}
                    </span>
                  </div>
                  <p className="mt-3 truncate text-sm font-black text-gray-900">{item.location.name}</p>
                  <p className="mt-1 text-[10px] font-bold text-gray-400">
                    {count === 1 ? '1 subposição' : count + ' subposições'}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-blue-100/80 bg-white/75 p-5 shadow-sm backdrop-blur-md">
        <div>
          <p className="font-mono text-[9px] font-extrabold uppercase tracking-[0.16em] text-gray-400">3 · Subposições</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-[#00288e]">
              {selectedLocation ? selectedLocation.name : 'Selecione um local'}
            </h3>
            {selectedLocation && (
              <>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#00288e]">
                  {subpositions.length} subposições
                </span>
                <button type="button" onClick={() => openPanel('editLocation')} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-black text-gray-600 transition hover:border-blue-200 hover:text-[#00288e]">
                  <Pencil className="h-3 w-3" />
                  Editar local
                </button>
              </>
            )}
          </div>
        </div>

        {!selectedLocation ? (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
            Selecione um local para visualizar suas divisões internas.
          </div>
        ) : subpositions.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 p-8 text-center">
            <Archive className="mx-auto h-7 w-7 text-blue-300" />
            <p className="mt-3 text-sm font-black text-gray-700">Nenhuma subposição cadastrada</p>
            <p className="mt-1 text-xs text-gray-500">Prateleiras, níveis e nichos aparecerão aqui.</p>
            <button type="button" onClick={() => openPanel('subposition')} className="mt-3 text-xs font-black text-[#00288e] hover:underline">
              Criar primeira subposição
            </button>
          </div>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {subpositions.map((item) => (
              <div key={item.location.id} className="rounded-xl border border-gray-200 bg-white px-3 py-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-[#00288e]">
                    <Archive className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-gray-800">{item.location.name}</p>
                    <p className="mt-0.5 truncate font-mono text-[9px] font-bold text-gray-400">{item.location.code}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLocationId(item.location.id);
                      openPanel('editSubposition');
                    }}
                    className="ml-auto grid h-7 w-7 place-items-center rounded-lg border border-gray-200 bg-white text-gray-400 transition hover:border-blue-200 hover:text-[#00288e]"
                    aria-label={'Editar ' + item.location.name}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <WarehouseStructureImportR1
        workspaceId={workspaceId}
        depots={state.depots}
        locations={state.locations}
        onImported={refresh}
      />
    </div>
  );
}
