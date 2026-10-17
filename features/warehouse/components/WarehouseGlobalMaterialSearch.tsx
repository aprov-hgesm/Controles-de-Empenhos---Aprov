'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, MapPin, Search, X } from 'lucide-react';
import type { WarehouseDepot, WarehouseLocation, WarehouseLocationBalance } from '../../../lib/warehouse/location';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import {
  findWarehouseMaterialsAcrossDepots,
  type GlobalMaterialPosition,
} from '../../../lib/warehouse/globalMaterialSearch';

type Props = {
  depots: WarehouseDepot[];
  locations: WarehouseLocation[];
  balances: WarehouseLocationBalance[];
  materials: WarehouseMaterial[];
  complete: boolean;
  loaded: boolean;
  queryText: string;
  selectedMaterialId: string;
  onQueryTextChange: (value: string) => void;
  onSelectedMaterialIdChange: (value: string) => void;
  onNavigateToLocation: (item: GlobalMaterialPosition, materialId: string) => void;
};

export function WarehouseGlobalMaterialSearch({
  depots,
  locations,
  balances,
  materials,
  complete,
  loaded,
  queryText,
  selectedMaterialId,
  onQueryTextChange,
  onSelectedMaterialIdChange,
  onNavigateToLocation,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const results = useMemo(
    () => findWarehouseMaterialsAcrossDepots({
      query: queryText,
      depots,
      locations,
      balances,
      materials,
      maxMaterials: 20,
    }),
    [queryText, depots, locations, balances, materials]
  );

  const visibleResults = results.slice(0, 12);
  const selectedResult = results.find((result) => result.materialId === selectedMaterialId);
  const showResults = queryText.trim().length > 0 && expanded;

  function navigate(
    position: GlobalMaterialPosition,
    materialId: string,
    description: string
  ) {
    onSelectedMaterialIdChange(materialId);
    onQueryTextChange(description);
    onNavigateToLocation(position, materialId);
    setExpanded(false);
  }

  return (
    <div className="relative w-full" data-testid="warehouse-global-material-search">
      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
      <input
        value={queryText}
        onChange={(event) => {
          onQueryTextChange(event.target.value);
          onSelectedMaterialIdChange('');
          setExpanded(true);
        }}
        onFocus={() => setExpanded(true)}
        onKeyDown={(event) => { if (event.key === 'Escape') setExpanded(false); }}
        aria-label="Pesquisar item em todos os depósitos"
        placeholder="Pesquisar item em todos os depósitos…"
        className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-xs font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      />
      {queryText && (
        <button
          type="button"
          aria-label="Limpar pesquisa global"
          onClick={() => {
            onQueryTextChange('');
            onSelectedMaterialIdChange('');
            setExpanded(false);
          }}
          className="absolute right-2 top-2 rounded-lg p-1 text-slate-400 hover:bg-slate-100"
        ><X className="h-4 w-4" /></button>
      )}
      {queryText.trim() && !expanded && (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold text-slate-500">
            {selectedResult
              ? selectedResult.depotCount + ' depósito(s) · ' + selectedResult.positions.length + ' posição(ões) com saldo'
              : 'Pesquisa em todos os depósitos'}
          </p>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-[10px] font-black text-blue-700 hover:underline"
          >Ver todos os locais</button>
        </div>
      )}
      {showResults && (
        <div
          data-testid="warehouse-global-material-results"
          className="absolute left-0 right-0 top-11 z-[80] max-h-[430px] overflow-y-auto rounded-xl border border-blue-200 bg-white p-2 text-slate-800 shadow-[0_22px_55px_rgba(15,35,75,0.20)]"
        >
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-blue-50 px-2.5 py-2">
            <p className="text-[10px] font-black text-[#00288e]">Todos os depósitos do workspace</p>
            <span className="text-[10px] font-semibold text-slate-500">
              {loaded ? results.length + ' material(is)' : 'Carregando…'}
            </span>
          </div>
          {!loaded && (
            <p className="px-2 py-3 text-xs text-slate-500">Consultando saldos físicos…</p>
          )}
          {loaded && results.length === 0 && (
            <p className="px-2 py-3 text-xs text-slate-500">
              Nenhum item com saldo localizado nos depósitos consultados.
              {!complete && ' O limite de consulta foi atingido e pode haver outros resultados.'}
            </p>
          )}
          {visibleResults.map((result) => (
            <section key={result.materialId} className="border-b border-slate-100 pb-2 last:border-b-0">
              <div className="px-2 py-2">
                <p className="text-[11px] font-black leading-4 text-slate-900">
                  {result.description}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                  {result.depotCount} depósito(s) · {result.positions.length} posição(ões)
                </p>
              </div>
              {result.positions.map((position, index) => (
                <button
                  key={[
                    position.depotId, position.locationId, position.subpositionId || 'local', index,
                  ].join('|')}
                  type="button"
                  data-testid="warehouse-global-material-position"
                  onClick={() => navigate(position, result.materialId, result.description)}
                  className="group flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-left transition hover:border-blue-100 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-bold text-slate-800">
                      {position.depotCode} · {position.depotName}
                    </span>
                    <span className="block truncate text-[10px] text-slate-500">
                      {position.locationCode} · {position.locationName}
                      {position.subpositionCode ? ' / ' + position.subpositionCode + ' · ' + position.subpositionName : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[10px] font-black text-slate-700">
                    {position.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
                    {' '}{position.unit}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                </button>
              ))}
            </section>
          ))}
          {results.length > visibleResults.length && (
            <p className="px-2 py-2 text-[10px] font-semibold text-slate-500">
              Exibindo os primeiros {visibleResults.length} materiais. Refine a busca.
            </p>
          )}
          {!complete && (
            <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[10px] font-bold text-amber-800">
              Consulta parcial: o limite de materiais, saldos ou locais foi atingido.
              Alguns depósitos ou posições podem não aparecer.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
