'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Barcode,
  Boxes,
  Building2,
  ChevronRight,
  Download,
  FileText,
  Grid2X2,
  Info,
  List,
  MapPin,
  Pencil,
  RefreshCw,
  Save,
  TriangleAlert,
  X,
} from 'lucide-react';

import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import {
  listWarehouseMaterials,
  saveWarehouseMaterial,
} from '../../../lib/warehouse/materialRepository';
import {
  warehouseStockPositionsEqual,
  type WarehouseDepot,
  type WarehouseLocation,
  type WarehouseLocationBalance,
  type WarehouseStockPosition,
} from '../../../lib/warehouse/location';
import {
  listWarehouseDepotsCached,
  listWarehouseLocationBalances,
  listWarehouseLocationsCached,
} from '../../../lib/warehouse/locationRepository';
import {
  createWarehousePendingLotCode,
  type WarehouseLot,
} from '../../../lib/warehouse/lot';
import {
  createWarehouseLot,
  listWarehouseLots,
  updateWarehouseLot,
} from '../../../lib/warehouse/lotRepository';
import type { WarehouseBarcodeAssociation } from '../../../lib/warehouse/barcode';
import {
  listWarehouseBarcodes,
  saveWarehouseBarcodeAssociation,
} from '../../../lib/warehouse/barcodeRepository';
import {
  loadWarehouseInvoiceIntakeQueue,
  type WarehouseInvoiceIntakeQueueRow,
} from '../../../lib/warehouse/intakeStateRepository';

type PhysicalPosition = Exclude<WarehouseStockPosition, { kind: 'UNASSIGNED' }>;
type DisplayMode = 'cards' | 'list';

interface StoredItemsState {
  loading: boolean;
  error: string | null;
  materials: WarehouseMaterial[];
  depots: WarehouseDepot[];
  locations: WarehouseLocation[];
  locationBalances: WarehouseLocationBalance[];
  lots: WarehouseLot[];
  barcodes: WarehouseBarcodeAssociation[];
  intakeRows: WarehouseInvoiceIntakeQueueRow[];
}

interface StoredItemRow {
  key: string;
  material: WarehouseMaterial;
  quantity: number;
  position: PhysicalPosition;
  depot: WarehouseDepot;
  location: WarehouseLocation;
  subposition: WarehouseLocation | null;
  lots: WarehouseLot[];
  barcodes: WarehouseBarcodeAssociation[];
  missingExpiry: boolean;
  missingBarcode: boolean;
  nearestExpiry: string | null;
}

function dateLabel(value: string | null): string {
  if (!value) return 'Não informada';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return match[3] + '/' + match[2] + '/' + match[1];
}

