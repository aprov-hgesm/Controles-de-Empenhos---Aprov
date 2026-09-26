'use client';

import { useMemo, useState } from 'react';
import {
  Download,
  Eye,
  Printer,
  Tags,
  X,
} from 'lucide-react';

import {
  buildWarehouseLabelsForScope,
  WAREHOUSE_LABEL_PRESETS,
  type WarehouseLabelSheetPreset,
} from '../../../lib/warehouse/labels';
import type {
  WarehouseDepotListItem,
  WarehouseLocationListItem,
} from '../../../lib/warehouse/locationRepository';
import {
  createWarehouseLabelsPdf,
  downloadWarehouseLabelsPdf,
  openWarehouseLabelsPdf,
} from '../pdf/warehouseLabelsPdf';

type Scope =
  | 'DEPOT_ONLY'
  | 'DEPOT_LOCALS'
  | 'DEPOT_FULL'
  | 'LOCATION_ONLY'
  | 'LOCATION_SUBPOSITIONS';

interface Props {
  open: boolean;
  onClose: () => void;
  depots: WarehouseDepotListItem[];
  locations: WarehouseLocationListItem[];
  selectedDepotId: string;
  selectedLocationId: string;
}

const scopeOptions: Array<{
  id: Scope;
  title: string;
  description: string;
  requiresLocation?: boolean;
}> = [
  {
    id: 'DEPOT_ONLY',
    title: 'Somente o depósito',
    description: '1 etiqueta para identificar a entrada ou área principal.',
  },
  {
    id: 'DEPOT_LOCALS',
    title: 'Locais do depósito',
    description: 'Estantes, freezers, paletes, geladeiras e demais locais ativos.',
  },
  {
    id: 'DEPOT_FULL',
    title: 'Estrutura completa do depósito',
    description: 'Depósito + todos os Locais + todas as Subposições ativas.',
  },
  {
    id: 'LOCATION_ONLY',
    title: 'Somente o Local selecionado',
    description: '1 etiqueta para o Local atualmente selecionado.',
    requiresLocation: true,
  },
  {
    id: 'LOCATION_SUBPOSITIONS',
    title: 'Subposições do Local',
    description: 'Prateleiras, níveis e nichos do Local selecionado.',
    requiresLocation: true,
  },
];

