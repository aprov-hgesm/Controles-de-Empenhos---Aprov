'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Download, Pencil, RefreshCw, X } from 'lucide-react';
import {
  warehouseLocationExpiry,
  warehouseLocationExpiryStatus,
  warehouseLocationQuantity,
  type LocationContents,
} from '../../../lib/warehouse/locationContents';

import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import type { WarehouseBarcodeAssociation } from '../../../lib/warehouse/barcode';
import {
  listWarehouseBarcodesForMaterials,
  replaceWarehouseBarcodeAssociation,
  saveWarehouseBarcodeAssociation,
  setWarehouseBarcodeStatus,
} from '../../../lib/warehouse/barcodeRepository';
import { saveWarehouseMaterial } from '../../../lib/warehouse/materialRepository';
import { updateWarehouseLot } from '../../../lib/warehouse/lotRepository';

export type WarehouseInspectionLotState = 'idle' | 'loading' | 'ready' | 'error';

function nearestExpiry(
  row: LocationContents['groups'][number]['rows'][number],
  lotState: WarehouseInspectionLotState
): string {
  if (lotState !== 'ready') return 'Validade: consultando…';
  const dates = [...new Set(
    row.lots.flatMap((lot) => lot.expiresOn ? [lot.expiresOn] : [])
  )].sort();
  if (!dates.length) return 'Validade: não informada';
  const summary = dates.slice(0, 2).map(warehouseLocationExpiry).join(', ')
    + (dates.length > 2 ? ' +' + (dates.length - 2) + ' outras' : '');
  const pending = row.quantityWithoutLot > 0.000001
    || row.lots.some((lot) => !lot.expiresOn);
  return 'Validades: ' + summary + (pending ? ' · pendências' : '');
}

export function WarehouseLocationContentsTooltip({
  contents,
  lotState,
}: {
  contents: LocationContents;
  lotState: WarehouseInspectionLotState;
}) {
  const count = contents.groups.reduce((sum, group) => sum + group.rows.length, 0);
  let shown = 0;

  return (
    <div
      data-testid="warehouse-location-hover-tooltip"
      className="pointer-events-none w-full rounded-2xl border border-blue-100 bg-white p-3 text-slate-800 shadow-sm"
    >
      <p className="text-xs font-black text-[#00288e]">
        {contents.location.code} · {contents.location.name}
      </p>
      <p className="mt-1 text-[10px] font-semibold text-slate-500">
        {contents.materialCount} material(is) · {contents.rowCount} registro(s) de saldo físico
      </p>
      <div className="mt-2 space-y-2">
        {count === 0 && (
          <p className="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-500">Local sem itens com saldo positivo. Saldo físico: 0.</p>
        )}
        {contents.groups.map((group) => {
          const rows = group.rows.slice(0, Math.max(0, 5 - shown));
          shown += rows.length;
          if (!rows.length) return null;
          return (
            <div key={group.id}>
              <p className="mb-1 rounded-md bg-blue-50 px-2 py-1 text-[10px] font-black text-[#00288e]">
                {group.direct ? 'Sem prateleira' : 'Prateleira ' + group.code + ' · ' + group.name}
              </p>
              {rows.map((row) => (
                <div key={row.materialId} className="border-b border-slate-100 px-1 py-1.5 last:border-0">
                  <p className="text-[11px] font-semibold leading-4">{row.description}</p>
                  <p className="text-[10px] text-slate-500">
                    {warehouseLocationQuantity(row.quantity)} {row.unit} · {nearestExpiry(row, lotState)}
                  </p>
                </div>
              ))}
            </div>
          );
        })}
        {count > shown && <p className="text-[10px] font-bold text-slate-500">+{count - shown} registros · clique para ver todos</p>}
      </div>
      <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] font-bold text-blue-700">
        Clique no local para detalhes e relatório PDF
      </p>
    </div>
  );
}


type ContentsRow = LocationContents['groups'][number]['rows'][number];
type EditingDraft = {
  materialId: string;
  description: string;
  barcode: string;
  dates: Record<string, string>;
};