function unitLabel(material: WarehouseMaterial): string {
  return material.unit.label || material.unit.code.toUpperCase();
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function csvCell(value: unknown): string {
  return '"' + String(value ?? '').replace(/"/g, '""') + '"';
}

function downloadCsv(name: string, headers: string[], rows: Array<Array<string | number>>) {
  const csv = [
    headers.map(csvCell).join(';'),
    ...rows.map((row) => row.map(csvCell).join(';')),
  ].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function positionKey(position: PhysicalPosition): string {
  return position.kind === 'SUBPOSITION'
    ? position.depotId + '|' + position.locationId + '|' + position.subpositionId
    : position.depotId + '|' + position.locationId;
}

function originRowsForItem(
  row: StoredItemRow,
  intakeRows: WarehouseInvoiceIntakeQueueRow[]
): WarehouseInvoiceIntakeQueueRow[] {
  const invoiceIds = new Set(
    row.lots.flatMap((lot) =>
      lot.origin.kind === 'INVOICE' && lot.origin.invoiceId
        ? [lot.origin.invoiceId]
        : []
    )
  );

  const candidates = intakeRows.filter((candidate) =>
    candidate.materialId === row.material.id
    && (invoiceIds.size === 0 || invoiceIds.has(candidate.invoiceId))
  );

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.invoiceRecordKey + '|' + candidate.itemId;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rowAccent(row: StoredItemRow): string {
  if (row.missingExpiry) return 'border-rose-200 bg-rose-50/35';
  if (row.missingBarcode) return 'border-amber-200 bg-amber-50/35';
  return 'border-slate-200 bg-white';
}

function EditStoredItemModal({
  workspaceId,
  row,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  row: StoredItemRow;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [description, setDescription] = useState(row.material.description);
  const [newBarcode, setNewBarcode] = useState('');
  const [validityDrafts, setValidityDrafts] = useState(
    row.lots.length > 0
      ? row.lots.map((lot) => ({
          id: lot.id as string | null,
          expiresOn: lot.expiresOn || '',
          original: lot as WarehouseLot | null,
        }))
      : [{
          id: null,
          expiresOn: '',
          original: null as WarehouseLot | null,
        }]
  );
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const nextDescription = description.trim();
    if (!nextDescription) {
      setError('O descritivo não pode ficar vazio.');
      return;
    }

    setWorking(true);
    setError(null);
    try {
      if (nextDescription !== row.material.description) {
        await saveWarehouseMaterial(workspaceId, {
          ...row.material,
          description: nextDescription,
        });
      }

      const barcode = newBarcode.trim();
      if (
        barcode
        && !row.barcodes.some((item) => item.barcode === barcode)
      ) {
        await saveWarehouseBarcodeAssociation(workspaceId, {
          materialId: row.material.id,
          barcode,
          presentation: row.material.unit,
        });
      }

      for (const draft of validityDrafts) {
        const expiresOn = draft.expiresOn || null;
        if (draft.original && draft.id) {
          if (expiresOn !== draft.original.expiresOn) {
            await updateWarehouseLot(workspaceId, draft.id, { expiresOn });
          }
        } else if (expiresOn) {
          await createWarehouseLot(workspaceId, {
            materialId: row.material.id,
            code: createWarehousePendingLotCode(crypto.randomUUID()),
            expiresOn,
            quantity: row.quantity,
            position: row.position,
          });
        }
      }

      await onSaved();
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Não foi possível salvar as alterações.'
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#00288e]">Editar item</p>
            <p className="mt-1 text-sm font-black text-slate-900">{row.material.description}</p>
            <p className="mt-1 text-[10px] text-slate-500">{row.depot.name} → {row.location.name}</p>
          </div>
          <button type="button" onClick={onClose} disabled={working} className="rounded-xl border border-slate-200 p-2 text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">Descritivo</span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={240}
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-[#00288e]"
            />
          </label>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="flex items-center gap-2 text-amber-700">
              <Barcode className="h-4 w-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.12em]">Código de barras</p>
            </div>
            {row.barcodes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {row.barcodes.map((item) => (
                  <span key={item.id} className="rounded-lg border border-amber-200 bg-white px-2 py-1 font-mono text-[10px] font-bold text-slate-700">
                    {item.barcode}
                  </span>
                ))}
              </div>
            )}
            <input
              value={newBarcode}
              onChange={(event) => setNewBarcode(event.target.value)}
              placeholder={row.barcodes.length ? 'Adicionar outro código de barras' : 'Incluir código de barras'}
              maxLength={128}
              className="mt-3 h-11 w-full rounded-xl border border-amber-200 bg-white px-3 font-mono text-sm font-bold text-slate-800 outline-none focus:border-amber-400"
            />
            <p className="mt-2 text-[9px] text-amber-700">
              Enquanto nenhum código estiver cadastrado, o item permanece com pendência amarela.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Validade</p>
              <p className="mt-1 text-[10px] leading-5 text-slate-400">
                A validade é o único dado temporal editável do item. Quando ausente, o item permanece com pendência vermelha.
              </p>
            </div>

            {validityDrafts.map((draft, index) => (
              <label key={draft.id || 'new-validity'} className="block rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[9px] font-black uppercase text-rose-600">
                  Data de validade {validityDrafts.length > 1 ? index + 1 : ''}
                </span>
                <input
                  type="date"
                  value={draft.expiresOn}
                  onChange={(event) => {
                    const value = event.target.value;
                    setValidityDrafts((current) =>
                      current.map((item) => item.id === draft.id ? { ...item, expiresOn: value } : item)
                    );
                  }}
                  className="mt-1 h-10 w-full rounded-lg border border-rose-200 bg-white px-3 text-xs font-bold text-slate-800"
                />
              </label>
            ))}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={working} className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-600">
              Cancelar
            </button>
            <button type="button" onClick={() => void save()} disabled={working} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white disabled:opacity-50">
              {working ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StoredItemDetailsModal({
  row,
  intakeRows,
  onClose,
}: {
  row: StoredItemRow;
  intakeRows: WarehouseInvoiceIntakeQueueRow[];
  onClose: () => void;
}) {
  const origins = originRowsForItem(row, intakeRows);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#00288e]">Mais informações</p>
            <p className="mt-1 text-sm font-black text-slate-900">{row.material.description}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[9px] font-black uppercase text-slate-400">Posição</p>
              <p className="mt-1 text-xs font-black text-slate-800">
                {row.depot.name} → {row.location.name}
                {row.subposition ? ' → ' + row.subposition.name : ''}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[9px] font-black uppercase text-slate-400">Quantidade</p>
              <p className="mt-1 text-xs font-black text-slate-800">
                {row.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} {unitLabel(row.material)}
              </p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
              <p className="text-[9px] font-black uppercase text-rose-500">Validade</p>
              <p className="mt-1 text-xs font-black text-slate-800">{dateLabel(row.nearestExpiry)}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <p className="text-[9px] font-black uppercase text-amber-600">Código de barras</p>
              <p className="mt-1 break-all font-mono text-[10px] font-bold text-slate-700">
                {row.barcodes.length ? row.barcodes.map((item) => item.barcode).join(' · ') : 'Não informado'}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Procedência</p>
            <div className="mt-2 space-y-2">
              {origins.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                  Procedência documental não disponível na janela canônica atual.
                </div>
              ) : origins.map((origin) => (
                <div key={origin.key} className="rounded-xl border border-blue-100 bg-blue-50/45 p-4">
                  <div className="flex items-center gap-2 text-[#00288e]">
                    <FileText className="h-4 w-4" />
                    <p className="text-[10px] font-black uppercase tracking-[0.1em]">Nota Fiscal {origin.invoiceId}</p>
                  </div>
                  <div className="mt-3 grid gap-2 text-[10px] text-slate-600 sm:grid-cols-2">
                    <p><span className="font-black text-slate-700">Procedência:</span> Nota Fiscal cadastrada no EMPROVEX</p>
                    <p><span className="font-black text-slate-700">Nota de Empenho:</span> {origin.empenhoId}</p>
                    <p><span className="font-black text-slate-700">Fornecedor:</span> {origin.supplier}</p>
                    <p><span className="font-black text-slate-700">Data da NF:</span> {dateLabel(origin.issueDate)}</p>
                    <p><span className="font-black text-slate-700">Pregão:</span> {origin.pregao || 'Não informado'}</p>
                    <p><span className="font-black text-slate-700">Validade:</span> {
                      row.lots
                        .filter((lot) => lot.origin.invoiceId === origin.invoiceId)
                        .map((lot) => dateLabel(lot.expiresOn))
                        .join(' · ') || 'Não informada'
                    }</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WarehouseAllocatedItemsOperational({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const [state, setState] = useState<StoredItemsState>({
    loading: true,
    error: null,
    materials: [],
    depots: [],
    locations: [],
    locationBalances: [],
    lots: [],
    barcodes: [],
    intakeRows: [],
  });
  const [selectedDepotId, setSelectedDepotId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('cards');
  const [queryText, setQueryText] = useState('');
  const [editRow, setEditRow] = useState<StoredItemRow | null>(null);
  const [detailsRow, setDetailsRow] = useState<StoredItemRow | null>(null);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [
        materials,
        depotItems,
        locationItems,
        locationBalanceItems,
        lotItems,
        barcodeItems,
        intakeContext,
      ] = await Promise.all([
        listWarehouseMaterials(workspaceId, 500),
        listWarehouseDepotsCached(workspaceId, 250),
        listWarehouseLocationsCached(workspaceId, 500),
        listWarehouseLocationBalances(workspaceId, 500),
        listWarehouseLots(workspaceId, 500),
        listWarehouseBarcodes(workspaceId, 500),
        loadWarehouseInvoiceIntakeQueue(workspaceId),
      ]);

      setState({
        loading: false,
        error: null,
        materials,
        depots: depotItems.map((item) => item.depot),
        locations: locationItems.map((item) => item.location),
        locationBalances: locationBalanceItems.map((item) => item.balance),
        lots: lotItems.map((item) => item.lot),
        barcodes: barcodeItems.map((item) => item.association),
        intakeRows: intakeContext.rows,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'Falha ao carregar os itens armazenados.',
      }));
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows = useMemo<StoredItemRow[]>(() => {
    const materialById = new Map(state.materials.map((material) => [material.id, material]));
    const depotById = new Map(state.depots.map((depot) => [depot.id, depot]));
    const locationById = new Map(state.locations.map((location) => [location.id, location]));

    return state.locationBalances.flatMap((balance) => {
      if (balance.quantity <= 0 || balance.position.kind === 'UNASSIGNED') return [];
      const position: PhysicalPosition = balance.position;
      const material = materialById.get(balance.materialId);
      const depot = depotById.get(position.depotId);
      const location = locationById.get(position.locationId);
      if (!material || !depot || !location) return [];

      const subposition = position.kind === 'SUBPOSITION'
        ? locationById.get(position.subpositionId) || null
        : null;
      const lots = state.lots.filter((lot) =>
        lot.materialId === material.id
        && lot.status === 'active'
        && lot.quantity > 0
        && warehouseStockPositionsEqual(lot.position, position)
      );
      const barcodes = state.barcodes.filter((item) =>
        item.materialId === material.id && item.status === 'active'
      );
      const nearestExpiry = lots
        .flatMap((lot) => lot.expiresOn ? [lot.expiresOn] : [])
        .sort()[0] || null;

      return [{
        key: material.id + '|' + positionKey(position),
        material,
        quantity: balance.quantity,
        position,
        depot,
        location,
        subposition,
        lots,
        barcodes,
        missingExpiry: lots.length === 0 || lots.some((lot) => !lot.expiresOn),
        missingBarcode: barcodes.length === 0,
        nearestExpiry,
      }];
    }).sort((left, right) =>
      left.depot.name.localeCompare(right.depot.name, 'pt-BR')
      || left.location.name.localeCompare(right.location.name, 'pt-BR')
      || left.material.description.localeCompare(right.material.description, 'pt-BR')
    );
  }, [state]);

  const activeDepots = useMemo(
    () => state.depots.filter((depot) => depot.status === 'active'),
    [state.depots]
  );

  const selectedDepot = activeDepots.find((depot) => depot.id === selectedDepotId) || null;
  const selectedLocation = state.locations.find((location) => location.id === selectedLocationId) || null;

  const depotLocations = useMemo(
    () => state.locations
      .filter((location) =>
        location.status === 'active'
        && location.kind === 'LOCAL'
        && location.depotId === selectedDepotId
      )
      .sort((left, right) => left.code.localeCompare(right.code, 'pt-BR', { numeric: true })),
    [selectedDepotId, state.locations]
  );

  const visibleRows = useMemo(() => {
    const query = normalizeSearch(queryText);
    return rows.filter((row) => {
      if (selectedDepotId && row.position.depotId !== selectedDepotId) return false;
      if (selectedLocationId && row.position.locationId !== selectedLocationId) return false;
      if (!query) return true;

      const origins = originRowsForItem(row, state.intakeRows);
      const haystack = normalizeSearch([
        row.material.description,
        row.material.id,
        row.depot.name,
        row.location.name,
        row.subposition?.name || '',
        ...row.barcodes.map((item) => item.barcode),
        ...row.lots.map((lot) => lot.expiresOn || ''),
        ...origins.flatMap((origin) => [
          origin.invoiceId,
          origin.empenhoId,
          origin.supplier,
          origin.pregao || '',
        ]),
      ].join(' '));
      return haystack.includes(query);
    });
  }, [queryText, rows, selectedDepotId, selectedLocationId, state.intakeRows]);

  const reportRows = (source: StoredItemRow[]) => source.map((row) => {
    const origins = originRowsForItem(row, state.intakeRows);
    return [
      row.depot.name,
      row.location.name,
      row.subposition?.name || '',
      row.material.description,
      row.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 }),
      unitLabel(row.material),
      row.nearestExpiry ? dateLabel(row.nearestExpiry) : 'Não informada',
      row.barcodes.map((item) => item.barcode).join(' | '),
      origins.map((origin) => origin.invoiceId).join(' | '),
      origins.map((origin) => origin.empenhoId).join(' | '),
      origins.map((origin) => origin.supplier).join(' | '),
      origins.map((origin) => origin.pregao || '').join(' | '),
    ];
  });

  const exportReport = (scope: 'general' | 'selection') => {
    const source = scope === 'general' ? rows : visibleRows;
    downloadCsv(
      scope === 'general'
        ? 'emprovex-itens-geral.csv'
        : 'emprovex-itens-selecao.csv',
      [
        'Depósito',
        'Localização',
        'Subposição',
        'Descrição',
        'Quantidade',
        'Unidade',
        'Validade',
        'Código de barras',
        'Nota Fiscal',
        'Nota de Empenho',
        'Fornecedor',
        'Pregão',
      ],
      reportRows(source)
    );
  };

  if (state.loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Carregando itens, posições e procedências…
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="warehouse-allocated-items">
      <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#00288e]">
              <Boxes className="h-4 w-4" />
              <p className="text-xs font-black uppercase tracking-[0.12em]">Itens armazenados</p>
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
              Consulta administrativa por depósito e localização. Esta visão contém apenas dados e informações; o croqui permanece fora desta aba.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void refresh()} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-[10px] font-black text-slate-600">
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </button>
            <button type="button" onClick={() => exportReport('general')} disabled={!rows.length} className="inline-flex h-9 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-[10px] font-black text-[#00288e] disabled:opacity-40">
              <Download className="h-3.5 w-3.5" /> Relatório geral
            </button>
            {(selectedDepotId || queryText.trim()) && (
              <button type="button" onClick={() => exportReport('selection')} disabled={!visibleRows.length} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#00288e] px-3 text-[10px] font-black text-white disabled:opacity-40">
                <Download className="h-3.5 w-3.5" /> Relatório da seleção
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">Depósitos</p>
            <p className="mt-1 text-xl font-black text-slate-900">{activeDepots.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">Posições com saldo</p>
            <p className="mt-1 text-xl font-black text-slate-900">{rows.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">Materiais distintos</p>
            <p className="mt-1 text-xl font-black text-slate-900">{new Set(rows.map((row) => row.material.id)).size}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-[8px] font-black uppercase tracking-[0.12em] text-amber-600">Sem código</p>
            <p className="mt-1 text-xl font-black text-slate-900">{rows.filter((row) => row.missingBarcode).length}</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
            <p className="text-[8px] font-black uppercase tracking-[0.12em] text-rose-600">Sem validade</p>
            <p className="mt-1 text-xl font-black text-slate-900">{rows.filter((row) => row.missingExpiry).length}</p>
          </div>
        </div>

        {state.error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[10px]">
        {selectedDepot && (
          <button type="button" onClick={() => {
            setSelectedDepotId('');
            setSelectedLocationId('');
            setQueryText('');
          }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-black text-slate-600">
            <ArrowLeft className="h-3 w-3" /> Depósitos
          </button>
        )}
        {selectedDepot && (
          <span className="font-black text-[#00288e]">{selectedDepot.name}</span>
        )}
        {selectedLocation && (
          <>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <button type="button" onClick={() => setSelectedLocationId('')} className="font-black text-[#00288e]">
              {selectedLocation.name}
            </button>
          </>
        )}
      </div>

      {!selectedDepotId ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activeDepots.map((depot) => {
            const depotRows = rows.filter((row) => row.position.depotId === depot.id);
            const localCount = new Set(depotRows.map((row) => row.position.locationId)).size;
            return (
              <button
                key={depot.id}
                type="button"
                onClick={() => setSelectedDepotId(depot.id)}
                className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#00288e]">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </div>
                <p className="mt-4 text-sm font-black text-slate-900">{depot.name}</p>
                <p className="mt-1 text-[10px] font-bold text-slate-400">{depot.code}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 p-2"><p className="text-sm font-black text-slate-800">{localCount}</p><p className="text-[8px] uppercase text-slate-400">locais</p></div>
                  <div className="rounded-lg bg-amber-50 p-2"><p className="text-sm font-black text-amber-700">{depotRows.filter((row) => row.missingBarcode).length}</p><p className="text-[8px] uppercase text-amber-600">sem código</p></div>
                  <div className="rounded-lg bg-rose-50 p-2"><p className="text-sm font-black text-rose-700">{depotRows.filter((row) => row.missingExpiry).length}</p><p className="text-[8px] uppercase text-rose-600">sem validade</p></div>
                </div>
              </button>
            );
          })}
        </div>
      ) : !selectedLocationId ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {depotLocations.map((location) => {
            const locationRows = rows.filter((row) =>
              row.position.depotId === selectedDepotId
              && row.position.locationId === location.id
            );
            const subpositionCount = new Set(
              locationRows.flatMap((row) => row.subposition ? [row.subposition.id] : [])
            ).size;
            return (
              <button
                key={location.id}
                type="button"
                onClick={() => setSelectedLocationId(location.id)}
                className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </div>
                <p className="mt-4 text-sm font-black text-slate-900">{location.name}</p>
                <p className="mt-1 text-[10px] font-bold text-slate-400">{location.code}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-[9px] font-bold">
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-[#00288e]">{locationRows.length} item/posição</span>
                  {subpositionCount > 0 && <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500">{subpositionCount} subposição(ões)</span>}
                  {locationRows.some((row) => row.missingBarcode) && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">pendência código</span>}
                  {locationRows.some((row) => row.missingExpiry) && <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">pendência validade</span>}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <input
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="Pesquisar descrição, validade, código, NF, fornecedor ou pregão…"
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-300 sm:max-w-xl"
            />
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              <button type="button" onClick={() => setDisplayMode('cards')} aria-pressed={displayMode === 'cards'} className={displayMode === 'cards' ? 'rounded-lg bg-white p-2 text-[#00288e] shadow-sm' : 'rounded-lg p-2 text-slate-400'}>
                <Grid2X2 className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setDisplayMode('list')} aria-pressed={displayMode === 'list'} className={displayMode === 'list' ? 'rounded-lg bg-white p-2 text-[#00288e] shadow-sm' : 'rounded-lg p-2 text-slate-400'}>
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {visibleRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
              Nenhum item encontrado nesta localização.
            </div>
          ) : displayMode === 'cards' ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleRows.map((row) => (
                <div key={row.key} className={'rounded-2xl border p-4 shadow-sm ' + rowAccent(row)}>
                  <div className="flex flex-wrap gap-1.5">
                    {row.missingExpiry && <span className="rounded-full bg-rose-100 px-2 py-1 text-[8px] font-black uppercase text-rose-700">Validade pendente</span>}
                    {row.missingBarcode && <span className="rounded-full bg-amber-100 px-2 py-1 text-[8px] font-black uppercase text-amber-700">Código pendente</span>}
                    {!row.missingExpiry && !row.missingBarcode && <span className="rounded-full bg-emerald-100 px-2 py-1 text-[8px] font-black uppercase text-emerald-700">Completo</span>}
                  </div>
                  <p className="mt-3 text-sm font-black leading-5 text-slate-900">{row.material.description}</p>
                  <p className="mt-1 text-[10px] font-bold text-slate-500">
                    {row.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} {unitLabel(row.material)}
                  </p>
                  <div className="mt-3 space-y-1 text-[10px] text-slate-500">
                    <p><span className="font-black text-slate-600">Subposição:</span> {row.subposition?.name || '—'}</p>
                    <p><span className="font-black text-slate-600">Validade:</span> {dateLabel(row.nearestExpiry)}</p>
                  </div>
                  <div className="mt-4 flex gap-2 border-t border-slate-200/70 pt-3">
                    <button type="button" onClick={() => setEditRow(row)} className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[10px] font-black text-slate-600">
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button type="button" onClick={() => setDetailsRow(row)} className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-[#00288e] text-[10px] font-black text-white">
                      <Info className="h-3.5 w-3.5" /> Mais informações
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {visibleRows.map((row) => (
                <div key={row.key} className={'grid gap-3 border-b border-slate-100 p-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_140px_160px_220px] lg:items-center ' + (row.missingExpiry ? 'bg-rose-50/30' : row.missingBarcode ? 'bg-amber-50/30' : '')}>
                  <div>
                    <p className="text-sm font-black text-slate-900">{row.material.description}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{row.subposition?.name || 'Sem subposição específica'}</p>
                  </div>
                  <p className="text-xs font-black text-slate-700">{row.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} {unitLabel(row.material)}</p>
                  <div className="text-[10px]">
                    <p className={row.missingExpiry ? 'font-black text-rose-700' : 'font-bold text-slate-600'}>Validade: {dateLabel(row.nearestExpiry)}</p>
                    <p className={row.missingBarcode ? 'mt-1 font-black text-amber-700' : 'mt-1 font-bold text-slate-500'}>{row.missingBarcode ? 'Código de barras pendente' : row.barcodes[0]?.barcode}</p>
                  </div>
                  <div className="flex gap-2 lg:justify-end">
                    <button type="button" onClick={() => setEditRow(row)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-[10px] font-black text-slate-600"><Pencil className="h-3.5 w-3.5" /> Editar</button>
                    <button type="button" onClick={() => setDetailsRow(row)} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#00288e] px-3 text-[10px] font-black text-white"><Info className="h-3.5 w-3.5" /> Mais informações</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editRow && (
        <EditStoredItemModal
          workspaceId={workspaceId}
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={refresh}
        />
      )}

      {detailsRow && (
        <StoredItemDetailsModal
          row={detailsRow}
          intakeRows={state.intakeRows}
          onClose={() => setDetailsRow(null)}
        />
      )}
    </div>
  );
}
