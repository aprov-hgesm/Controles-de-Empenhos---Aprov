'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { MapPin, Plus, RefreshCw } from 'lucide-react';

import {
  createWarehouseDepot,
  createWarehouseLocation,
  listWarehouseDepots,
  listWarehouseLocations,
  type WarehouseDepotListItem,
  type WarehouseLocationListItem,
} from '../../../lib/warehouse/locationRepository';

type State = {
  loading: boolean;
  depots: WarehouseDepotListItem[];
  locations: WarehouseLocationListItem[];
};

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

export function WarehouseLocationsR1Operational({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const [state, setState] = useState<State>({
    loading: true,
    depots: [],
    locations: [],
  });
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const [depotCode, setDepotCode] = useState('');
  const [depotName, setDepotName] = useState('');
  const [depotDescription, setDepotDescription] = useState('');
  const [selectedDepotId, setSelectedDepotId] = useState('');

  const [locationKind, setLocationKind] = useState<'LOCAL' | 'SUBPOSITION'>('LOCAL');
  const [parentLocationId, setParentLocationId] = useState('');
  const [locationCode, setLocationCode] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationDescription, setLocationDescription] = useState('');

  const refresh = async () => {
    setState((current) => ({ ...current, loading: true }));
    setMessage(null);
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

  const selectedDepotLocations = useMemo(
    () =>
      state.locations.filter(
        (item) =>
          item.location.depotId === selectedDepotId
          && item.location.status === 'active'
      ),
    [selectedDepotId, state.locations]
  );

  const selectedDepotLocals = useMemo(
    () =>
      selectedDepotLocations.filter(
        (item) => item.location.kind === 'LOCAL'
      ),
    [selectedDepotLocations]
  );

  async function submitDepot(event: FormEvent) {
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
      setMessage('Depósito criado com sucesso.');
      await refresh();
    } catch (error) {
      setMessage(messageFromError(error));
    } finally {
      setWorking(false);
    }
  }

  async function submitLocation(event: FormEvent) {
    event.preventDefault();
    if (!selectedDepotId) {
      setMessage('Crie ou selecione um depósito primeiro.');
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
          ? 'Localização criada com sucesso.'
          : 'Subposição criada com sucesso.'
      );
      await refresh();
    } catch (error) {
      setMessage(messageFromError(error));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="mt-6 space-y-6" data-testid="warehouse-locations-r1-operational">
      <div className="rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.035] p-4">
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-300/70">
          ADM-R1 · estrutura independente
        </p>
        <p className="mt-2 text-sm font-black text-slate-200">
          Depósitos e localizações sem operações de estoque
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Esta etapa consulta somente depots e locations. Transferências, saldos e distribuição física permanecem desligados.
        </p>
      </div>

      {message && (
        <div className="rounded-2xl border border-white/[0.08] bg-black/10 px-4 py-3 text-sm text-slate-300">
          {message}
        </div>
      )}

      <section className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-100">Depósitos</h3>
            <p className="mt-1 text-xs text-slate-500">Cadastre a estrutura física básica da UG.</p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={state.loading || working}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-3 text-xs font-bold text-slate-300 disabled:opacity-40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </button>
        </div>

        <form onSubmit={submitDepot} className="mt-4 grid gap-3 lg:grid-cols-[170px_1fr_1fr_auto]">
          <input
            value={depotCode}
            onChange={(event) => setDepotCode(event.target.value)}
            placeholder="DEP-01"
            className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-sm text-slate-200 outline-none"
            required
          />
          <input
            value={depotName}
            onChange={(event) => setDepotName(event.target.value)}
            placeholder="Nome do depósito"
            className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-sm text-slate-200 outline-none"
            required
          />
          <input
            value={depotDescription}
            onChange={(event) => setDepotDescription(event.target.value)}
            placeholder="Descrição opcional"
            className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-sm text-slate-200 outline-none"
          />
          <button
            type="submit"
            disabled={working}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-500/90 px-4 text-xs font-black text-white disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Criar depósito
          </button>
        </form>

        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {state.depots.length === 0 && !state.loading ? (
            <p className="text-sm text-slate-500">Nenhum depósito cadastrado.</p>
          ) : (
            state.depots.map((item) => (
              <button
                key={item.depot.id}
                type="button"
                onClick={() => setSelectedDepotId(item.depot.id)}
                className={
                  selectedDepotId === item.depot.id
                    ? 'rounded-xl border border-blue-300/20 bg-blue-400/[0.06] p-3 text-left'
                    : 'rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left'
                }
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-blue-300" />
                  <span className="font-mono text-[10px] font-black text-blue-200">{item.depot.code}</span>
                </div>
                <p className="mt-1 text-sm font-black text-slate-200">{item.depot.name}</p>
                <p className="mt-1 text-[11px] text-slate-500">{item.depot.status}</p>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
        <h3 className="text-base font-black text-slate-100">Localizações</h3>
        <p className="mt-1 text-xs text-slate-500">
          Selecione um depósito ativo e cadastre Local ou Subposição.
        </p>

        <form onSubmit={submitLocation} className="mt-4 grid gap-3 lg:grid-cols-2">
          <select
            value={selectedDepotId}
            onChange={(event) => setSelectedDepotId(event.target.value)}
            className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-sm text-slate-200"
            required
          >
            <option value="">Selecione o depósito</option>
            {activeDepots.map((item) => (
              <option key={item.depot.id} value={item.depot.id}>
                {item.depot.code} · {item.depot.name}
              </option>
            ))}
          </select>

          <select
            value={locationKind}
            onChange={(event) => {
              const next = event.target.value as 'LOCAL' | 'SUBPOSITION';
              setLocationKind(next);
              if (next === 'LOCAL') setParentLocationId('');
            }}
            className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-sm text-slate-200"
          >
            <option value="LOCAL">Local</option>
            <option value="SUBPOSITION">Subposição</option>
          </select>

          {locationKind === 'SUBPOSITION' && (
            <select
              value={parentLocationId}
              onChange={(event) => setParentLocationId(event.target.value)}
              className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-sm text-slate-200"
              required
            >
              <option value="">Selecione o Local pai</option>
              {selectedDepotLocals.map((item) => (
                <option key={item.location.id} value={item.location.id}>
                  {item.location.code} · {item.location.name}
                </option>
              ))}
            </select>
          )}

          <input
            value={locationCode}
            onChange={(event) => setLocationCode(event.target.value)}
            placeholder={locationKind === 'LOCAL' ? 'LOC-01' : 'PRAT-A'}
            className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-sm text-slate-200 outline-none"
            required
          />
          <input
            value={locationName}
            onChange={(event) => setLocationName(event.target.value)}
            placeholder="Nome da localização"
            className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-sm text-slate-200 outline-none"
            required
          />
          <input
            value={locationDescription}
            onChange={(event) => setLocationDescription(event.target.value)}
            placeholder="Descrição opcional"
            className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-sm text-slate-200 outline-none"
          />
          <button
            type="submit"
            disabled={working || !selectedDepotId}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-500/90 px-4 text-xs font-black text-white disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Criar localização
          </button>
        </form>

        <div className="mt-4 space-y-2">
          {selectedDepotId && selectedDepotLocations.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma localização ativa neste depósito.</p>
          ) : (
            selectedDepotLocations.map((item) => (
              <div
                key={item.location.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
              >
                <p className="text-xs font-black text-slate-200">
                  {item.location.code} · {item.location.name}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-slate-600">
                  {item.location.kind === 'LOCAL' ? 'Local' : 'Subposição'}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
