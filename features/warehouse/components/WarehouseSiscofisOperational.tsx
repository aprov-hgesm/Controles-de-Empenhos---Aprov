'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  FileJson2,
  FileUp,
  HardDrive,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import {
  EMPROVEX_SISCOFIS_INVENTORY_SCHEMA_VERSION,
  WAREHOUSE_SISCOFIS_SNAPSHOT_SCHEMA_VERSION,
  classifyEmprovexSiscofisSourceItem,
  type WarehouseSiscofisIssue,
  type WarehouseSiscofisPreview,
} from '../../../lib/warehouse/siscofis';
import {
  confirmWarehouseSiscofisImport,
  loadWarehouseSiscofisContext,
  prepareEmprovexSiscofisInventoryImport,
  type WarehouseSiscofisContext,
} from '../../../lib/warehouse/siscofisService';

function ContractCard({ title, code, description }: { title: string; code: string; description: string }) {
  return (
    <div className="rounded-2xl border border-blue-100/80 bg-white/80 p-4 shadow-sm backdrop-blur-md sm:p-5">
      <p className="text-xs font-black text-slate-900">{title}</p>
      <code className="mt-3 block w-fit rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-bold text-[#00288e]">{code}</code>
      <p className="mt-3 text-xs leading-5 text-slate-600">{description}</p>
    </div>
  );
}

function WarehouseDataState({ children }: { children: string }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-white/80 p-5 text-sm leading-6 text-slate-600 shadow-sm backdrop-blur-md">
      {children}
    </div>
  );
}

type SiscofisPdfSummary = {
  fileName: string;
  pageCount: number;
  detectedRows: number;
  zeroQuantityRows: number;
  invalidRows: number;
  eligibleRows: number;
  filteredOtherAccounts: number;
  filteredHortifruti: number;
};

const DEFAULT_SISCOFIS_SOURCE_LABEL = 'Inventário SISCOFIS — Migração inicial';

