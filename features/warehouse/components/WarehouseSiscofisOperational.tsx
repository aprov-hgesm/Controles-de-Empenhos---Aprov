'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  FileUp,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import {
  classifyEmprovexSiscofisSourceItem,
  emprovexSiscofisSourceIndexFromRowId,
  remapEmprovexSiscofisRowIdAfterExclusions,
  type EmprovexSiscofisInventory,
  type WarehouseSiscofisIssue,
  type WarehouseSiscofisPreview,
} from '../../../lib/warehouse/siscofis';
import {
  confirmWarehouseSiscofisImport,
  loadWarehouseSiscofisContext,
  prepareEmprovexSiscofisInventoryData,
  type WarehouseSiscofisContext,
} from '../../../lib/warehouse/siscofisService';

type SiscofisPdfSummary = {
  fileName: string;
  pageCount: number;
  detectedRows: number;
  zeroQuantityRows: number;
  invalidRows: number;
  eligibleRows: number;
  filteredOtherAccounts: number;
  filteredHortifruti: number;
  withExpiryRows: number;
  withoutExpiryRows: number;
};

const DEFAULT_SISCOFIS_SOURCE_LABEL = 'Mapa de Existência SISCOFIS';

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Não informada';
  const parsed = new Date(value + 'T00:00:00');
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleDateString('pt-BR')
    : value;
}

function filterSiscofisDraftRows(
  inventory: EmprovexSiscofisInventory,
  excludedRowIds: readonly string[]
): EmprovexSiscofisInventory {
  if (excludedRowIds.length === 0) return inventory;
  const excludedIndexes = new Set(
    excludedRowIds
      .map((rowId) => emprovexSiscofisSourceIndexFromRowId(rowId))
      .filter((index): index is number => index !== null)
  );
  return {
    ...inventory,
    items: inventory.items.filter((_, index) => !excludedIndexes.has(index)),
  };
}

function remapSiscofisRowRecord<T>(
  record: Record<string, T>,
  excludedRowIds: readonly string[]
): Record<string, T> {
  if (excludedRowIds.length === 0) return record;
  const next: Record<string, T> = {};
  for (const [rowId, value] of Object.entries(record)) {
    const remapped = remapEmprovexSiscofisRowIdAfterExclusions(rowId, excludedRowIds);
    if (remapped) next[remapped] = value;
  }
  return next;
}

function WarehouseDataState({ children }: { children: string }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-white/80 p-5 text-sm leading-6 text-slate-600 shadow-sm backdrop-blur-md">
      {children}
    </div>
  );
}