export function WarehouseLabelsR1({
  open,
  onClose,
  depots,
  locations,
  selectedDepotId,
  selectedLocationId,
}: Props) {
  const [scope, setScope] = useState<Scope>('DEPOT_FULL');
  const [preset, setPreset] = useState<WarehouseLabelSheetPreset>('MEDIUM');
  const [includeUg, setIncludeUg] = useState(true);
  const [includeHierarchy, setIncludeHierarchy] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const selectedDepot = useMemo(
    () => depots.find((item) => item.depot.id === selectedDepotId)?.depot ?? null,
    [depots, selectedDepotId]
  );

  const selectedLocation = useMemo(
    () => locations.find((item) => item.location.id === selectedLocationId)?.location ?? null,
    [locations, selectedLocationId]
  );

  const activeLocations = useMemo(
    () => locations.map((item) => item.location).filter((item) => item.status === 'active'),
    [locations]
  );

  const labels = useMemo(() => {
    if (!selectedDepot) return [];
    return buildWarehouseLabelsForScope({
      depot: selectedDepot,
      locations: activeLocations,
      selectedLocationId,
      scope,
    });
  }, [activeLocations, scope, selectedDepot, selectedLocationId]);

  const selectedPreset = WAREHOUSE_LABEL_PRESETS[preset];
  const pages = labels.length === 0
    ? 0
    : Math.ceil(labels.length / selectedPreset.perPage);

  if (!open) return null;

  function buildPdf() {
    if (!selectedDepot) {
      setMessage('Selecione um depósito antes de gerar etiquetas.');
      return null;
    }
    if (labels.length === 0) {
      setMessage('O escopo selecionado não possui etiquetas ativas para gerar.');
      return null;
    }

    try {
      setMessage(null);
      return createWarehouseLabelsPdf(labels, {
        preset,
        includeUg,
        includeHierarchy,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  function preview() {
    const blob = buildPdf();
    if (blob) openWarehouseLabelsPdf(blob);
  }

  function download() {
    const blob = buildPdf();
    if (!blob || !selectedDepot) return;

    const normalized = selectedDepot.code.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    downloadWarehouseLabelsPdf(
      blob,
      'emprovex-etiquetas-' + normalized + '.pdf'
    );
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Imprimir etiquetas ADM Depósito"
    >
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-blue-100 bg-[#f7f9fc] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-blue-100 bg-white/95 px-6 py-5 backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-blue-100 bg-blue-50 text-[#00288e]">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-[#00288e]/60">
                EMPROVEX · ADM Depósito
              </p>
              <h2 className="mt-1 text-xl font-black text-[#00288e]">
                Imprimir etiquetas
              </h2>
              <p className="mt-1 text-sm font-medium text-gray-500">
                PDF A4 monocromático, otimizado para toner e identificação física.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 p-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Tags className="h-4 w-4 text-[#00288e]" />
                <h3 className="text-sm font-black text-gray-800">1. O que imprimir</h3>
              </div>

              <div className="mt-4 grid gap-2">
                {scopeOptions.map((option) => {
                  const disabled = Boolean(option.requiresLocation && !selectedLocation);
                  const active = scope === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setScope(option.id);
                        setMessage(null);
                      }}
                      className={
                        active
                          ? 'rounded-2xl border border-blue-300 bg-blue-50 px-4 py-3 text-left ring-2 ring-[#00288e]/10'
                          : 'rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/40 disabled:cursor-not-allowed disabled:opacity-40'
                      }
                    >
                      <p className="text-sm font-black text-gray-800">{option.title}</p>
                      <p className="mt-1 text-xs leading-5 text-gray-500">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-black text-gray-800">2. Tamanho da etiqueta</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {(Object.keys(WAREHOUSE_LABEL_PRESETS) as WarehouseLabelSheetPreset[]).map((id) => {
                  const option = WAREHOUSE_LABEL_PRESETS[id];
                  const active = preset === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPreset(id)}
                      className={
                        active
                          ? 'rounded-2xl border border-blue-300 bg-blue-50 p-4 text-left ring-2 ring-[#00288e]/10'
                          : 'rounded-2xl border border-gray-200 bg-white p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/40'
                      }
                    >
                      <p className="text-sm font-black text-[#00288e]">{option.label}</p>
                      <p className="mt-1 text-[11px] leading-4 text-gray-500">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-black text-gray-800">3. Informações complementares</h3>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={includeHierarchy}
                    onChange={(event) => setIncludeHierarchy(event.target.checked)}
                    className="h-4 w-4 accent-[#00288e]"
                  />
                  <span className="text-xs font-bold text-gray-700">Mostrar hierarquia física</span>
                </label>
                <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={includeUg}
                    onChange={(event) => setIncludeUg(event.target.checked)}
                    className="h-4 w-4 accent-[#00288e]"
                  />
                  <span className="text-xs font-bold text-gray-700">Mostrar UG</span>
                </label>
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <p className="font-mono text-[9px] font-black uppercase tracking-[0.15em] text-gray-400">
                Resumo
              </p>
              <h3 className="mt-1 text-base font-black text-[#00288e]">
                {selectedDepot ? selectedDepot.name : 'Nenhum depósito selecionado'}
              </h3>
              {selectedLocation && (
                <p className="mt-1 text-xs font-medium text-gray-500">
                  Local ativo: {selectedLocation.code} · {selectedLocation.name}
                </p>
              )}

              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-center">
                  <p className="text-xl font-black text-[#00288e]">{labels.length}</p>
                  <p className="mt-0.5 text-[9px] font-black uppercase tracking-wide text-gray-500">Etiquetas</p>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-center">
                  <p className="text-xl font-black text-[#00288e]">{pages}</p>
                  <p className="mt-0.5 text-[9px] font-black uppercase tracking-wide text-gray-500">Páginas</p>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-center">
                  <p className="text-xl font-black text-[#00288e]">{selectedPreset.perPage}</p>
                  <p className="mt-0.5 text-[9px] font-black uppercase tracking-wide text-gray-500">Por A4</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border-2 border-gray-900 bg-white p-4">
                <div className="flex items-start justify-between gap-3 border-l-4 border-black pl-3">
                  <div>
                    <p className="text-[9px] font-black tracking-wider text-black">EMPROVEX</p>
                    <p className="text-[8px] font-medium text-gray-600">ADM DEPÓSITO</p>
                  </div>
                  <span className="rounded border border-black px-2 py-0.5 text-[8px] font-black text-black">
                    LOCAL
                  </span>
                </div>
                <p className="mt-5 font-mono text-2xl font-black tracking-tight text-black">EST-01</p>
                <p className="mt-1 text-sm font-black text-black">Estante 01</p>
                <p className="mt-3 text-[9px] text-gray-700">
                  {includeHierarchy ? 'Gêneros Secos › Estante 01' : ' '}
                </p>
                <div className="mt-4 border-t border-gray-400 pt-2 text-[8px] text-gray-600">
                  {includeUg ? 'UG 160416 · ' : ''}hgesm-aprov
                </div>
              </div>

              <p className="mt-3 text-[10px] leading-4 text-gray-400">
                A amostra representa a linguagem visual. O PDF final adapta tipografia e margens conforme o tamanho escolhido.
              </p>
            </section>

            {message && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium leading-5 text-amber-900">
                {message}
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <button
                type="button"
                onClick={preview}
                disabled={labels.length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-black text-[#00288e] transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Eye className="h-4 w-4" />
                Visualizar PDF
              </button>
              <button
                type="button"
                onClick={download}
                disabled={labels.length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download className="h-4 w-4" />
                Gerar PDF
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