export function WarehouseSiscofisOperational({ workspaceId }: { workspaceId: string }) {
  const [context, setContext] = useState<WarehouseSiscofisContext | null>(null);
  const [rawJson, setRawJson] = useState('');
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
  const [manualNumeroItem, setManualNumeroItem] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualQuantity, setManualQuantity] = useState('');
  const [manualUnitValue, setManualUnitValue] = useState('');
  const [manualReferenceDate, setManualReferenceDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  const refresh = async () => {
    setLoading(true);
    try {
      setContext(await loadWarehouseSiscofisContext(workspaceId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao carregar a conciliação SISCOFIS.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [workspaceId]);

  const importSiscofisPdf = async (file: File) => {
    setWorking(true);
    setMessage(null);
    setPreview(null);
    setIssues([]);
    setPreviewDirty(false);
    setMaterialOverrides({});
    setEditedRows({});

    try {
      if (!file.name.toLocaleLowerCase('pt-BR').endsWith('.pdf')) {
        throw new Error('Selecione um arquivo PDF emitido pelo SISCOFIS.');
      }
      if (file.size > 15 * 1024 * 1024) {
        throw new Error('O PDF SISCOFIS deve possuir no máximo 15 MB.');
      }

      const { extractEmprovexSiscofisInventoryFromPdfBytes } = await import(
        '../../../lib/warehouse/siscofisPdf'
      );
      const extraction = extractEmprovexSiscofisInventoryFromPdfBytes(await file.arrayBuffer());
      const nextRawJson = JSON.stringify(extraction.inventory, null, 2);
      const referenceDate = extraction.referenceDate || manualReferenceDate;
      const sourceLabel = 'PDF SISCOFIS — ' + file.name;

      let filteredOtherAccounts = 0;
      let filteredHortifruti = 0;
      for (const item of extraction.inventory.items) {
        const exclusion = classifyEmprovexSiscofisSourceItem(item);
        if (exclusion === 'NON_ACCOUNT_07') filteredOtherAccounts += 1;
        if (exclusion === 'FRESH_HORTIFRUTI') filteredHortifruti += 1;
      }
      const eligibleRows =
        extraction.inventory.items.length - filteredOtherAccounts - filteredHortifruti;

      setRawJson(nextRawJson);
      setDraftSourceLabel(sourceLabel);
      if (extraction.referenceDate) setManualReferenceDate(extraction.referenceDate);
      setPdfSummary({
        fileName: file.name,
        pageCount: extraction.pageCount,
        detectedRows: extraction.detectedRows,
        zeroQuantityRows: extraction.zeroQuantityRows,
        invalidRows: extraction.invalidRows,
        eligibleRows,
        filteredOtherAccounts,
        filteredHortifruti,
      });

      const nextPreview = await prepareEmprovexSiscofisInventoryImport(
        workspaceId,
        nextRawJson,
        referenceDate,
        sourceLabel,
        {}
      );
      setPreview(nextPreview);
      setIssues(nextPreview.issues);
      setMessage(
        eligibleRows
          + ' linha(s) elegível(is) preparadas localmente a partir do PDF. Revise a prévia antes de confirmar.'
      );
    } catch (error) {
      const candidate = error as Error & { issues?: WarehouseSiscofisIssue[] };
      setPdfSummary(null);
      setIssues(candidate.issues || []);
      setMessage(
        candidate.issues?.length
          ? 'O PDF foi lido, mas a prévia possui pendências que impedem a confirmação.'
          : candidate.message || 'Não foi possível ler o PDF SISCOFIS localmente.'
      );
    } finally {
      setWorking(false);
    }
  };

  const validateImport = async () => {
    setWorking(true);
    setMessage(null);
    setPreview(null);
    setIssues([]);
    try {
      const nextPreview = await prepareEmprovexSiscofisInventoryImport(
        workspaceId,
        rawJson,
        manualReferenceDate,
        draftSourceLabel,
        materialOverrides
      );
      setPreview(nextPreview);
      setPreviewDirty(false);
      setIssues(nextPreview.issues);
    } catch (error) {
      const candidate = error as Error & { issues?: WarehouseSiscofisIssue[] };
      setIssues(candidate.issues || []);
      setMessage(candidate.issues?.length ? 'O JSON possui pendências que impedem a confirmação.' : candidate.message);
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
          : 'Snapshot salvo. Nenhuma alteração automática foi feita no estoque.'
      );
      setPreview(null);
      setPreviewDirty(false);
      setMaterialOverrides({});
      setEditedRows({});
      setRawJson('');
      setPdfSummary(null);
      setDraftSourceLabel(DEFAULT_SISCOFIS_SOURCE_LABEL);
      setIssues([]);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao confirmar a importação.');
    } finally {
      setWorking(false);
    }
  };

  const copyPrompt = async () => {
    if (!context?.prompt) return;
    try {
      await navigator.clipboard.writeText(context.prompt);
      setMessage('Prompt oficial copiado. Use-o em uma IA externa junto com o relatório SISCOFIS.');
    } catch {
      setMessage('Não foi possível copiar automaticamente. Selecione o prompt e copie manualmente.');
    }
  };

  const prepareManualRow = () => {
    const quantity = Number(manualQuantity.replace(',', '.'));
    const unitValue = Number(manualUnitValue.replace(/\./g, '').replace(',', '.'));
    if (!manualNumeroItem.trim() || !manualDescription.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitValue) || unitValue < 0) {
      setMessage('Informe Nº Ficha, descrição, quantidade maior que zero e valor unitário válido.');
      return;
    }
    let currentItems: unknown[] = [];
    try {
      const parsed = rawJson.trim() ? JSON.parse(rawJson) : null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray((parsed as { items?: unknown[] }).items)) {
        currentItems = (parsed as { items: unknown[] }).items;
      }
    } catch { currentItems = []; }
    setRawJson(JSON.stringify({
      schemaVersion: EMPROVEX_SISCOFIS_INVENTORY_SCHEMA_VERSION,
      items: [...currentItems, { numeroItem: manualNumeroItem.trim(), descricao: manualDescription.trim(), quantidade: quantity, valorUnitario: unitValue }],
    }, null, 2));
    setManualNumeroItem(''); setManualDescription(''); setManualQuantity(''); setManualUnitValue('');
    setPreview(null); setPreviewDirty(false); setIssues([]);
    setMessage('Linha adicionada ao mesmo draft oficial. Revise e valide antes de confirmar.');
  };

  const editPreviewItem = (
    index: number,
    field: 'numeroItem' | 'descricao' | 'quantidade' | 'valorUnitario',
    value: string
  ) => {
    try {
      const parsed = JSON.parse(rawJson) as {
        schemaVersion?: string;
        items?: Array<Record<string, unknown>>;
      };
      if (!parsed || !Array.isArray(parsed.items) || !parsed.items[index]) return;
      const nextItems = parsed.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const nextValue = field === 'quantidade' || field === 'valorUnitario'
          ? Number(value.replace(',', '.'))
          : value;
        return { ...item, [field]: nextValue };
      });
      setRawJson(JSON.stringify({ ...parsed, items: nextItems }, null, 2));
      setPreviewDirty(true);
      const editedRowId = preview?.rows[index]?.rowId;
      if (editedRowId) setEditedRows((current) => ({ ...current, [editedRowId]: true }));
      setMessage('Prévia alterada manualmente. Revalide antes de confirmar.');
    } catch {
      setMessage('Não foi possível aplicar a edição à origem JSON. Revise o conteúdo colado.');
    }
  };

  const clearDraft = () => {
    setRawJson('');
    setPdfSummary(null);
    setDraftSourceLabel(DEFAULT_SISCOFIS_SOURCE_LABEL);
    setPreview(null);
    setPreviewDirty(false);
    setMaterialOverrides({});
    setEditedRows({});
    setIssues([]);
    setMessage('Rascunho limpo.');
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


  if (loading && !context) {
    return <div className="mt-6"><WarehouseDataState>Carregando estado do SISCOFIS e do Marco Zero…</WarehouseDataState></div>;
  }

  return (
    <div className="mt-6 space-y-5 text-slate-800" data-testid="warehouse-siscofis-operational" data-visual-theme="operational-light">
      <section className="rounded-2xl border border-blue-100/80 bg-white/80 p-5 shadow-sm backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#00288e]/65">
              ADM Depósito · integração de inventário
            </p>
            <h2 className="mt-2 text-xl font-black text-[#00288e]">Migração SISCOFIS</h2>
            <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-600">
              Importe o inventário inicial, revise os itens elegíveis e confirme o Marco Zero com
              rastreabilidade. PDF direto, JSON e inclusão manual convergem para a mesma validação.
            </p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 lg:max-w-sm">
            <div className="flex items-center gap-2 text-[#00288e]">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.12em]">Processo auditável</p>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-slate-600">
              Nenhuma prévia altera estoque. O saldo só é registrado após confirmação explícita.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <ContractCard title="Contrato de importação" code={EMPROVEX_SISCOFIS_INVENTORY_SCHEMA_VERSION} description="PDF direto, migração manual e JSON usam o mesmo contrato versionado e passam pela mesma validação." />
        <ContractCard title="Snapshot auditável" code={WAREHOUSE_SISCOFIS_SNAPSHOT_SCHEMA_VERSION} description="Marco Zero e conciliações ficam no namespace logístico. Snapshots posteriores não alteram saldo automaticamente." />
      </div>

      <div
        className="rounded-2xl border border-blue-100/80 bg-white/80 p-5 shadow-sm backdrop-blur-md"
        data-testid="warehouse-siscofis-pdf-direct"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[#00288e]">
              <HardDrive className="h-4 w-4" />
              <p className="text-xs font-black uppercase tracking-[0.12em]">
                PDF SISCOFIS direto · sem IA
              </p>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Leitura determinística no próprio navegador. O PDF não é enviado para IA nem para serviço
              externo. O EMPROVEX lê o Mapa de Existência, usa Qtde Exist, restringe a conta 07 e aplica
              novamente o filtro de hortifruti/granjeiros antes da prévia.
            </p>
            <p className="mt-2 text-[10px] leading-4 text-slate-600">
              Compatível com o Mapa de Existência - Material de Consumo textual do SISCOFIS. PDFs
              escaneados, protegidos ou com estrutura diferente permanecem disponíveis pelo fluxo
              JSON/IA abaixo.
            </p>
          </div>

          <label className={[
            'inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-4 text-xs font-black transition',
            working
              ? 'pointer-events-none border-slate-200 bg-slate-100 text-slate-600'
              : 'border-[#00288e] bg-[#00288e] text-white shadow-sm hover:bg-[#001f70]',
          ].join(' ')}>
            <FileUp className="h-4 w-4" />
            {working ? 'Processando…' : 'Selecionar PDF SISCOFIS'}
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
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-600">Arquivo</p>
              <p className="mt-1 truncate text-xs font-bold text-slate-800">{pdfSummary.fileName}</p>
              <p className="mt-1 text-[10px] text-slate-600">{pdfSummary.pageCount} página(s) · {pdfSummary.detectedRows} linha(s) detectada(s)</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">Elegíveis</p>
              <p className="mt-1 text-lg font-black text-emerald-800">{pdfSummary.eligibleRows}</p>
              <p className="text-[10px] text-slate-600">seguem para a prévia oficial</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-amber-700">Filtrados</p>
              <p className="mt-1 text-xs font-bold text-slate-800">{pdfSummary.filteredOtherAccounts} outra(s) conta(s)</p>
              <p className="mt-1 text-xs font-bold text-slate-800">{pdfSummary.filteredHortifruti} hortifruti/granjeiro(s)</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-600">Leitura física</p>
              <p className="mt-1 text-xs font-bold text-slate-800">{pdfSummary.zeroQuantityRows} saldo zero ignorado(s)</p>
              <p className="mt-1 text-xs font-bold text-slate-800">{pdfSummary.invalidRows} linha(s) incompleta(s)</p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-md">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-800">Migração manual de item</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">Para inventários pequenos ou correções de digitação. A linha manual é convertida para o mesmo JSON auditável antes da confirmação.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-[0.7fr_minmax(0,1.7fr)_0.7fr_0.8fr_0.8fr_auto]">
          <input value={manualNumeroItem} onChange={(e) => setManualNumeroItem(e.target.value)} placeholder="Nº Ficha" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#00288e]" />
          <input value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} placeholder="Descrição" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#00288e]" />
          <input value={manualQuantity} onChange={(e) => setManualQuantity(e.target.value)} inputMode="decimal" placeholder="Quantidade" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#00288e]" />
          <input value={manualUnitValue} onChange={(e) => setManualUnitValue(e.target.value)} inputMode="decimal" placeholder="Valor unitário" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#00288e]" />
          <input type="date" value={manualReferenceDate} onChange={(e) => { setManualReferenceDate(e.target.value); if (preview) setPreviewDirty(true); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-[#00288e]" />
          <button type="button" onClick={prepareManualRow} className="h-10 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#001f70]">Adicionar</button>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#00288e]"><FileJson2 className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.12em]">Prompt para IA externa</p></div>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-600">Use o prompt com o relatório SISCOFIS. A IA devolve apenas JSON; o EMPROVEX valida antes de qualquer confirmação.</p>
          </div>
          <button type="button" onClick={copyPrompt} disabled={!context?.prompt} className="inline-flex h-9 items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 text-xs font-black text-[#00288e] shadow-sm transition hover:bg-blue-50 disabled:opacity-40">
            <Clipboard className="h-3.5 w-3.5" /> Copiar prompt
          </button>
        </div>
        <textarea readOnly value={context?.prompt || ''} className="mt-4 h-36 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 font-mono text-[10px] leading-5 text-slate-700 outline-none focus:border-[#00288e]" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-2 text-[#00288e]"><FileJson2 className="h-4 w-4 text-[#00288e]" /><p className="text-xs font-black uppercase tracking-[0.12em]">JSON / linha manual preparada</p></div>
        <textarea value={rawJson} onChange={(event) => { setRawJson(event.target.value); if (preview) setPreviewDirty(true); }} data-testid="warehouse-siscofis-json" placeholder={'{\n  "schemaVersion": "emprovex_siscofis_inventory_v1",\n  "items": [...]\n}'} className="mt-4 h-56 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-5 text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#00288e]" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={validateImport} disabled={working || !rawJson.trim()} data-testid="warehouse-siscofis-validate" className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#001f70] disabled:opacity-40">
            {working ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {previewDirty ? 'Revalidar alterações' : 'Validar e gerar prévia'}
          </button>
          <button type="button" onClick={clearDraft} disabled={working || !rawJson.trim()} className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40">Limpar</button>
          <span className="text-[10px] text-slate-600">Modo: {context?.hasMarcoZero ? 'snapshot de conciliação' : 'Marco Zero inicial'}</span>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 text-amber-800"><AlertTriangle className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.12em]">Validação</p></div>
          <div className="mt-3 space-y-2">
            {issues.map((issue, index) => (
              <div key={issue.code + issue.path + index} className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
                <span className={issue.severity === 'error' ? 'font-bold text-rose-700' : 'font-bold text-amber-800'}>{issue.severity === 'error' ? 'Erro' : 'Aviso'}</span>
                {' · '}{issue.path}{' · '}{issue.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {preview && (
        <div className="rounded-2xl border border-blue-100 bg-white/85 p-5 shadow-sm backdrop-blur-md" data-testid="warehouse-siscofis-preview">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#00288e]/70">Prévia · {preview.kind === 'MARCO_ZERO' ? 'Marco Zero' : 'Snapshot'}</p>
              <p className="mt-2 text-sm font-black text-slate-900">{preview.summary.totalRows} linha(s) · {preview.summary.createsMaterials} novo(s) · {preview.summary.unresolvedRows} sem vínculo · {preview.summary.divergentRows} divergente(s)</p>
              <p className="mt-1 text-[10px] text-slate-500">{issues.filter((item) => item.severity === 'error').length} erro(s) · {issues.filter((item) => item.severity === 'warning').length} aviso(s) · valor total {preview.import.rows.reduce((sum, row) => sum + (row.totalValue || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · {Object.keys(editedRows).length} corrigida(s) · data-base {preview.import.referenceDate}</p>
              {previewDirty && <p className="mt-2 text-[10px] font-bold text-amber-700">Há correções manuais ainda não revalidadas. A confirmação permanece bloqueada.</p>}
            </div>
            <button type="button" onClick={confirmImport} disabled={working || !preview.canConfirm || previewDirty} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#001f70] disabled:opacity-40">
              <ShieldCheck className="h-3.5 w-3.5" /> {preview.kind === 'MARCO_ZERO' ? 'Confirmar Marco Zero' : 'Salvar snapshot'}
            </button>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[760px] w-full text-left text-xs">
              <thead className="bg-slate-50 text-[9px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="p-3">Nº Ficha</th><th className="p-3">Material</th><th className="p-3">Qtd.</th><th className="p-3">Valor unit.</th><th className="p-3">Total</th><th className="p-3">Vínculo</th><th className="p-3">Estado</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {preview.rows.map((row, index) => { const source = preview.import.rows.find((item) => item.rowId === row.rowId); return <tr key={preview.sourceHash + row.rowId}>
                  <td className="p-2"><input defaultValue={row.sourceItemNumber || ''} onChange={(event) => editPreviewItem(index, 'numeroItem', event.target.value)} className="h-9 w-28 rounded-lg border border-slate-200 bg-white px-2 font-mono text-xs text-slate-800 outline-none focus:border-[#00288e]" /></td>
                  <td className="p-2"><input defaultValue={row.description} onChange={(event) => editPreviewItem(index, 'descricao', event.target.value)} className="h-9 min-w-[280px] w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-800 outline-none focus:border-[#00288e]" /></td>
                  <td className="p-2"><input defaultValue={String(row.siscofisQuantity)} onChange={(event) => editPreviewItem(index, 'quantidade', event.target.value)} inputMode="decimal" className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-[#00288e]" /></td>
                  <td className="p-2"><input defaultValue={String(source?.unitValue ?? 0)} onChange={(event) => editPreviewItem(index, 'valorUnitario', event.target.value)} inputMode="decimal" className="h-9 w-28 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800" /></td>
                  <td className="p-3 text-slate-600">{source?.totalValue?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00"}</td>
                  <td className="p-2">
                    {row.createsMaterial ? (
                      <span className="text-[10px] font-bold text-[#00288e]">Novo material</span>
                    ) : (
                      <select
                        value={materialOverrides[row.rowId] || (preview.materialOptions.some((option) => option.id === row.materialId) ? row.materialId || '' : '')}
                        onChange={(event) => selectCanonicalMaterial(row.rowId, event.target.value)}
                        className="h-9 max-w-[260px] rounded-lg border border-slate-200 bg-white px-2 text-[10px] text-slate-800 outline-none focus:border-[#00288e]"
                      >
                        <option value="">{row.materialId ? 'Vínculo automático' : 'Selecione o material'}</option>
                        {preview.materialOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.description} · {option.unit.code}{option.unit.label ? ' / ' + option.unit.label : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="p-3 text-slate-600">{row.state}{editedRows[row.rowId] ? ' · corrigida' : ''}{previewDirty ? ' · revalidar' : ''}</td>
                </tr>; })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {message && <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-800">{message}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-slate-900">Histórico SISCOFIS</p><p className="mt-1 text-[10px] text-slate-500">Leitura sob demanda · até 12 registros</p></div><button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-lg border border-slate-200 bg-white p-2 text-[#00288e] transition hover:bg-blue-50"><RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /></button></div>
        {!context?.snapshots.length ? <p className="mt-4 text-xs text-slate-500">Nenhum Marco Zero confirmado.</p> : <div className="mt-4 space-y-2">{context.snapshots.map((snapshot) => <div key={snapshot.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"><p className="text-xs font-bold text-slate-800">{snapshot.kind === 'MARCO_ZERO' ? 'Marco Zero' : 'Snapshot'} · {snapshot.referenceDate}</p><p className="mt-1 text-[10px] text-slate-600">{snapshot.sourceLabel} · {snapshot.status}</p></div>)}</div>}
      </div>
    </div>
  );
}
