'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  FileJson2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import {
  EMPROVEX_SISCOFIS_INVENTORY_SCHEMA_VERSION,
  WAREHOUSE_SISCOFIS_SNAPSHOT_SCHEMA_VERSION,
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
    <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-4 sm:p-5">
      <p className="text-xs font-bold text-slate-300">{title}</p>
      <code className="mt-3 block w-fit rounded-lg bg-black/25 px-2 py-1 text-xs text-blue-200">{code}</code>
      <p className="mt-3 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

function WarehouseDataState({ children }: { children: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5 text-sm leading-6 text-slate-400">
      {children}
    </div>
  );
}

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

  const validateImport = async () => {
    setWorking(true);
    setMessage(null);
    setPreview(null);
    setIssues([]);
    try {
      const nextPreview = await prepareEmprovexSiscofisInventoryImport(workspaceId, rawJson, manualReferenceDate, 'Inventário SISCOFIS — Migração inicial', materialOverrides);
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
    <div className="mt-6 space-y-5" data-testid="warehouse-siscofis-operational">
      <div className="grid gap-3 md:grid-cols-2">
        <ContractCard title="Contrato de importação" code={EMPROVEX_SISCOFIS_INVENTORY_SCHEMA_VERSION} description="Migração manual e JSON usam o mesmo contrato versionado e passam pela mesma validação." />
        <ContractCard title="Snapshot auditável" code={WAREHOUSE_SISCOFIS_SNAPSHOT_SCHEMA_VERSION} description="Marco Zero e conciliações ficam no namespace logístico. Snapshots posteriores não alteram saldo automaticamente." />
      </div>

      <div className="rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.025] p-5">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-200">Migração manual de item</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">Para inventários pequenos ou correções de digitação. A linha manual é convertida para o mesmo JSON auditável antes da confirmação.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-[0.7fr_minmax(0,1.7fr)_0.7fr_0.8fr_0.8fr_auto]">
          <input value={manualNumeroItem} onChange={(e) => setManualNumeroItem(e.target.value)} placeholder="Nº Ficha" className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-xs text-slate-200" />
          <input value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} placeholder="Descrição" className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-xs text-slate-200" />
          <input value={manualQuantity} onChange={(e) => setManualQuantity(e.target.value)} inputMode="decimal" placeholder="Quantidade" className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-xs text-slate-200" />
          <input value={manualUnitValue} onChange={(e) => setManualUnitValue(e.target.value)} inputMode="decimal" placeholder="Valor unitário" className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-xs text-slate-200" />
          <input type="date" value={manualReferenceDate} onChange={(e) => { setManualReferenceDate(e.target.value); if (preview) setPreviewDirty(true); }} className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-xs text-slate-300" />
          <button type="button" onClick={prepareManualRow} className="h-10 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.08] px-4 text-xs font-black text-emerald-100">Adicionar</button>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-300/10 bg-blue-400/[0.035] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-blue-200"><FileJson2 className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.12em]">Prompt para IA externa</p></div>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">Use o prompt com o relatório SISCOFIS. A IA devolve apenas JSON; o EMPROVEX valida antes de qualquer confirmação.</p>
          </div>
          <button type="button" onClick={copyPrompt} disabled={!context?.prompt} className="inline-flex h-9 items-center gap-2 rounded-xl border border-blue-300/15 bg-blue-400/[0.08] px-3 text-xs font-bold text-blue-100 disabled:opacity-40">
            <Clipboard className="h-3.5 w-3.5" /> Copiar prompt
          </button>
        </div>
        <textarea readOnly value={context?.prompt || ''} className="mt-4 h-36 w-full resize-y rounded-xl border border-white/[0.07] bg-black/25 p-3 font-mono text-[10px] leading-5 text-slate-400" />
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
        <div className="flex items-center gap-2 text-slate-200"><FileJson2 className="h-4 w-4 text-blue-200" /><p className="text-xs font-black uppercase tracking-[0.12em]">JSON / linha manual preparada</p></div>
        <textarea value={rawJson} onChange={(event) => { setRawJson(event.target.value); if (preview) setPreviewDirty(true); }} data-testid="warehouse-siscofis-json" placeholder={'{\n  "schemaVersion": "emprovex_siscofis_inventory_v1",\n  "items": [...]\n}'} className="mt-4 h-56 w-full resize-y rounded-xl border border-white/[0.08] bg-[#01050d] p-4 font-mono text-xs leading-5 text-slate-300" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={validateImport} disabled={working || !rawJson.trim()} data-testid="warehouse-siscofis-validate" className="inline-flex h-9 items-center gap-2 rounded-xl bg-blue-500/90 px-4 text-xs font-black text-white disabled:opacity-40">
            {working ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {previewDirty ? 'Revalidar alterações' : 'Validar e gerar prévia'}
          </button>
          <button type="button" onClick={clearDraft} disabled={working || !rawJson.trim()} className="inline-flex h-9 items-center rounded-xl border border-white/[0.08] px-3 text-xs font-bold text-slate-400 disabled:opacity-40">Limpar</button>
          <span className="text-[10px] text-slate-600">Modo: {context?.hasMarcoZero ? 'snapshot de conciliação' : 'Marco Zero inicial'}</span>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="rounded-2xl border border-amber-300/10 bg-amber-400/[0.035] p-5">
          <div className="flex items-center gap-2 text-amber-200"><AlertTriangle className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.12em]">Validação</p></div>
          <div className="mt-3 space-y-2">
            {issues.map((issue, index) => (
              <div key={issue.code + issue.path + index} className="rounded-xl border border-white/[0.06] bg-black/10 px-3 py-2 text-xs text-slate-400">
                <span className={issue.severity === 'error' ? 'font-bold text-rose-300' : 'font-bold text-amber-200'}>{issue.severity === 'error' ? 'Erro' : 'Aviso'}</span>
                {' · '}{issue.path}{' · '}{issue.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {preview && (
        <div className="rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.025] p-5" data-testid="warehouse-siscofis-preview">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300/75">Prévia · {preview.kind === 'MARCO_ZERO' ? 'Marco Zero' : 'Snapshot'}</p>
              <p className="mt-2 text-sm font-bold text-slate-200">{preview.summary.totalRows} linha(s) · {preview.summary.createsMaterials} novo(s) · {preview.summary.unresolvedRows} sem vínculo · {preview.summary.divergentRows} divergente(s)</p>
              <p className="mt-1 text-[10px] text-slate-500">{issues.filter((item) => item.severity === 'error').length} erro(s) · {issues.filter((item) => item.severity === 'warning').length} aviso(s) · valor total {preview.import.rows.reduce((sum, row) => sum + (row.totalValue || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · {Object.keys(editedRows).length} corrigida(s) · data-base {preview.import.referenceDate}</p>
              {previewDirty && <p className="mt-2 text-[10px] font-bold text-amber-300">Há correções manuais ainda não revalidadas. A confirmação permanece bloqueada.</p>}
            </div>
            <button type="button" onClick={confirmImport} disabled={working || !preview.canConfirm || previewDirty} className="inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/[0.11] px-4 text-xs font-black text-emerald-100 disabled:opacity-40">
              <ShieldCheck className="h-3.5 w-3.5" /> {preview.kind === 'MARCO_ZERO' ? 'Confirmar Marco Zero' : 'Salvar snapshot'}
            </button>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="min-w-[760px] w-full text-left text-xs">
              <thead className="bg-white/[0.025] text-[9px] uppercase tracking-[0.12em] text-slate-600"><tr><th className="p-3">Nº Ficha</th><th className="p-3">Material</th><th className="p-3">Qtd.</th><th className="p-3">Valor unit.</th><th className="p-3">Total</th><th className="p-3">Vínculo</th><th className="p-3">Estado</th></tr></thead>
              <tbody className="divide-y divide-white/[0.05]">
                {preview.rows.map((row, index) => { const source = preview.import.rows.find((item) => item.rowId === row.rowId); return <tr key={preview.sourceHash + row.rowId}>
                  <td className="p-2"><input defaultValue={row.sourceItemNumber || ''} onChange={(event) => editPreviewItem(index, 'numeroItem', event.target.value)} className="h-9 w-28 rounded-lg border border-white/[0.08] bg-black/20 px-2 font-mono text-xs text-slate-200" /></td>
                  <td className="p-2"><input defaultValue={row.description} onChange={(event) => editPreviewItem(index, 'descricao', event.target.value)} className="h-9 min-w-[280px] w-full rounded-lg border border-white/[0.08] bg-black/20 px-2 text-xs font-bold text-slate-200" /></td>
                  <td className="p-2"><input defaultValue={String(row.siscofisQuantity)} onChange={(event) => editPreviewItem(index, 'quantidade', event.target.value)} inputMode="decimal" className="h-9 w-24 rounded-lg border border-white/[0.08] bg-black/20 px-2 text-xs text-slate-200" /></td>
                  <td className="p-2"><input defaultValue={String(source?.unitValue ?? 0)} onChange={(event) => editPreviewItem(index, 'valorUnitario', event.target.value)} inputMode="decimal" className="h-9 w-28 rounded-lg border border-white/[0.08] bg-black/20 px-2 text-xs text-slate-200" /></td>
                  <td className="p-3 text-slate-400">{source?.totalValue?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00"}</td>
                  <td className="p-2">
                    {row.createsMaterial ? (
                      <span className="text-[10px] font-bold text-blue-200">Novo material</span>
                    ) : (
                      <select
                        value={materialOverrides[row.rowId] || (preview.materialOptions.some((option) => option.id === row.materialId) ? row.materialId || '' : '')}
                        onChange={(event) => selectCanonicalMaterial(row.rowId, event.target.value)}
                        className="h-9 max-w-[260px] rounded-lg border border-white/[0.08] bg-black/20 px-2 text-[10px] text-slate-200"
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
                  <td className="p-3 text-slate-400">{row.state}{editedRows[row.rowId] ? ' · corrigida' : ''}{previewDirty ? ' · revalidar' : ''}</td>
                </tr>; })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {message && <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-xs text-slate-300">{message}</div>}

      <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-slate-300">Histórico SISCOFIS</p><p className="mt-1 text-[10px] text-slate-600">Leitura sob demanda · até 12 registros</p></div><button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-lg border border-white/[0.07] p-2 text-slate-400"><RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /></button></div>
        {!context?.snapshots.length ? <p className="mt-4 text-xs text-slate-500">Nenhum Marco Zero confirmado.</p> : <div className="mt-4 space-y-2">{context.snapshots.map((snapshot) => <div key={snapshot.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3"><p className="text-xs font-bold text-slate-300">{snapshot.kind === 'MARCO_ZERO' ? 'Marco Zero' : 'Snapshot'} · {snapshot.referenceDate}</p><p className="mt-1 text-[10px] text-slate-600">{snapshot.sourceLabel} · {snapshot.status}</p></div>)}</div>}
      </div>
    </div>
  );
}
