'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, MapPin, PackageSearch, RefreshCw, Search } from 'lucide-react';

import { findWarehouseMaterialsAcrossDepots } from '../../../lib/warehouse/globalMaterialSearch';
import {
  listWarehouseDepotsCached,
  listWarehouseLocationsCached,
  listWarehouseLocationBalances,
  type WarehouseDepotListItem,
  type WarehouseLocationListItem,
  type WarehouseLocationBalanceListItem,
} from '../../../lib/warehouse/locationRepository';
import { listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';

// Leitura sob demanda: nenhum catálogo, saldo, croqui, lote ou renderizador 3D
// é solicitado apenas por visitar Início ou Meus Depósitos no Modo Essencial.
const MATERIAL_LIMIT = 1000;
const DEPOT_LIMIT = 250;
const LOCATION_LIMIT = 500;
const BALANCE_LIMIT_PER_MATERIAL = 500;
const MAX_MATCHED_MATERIALS = 12;
const INITIAL_POSITION_COUNT = 30;

const normalize = (value: string) => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

type LookupData = {
  workspaceId: string;
  materials: WarehouseMaterial[];
  depots: WarehouseDepotListItem[];
  locations: WarehouseLocationListItem[];
  balances: WarehouseLocationBalanceListItem[];
  partial: boolean;
  matchedMaterialLimit: boolean;
};

export function WarehouseEssentialLocationLookup({
  workspaceId,
  section,
}: {
  workspaceId: string;
  section: 'home' | 'overview';
}) {
  const [input, setInput] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [data, setData] = useState<LookupData | null>(null);
  const [depotFilter, setDepotFilter] = useState('');
  const [visiblePositionCount, setVisiblePositionCount] = useState(INITIAL_POSITION_COUNT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const requestInFlight = useRef(false);

  // Respostas de um workspace anterior nunca podem aparecer no workspace atual.
  useEffect(() => {
    requestRef.current += 1;
    requestInFlight.current = false;
    setInput('');
    setSubmittedQuery('');
    setData(null);
    setDepotFilter('');
    setVisiblePositionCount(INITIAL_POSITION_COUNT);
    setError(null);
    setLoading(false);
    return () => { requestRef.current += 1; };
  }, [workspaceId]);

  const readSnapshot = useCallback(async (searchTerm: string, force = false) => {
    if (!workspaceId || requestInFlight.current) return;
    requestInFlight.current = true;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);

    try {
      // Material, depósitos e locais são reutilizados entre buscas nesta aba.
      // Os saldos são consultados SOMENTE por material correspondente, não
      // via leitura de 500 posições globais a cada pesquisa.
      const current = !force && data?.workspaceId === workspaceId ? data : null;
      const [materials, depots, locations] = current
        ? [current.materials, current.depots, current.locations] as const
        : await Promise.all([
          listWarehouseMaterials(workspaceId, MATERIAL_LIMIT),
          listWarehouseDepotsCached(workspaceId, DEPOT_LIMIT),
          listWarehouseLocationsCached(workspaceId, LOCATION_LIMIT),
        ]);

      const term = normalize(searchTerm);
      const candidates = materials.filter((item) =>
        item.status === 'active'
        && normalize([item.id, item.description, ...item.aliases].join(' ')).includes(term)
      );
      const selected = candidates.slice(0, MAX_MATCHED_MATERIALS);
      const perMaterialBalances = await Promise.all(selected.map((item) =>
        listWarehouseLocationBalances(workspaceId, BALANCE_LIMIT_PER_MATERIAL, item.id)
      ));
      if (requestId !== requestRef.current) return;
      setData({
        workspaceId,
        materials,
        depots,
        locations,
        balances: perMaterialBalances.flat(),
        partial: materials.length >= MATERIAL_LIMIT
          || depots.length >= DEPOT_LIMIT
          || locations.length >= LOCATION_LIMIT
          || perMaterialBalances.some((items) => items.length >= BALANCE_LIMIT_PER_MATERIAL),
        matchedMaterialLimit: candidates.length > MAX_MATCHED_MATERIALS,
      });
      setSubmittedQuery(searchTerm);
      setVisiblePositionCount(INITIAL_POSITION_COUNT);
    } catch (cause) {
      if (requestId !== requestRef.current) return;
      setError(cause instanceof Error ? cause.message : 'Falha ao consultar posições físicas.');
    } finally {
      if (requestId === requestRef.current) {
        requestInFlight.current = false;
        setLoading(false);
      }
    }
  }, [workspaceId, data]);

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = input.trim();
    if (value.length < 2) {
      setError('Digite pelo menos dois caracteres para localizar um material.');
      return;
    }
    setError(null);
    void readSnapshot(value);
  };

  const matches = useMemo(() => {
    if (!data || data.workspaceId !== workspaceId || !submittedQuery) return [];
    return findWarehouseMaterialsAcrossDepots({
      query: submittedQuery,
      depots: data.depots.map((entry) => entry.depot),
      locations: data.locations.map((entry) => entry.location),
      balances: data.balances.map((entry) => entry.balance),
      materials: data.materials,
      maxMaterials: MAX_MATCHED_MATERIALS,
    });
  }, [data, submittedQuery, workspaceId]);

  const rows = useMemo(() => matches.flatMap((material) =>
    material.positions
      .filter((position) => !depotFilter || position.depotId === depotFilter)
      .map((position) => ({
        key: [material.materialId, position.depotId, position.locationId,
          position.subpositionId || 'local'].join('|'),
        description: material.description,
        position,
      }))
  ), [matches, depotFilter]);

  const visibleRows = rows.slice(0, visiblePositionCount);
  const title = section === 'home' ? 'Localizar material' : 'Consultar meus depósitos';

  // Nem durante a troca de identidade é permitido exibir posições do workspace anterior.
  if (data && data.workspaceId !== workspaceId) {
    return <div role="status" className="p-4 text-sm text-slate-600">Preparando consulta do workspace…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5" data-testid="warehouse-essential-location-lookup"
      data-warehouse-essential-section={section}>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-widest text-blue-700">
          Central de Depósitos · Modo Essencial
        </p>
        <h2 className="mt-2 text-2xl font-black text-slate-900">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Consulte o endereço físico do material sem abrir mapas ou visualização 3D.
          O resultado informa depósito, local, subposição e saldo disponível.
        </p>

        <form onSubmit={onSearch} role="search" className="mt-6 flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Nome, código ou apelido do material</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              type="search"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ex.: arroz, leite, código do material"
              autoComplete="off"
              data-testid="warehouse-essential-search-input"
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <button type="submit" disabled={loading}
            className="h-11 rounded-xl bg-[#00288e] px-5 text-sm font-bold text-white hover:bg-blue-900 disabled:cursor-wait disabled:opacity-60">
            {loading ? 'Consultando…' : 'Consultar localização'}
          </button>
        </form>

        {data && section === 'overview' && (
          <label className="mt-4 block max-w-md text-xs font-semibold text-slate-600">
            Filtrar por depósito
            <select value={depotFilter} onChange={(event) => {
              setDepotFilter(event.target.value);
              setVisiblePositionCount(INITIAL_POSITION_COUNT);
            }} data-testid="warehouse-essential-depot-filter"
              className="mt-1 block h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900">
              <option value="">Todos os depósitos</option>
              {data.depots.filter((item) => item.depot.status === 'active').map((item) => (
                <option key={item.depot.id} value={item.depot.id}>
                  {item.depot.code} · {item.depot.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
        {loading && <p role="status" className="mt-4 text-sm text-slate-600">Consultando os registros físicos do workspace…</p>}
        {data && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Consulta sob demanda · sem carregamento de croquis ou modelos 3D</span>
            <button type="button" disabled={loading} onClick={() => void readSnapshot(submittedQuery, true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Atualizar saldos
            </button>
          </div>
        )}
      </section>

      {submittedQuery && data && !loading && !error && (
        <section className="space-y-3" data-testid="warehouse-essential-text-results" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-black text-slate-900">Localização de “{submittedQuery}”</h3>
            <span className="text-xs font-semibold text-slate-600">
              {rows.length} posição(ões)
            </span>
          </div>

          {(data.partial || data.matchedMaterialLimit) && (
            <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Consulta parcial: um limite de segurança foi atingido. Podem existir outros materiais ou posições.
              Refine a pesquisa ou consulte Controle de Materiais para conferir o estoque completo.
            </p>
          )}

          {rows.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <PackageSearch className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                Nenhuma posição com saldo encontrada {depotFilter ? 'neste depósito' : 'nos depósitos consultados'}.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                A consulta considera posições físicas ativas. Confira o nome ou código e atualize os saldos quando necessário.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {visibleRows.map(({ key, description, position }) => (
              <article key={key} data-testid="warehouse-essential-position"
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <MapPin className="mt-1 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
                <div className="min-w-0 flex-1 space-y-1">
                  <h4 className="text-sm font-black text-slate-900">{description}</h4>
                  <p className="text-sm text-slate-700">
                    <span className="font-bold">Depósito:</span> {position.depotCode} · {position.depotName}
                  </p>
                  <p className="text-sm text-slate-700">
                    <span className="font-bold">Local:</span> {position.locationCode} · {position.locationName}
                  </p>
                  <p className="text-sm text-slate-700">
                    <span className="font-bold">Subposição:</span>{' '}
                    {position.subpositionCode
                      ? position.subpositionCode + ' · ' + position.subpositionName
                      : 'Diretamente no local'}
                  </p>
                  <p className="text-xs font-bold text-blue-800">
                    Saldo físico: {position.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} {position.unit}
                  </p>
                </div>
              </article>
            ))}
          </div>

          {rows.length > visiblePositionCount && (
            <div className="flex flex-col items-center gap-2 py-3">
              <span className="text-xs text-slate-500">Mostrando {visibleRows.length} de {rows.length} posições.</span>
              <button type="button" onClick={() => setVisiblePositionCount((count) => count + INITIAL_POSITION_COUNT)}
                className="rounded-xl border border-blue-200 bg-white px-5 py-2 text-xs font-bold text-blue-800 hover:bg-blue-50">
                Mostrar mais locais
              </button>
            </div>
          )}
        </section>
      )}

      {!submittedQuery && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/75 p-6 text-center text-sm text-slate-600">
          <PackageSearch className="mx-auto mb-2 h-8 w-8 text-slate-400" aria-hidden="true" />
          Digite o material e clique em Consultar localização.
          Nenhuma consulta de estoque é realizada até você pesquisar.
        </div>
      )}
    </div>
  );
}
