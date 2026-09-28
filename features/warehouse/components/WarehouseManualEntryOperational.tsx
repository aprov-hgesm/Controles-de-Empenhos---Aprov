'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Barcode,
  CalendarClock,
  CheckCircle2,
  FileText,
  MapPin,
  PackagePlus,
  RefreshCw,
  Search,
  TriangleAlert,
} from 'lucide-react';

import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import { listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import type { WarehouseStockPosition } from '../../../lib/warehouse/location';
import {
  listWarehouseDepots,
  listWarehouseLocations,
  type WarehouseDepotListItem,
  type WarehouseLocationListItem,
} from '../../../lib/warehouse/locationRepository';
import {
  registerWarehouseManualEntry,
  type RegisterWarehouseManualEntryResult,
} from '../../../lib/warehouse/manualEntryRepository';

type MaterialMode = 'existing' | 'new';

function unitLabel(material: WarehouseMaterial): string {
  return material.unit.label || material.unit.code.toUpperCase();
}

function newOperationId(): string {
  return crypto.randomUUID();
}

export function WarehouseManualEntryOperational({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const [materials, setMaterials] = useState<WarehouseMaterial[]>([]);
  const [depots, setDepots] = useState<WarehouseDepotListItem[]>([]);
  const [locations, setLocations] = useState<WarehouseLocationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<MaterialMode>('existing');
  const [materialSearch, setMaterialSearch] = useState('');
  const [existingMaterialId, setExistingMaterialId] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('UN');
  const [quantity, setQuantity] = useState('1');
  const [provenance, setProvenance] = useState('');
  const [reference, setReference] = useState('');
  const [depotId, setDepotId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [subpositionId, setSubpositionId] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [barcode, setBarcode] = useState('');
  const [operationId, setOperationId] = useState(newOperationId);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [materialItems, depotItems, locationItems] = await Promise.all([
        listWarehouseMaterials(workspaceId, 500),
        listWarehouseDepots(workspaceId, 250),
        listWarehouseLocations(workspaceId, 500),
      ]);
      setMaterials(materialItems.filter((item) => item.status === 'active'));
      const activeDepots = depotItems.filter((item) => item.depot.status === 'active');
      setDepots(activeDepots);
      setLocations(locationItems.filter((item) => item.location.status === 'active'));
      setDepotId((current) =>
        current && activeDepots.some((item) => item.depot.id === current)
          ? current
          : activeDepots[0]?.depot.id || ''
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível preparar a entrada avulsa.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [workspaceId]);

  const filteredMaterials = useMemo(() => {
    const query = materialSearch.trim().toLocaleLowerCase('pt-BR');
    if (!query) return materials.slice(0, 12);
    return materials
      .filter((material) =>
        [material.description, material.id, ...material.aliases]
          .join(' ')
          .toLocaleLowerCase('pt-BR')
          .includes(query)
      )
      .slice(0, 12);
  }, [materialSearch, materials]);

  const selectedMaterial = useMemo(
    () => materials.find((material) => material.id === existingMaterialId) || null,
    [existingMaterialId, materials]
  );

  const localOptions = useMemo(
    () => locations.filter(
      (item) =>
        item.location.kind === 'LOCAL'
        && item.location.depotId === depotId
    ),
    [locations, depotId]
  );

  const subpositionOptions = useMemo(
    () => locations.filter(
      (item) =>
        item.location.kind === 'SUBPOSITION'
        && item.location.depotId === depotId
        && item.location.parentLocationId === locationId
    ),
    [locations, depotId, locationId]
  );

  const buildPosition = (): WarehouseStockPosition | null => {
    if (!depotId || !locationId) return null;
    if (subpositionId) {
      return {
        kind: 'SUBPOSITION',
        depotId,
        locationId,
        subpositionId,
      };
    }
    return {
      kind: 'LOCATION',
      depotId,
      locationId,
      subpositionId: null,
    };
  };

  const resetAfterSuccess = () => {
    setQuantity('1');
    setProvenance('');
    setReference('');
    setExpiresOn('');
    setBarcode('');
    setSubpositionId('');
    setOperationId(newOperationId());
    if (mode === 'new') {
      setDescription('');
      setUnit('UN');
    }
  };

  const submit = async () => {
    setError(null);
    setMessage(null);
    const position = buildPosition();
    const numericQuantity = Number(quantity);

    if (mode === 'existing' && !existingMaterialId) {
      setError('Selecione um material existente ou escolha cadastrar um novo material.');
      return;
    }
    if (mode === 'new' && !description.trim()) {
      setError('Informe o descritivo do novo material.');
      return;
    }
    if (mode === 'new' && !unit.trim()) {
      setError('Informe a unidade/apresentação do novo material.');
      return;
    }
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      setError('Informe uma quantidade maior que zero.');
      return;
    }
    if (!provenance.trim()) {
      setError('Informe a procedência diversa do material.');
      return;
    }
    if (!position) {
      setError('Selecione o depósito e a localização física do material.');
      return;
    }

    setWorking(true);
    try {
      const result: RegisterWarehouseManualEntryResult =
        await registerWarehouseManualEntry(workspaceId, {
          operationId,
          existingMaterialId: mode === 'existing' ? existingMaterialId : null,
          description: mode === 'existing'
            ? selectedMaterial?.description || ''
            : description,
          unitLabel: mode === 'existing'
            ? selectedMaterial
              ? unitLabel(selectedMaterial)
              : ''
            : unit,
          quantity: numericQuantity,
          provenance,
          reference: reference || null,
          position,
          expiresOn: expiresOn || null,
          barcode: barcode || null,
        });

      const warningText = result.warnings.length
        ? ' ' + result.warnings.join(' ')
        : '';
      setMessage(
        'Entrada avulsa registrada: '
        + result.material.description
        + ' · '
        + numericQuantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
        + ' '
        + unitLabel(result.material)
        + '.'
        + warningText
      );
      resetAfterSuccess();
      await load();
    } catch (submitError) {
      const raw = submitError instanceof Error ? submitError.message : String(submitError || '');
      if (raw.includes('WAREHOUSE_MANUAL_ENTRY_PROVENANCE_REQUIRED')) {
        setError('Informe a procedência diversa do material.');
      } else if (raw.includes('WAREHOUSE_MANUAL_ENTRY_POSITION_REQUIRED')) {
        setError('Selecione uma localização física ativa.');
      } else if (raw.includes('WAREHOUSE_MANUAL_ENTRY_INVALID_EXPIRY')) {
        setError('Informe uma validade válida ou deixe o campo em branco.');
      } else if (raw.includes('WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK')) {
        setError('A entrada foi criada, mas o posicionamento precisa ser retomado. Atualize e tente novamente.');
      } else {
        setError(raw || 'Não foi possível registrar a entrada avulsa.');
      }
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="space-y-5" data-testid="warehouse-manual-entry-operational">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white via-white to-blue-50/40 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#00288e]">
              <PackagePlus className="h-4 w-4" />
              Entrada avulsa
            </p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900">
              Cadastrar material de procedência diversa
            </h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Use para materiais que já existem fisicamente no depósito, mas não vieram de Nota Fiscal
              nem de importação SISCOFIS. A entrada permanece auditável no ledger e já pode ser vinculada
              à posição física, validade e código de barras.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || working}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Atualizar
          </button>
        </div>
      </div>

      {message && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold leading-5 text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {message}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold leading-5 text-rose-700">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
              Material
            </p>
            <div className="mt-3 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setMode('existing')}
                className={
                  mode === 'existing'
                    ? 'rounded-lg bg-[#00288e] px-3 py-2 text-[10px] font-black text-white shadow-sm'
                    : 'rounded-lg px-3 py-2 text-[10px] font-black text-slate-500'
                }
              >
                Material existente
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('new');
                  setExistingMaterialId('');
                }}
                className={
                  mode === 'new'
                    ? 'rounded-lg bg-[#00288e] px-3 py-2 text-[10px] font-black text-white shadow-sm'
                    : 'rounded-lg px-3 py-2 text-[10px] font-black text-slate-500'
                }
              >
                Novo material
              </button>
            </div>
          </div>

          {mode === 'existing' ? (
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                Pesquisar material
              </label>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  value={materialSearch}
                  onChange={(event) => setMaterialSearch(event.target.value)}
                  placeholder="Descritivo ou código interno"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-semibold text-slate-800 outline-none focus:border-[#00288e]"
                />
              </div>
              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200">
                {filteredMaterials.map((material) => (
                  <button
                    key={material.id}
                    type="button"
                    onClick={() => setExistingMaterialId(material.id)}
                    className={
                      existingMaterialId === material.id
                        ? 'block w-full border-b border-blue-100 bg-blue-50 px-3 py-2 text-left last:border-b-0'
                        : 'block w-full border-b border-slate-100 bg-white px-3 py-2 text-left last:border-b-0 hover:bg-slate-50'
                    }
                  >
                    <span className="block text-xs font-black text-slate-800">
                      {material.description}
                    </span>
                    <span className="mt-1 block text-[9px] text-slate-400">
                      {unitLabel(material)} · {material.id}
                    </span>
                  </button>
                ))}
                {!filteredMaterials.length && (
                  <p className="px-3 py-4 text-center text-[10px] text-slate-400">
                    Nenhum material encontrado.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
              <label>
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                  Descritivo
                </span>
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={240}
                  placeholder="Ex.: Açúcar cristal"
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-[#00288e]"
                />
              </label>
              <label>
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                  Unidade/apresentação
                </span>
                <input
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                  maxLength={80}
                  placeholder="UN, KG, CX..."
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-[#00288e]"
                />
              </label>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                Quantidade
              </span>
              <input
                type="number"
                min="0.000001"
                step="any"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-[#00288e]"
              />
            </label>
            <label>
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                Procedência diversa
              </span>
              <input
                value={provenance}
                onChange={(event) => setProvenance(event.target.value)}
                maxLength={180}
                placeholder="Ex.: doação, transferência antiga, material localizado..."
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-[#00288e]"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
              Referência / observação da origem · opcional
            </span>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              maxLength={160}
              placeholder="Ex.: termo, setor de origem, observação administrativa"
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-[#00288e]"
            />
          </label>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#00288e]">
            <MapPin className="h-4 w-4" />
            Posição física
          </p>

          <label className="block">
            <span className="text-[9px] font-black uppercase text-slate-500">Depósito</span>
            <select
              value={depotId}
              onChange={(event) => {
                setDepotId(event.target.value);
                setLocationId('');
                setSubpositionId('');
              }}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800"
            >
              <option value="">Selecione</option>
              {depots.map(({ depot }) => (
                <option key={depot.id} value={depot.id}>
                  {depot.code} · {depot.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[9px] font-black uppercase text-slate-500">Localização</span>
            <select
              value={locationId}
              onChange={(event) => {
                setLocationId(event.target.value);
                setSubpositionId('');
              }}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800"
            >
              <option value="">Selecione</option>
              {localOptions.map(({ location }) => (
                <option key={location.id} value={location.id}>
                  {location.code} · {location.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[9px] font-black uppercase text-slate-500">
              Subposição · opcional
            </span>
            <select
              value={subpositionId}
              onChange={(event) => setSubpositionId(event.target.value)}
              disabled={!locationId || !subpositionOptions.length}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">Sem subposição</option>
              {subpositionOptions.map(({ location }) => (
                <option key={location.id} value={location.id}>
                  {location.code} · {location.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label>
              <span className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-500">
                <CalendarClock className="h-3.5 w-3.5" />
                Validade · opcional
              </span>
              <input
                type="date"
                value={expiresOn}
                onChange={(event) => setExpiresOn(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800"
              />
            </label>

            <label>
              <span className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-500">
                <Barcode className="h-3.5 w-3.5" />
                Código de barras · opcional
              </span>
              <input
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                maxLength={128}
                placeholder="Leitor ou digitação"
                className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800"
              />
            </label>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[9px] leading-5 text-amber-800">
            <FileText className="mr-1 inline h-3.5 w-3.5" />
            A procedência informada ficará registrada no movimento de entrada. Esta operação aumenta o
            estoque oficial e não deve ser usada para corrigir divergências de inventário.
          </div>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={working || loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#001f70] disabled:opacity-50"
          >
            {working ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <PackagePlus className="h-4 w-4" />
            )}
            Registrar entrada avulsa
          </button>
        </div>
      </div>
    </section>
  );
}