export function WarehouseSiscofisOperational({ workspaceId }: { workspaceId: string }) {
  const [context, setContext] = useState<WarehouseSiscofisContext | null>(null);
  const [draftInventory, setDraftInventory] = useState<EmprovexSiscofisInventory | null>(null);
  const [preview, setPreview] = useState<WarehouseSiscofisPreview | null>(null);
  const [issues, setIssues] = useState<WarehouseSiscofisIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewDirty, setPreviewDirty] = useState(false);
  const [materialOverrides, setMaterialOverrides] = useState<Record<string, string>>({});
  const [editedRows, setEditedRows] = useState<Record<string, boolean>>({});
  const [pdfSummary, setPdfSummary] = useState<SiscofisPdfSummary | null>(null);
  const [draftSourceLabel, setDraftSourceLabel] = useState(DEFAULT_SISCOFIS_SOURCE_LABEL);
  const [referenceDate, setReferenceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showValidationDetails, setShowValidationDetails] = useState(false);
  const [excludedPreviewRowIds, setExcludedPreviewRowIds] = useState<string[]>([]);

  const refresh = async () => {
    setLoading(true);
    try {
      setContext(await loadWarehouseSiscofisContext(workspaceId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao carregar o estado do SISCOFIS.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [workspaceId]);

  const resetDraftState = () => {
    setDraftInventory(null);
    setPreview(null);
    setIssues([]);
    setPreviewDirty(false);
    setMaterialOverrides({});
    setEditedRows({});
    setPdfSummary(null);
    setDraftSourceLabel(DEFAULT_SISCOFIS_SOURCE_LABEL);
    setShowValidationDetails(false);
    setExcludedPreviewRowIds([]);
  };

  const importSiscofisPdf = async (file: File) => {
    setWorking(true);
    setMessage(null);
    resetDraftState();

    try {
      if (!file.name.toLocaleLowerCase('pt-BR').endsWith('.pdf')) {
        throw new Error('Selecione um Mapa de Existência em PDF.');
      }
      if (file.size > 15 * 1024 * 1024) {
        throw new Error('O Mapa de Existência deve possuir no máximo 15 MB.');
      }

      const { extractEmprovexSiscofisInventoryFromPdfBytes } = await import(
        '../../../lib/warehouse/siscofisPdf'
      );
      const extraction = extractEmprovexSiscofisInventoryFromPdfBytes(await file.arrayBuffer());
      const nextReferenceDate = extraction.referenceDate || new Date().toISOString().slice(0, 10);
      const sourceLabel = 'Mapa de Existência SISCOFIS — ' + file.name;

      let filteredOtherAccounts = 0;
      let filteredHortifruti = 0;
      let withExpiryRows = 0;
      for (const item of extraction.inventory.items) {
        const exclusion = classifyEmprovexSiscofisSourceItem(item);
        if (exclusion === 'NON_ACCOUNT_07') {
          filteredOtherAccounts += 1;
          continue;
        }
        if (exclusion === 'FRESH_HORTIFRUTI') {
          filteredHortifruti += 1;
          continue;
        }
        if (item.validade) withExpiryRows += 1;
      }

      const eligibleRows =
        extraction.inventory.items.length - filteredOtherAccounts - filteredHortifruti;

      setDraftInventory(extraction.inventory);
      setDraftSourceLabel(sourceLabel);
      setReferenceDate(nextReferenceDate);
      setPdfSummary({
        fileName: file.name,
        pageCount: extraction.pageCount,
        detectedRows: extraction.detectedRows,
        zeroQuantityRows: extraction.zeroQuantityRows,
        invalidRows: extraction.invalidRows,
        eligibleRows,
        filteredOtherAccounts,
        filteredHortifruti,
        withExpiryRows,
        withoutExpiryRows: Math.max(0, eligibleRows - withExpiryRows),
      });

      const nextPreview = await prepareEmprovexSiscofisInventoryData(
        workspaceId,
        extraction.inventory,
        nextReferenceDate,
        sourceLabel,
        {}
      );
      setPreview(nextPreview);
      setIssues(nextPreview.issues);
      setMessage(
        eligibleRows
          + ' item(ns) elegível(is) preparados a partir do Mapa de Existência. Revise o Marco Zero antes de confirmar.'
      );
    } catch (error) {
      const candidate = error as Error & { issues?: WarehouseSiscofisIssue[] };
      setIssues(candidate.issues || []);
      setMessage(candidate.message || 'Não foi possível ler o Mapa de Existência.');
    } finally {
      setWorking(false);
    }
  };

  const revalidateImport = async () => {
    if (!draftInventory) return;
    setWorking(true);
    setMessage(null);
    setIssues([]);
    setShowValidationDetails(false);

    try {
      const exclusions = [...excludedPreviewRowIds];
      const nextInventory = filterSiscofisDraftRows(draftInventory, exclusions);
      const nextOverrides = remapSiscofisRowRecord(materialOverrides, exclusions);
      const nextEditedRows = remapSiscofisRowRecord(editedRows, exclusions);

      const nextPreview = await prepareEmprovexSiscofisInventoryData(
        workspaceId,
        nextInventory,
        referenceDate,
        draftSourceLabel,
        nextOverrides
      );

      setDraftInventory(nextInventory);
      setMaterialOverrides(nextOverrides);
      setEditedRows(nextEditedRows);
      setExcludedPreviewRowIds([]);
      setPreview(nextPreview);
      setPreviewDirty(false);
      setIssues(nextPreview.issues);
      setMessage(
        exclusions.length > 0
          ? exclusions.length + ' item(ns) retirado(s) do Marco Zero. A prévia foi revalidada.'
          : 'Alterações revalidadas com sucesso.'
      );
    } catch (error) {
      const candidate = error as Error & { issues?: WarehouseSiscofisIssue[] };
      setIssues(candidate.issues || []);
      setMessage(candidate.message || 'Não foi possível revalidar o Mapa de Existência.');
    } finally {
      setWorking(false);
    }
  };

  const confirmImport = async () => {
    if (!preview?.canConfirm || previewDirty) return;
    setWorking(true);
    setMessage(null);
    try {
      const stored = await confirmWarehouseSiscofisImport(workspaceId, preview);
      setMessage(
        stored.kind === 'MARCO_ZERO'
          ? 'Marco Zero confirmado e registrado no ledger.'
          : 'Snapshot SISCOFIS confirmado sem alteração automática do estoque.'
      );
      resetDraftState();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao confirmar a importação.');
    } finally {
      setWorking(false);
    }
  };

  const editPreviewItem = (
    rowId: string,
    field: 'numeroItem' | 'descricao' | 'quantidade' | 'valorUnitario' | 'validade',
    value: string
  ) => {
    if (!draftInventory) return;
    const sourceIndex = emprovexSiscofisSourceIndexFromRowId(rowId);
    if (sourceIndex === null || !draftInventory.items[sourceIndex]) return;

    const items = draftInventory.items.map((item, index) => {
      if (index !== sourceIndex) return item;
      if (field === 'quantidade' || field === 'valorUnitario') {
        return { ...item, [field]: Number(value.replace(',', '.')) };
      }
      if (field === 'validade') {
        return { ...item, validade: value || null };
      }
      return { ...item, [field]: value };
    });

    setDraftInventory({ ...draftInventory, items });
    setPreviewDirty(true);
    setEditedRows((current) => ({ ...current, [rowId]: true }));
    setMessage('Prévia alterada. Revalide antes de confirmar o Marco Zero.');
  };

  const excludePreviewRow = (rowId: string) => {
    if (preview?.kind !== 'MARCO_ZERO') return;
    setExcludedPreviewRowIds((current) =>
      current.includes(rowId) ? current : [...current, rowId]
    );
    setPreviewDirty(true);
    setMessage(
      'Item marcado para não importar. Revalide antes de confirmar o Marco Zero.'
    );
  };

  const undoPreviewExclusions = () => {
    setExcludedPreviewRowIds([]);
    setPreviewDirty(true);
    setMessage('Exclusões desfeitas. Revalide a prévia antes de confirmar.');
  };

  const selectCanonicalMaterial = (rowId: string, materialId: string) => {
    setMaterialOverrides((current) => {
      const next = { ...current };
      if (materialId) next[rowId] = materialId;
      else delete next[rowId];
      return next;
    });
    setPreviewDirty(true);
    setEditedRows((current) => ({ ...current, [rowId]: true }));
    setMessage('Vínculo canônico alterado. Revalide antes de confirmar.');
  };

  const excludedPreviewRowIdSet = new Set(excludedPreviewRowIds);
  const visiblePreviewRows = preview
    ? preview.rows.filter((row) => !excludedPreviewRowIdSet.has(row.rowId))
    : [];

  const validationErrors = issues.filter((issue) => issue.severity === 'error');
  const validationWarnings = issues.filter((issue) => issue.severity === 'warning');
  const warningGroups = Array.from(
    validationWarnings.reduce((groups, issue) => {
      const key = issue.code + '::' + issue.message;
      const current = groups.get(key);
      if (current) {
        current.count += 1;
      } else {
        groups.set(key, { code: issue.code, message: issue.message, count: 1 });
      }
      return groups;
    }, new Map<string, { code: string; message: string; count: number }>())
      .values()
  );

  if (loading && !context) {
    return (
      <div className="mt-6">
        <WarehouseDataState>Carregando estado do SISCOFIS e do Marco Zero…</WarehouseDataState>
      </div>
    );
  }

  return (
    <div
      className="mt-6 space-y-5 text-slate-800"
      data-testid="warehouse-siscofis-operational"
      data-visual-theme="operational-light"
    >
      <section className="rounded-2xl border border-blue-100/80 bg-white/80 p-5 shadow-sm backdrop-blur-md">
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#00288e]/65">
          ADM Depósito · integração de inventário
        </p>
        <h2 className="mt-2 text-xl font-black text-[#00288e]">Migração SISCOFIS</h2>
        <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-600">
          Importe exclusivamente o Mapa de Existência do SISCOFIS. O EMPROVEX lê o PDF localmente,
          filtra a conta 07 e hortifruti/granjeiros, preserva as validades e gera a prévia do Marco Zero.
        </p>
      </section>

      <section
        className="rounded-2xl border border-blue-100/80 bg-white/80 p-5 shadow-sm backdrop-blur-md"
        data-testid="warehouse-siscofis-pdf-direct"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[#00288e]">
              <HardDrive className="h-4 w-4" />
              <p className="text-xs font-black uppercase tracking-[0.12em]">
                Upload do Mapa de Existência
              </p>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              O EMPROVEX lê o Mapa de Existência diretamente no navegador. A quantidade vem de
              Qtde Exist e a validade é capturada da coluna Validade antes da geração da prévia.
            </p>
          </div>

          <label className={[
            'inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-4 text-xs font-black transition',
            working
              ? 'pointer-events-none border-slate-200 bg-slate-100 text-slate-400'
              : 'border-[#00288e] bg-[#00288e] text-white shadow-sm hover:bg-[#001f70]',
          ].join(' ')}>
            <FileUp className="h-4 w-4" />
            {working ? 'Processando…' : 'Selecionar Mapa de Existência'}
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              data-testid="warehouse-siscofis-pdf-input"
              disabled={working}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = '';
                if (file) void importSiscofisPdf(file);
              }}
            />
          </label>
        </div>

        {pdfSummary && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Arquivo</p>
              <p className="mt-1 truncate text-xs font-black text-slate-800">{pdfSummary.fileName}</p>
              <p className="mt-1 text-[10px] text-slate-500">
                {pdfSummary.pageCount} pág. · {pdfSummary.detectedRows} linha(s)
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">Elegíveis</p>
              <p className="mt-1 text-lg font-black text-emerald-800">{pdfSummary.eligibleRows}</p>
              <p className="text-[10px] text-slate-500">seguem para a prévia</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#00288e]">Validade</p>
              <p className="mt-1 text-sm font-black text-slate-800">{pdfSummary.withExpiryRows} informada(s)</p>
              <p className="text-[10px] text-slate-500">{pdfSummary.withoutExpiryRows} sem validade</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-amber-700">Filtrados</p>
              <p className="mt-1 text-xs font-bold text-slate-800">
                {pdfSummary.filteredOtherAccounts} outra(s) conta(s)
              </p>
              <p className="mt-1 text-xs font-bold text-slate-800">
                {pdfSummary.filteredHortifruti} hortifruti/granjeiro(s)
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Leitura</p>
              <p className="mt-1 text-xs font-bold text-slate-800">
                {pdfSummary.zeroQuantityRows} saldo zero ignorado(s)
              </p>
              <p className="mt-1 text-xs font-bold text-slate-800">
                {pdfSummary.invalidRows} linha(s) incompleta(s)
              </p>
            </div>
          </div>
        )}
      </section>

      {issues.length > 0 && (
        <section
          className={[
            'rounded-2xl border p-5',
            validationErrors.length > 0
              ? 'border-rose-200 bg-rose-50'
              : 'border-amber-200 bg-amber-50',
          ].join(' ')}
          data-testid="warehouse-siscofis-validation-summary"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className={[
                'flex items-center gap-2',
                validationErrors.length > 0 ? 'text-rose-800' : 'text-amber-800',
              ].join(' ')}>
                <AlertTriangle className="h-4 w-4" />
                <p className="text-xs font-black uppercase tracking-[0.12em]">Validação</p>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                {validationErrors.length > 0
                  ? validationErrors.length + ' erro(s) bloqueiam a confirmação.'
                  : 'Nenhum erro bloqueante.'}
                {validationWarnings.length > 0
                  ? ' ' + validationWarnings.length + ' aviso(s) agrupados.'
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {validationErrors.length > 0 && (
                <span className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[10px] font-black text-rose-700">
                  {validationErrors.length} erro(s)
                </span>
              )}
              {validationWarnings.length > 0 && (
                <span className="rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-black text-amber-800">
                  {validationWarnings.length} aviso(s)
                </span>
              )}
            </div>
          </div>

          {validationErrors.length > 0 && (
            <div className="mt-4 space-y-2">
              {validationErrors.map((issue, index) => (
                <div
                  key={issue.code + issue.path + index}
                  className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs text-slate-700"
                >
                  <span className="font-black text-rose-700">Erro</span>
                  {' · '}{issue.path}{' · '}{issue.message}
                </div>
              ))}
            </div>
          )}

          {warningGroups.length > 0 && (
            <div className="mt-4 space-y-2">
              {!showValidationDetails && warningGroups.slice(0, 4).map((group) => (
                <div
                  key={group.code + group.message}
                  className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-slate-700 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span><span className="font-black text-amber-800">Aviso</span>{' · '}{group.message}</span>
                  <span className="shrink-0 text-[10px] font-black text-amber-700">
                    {group.count} ocorrência(s)
                  </span>
                </div>
              ))}

              {showValidationDetails && validationWarnings.map((issue, index) => (
                <div
                  key={issue.code + issue.path + index}
                  className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-slate-700"
                >
                  <span className="font-black text-amber-800">Aviso</span>
                  {' · '}{issue.path}{' · '}{issue.message}
                </div>
              ))}

              {(validationWarnings.length > 1 || warningGroups.length > 4) && (
                <button
                  type="button"
                  onClick={() => setShowValidationDetails((current) => !current)}
                  className="mt-1 inline-flex h-8 items-center rounded-lg border border-amber-300 bg-white px-3 text-[10px] font-black text-amber-800 transition hover:bg-amber-50"
                  data-testid="warehouse-siscofis-validation-toggle"
                >
                  {showValidationDetails
                    ? 'Recolher detalhes'
                    : 'Ver detalhes dos ' + validationWarnings.length + ' avisos'}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {preview && (
        <section
          className="rounded-2xl border border-blue-100 bg-white/85 p-5 shadow-sm backdrop-blur-md"
          data-testid="warehouse-siscofis-preview"
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#00288e]/70">
                Prévia · {preview.kind === 'MARCO_ZERO' ? 'Marco Zero' : 'Snapshot'}
              </p>
              <p className="mt-2 text-sm font-black text-slate-900">
                {visiblePreviewRows.length} linha(s) na relação · {preview.summary.createsMaterials} novo(s) ·{' '}
                {preview.summary.unresolvedRows} sem vínculo · {preview.summary.divergentRows} divergente(s)
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
                <span>{validationErrors.length} erro(s) · {validationWarnings.length} aviso(s)</span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  Data-base {formatDate(preview.import.referenceDate)}
                </span>
              </div>

              {previewDirty && (
                <p className="mt-2 text-[10px] font-bold text-amber-700">
                  Há alterações ainda não revalidadas. A confirmação permanece bloqueada.
                </p>
              )}

              {excludedPreviewRowIds.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <span className="text-[10px] font-black text-amber-800">
                    {excludedPreviewRowIds.length} item(ns) marcado(s) para não importar.
                  </span>
                  <button
                    type="button"
                    onClick={undoPreviewExclusions}
                    className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[10px] font-black text-amber-800 hover:bg-amber-50"
                    data-testid="warehouse-siscofis-preview-undo-exclusions"
                  >
                    Desfazer exclusões
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {previewDirty && (
                <button
                  type="button"
                  onClick={() => void revalidateImport()}
                  disabled={working || !draftInventory}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#00288e] bg-white px-4 text-xs font-black text-[#00288e] transition hover:bg-blue-50 disabled:opacity-40"
                  data-testid="warehouse-siscofis-revalidate"
                >
                  <RefreshCw className={working ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
                  Revalidar alterações
                </button>
              )}
              <button
                type="button"
                onClick={() => void confirmImport()}
                disabled={working || !preview.canConfirm || previewDirty}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#001f70] disabled:opacity-40"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {preview.kind === 'MARCO_ZERO' ? 'Confirmar Marco Zero' : 'Salvar snapshot'}
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[1080px] w-full text-left text-xs">
              <thead className="bg-slate-50 text-[9px] uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="p-3">Nº Ficha</th>
                  <th className="p-3">Material</th>
                  <th className="p-3">Qtd.</th>
                  <th className="p-3">Validade</th>
                  <th className="p-3">Valor unit.</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Vínculo</th>
                  <th className="p-3">Estado</th>
                  {preview.kind === 'MARCO_ZERO' && <th className="p-3 text-right">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visiblePreviewRows.map((row) => {
                  const source = preview.import.rows.find((item) => item.rowId === row.rowId);
                  return (
                    <tr key={preview.sourceHash + row.rowId}>
                      <td className="p-2">
                        <input
                          defaultValue={row.sourceItemNumber || ''}
                          onChange={(event) => editPreviewItem(row.rowId, 'numeroItem', event.target.value)}
                          className="h-9 w-28 rounded-lg border border-slate-200 bg-white px-2 font-mono text-xs text-slate-800 outline-none focus:border-[#00288e]"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          defaultValue={row.description}
                          onChange={(event) => editPreviewItem(row.rowId, 'descricao', event.target.value)}
                          className="h-9 min-w-[280px] w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-800 outline-none focus:border-[#00288e]"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          defaultValue={String(row.siscofisQuantity)}
                          onChange={(event) => editPreviewItem(row.rowId, 'quantidade', event.target.value)}
                          inputMode="decimal"
                          className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-[#00288e]"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="date"
                          defaultValue={row.expiresOn || ''}
                          onChange={(event) => editPreviewItem(row.rowId, 'validade', event.target.value)}
                          className="h-9 w-36 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-[#00288e]"
                          title={row.expiresOn ? 'Validade ' + formatDate(row.expiresOn) : 'Validade não informada'}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          defaultValue={String(source?.unitValue ?? 0)}
                          onChange={(event) => editPreviewItem(row.rowId, 'valorUnitario', event.target.value)}
                          inputMode="decimal"
                          className="h-9 w-28 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-[#00288e]"
                        />
                      </td>
                      <td className="p-3 text-slate-600">
                        {source?.totalValue?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}
                      </td>
                      <td className="p-2">
                        {row.createsMaterial ? (
                          <span className="text-[10px] font-bold text-[#00288e]">Novo material</span>
                        ) : (
                          <select
                            value={
                              materialOverrides[row.rowId]
                              || (preview.materialOptions.some((option) => option.id === row.materialId)
                                ? row.materialId || ''
                                : '')
                            }
                            onChange={(event) => selectCanonicalMaterial(row.rowId, event.target.value)}
                            className="h-9 max-w-[260px] rounded-lg border border-slate-200 bg-white px-2 text-[10px] text-slate-800 outline-none focus:border-[#00288e]"
                          >
                            <option value="">
                              {row.materialId ? 'Vínculo automático' : 'Selecione o material'}
                            </option>
                            {preview.materialOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.description} · {option.unit.code}
                                {option.unit.label ? ' / ' + option.unit.label : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="p-3 text-slate-600">
                        {row.state}
                        {editedRows[row.rowId] ? ' · corrigida' : ''}
                        {previewDirty ? ' · revalidar' : ''}
                      </td>
                      {preview.kind === 'MARCO_ZERO' && (
                        <td className="p-2 text-right">
                          <button
                            type="button"
                            onClick={() => excludePreviewRow(row.rowId)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 text-[10px] font-black text-rose-700 transition hover:bg-rose-50"
                            title="Retira apenas desta relação de migração; não exclui material, NF ou estoque."
                            data-testid="warehouse-siscofis-preview-exclude"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Não importar
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {visiblePreviewRows.length === 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
              Nenhum item permaneceu na relação. Desfaça exclusões ou selecione outro Mapa de Existência.
            </div>
          )}
        </section>
      )}

      {message && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-slate-700">
          {message}
        </div>
      )}

    </div>
  );
}
