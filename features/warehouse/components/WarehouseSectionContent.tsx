'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Boxes, CheckCircle2, Clipboard, Database, FileJson2, Layers3, MapPinned, PackageCheck, RefreshCw, ShieldCheck } from 'lucide-react';

import { WAREHOUSE_MATERIAL_SCHEMA_VERSION, WAREHOUSE_MATERIAL_UNIT_CODES, type WarehouseMaterial } from '../../../lib/warehouse/material';
import { WAREHOUSE_BALANCE_SCHEMA_VERSION, WAREHOUSE_MOVEMENT_SCHEMA_VERSION, WAREHOUSE_MOVEMENT_TYPES, type WarehouseBalance } from '../../../lib/warehouse/movement';
import { listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import { listWarehouseBalances, listWarehouseMovements, type WarehouseMovementListItem } from '../../../lib/warehouse/ledgerRepository';
import { WAREHOUSE_DOMAIN_COLLECTIONS, WAREHOUSE_NAMESPACE_ROOT } from '../../../lib/warehouse/namespace';
import { WAREHOUSE_SISCOFIS_IMPORT_SCHEMA_VERSION, WAREHOUSE_SISCOFIS_SNAPSHOT_SCHEMA_VERSION, type WarehouseSiscofisIssue, type WarehouseSiscofisPreview } from '../../../lib/warehouse/siscofis';
import { confirmWarehouseSiscofisImport, loadWarehouseSiscofisContext, prepareWarehouseSiscofisImport, type WarehouseSiscofisContext } from '../../../lib/warehouse/siscofisService';
import type { WarehouseSectionId } from '../navigation';
import { WarehouseExpressOutbound } from './WarehouseExpressOutbound';
import { WarehouseLocationsOperational } from './WarehouseLocationsOperational';
import { WarehouseStockOperational } from './WarehouseStockOperational';

function FutureNotice({ phase, children }: { phase: string; children: string }) {
  return (
    <div className="rounded-2xl border border-amber-300/10 bg-amber-400/[0.04] p-4" data-testid="warehouse-future-state">
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-amber-300/70">Capacidade futura · {phase}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{children}</p>
    </div>
  );
}

function ContractCard({ title, code, description }: { title: string; code: string; description: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-4 sm:p-5">
      <p className="text-xs font-bold text-slate-300">{title}</p>
      <code className="mt-3 block w-fit rounded-lg bg-black/25 px-2 py-1 text-xs text-blue-200">{code}</code>
      <p className="mt-3 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

function PlannedItems({ items }: { items: readonly string[] }) {
  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs text-slate-400">
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden="true" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function OverviewContent() {
  return (
    <div className="mt-6 space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <ContractCard title="Material canônico" code={WAREHOUSE_MATERIAL_SCHEMA_VERSION} description="Identidade única de material e unidades da FASE 1. Nenhum modelo concorrente foi criado." />
        <ContractCard title="Ledger auditável" code={WAREHOUSE_MOVEMENT_SCHEMA_VERSION} description="Histórico append-only da FASE 2, preservado como fonte de movimentos." />
        <ContractCard title="Saldo materializado" code={WAREHOUSE_BALANCE_SCHEMA_VERSION} description="Projeção do ledger para leitura rápida. Não existe segundo saldo no Walking Skeleton." />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.035] p-5">
          <div className="flex items-center gap-2 text-emerald-200"><ShieldCheck className="h-4 w-4" aria-hidden="true" /><p className="text-xs font-black uppercase tracking-[0.12em]">Piloto fundador preservado</p></div>
          <p className="mt-3 text-sm leading-6 text-slate-400">O módulo continua protegido pela feature flag, pelo gate de identidade fundadora, pela API segura e pelo namespace logístico isolado.</p>
        </div>
        <div className="rounded-2xl border border-blue-300/10 bg-blue-400/[0.035] p-5">
          <div className="flex items-center gap-2 text-blue-200"><Database className="h-4 w-4" aria-hidden="true" /><p className="text-xs font-black uppercase tracking-[0.12em]">Namespace existente</p></div>
          <p className="mt-3 text-sm leading-6 text-slate-400"><code className="text-blue-200">{WAREHOUSE_NAMESPACE_ROOT}/&#123;workspaceId&#125;/...</code>{' '}continua sendo a única fronteira de persistência logística.</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">Domínios reservados: {Object.values(WAREHOUSE_DOMAIN_COLLECTIONS).join(', ')}.</p>
        </div>
      </div>
      <FutureNotice phase="FASES 4–11">Os indicadores operacionais serão adicionados somente quando as respectivas fontes reais existirem. Esta Visão Geral não exibe números fictícios de estoque, entregas, inventário ou conciliação.</FutureNotice>
    </div>
  );
}

interface WarehousePhase4Data {
  loading: boolean;
  error: string | null;
  materials: WarehouseMaterial[];
  balances: WarehouseBalance[];
  movements: WarehouseMovementListItem[];
}

function useWarehousePhase4Data(
  workspaceId: string,
  section: WarehouseSectionId
): WarehousePhase4Data {
  const [state, setState] = useState<WarehousePhase4Data>({
    loading: section === 'movements',
    error: null,
    materials: [],
    balances: [],
    movements: [],
  });

  useEffect(() => {
    if (section !== 'movements') {
      setState({ loading: false, error: null, materials: [], balances: [], movements: [] });
      return;
    }

    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    void (async () => {
      try {
        const [materials, movements] = await Promise.all([
          listWarehouseMaterials(workspaceId, 250),
          listWarehouseMovements(workspaceId, 100),
        ]);
        if (active) {
          setState({ loading: false, error: null, materials, balances: [], movements });
        }
      } catch (error) {
        if (active) {
          setState({
            loading: false,
            error: error instanceof Error ? error.message : 'Falha ao consultar o estoque.',
            materials: [],
            balances: [],
            movements: [],
          });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [section, workspaceId]);

  return state;
}

function WarehouseDataState({ children }: { children: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5 text-sm leading-6 text-slate-400">
      {children}
    </div>
  );
}

function StockContent({ data }: { data: WarehousePhase4Data }) {
  const materialById = useMemo(
    () => new Map(data.materials.map((material) => [material.id, material])),
    [data.materials]
  );

  return (
    <div className="mt-6 space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <ContractCard title="Identidade do material" code={WAREHOUSE_MATERIAL_SCHEMA_VERSION} description="Cada saldo aponta para o material canônico da FASE 1." />
        <ContractCard title="Fonte de saldo" code={WAREHOUSE_BALANCE_SCHEMA_VERSION} description="Saldo real materializado pelo ledger. Esta tela não recalcula histórico nem mantém um segundo saldo." />
      </div>

      {data.loading ? (
        <WarehouseDataState>Consultando saldos reais do workspace…</WarehouseDataState>
      ) : data.error ? (
        <WarehouseDataState>{'Não foi possível consultar o estoque: ' + data.error}</WarehouseDataState>
      ) : data.balances.length === 0 ? (
        <WarehouseDataState>Nenhuma entrada de estoque foi registrada após o cutoff logístico deste workspace.</WarehouseDataState>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-black/10">
          <div className="border-b border-white/[0.06] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Saldos reais · até 250 materiais por consulta
          </div>
          <div className="divide-y divide-white/[0.05]">
            {data.balances.map((balance) => {
              const material = materialById.get(balance.materialId);
              const unitLabel = material?.unit.label || material?.unit.code || '—';
              return (
                <div key={balance.materialId} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-200">{material?.description || balance.materialId}</p>
                    <p className="mt-1 truncate font-mono text-[10px] text-slate-600">{balance.materialId}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-lg font-black text-emerald-200">{balance.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}</p>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-600">{unitLabel}</p>
                  </div>
                  <div className="text-[10px] text-slate-600 sm:text-right">
                    revisão {balance.revision}<br />ledger
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <FutureNotice phase="FASE 7">Pesquisa avançada, lotes, validade, FEFO e ficha operacional do material continuam reservados para a FASE 7. A distribuição física já está disponível em Localizações.</FutureNotice>
    </div>
  );
}

function MovementsContent({ data }: { data: WarehousePhase4Data }) {
  const materialById = useMemo(
    () => new Map(data.materials.map((material) => [material.id, material])),
    [data.materials]
  );

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
        <div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-blue-200" aria-hidden="true" /><p className="text-xs font-bold text-slate-300">Ledger oficial · histórico append-only</p></div>
        <div className="mt-4 flex flex-wrap gap-2">{WAREHOUSE_MOVEMENT_TYPES.map((movementType) => <code key={movementType} className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2 py-1 text-[11px] text-slate-400">{movementType}</code>)}</div>
        <p className="mt-4 text-xs leading-5 text-slate-500">A FASE 4 passa a produzir INVOICE_ENTRY e INVOICE_CORRECTION com origem estruturada da NF.</p>
      </div>

      {data.loading ? (
        <WarehouseDataState>Consultando os movimentos mais recentes…</WarehouseDataState>
      ) : data.error ? (
        <WarehouseDataState>{'Não foi possível consultar os movimentos: ' + data.error}</WarehouseDataState>
      ) : data.movements.length === 0 ? (
        <WarehouseDataState>Nenhuma movimentação de estoque foi registrada neste workspace.</WarehouseDataState>
      ) : (
        <div className="space-y-3">
          {data.movements.map(({ movement, createdAt }) => {
            const material = materialById.get(movement.materialId);
            const source = movement.source;
            const invoiceSource = source?.kind === 'INVOICE' ? source : null;
            const transferSource = source?.kind === 'LOCATION_TRANSFER' ? source : null;
            const dateLabel = createdAt
              ? new Date(createdAt).toLocaleString('pt-BR')
              : 'horário pendente';
            return (
              <div key={movement.id} className="rounded-2xl border border-white/[0.07] bg-black/10 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded-lg bg-blue-400/[0.08] px-2 py-1 text-[10px] font-bold text-blue-200">{movement.type}</code>
                      {invoiceSource && <span className="rounded-lg bg-emerald-400/[0.06] px-2 py-1 text-[10px] font-bold text-emerald-200">NF {invoiceSource.invoiceId}</span>}
                      {transferSource && <span className="rounded-lg bg-blue-400/[0.08] px-2 py-1 text-[10px] font-bold text-blue-200">transferência interna</span>}
                    </div>
                    <p className="mt-3 truncate text-sm font-bold text-slate-200">{material?.description || movement.materialId}</p>
                    {invoiceSource ? (
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Empenho {invoiceSource.empenhoId} · {invoiceSource.supplier} · item(ns) {invoiceSource.itemIds.join(', ')}
                      </p>
                    ) : transferSource ? (
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        {transferSource.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} unidade(s) redistribuída(s) sem alterar o saldo total da OM.
                      </p>
                    ) : (
                      <p className="mt-2 text-xs leading-5 text-slate-600">{movement.note || 'Movimento sem origem estruturada.'}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className={movement.quantityDelta >= 0 ? 'text-lg font-black text-emerald-200' : 'text-lg font-black text-amber-200'}>
                      {movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-600">{dateLabel}</p>
                  </div>
                </div>
                <p className="mt-3 break-all font-mono text-[9px] text-slate-700">{movement.id}</p>
              </div>
            );
          })}
        </div>
      )}

      <FutureNotice phase="FASES 7–10">Transferências internas e localização já estão operacionais na FASE 6. Lotes, saídas expressas e inventário continuam nas fases previstas no roadmap.</FutureNotice>
    </div>
  );
}

function WarehouseViewContent() {
  return (
    <div className="mt-6">
      <div className="rounded-3xl border border-dashed border-blue-300/15 bg-[linear-gradient(135deg,rgba(59,130,246,0.035),rgba(255,255,255,0.015))] p-6 sm:p-8">
        <div className="mx-auto max-w-2xl text-center"><MapPinned className="mx-auto h-8 w-8 text-blue-200/60" aria-hidden="true" /><p className="mt-4 text-sm font-black text-slate-200">Área estrutural do futuro croqui operacional</p><p className="mt-2 text-xs leading-6 text-slate-500">O mapa será 2D com perspectiva tridimensional leve e representará locais, não produtos. Nenhum motor 3D, editor ou layout fictício foi criado nesta fase.</p></div>
      </div>
      <div className="mt-5"><FutureNotice phase="FASE 9">Pesquisa, destaque visual de locais, editor simplificado e persistência versionada serão implementados como uma fatia vertical própria.</FutureNotice></div>
    </div>
  );
}

function InventoryContent() {
  return <div className="mt-6"><PlannedItems items={['Selecionar depósito/local','Registrar contagem','Comparar esperado x contado','Exibir divergência','Confirmar ajuste humano','Gerar ajuste auditável']} /><div className="mt-5"><FutureNotice phase="FASE 10">Esta capacidade será disponibilizada em uma fase posterior. INVENTORY_ADJUSTMENT permanece apenas como tipo reconhecido pelo ledger; nenhum ajuste operacional é disparado aqui.</FutureNotice></div></div>;
}

function SiscofisContent({ workspaceId }: { workspaceId: string }) {
  const [context, setContext] = useState<WarehouseSiscofisContext | null>(null);
  const [rawJson, setRawJson] = useState('');
  const [preview, setPreview] = useState<WarehouseSiscofisPreview | null>(null);
  const [issues, setIssues] = useState<WarehouseSiscofisIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
      const nextPreview = await prepareWarehouseSiscofisImport(workspaceId, rawJson);
      setPreview(nextPreview);
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
    if (!preview?.canConfirm) return;
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

  if (loading && !context) {
    return <div className="mt-6"><WarehouseDataState>Carregando estado do SISCOFIS e do Marco Zero…</WarehouseDataState></div>;
  }

  return (
    <div className="mt-6 space-y-5" data-testid="warehouse-siscofis-operational">
      <div className="grid gap-3 md:grid-cols-2">
        <ContractCard title="Contrato de importação" code={WAREHOUSE_SISCOFIS_IMPORT_SCHEMA_VERSION} description="JSON rígido e versionado. A IA interpreta o relatório fora do EMPROVEX; o sistema apenas valida, pré-visualiza e persiste após confirmação." />
        <ContractCard title="Snapshot auditável" code={WAREHOUSE_SISCOFIS_SNAPSHOT_SCHEMA_VERSION} description="Marco Zero e conciliações ficam no namespace logístico. Snapshots posteriores nunca alteram o saldo automaticamente." />
      </div>

      <div className="rounded-2xl border border-blue-300/10 bg-blue-400/[0.035] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-blue-200"><FileJson2 className="h-4 w-4" aria-hidden="true" /><p className="text-xs font-black uppercase tracking-[0.12em]">1 · Prompt oficial para IA externa</p></div>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">O prompt inclui o contrato JSON e até 500 materiais canônicos para permitir vínculo explícito por ID. A IA não é executada dentro do EMPROVEX.</p>
          </div>
          <button type="button" onClick={copyPrompt} disabled={!context?.prompt} data-testid="warehouse-siscofis-copy-prompt" className="inline-flex h-9 items-center gap-2 rounded-xl border border-blue-300/15 bg-blue-400/[0.08] px-3 text-xs font-bold text-blue-100 transition hover:bg-blue-400/[0.14] disabled:opacity-40">
            <Clipboard className="h-3.5 w-3.5" aria-hidden="true" /> Copiar prompt
          </button>
        </div>
        <textarea readOnly value={context?.prompt || ''} aria-label="Prompt oficial SISCOFIS" className="mt-4 h-36 w-full resize-y rounded-xl border border-white/[0.07] bg-black/25 p-3 font-mono text-[10px] leading-5 text-slate-400 outline-none" />
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
        <div className="flex items-center gap-2 text-slate-200"><FileJson2 className="h-4 w-4 text-blue-200" aria-hidden="true" /><p className="text-xs font-black uppercase tracking-[0.12em]">2 · Colar JSON e validar</p></div>
        <p className="mt-2 text-xs leading-5 text-slate-500">Nenhuma persistência ocorre nesta etapa. Campos desconhecidos, UG incorreta, IDs inválidos e inconsistências são apresentados antes da confirmação.</p>
        <textarea value={rawJson} onChange={(event) => setRawJson(event.target.value)} aria-label="JSON SISCOFIS" data-testid="warehouse-siscofis-json" placeholder={'{\n  "schemaVersion": "warehouse_siscofis_import_v1",\n  ...\n}'} className="mt-4 h-56 w-full resize-y rounded-xl border border-white/[0.08] bg-[#01050d] p-4 font-mono text-xs leading-5 text-slate-300 outline-none transition focus:border-blue-300/25" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={validateImport} disabled={working || !rawJson.trim()} data-testid="warehouse-siscofis-validate" className="inline-flex h-9 items-center gap-2 rounded-xl bg-blue-500/90 px-4 text-xs font-black text-white transition hover:bg-blue-400 disabled:opacity-40">
            {working ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />} Validar e gerar prévia
          </button>
          <span className="text-[10px] text-slate-600">Modo atual: {context?.hasMarcoZero ? 'snapshot de conciliação' : 'Marco Zero inicial'}</span>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="rounded-2xl border border-amber-300/10 bg-amber-400/[0.035] p-5" data-testid="warehouse-siscofis-issues">
          <div className="flex items-center gap-2 text-amber-200"><AlertTriangle className="h-4 w-4" aria-hidden="true" /><p className="text-xs font-black uppercase tracking-[0.12em]">Validação</p></div>
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
        <div className="rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.025] p-5" data-testid="warehouse-siscofis-preview" data-import-kind={preview.kind}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300/75">3 · Prévia · {preview.kind === 'MARCO_ZERO' ? 'Marco Zero' : 'Snapshot de conciliação'}</p>
              <p className="mt-2 text-sm font-bold text-slate-200">
                {preview.kind === 'MARCO_ZERO'
                  ? 'Os saldos iniciais serão registrados como INITIAL_BALANCE no ledger.'
                  : 'A comparação será salva sem alterar o estoque do EMPROVEX.'}
              </p>
              <p className="mt-1 break-all font-mono text-[9px] text-slate-600">hash {preview.sourceHash}</p>
            </div>
            <button type="button" onClick={confirmImport} disabled={working || !preview.canConfirm} data-testid="warehouse-siscofis-confirm" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/[0.11] px-4 text-xs font-black text-emerald-100 transition hover:bg-emerald-400/[0.17] disabled:opacity-40">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {preview.kind === 'MARCO_ZERO' ? 'Confirmar Marco Zero' : 'Salvar snapshot'}
            </button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ['Linhas', preview.summary.totalRows],
              ['Conciliadas', preview.summary.matchedRows],
              ['Divergentes', preview.summary.divergentRows],
              ['Sem vínculo', preview.summary.unresolvedRows],
              ['Novos materiais', preview.summary.createsMaterials],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-white/[0.06] bg-black/10 px-3 py-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">{label}</p>
                <p className="mt-1 text-lg font-black text-slate-200">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="min-w-[780px] w-full text-left text-xs">
              <thead className="bg-white/[0.025] text-[9px] uppercase tracking-[0.12em] text-slate-600">
                <tr><th className="p-3">Material</th><th className="p-3">SISCOFIS</th><th className="p-3">EMPROVEX</th><th className="p-3">Diferença</th><th className="p-3">Estado</th></tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {preview.rows.map((row) => (
                  <tr key={row.rowId}>
                    <td className="p-3"><p className="max-w-md font-bold text-slate-300">{row.description}</p><p className="mt-1 font-mono text-[9px] text-slate-600">{row.materialId || 'sem vínculo canônico'}</p></td>
                    <td className="p-3 font-bold text-slate-300">{row.siscofisQuantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}</td>
                    <td className="p-3 text-slate-400">{row.emprovexQuantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}</td>
                    <td className="p-3 text-slate-400">{preview.kind === 'MARCO_ZERO' ? '—' : row.difference.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}</td>
                    <td className="p-3"><span className={row.state === 'DIVERGENT' ? 'font-bold text-amber-200' : row.state === 'UNRESOLVED' ? 'font-bold text-rose-300' : 'font-bold text-emerald-200'}>{row.state === 'MATCHED' ? (preview.kind === 'MARCO_ZERO' ? 'Pronto' : 'Conciliado') : row.state === 'DIVERGENT' ? 'Divergente' : 'Sem vínculo'}</span>{row.createsMaterial && <p className="mt-1 text-[9px] text-blue-300/70">criar material canônico</p>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-xs leading-5 text-slate-300" data-testid="warehouse-siscofis-message">{message}</div>
      )}

      <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-slate-300">Histórico SISCOFIS</p><p className="mt-1 text-[10px] text-slate-600">Leitura sob demanda · até 12 registros</p></div><button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-lg border border-white/[0.07] p-2 text-slate-400 hover:text-slate-200"><RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} aria-hidden="true" /></button></div>
        {!context?.snapshots.length ? (
          <p className="mt-4 text-xs leading-5 text-slate-500">Nenhum Marco Zero foi confirmado. A primeira importação válida será tratada como saldo inicial auditável.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {context.snapshots.map((snapshot) => (
              <div key={snapshot.id} className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-xs font-bold text-slate-300">{snapshot.kind === 'MARCO_ZERO' ? 'Marco Zero' : 'Snapshot'} · {snapshot.referenceDate}</p><p className="mt-1 text-[10px] text-slate-600">{snapshot.sourceLabel} · {snapshot.status}</p></div>
                <div className="text-[10px] text-slate-500 sm:text-right">{snapshot.summary.divergentRows} divergência(s)<br />{snapshot.summary.unresolvedRows} sem vínculo</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-amber-300/10 bg-amber-400/[0.03] px-4 py-3 text-xs leading-5 text-amber-100/70">
        Divergências SISCOFIS nunca corrigem o estoque automaticamente. Qualquer ajuste futuro deverá ser uma ação humana explícita e auditável na fase apropriada.
      </div>
    </div>
  );
}

function DeliveriesContent() {
  return (
    <div className="mt-6">
      <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5"><div className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-blue-200" aria-hidden="true" /><p className="text-xs font-bold text-slate-300">Integração sem duplicação</p></div><p className="mt-3 text-sm leading-6 text-slate-400">Esta área será conectada ao Planejamento/Cronograma existente. O Walking Skeleton não copia, migra ou mantém uma segunda fonte de entregas.</p></div>
      <div className="mt-5"><FutureNotice phase="FASE 11">Entrega → NF → estoque e os indicadores logísticos serão conectados somente quando as fatias anteriores estiverem operacionais.</FutureNotice></div>
    </div>
  );
}

function SettingsContent() {
  return (
    <div className="mt-6">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.035] p-5"><div className="flex items-center gap-2 text-emerald-200"><ShieldCheck className="h-4 w-4" aria-hidden="true" /><p className="text-xs font-bold">Escopo do piloto</p></div><p className="mt-3 text-sm leading-6 text-slate-400">A configuração efetiva continua no contrato founder-only existente. Nenhum novo papel externo foi criado.</p></div>
        <div className="rounded-2xl border border-blue-300/10 bg-blue-400/[0.035] p-5"><div className="flex items-center gap-2 text-blue-200"><Boxes className="h-4 w-4" aria-hidden="true" /><p className="text-xs font-bold">Configuração logística</p></div><p className="mt-3 text-sm leading-6 text-slate-400">Não existem toggles fictícios nesta fase. Parâmetros serão adicionados apenas quando possuírem contrato funcional e de segurança definido.</p></div>
      </div>
      <div className="mt-5"><FutureNotice phase="FASES 12–14">Configurações de operacionalização, telemetria e expansão externa serão tratadas nas fases específicas do roadmap.</FutureNotice></div>
    </div>
  );
}

export function WarehouseSectionContent({ section, workspaceId }: { section: WarehouseSectionId; workspaceId: string }) {
  const phase4Data = useWarehousePhase4Data(workspaceId, section);

  switch (section) {
    case 'overview': return <OverviewContent />;
    case 'stock': return <WarehouseStockOperational workspaceId={workspaceId} />;
    case 'outbound': return <WarehouseExpressOutbound workspaceId={workspaceId} />;
    case 'movements': return <MovementsContent data={phase4Data} />;
    case 'locations': return <WarehouseLocationsOperational workspaceId={workspaceId} />;
    case 'warehouseView': return <WarehouseViewContent />;
    case 'inventory': return <InventoryContent />;
    case 'siscofis': return <SiscofisContent workspaceId={workspaceId} />;
    case 'deliveries': return <DeliveriesContent />;
    case 'settings': return <SettingsContent />;
  }
}
