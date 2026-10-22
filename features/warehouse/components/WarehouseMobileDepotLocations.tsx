'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, MapPin, PackageSearch, Search, ScanLine } from 'lucide-react';

import type { WarehouseLocation, WarehouseLocationBalance } from '../../../lib/warehouse/location';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import type { WarehouseLot } from '../../../lib/warehouse/lot';
import { deriveWarehouseLocationContents } from '../../../lib/warehouse/locationContents';
import {
  WarehouseLocationDetailsDialog,
  type WarehouseInspectionLotState,
} from './WarehouseLocationInspection';

interface Props {
  depotName: string;
  workspaceId: string;
  locations: WarehouseLocation[];
  balances: WarehouseLocationBalance[];
  materials: WarehouseMaterial[];
  inspectionLots: WarehouseLot[];
  lotState: WarehouseInspectionLotState;
  lotError: string | null;
  complete: boolean;
  available: boolean;
  onInspect: () => void;
  onRefresh: () => void;
  onMaterialUpdated: (material: WarehouseMaterial) => void;
}

/**
 * Lista mobile: reusa o mesmo saldo/local do mapa 3D. Nenhuma leitura extra é
 * disparada ao rolar, pesquisar ou expandir os cards; lotes/códigos só sob demanda.
 */
export function WarehouseMobileDepotLocations({
  depotName,
  workspaceId,
  locations,
  balances,
  materials,
  inspectionLots,
  lotState,
  lotError,
  complete,
  available,
  onInspect,
  onRefresh,
  onMaterialUpdated,
}: Props) {
  const [filter, setFilter] = useState('');
  const [openedId, setOpenedId] = useState<string | null>(null);

  const localContents = useMemo(() => locations
    .filter((location) => location.kind === 'LOCAL' && location.status === 'active')
    .map((location) => deriveWarehouseLocationContents(
      location.id, locations, balances, materials, inspectionLots
    ))
    .filter((contents): contents is NonNullable<typeof contents> => contents !== null)
    .sort((a, b) => a.location.code.localeCompare(b.location.code, 'pt-BR', { numeric: true })),
    [locations, balances, materials, inspectionLots]
  );

  const normalized = filter.trim().toLocaleLowerCase('pt-BR');
  const visibleContents = useMemo(() => (
    normalized
      ? localContents.filter((contents) =>
        (contents.location.code + ' ' + contents.location.name + ' '
          + contents.groups.flatMap((group) => group.rows.map((row) => row.description)).join(' ')
        ).toLocaleLowerCase('pt-BR').includes(normalized)
      )
      : localContents
  ), [localContents, normalized]);

  const opened = localContents.find((item) => item.location.id === openedId) || null;
  const withStock = localContents.filter((item) => item.materialCount > 0).length;

  return (
    <section
      className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/70 p-3 text-white shadow-xl sm:p-4"
      data-testid="warehouse-mobile-depot-locations"
      aria-label="Consulta móvel de locais do depósito"
    >
      <div className="rounded-2xl border border-blue-300/15 bg-[#0b1d3f] p-4">
        <div className="flex items-center gap-2 text-blue-200">
          <ScanLine className="h-5 w-5" aria-hidden="true" />
          <span className="text-[10px] font-black uppercase tracking-[0.14em]">Operação pelo celular</span>
        </div>
        <h2 className="mt-2 text-xl font-black leading-tight">Localize, leia e cadastre</h2>
        <p className="mt-2 text-xs leading-5 text-slate-300">
          Selecione um local, escolha o material e use a câmera para cadastrar
          ou corrigir seu código de barras. Quantidades não são alteradas.
        </p>
        <p className="mt-3 text-[11px] font-bold text-blue-100">
          {localContents.length} locais · {withStock} com materiais
        </p>
      </div>

      <label className="block">
        <span className="mb-2 block text-xs font-bold text-blue-100">Buscar local ou item</span>
        <span className="relative block">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Ex.: EST-02, Arroz, Leite"
            autoComplete="off"
            className="min-h-12 w-full rounded-xl border border-white/15 bg-slate-900 px-11 text-base text-white placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
            data-testid="warehouse-mobile-location-search"
          />
        </span>
      </label>

      {!complete && (
        <p role="status" className="rounded-xl border border-amber-400/25 bg-amber-950/35 p-3 text-xs text-amber-100">
          Parte dos registros do depósito pode não estar carregada. A edição de códigos
          ficará bloqueada até uma consulta completa.
        </p>
      )}

      <div className="space-y-2">
        {visibleContents.map((contents) => {
          const descriptions = contents.groups.flatMap((group) => group.rows.map((row) => row.description));
          return (
            <button
              key={contents.location.id}
              type="button"
              disabled={!available}
              onClick={() => {
                setOpenedId(contents.location.id);
                onInspect();
              }}
              className="flex min-h-[98px] w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#10203b] px-4 py-3 text-left transition-colors hover:bg-[#172d52] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 disabled:opacity-50"
              data-testid="warehouse-mobile-location-open"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-400/15 text-blue-200">
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black">{contents.location.code}</span>
                <span className="block truncate text-xs font-semibold text-slate-300">{contents.location.name}</span>
                <span className="mt-1 block text-[11px] text-slate-400">
                  {contents.materialCount} material(is)
                  {descriptions.length > 0 ? ' · ' + descriptions.slice(0, 2).join(', ') : ' · local vazio'}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-blue-200" aria-hidden="true" />
            </button>
          );
        })}
        {visibleContents.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-slate-300">
            <PackageSearch className="mx-auto mb-2 h-7 w-7" aria-hidden="true" />
            <p className="text-sm font-semibold">
              {localContents.length ? 'Nenhum local ou material encontrado.' : 'Nenhum local cadastrado neste depósito.'}
            </p>
          </div>
        )}
      </div>

      {opened && (
        <WarehouseLocationDetailsDialog
          contents={opened}
          depotName={depotName}
          workspaceId={workspaceId}
          materials={materials}
          onMaterialUpdated={onMaterialUpdated}
          lotState={lotState}
          lotError={lotError}
          complete={complete}
          onRefresh={onRefresh}
          onClose={() => setOpenedId(null)}
        />
      )}
    </section>
  );
}