function primaryCode(codes: WarehouseBarcodeAssociation[], materialId: string) {
  return codes.find((item) => item.materialId === materialId && item.factorToBaseUnit === 1)
    || codes.find((item) => item.materialId === materialId)
    || null;
}

function expiryBadge(value: string | null, today: Date) {
  const status = warehouseLocationExpiryStatus(value, today);
  const style = status === 'expired'
    ? 'border-rose-200 bg-rose-50 text-rose-800'
    : status === 'soon'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-slate-200 bg-slate-50 text-slate-700';
  return { status, style };
}

export function WarehouseLocationDetailsDialog({
  contents,
  depotName,
  lotState,
  lotError,
  complete,
  workspaceId,
  materials = [],
  onMaterialUpdated,
  onRefresh,
  onClose,
}: {
  contents: LocationContents;
  depotName: string;
  lotState: WarehouseInspectionLotState;
  lotError: string | null;
  complete: boolean;
  workspaceId?: string;
  materials?: WarehouseMaterial[];
  onMaterialUpdated?: (material: WarehouseMaterial) => void;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [barcodeState, setBarcodeState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [barcodes, setBarcodes] = useState<WarehouseBarcodeAssociation[]>([]);
  const [barcodeVersion, setBarcodeVersion] = useState(0);
  const [editing, setEditing] = useState<EditingDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  const [today, setToday] = useState(() => new Date());

  const materialIds = useMemo(
    () => [...new Set(contents.groups.flatMap((group) => group.rows.map((row) => row.materialId)))],
    [contents]
  );
  const materialKey = materialIds.join('|');

  useEffect(() => {
    let active = true;
    if (!workspaceId || !materialIds.length) {
      setBarcodes([]);
      setBarcodeState('ready');
      return () => { active = false; };
    }
    setBarcodeState('loading');
    void listWarehouseBarcodesForMaterials(workspaceId, materialIds)
      .then((result) => {
        if (!active) return;
        setBarcodes(result);
        setBarcodeState('ready');
      })
      .catch(() => { if (active) setBarcodeState('error'); });
    return () => { active = false; };
    // materialKey stabilizes material identity across lot refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, materialKey, barcodeVersion]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        if (editing) setEditing(null);
        else onClose();
      }
    };
    const onVisible = () => { if (!document.hidden) setToday(new Date()); };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [onClose, editing, saving]);

  function startEditing(row: ContentsRow) {
    if (!workspaceId || lotState !== 'ready' || !complete || barcodeState !== 'ready') return;
    if (!materials.some((item) => item.id === row.materialId)) return;
    const current = primaryCode(barcodes, row.materialId);
    setEditError(null);
    setEditNotice(null);
    setEditing({
      materialId: row.materialId,
      description: row.description,
      barcode: current?.barcode || '',
      dates: Object.fromEntries(row.lots.map((lot) => [lot.id, lot.expiresOn || ''])),
    });
  }

  async function saveEditing(row: ContentsRow) {
    if (!editing || !workspaceId || saving || editing.materialId !== row.materialId) return;
    const material = materials.find((item) => item.id === row.materialId);
    if (!material) {
      setEditError('Cadastro do material indisponível. Atualize a consulta.');
      return;
    }
    const description = editing.description.trim();
    if (!description) {
      setEditError('Informe a descrição do material.');
      return;
    }
    setSaving(true);
    setEditError(null);
    setEditNotice(null);
    let saved = 0;
    let barcodeSaved = false;
    let lotSaved = false;
    try {
      if (description !== material.description) {
        const updated = await saveWarehouseMaterial(workspaceId, { ...material, description });
        onMaterialUpdated?.(updated);
        saved += 1;
      }
      const old = primaryCode(barcodes, row.materialId);
      const nextBarcode = editing.barcode.trim();
      if (nextBarcode !== (old?.barcode || '')) {
        if (old) {
          if (nextBarcode) {
            await replaceWarehouseBarcodeAssociation(workspaceId, old.id, nextBarcode);
          } else {
            await setWarehouseBarcodeStatus(workspaceId, old.id, 'inactive');
          }
        } else if (nextBarcode) {
          await saveWarehouseBarcodeAssociation(workspaceId, {
            materialId: material.id,
            barcode: nextBarcode,
            presentation: material.unit,
          });
        }
        saved += 1;
        barcodeSaved = true;
      }
      for (const lot of row.lots) {
        const next = editing.dates[lot.id] || null;
        if (next !== lot.expiresOn) {
          await updateWarehouseLot(workspaceId, lot.id, { expiresOn: next });
          saved += 1;
          lotSaved = true;
        }
      }
      setEditing(null);
      if (barcodeSaved) setBarcodeVersion((value) => value + 1);
      if (lotSaved) onRefresh();
      setEditNotice(saved > 0 ? 'Informações atualizadas. O saldo físico não foi alterado.' : 'Nenhuma alteração necessária.');
    } catch (error) {
      setEditError(
        (saved > 0 ? 'Parte das alterações foi salva. Atualize a consulta e confira os campos. ' : '')
        + (error instanceof Error ? error.message : 'Não foi possível salvar as informações.')
      );
      if (barcodeSaved) setBarcodeVersion((value) => value + 1);
      if (lotSaved) onRefresh();
    } finally {
      setSaving(false);
    }
  }

  const generate = async () => {
    if (lotState !== 'ready' || barcodeState !== 'ready' || !complete || generating || saving || editing) return;
    setGenerating(true);
    setReportError(null);
    try {
      const { downloadWarehouseLocationContentsPdf } = await import('../pdf/WarehouseLocationContentsPdf');
      await downloadWarehouseLocationContentsPdf({ contents, depotName, barcodes, generatedAt: new Date() });
    } catch {
      setReportError('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  const canExport = lotState === 'ready' && barcodeState === 'ready' && complete && !saving && !editing;
  const canEdit = Boolean(workspaceId && complete && lotState === 'ready' && barcodeState === 'ready');
  const nearExpiryCount = contents.groups.flatMap((group) => group.rows)
    .flatMap((row) => row.lots)
    .filter((lot) => warehouseLocationExpiryStatus(lot.expiresOn, today) === 'soon').length;
  const expiredCount = contents.groups.flatMap((group) => group.rows)
    .flatMap((row) => row.lots)
    .filter((lot) => warehouseLocationExpiryStatus(lot.expiresOn, today) === 'expired').length;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/65 px-3 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}
      data-testid="warehouse-location-details-overlay"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="warehouse-location-details-title"
        data-testid="warehouse-location-details-dialog"
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-[#f8faff] px-5 py-5 sm:px-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-blue-800">{depotName} · Consulta de materiais</p>
            <h2 id="warehouse-location-details-title" className="mt-1 text-xl font-black text-slate-900">
              {contents.location.code} · {contents.location.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="rounded-full bg-white px-3 py-1 font-semibold shadow-sm">{contents.materialCount} materiais</span>
              {nearExpiryCount > 0 && <span className="rounded-full bg-amber-100 px-3 py-1 font-bold text-amber-800">{nearExpiryCount} a vencer em 14 dias</span>}
              {expiredCount > 0 && <span className="rounded-full bg-rose-100 px-3 py-1 font-bold text-rose-800">{expiredCount} vencidos</span>}
            </div>
          </div>
          <button autoFocus type="button" aria-label="Fechar detalhes" onClick={onClose} disabled={saving}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
          {lotState === 'loading' && (
            <p className="mb-3 rounded-xl bg-blue-50 p-3 text-xs font-semibold text-blue-800">Consultando validades dos materiais…</p>
          )}
          {lotState === 'error' && (
            <p className="mb-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">Não foi possível consultar validades. {lotError || 'Tente atualizar.'}</p>
          )}
          {barcodeState === 'loading' && (
            <p className="mb-3 rounded-xl bg-blue-50 p-3 text-xs font-semibold text-blue-800">Consultando códigos de barras cadastrados…</p>
          )}
          {barcodeState === 'error' && (
            <p className="mb-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">Não foi possível consultar códigos de barras. Atualize a consulta antes de editar ou emitir o PDF.</p>
          )}
          {!complete && (
            <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              A consulta pode estar incompleta. Edição e relatório bloqueados até carregar todos os registros.
            </p>
          )}
          {contents.hasLotDiscrepancy && (
            <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              Divergência entre atribuições de lotes e saldo físico. Conferir integridade logística.
            </p>
          )}
          {editNotice && <p role="status" className="mb-3 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{editNotice}</p>}
          {editError && <p role="alert" className="mb-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800">{editError}</p>}

          {contents.groups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Não há materiais com saldo positivo neste local.
            </p>
          ) : (
            <div className="space-y-4">
              {contents.groups.map((group) => (
                <div key={group.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <h3 className="flex items-center justify-between border-b border-blue-100 bg-blue-50 px-4 py-3 text-xs font-black text-[#00288e]">
                    <span>{group.direct ? 'Itens diretamente no local' : group.name}</span>
                    <span className="text-[11px] font-semibold text-blue-700">{group.rows.length} itens</span>
                  </h3>
                  <div className="hidden grid-cols-[minmax(0,2fr)_118px_190px_156px_48px] gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-500 lg:grid">
                    <span>Descrição do item</span><span>Quantidade</span><span>Validade</span><span>Código de barras</span><span></span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {group.rows.map((row) => {
                      const currentBarcode = primaryCode(barcodes, row.materialId);
                      const isEditing = editing?.materialId === row.materialId;
                      return (
                        <div key={row.materialId} className="px-4 py-3.5" data-testid="warehouse-location-material-row">
                          <div className="grid grid-cols-2 gap-x-3 gap-y-3 lg:grid-cols-[minmax(0,2fr)_118px_190px_156px_48px] lg:items-start">
                            <div className="col-span-2 min-w-0 lg:col-span-1">
                              <p className="mb-1 text-[10px] font-bold uppercase text-slate-400 lg:hidden">Descrição</p>
                              <p className="break-words text-sm font-bold leading-5 text-slate-900">{row.description}</p>
                            </div>
                            <div>
                              <p className="mb-1 text-[10px] font-bold uppercase text-slate-400 lg:hidden">Quantidade</p>
                              <p className="text-base font-black tabular-nums text-slate-900">
                                {warehouseLocationQuantity(row.quantity)} <span className="text-xs font-semibold text-slate-500">{row.unit}</span>
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className="mb-1 text-[10px] font-bold uppercase text-slate-400 lg:hidden">Validade</p>
                              {lotState !== 'ready' ? <span className="text-xs text-slate-400">Consultando…</span> : (
                                <div className="flex flex-col items-start gap-1">
                                  {row.lots.length === 0 && <span className="text-xs text-slate-500">Não informada</span>}
                                  {row.lots.map((lot) => {
                                    const badge = expiryBadge(lot.expiresOn, today);
                                    return (
                                      <span key={lot.id} className={'inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold ' + badge.style}>
                                        {warehouseLocationExpiry(lot.expiresOn)}
                                        {badge.status === 'expired' && <span className="text-[10px]">· Vencido</span>}
                                        {badge.status === 'soon' && <span className="text-[10px]">· A vencer</span>}
                                        {row.lots.length > 1 && <span className="text-[10px] opacity-75">· {warehouseLocationQuantity(lot.quantity)} {row.unit}</span>}
                                      </span>
                                    );
                                  })}
                                  {row.quantityWithoutLot > 0.000001 && <span className="text-[10px] font-medium text-slate-500">Há saldo sem validade informada</span>}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="mb-1 text-[10px] font-bold uppercase text-slate-400 lg:hidden">Código de barras</p>
                              <p className="min-h-[20px] break-all font-mono text-xs font-semibold text-slate-700"
                                aria-label={currentBarcode?.barcode || 'Código de barras não cadastrado'}>
                                {barcodeState === 'ready' ? (currentBarcode?.barcode || '\u00a0') : ' '}
                              </p>
                            </div>
                            <div className="flex justify-end">
                              {canEdit && !editing && materials.some((material) => material.id === row.materialId) && (
                                <button type="button" onClick={() => startEditing(row)}
                                  aria-label={'Editar ' + row.description} title="Editar dados do material"
                                  data-testid="warehouse-location-edit-material"
                                  className="rounded-lg border border-blue-100 bg-blue-50 p-2 text-blue-800 hover:bg-blue-100">
                                  <Pencil className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          {isEditing && editing && (
                            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4" data-testid="warehouse-location-material-editor">
                              <p className="mb-3 text-xs font-bold text-blue-900">Editar informações · nenhuma quantidade será alterada</p>
                              <div className="grid gap-3 md:grid-cols-2">
                                <label className="block text-xs font-semibold text-slate-700">
                                  Descrição
                                  <input type="text" maxLength={240} value={editing.description}
                                    onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                                    disabled={saving}
                                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" />
                                </label>
                                <label className="block text-xs font-semibold text-slate-700">
                                  Código de barras (opcional)
                                  <input type="text" maxLength={128} value={editing.barcode}
                                    onChange={(event) => setEditing({ ...editing, barcode: event.target.value })}
                                    disabled={saving} placeholder=" "
                                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900" />
                                </label>
                              </div>
                              {row.lots.length > 0 ? (
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  {row.lots.map((lot, index) => (
                                    <label key={lot.id} className="block text-xs font-semibold text-slate-700">
                                      {row.lots.length > 1 ? 'Validade da partida ' + (index + 1) : 'Data de validade'}
                                      <input type="date" value={editing.dates[lot.id] || ''} disabled={saving}
                                        onChange={(event) => setEditing({ ...editing, dates: { ...editing.dates, [lot.id]: event.target.value } })}
                                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" />
                                    </label>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-3 text-xs text-amber-800">
                                  Não há partida vinculada para editar validade. Cadastre o lote no fluxo de estoque; não é possível atribuir data a saldo sem lote por esta janela.
                                </p>
                              )}
                              <p className="mt-3 text-[11px] text-slate-500">Descrição e código de barras pertencem ao cadastro compartilhado do material. Cada validade pertence à sua partida.</p>
                              <p className="mt-1 text-[11px] text-slate-500">Quantidade: {warehouseLocationQuantity(row.quantity)} {row.unit} · somente entrada, saída ou outro movimento oficial altera o saldo.</p>
                              <div className="mt-3 flex flex-wrap justify-end gap-2">
                                <button type="button" disabled={saving} onClick={() => { setEditing(null); setEditError(null); }}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">Cancelar</button>
                                <button type="button" disabled={saving} onClick={() => void saveEditing(row)}
                                  data-testid="warehouse-location-save-metadata"
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#00288e] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                                  <Check className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar alterações'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {reportError && <p role="alert" className="mt-3 text-xs font-semibold text-rose-700">{reportError}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
          <p className="max-w-xl text-[11px] leading-5 text-slate-500">
            Quantidade somente por movimentação. <span className="font-bold text-amber-800">Amarelo:</span> vence em até 14 dias. <span className="font-bold text-rose-800">Vermelho:</span> vencido.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { onRefresh(); setBarcodeVersion((v) => v + 1); }} disabled={lotState === 'loading' || saving}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar consulta
            </button>
            <button type="button" onClick={() => void generate()} disabled={!canExport || generating}
              data-testid="warehouse-location-download-pdf"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#00288e] px-4 py-2 text-xs font-black text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40">
              <Download className="h-3.5 w-3.5" /> {generating ? 'Gerando…' : 'Gerar relatório PDF'}
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
