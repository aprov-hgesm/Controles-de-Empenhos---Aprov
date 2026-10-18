'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  CreditCard,
  FileClock,
  Landmark,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import {
  customerBillingLabel,
  formatCustomerCurrency,
  formatCustomerDate,
  type CustomerBillingSnapshot,
  type CustomerWorkspaceRecord,
} from '../../../lib/admin2/customers/customerWorkspaceContract';
import { readCustomerBilling } from '../../../lib/admin2/customers/customerWorkspaceDirectory';
import {
  ADMIN2_AUDIT_SAMPLE_LIMIT,
  ADMIN2_CYCLE_PAGE_SIZE,
  auditOperationLabel,
  billingCycleStatusLabel,
  type CustomerAuditRecord,
  type CustomerCycleRecord,
} from '../../../lib/admin2/customers/customer360Contract';
import { readCustomerAuditSample, readCustomerCyclePage } from '../../../lib/admin2/customers/customer360Read';
import styles from '../shell/AdminCommandPreview.module.css';

type Tab = 'summary' | 'finance' | 'activity' | 'relationship';
type LoadState = 'loading' | 'ready' | 'error';
const TABS: Array<{ id: Tab; title: string; icon: typeof Building2 }> = [
  { id: 'summary', title: 'Visão geral', icon: Building2 },
  { id: 'finance', title: 'Financeiro', icon: WalletCards },
  { id: 'activity', title: 'Atividades', icon: Activity },
  { id: 'relationship', title: 'Vínculos e contato', icon: Users },
];

function errorText(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code: unknown }).code || '') : '';
  if (code.includes('permission-denied')) return 'Sem permissão para consultar estes metadados administrativos.';
  if (code.includes('failed-precondition')) return 'Consulta indisponível: o Firestore solicitou um índice. Nenhuma alteração automática será feita.';
  return error instanceof Error ? error.message : 'Não foi possível consultar os dados.';
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-[#e7edf7] py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
      <dt className="text-[11px] font-semibold text-[#73849d]">{label}</dt>
      <dd className="break-words text-left text-[12px] font-bold text-[#1d3659] sm:max-w-[65%] sm:text-right">{value}</dd>
    </div>
  );
}

function Surface({ title, icon: Icon, children, hint }: {
  title: string;
  icon: typeof Building2;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <section className="rounded-[20px] border border-[#dce5f1] bg-white p-5 shadow-[0_12px_32px_rgba(38,77,131,0.055)]">
      <div className="flex items-start gap-3 border-b border-[#edf1f8] pb-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#cfe1f8] bg-[#edf5ff] text-[#225cac]">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-[13px] font-extrabold text-[#18365a]">{title}</h3>
          {hint && <p className="mt-1 text-[11px] leading-5 text-[#788aa4]">{hint}</p>}
        </div>
      </div>
      <div className="pt-2">{children}</div>
    </section>
  );
}

function ReadNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[#cbdcf2] bg-[#f0f6ff] px-4 py-3 text-[11px] leading-5 text-[#496994]">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2b65ae]" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] text-red-700">
    <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />{message}
  </p>;
}

function BillingSummary({ billing, state, error }: {
  billing: CustomerBillingSnapshot | null;
  state: LoadState;
  error: string;
}) {
  if (state === 'loading') return <p className="flex items-center gap-2 py-5 text-xs text-[#667f9e]"><Loader2 className="h-4 w-4 animate-spin" /> Consultando resumo de assinatura...</p>;
  if (state === 'error') return <ErrorNotice message={error} />;
  return <dl>
    <Info label="Situação" value={customerBillingLabel(billing)} />
    <Info label="Mensalidade" value={billing ? formatCustomerCurrency(billing.monthlyPriceCents) : 'Não configurada'} />
    <Info label="Fim do período de teste" value={billing ? formatCustomerDate(billing.trialEndsAt) : 'Não informado'} />
    <Info label="Isenção" value={billing?.exemptionSource || 'Não informada'} />
    <Info label="Pagamento exigido" value={billing ? (billing.paymentRequired ? 'Sim' : 'Não') : 'Não informado'} />
  </dl>;
}

function BillingCycles({ workspaceId }: { workspaceId: string }) {
  const [page, setPage] = useState(0);
  const cursors = useRef<Array<QueryDocumentSnapshot<DocumentData> | null>>([null]);
  const [rows, setRows] = useState<CustomerCycleRecord[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let current = true;
    setStatus('loading');
    setError('');
    readCustomerCyclePage(workspaceId, cursors.current[page] || null).then((result) => {
      if (!current) return;
      setRows(result.rows);
      setHasMore(result.hasMore);
      cursors.current[page + 1] = result.lastVisible;
      setStatus('ready');
    }).catch((reason: unknown) => {
      if (!current) return;
      setError(errorText(reason));
      setStatus('error');
    });
    return () => { current = false; };
  }, [workspaceId, page, requestVersion]);

  return (
    <Surface title="Competências de cobrança" icon={CreditCard} hint="Somente ciclos canônicos existentes, paginados por competência em ordem decrescente.">
      {status === 'loading' && <p className="flex items-center gap-2 py-6 text-xs text-[#66819f]"><Loader2 className="h-4 w-4 animate-spin" /> Consultando competências...</p>}
      {status === 'error' && <ErrorNotice message={error} />}
      {status === 'ready' && (
        <>
          {rows.length === 0 ? (
            <p className="py-7 text-center text-xs text-[#74859b]">Nenhuma competência registrada nesta consulta. Isso não altera a situação da assinatura.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#e4eaf4]">
              <table className="w-full min-w-[610px] text-left text-[11px]">
                <thead className="bg-[#eef4fd] text-[#566e8b]">
                  <tr>
                    <th scope="col" className="px-3 py-3">Competência</th>
                    <th scope="col" className="px-3 py-3">Situação</th>
                    <th scope="col" className="px-3 py-3">Valor</th>
                    <th scope="col" className="px-3 py-3">Vencimento</th>
                    <th scope="col" className="px-3 py-3">Confirmação</th>
                  </tr>
                </thead>
                <tbody>{rows.map((cycle) => (
                  <tr key={cycle.id} className="border-t border-[#e7edf5] text-[#3e5370]">
                    <td className="px-3 py-3 font-semibold text-[#1a3861]">{cycle.referenceMonth}</td>
                    <td className="px-3 py-3"><span className={'rounded-lg px-2 py-1 font-semibold ' + (cycle.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : cycle.status === 'waived' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-800')}>{billingCycleStatusLabel(cycle.status)}</span></td>
                    <td className="px-3 py-3 font-semibold">{formatCustomerCurrency(cycle.amountCents)}</td>
                    <td className="px-3 py-3">{cycle.dueDate ? formatCustomerDate(cycle.dueDate + 'T12:00:00Z') : '—'}</td>
                    <td className="px-3 py-3">{formatCustomerDate(cycle.confirmedAt)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] text-[#76889f]">{rows.length} competência(s) nesta página · {ADMIN2_CYCLE_PAGE_SIZE} por página</span>
            <div className="flex gap-2">
              <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#cfdeed] bg-white px-3 text-xs font-bold text-[#285999] disabled:opacity-40"><ChevronLeft className="h-4 w-4"/>Anterior</button>
              <button type="button" disabled={!hasMore} onClick={() => setPage((p) => p + 1)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#cfdeed] bg-white px-3 text-xs font-bold text-[#285999] disabled:opacity-40">Próxima<ChevronRight className="h-4 w-4"/></button>
            </div>
          </div>
        </>
      )}
      <button type="button" onClick={() => { cursors.current = [null]; setPage(0); setRequestVersion((n) => n + 1); }} className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#d3e0f0] bg-[#f7faff] px-3 text-[11px] font-bold text-[#245c9a]"><RefreshCw className="h-3.5 w-3.5"/> Recarregar competências</button>
      <p className="mt-3 text-[10px] leading-5 text-[#8491a4]">A lista não representa receita total nem fluxo de caixa agregado. Cycles legados fora do padrão de ID workspace__AAAA-MM não são incluídos.</p>
    </Surface>
  );
}

function AuditSample({ workspaceId }: { workspaceId: string }) {
  const [status, setStatus] = useState<LoadState>('loading');
  const [events, setEvents] = useState<CustomerAuditRecord[]>([]);
  const [error, setError] = useState('');
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let current = true;
    setStatus('loading');
    readCustomerAuditSample(workspaceId).then((result) => {
      if (!current) return;
      setEvents(result);
      setStatus('ready');
    }).catch((reason: unknown) => {
      if (!current) return;
      setError(errorText(reason));
      setStatus('error');
    });
    return () => { current = false; };
  }, [workspaceId, requestVersion]);

  return (
    <Surface title="Eventos de auditoria administrativa" icon={FileClock} hint="Amostra limitada de eventos gravados no EMPROVEX, sem acesso aos dados operacionais de outros setores.">
      {status === 'loading' && <p className="flex items-center gap-2 py-7 text-xs text-[#657d9b]"><Loader2 className="h-4 w-4 animate-spin" /> Consultando eventos...</p>}
      {status === 'error' && <ErrorNotice message={error} />}
      {status === 'ready' && (
        events.length === 0
          ? <p className="py-7 text-xs text-[#74859b]">Nenhum evento administrativo disponível na amostra consultada.</p>
          : <div className="space-y-2">{events.map((event) => (
            <div key={event.id} className="flex items-start gap-3 rounded-xl border border-[#e0e8f4] bg-[#f8fbff] p-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#3d83cb]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-[#1b3c67]">{auditOperationLabel(event.operation)}</p>
                <p className="mt-1 text-[10px] text-[#7588a4]">Ator: {event.actorEmail || 'Não informado'} · {event.entityType}</p>
              </div>
              <span className="text-right text-[10px] font-semibold text-[#6681a4]">{event.occurredAt ? formatCustomerDate(event.occurredAt) : 'Sem data'}</span>
            </div>
          ))}</div>
      )}
      <ReadNotice><strong>Importante:</strong> esta é uma amostra de no máximo {ADMIN2_AUDIT_SAMPLE_LIMIT} eventos, ordenada por data apenas entre os itens retornados. Como os IDs de auditoria não são cronológicos, não representa necessariamente os eventos mais recentes nem um histórico completo.</ReadNotice>
      <button type="button" onClick={() => setRequestVersion((n) => n + 1)} className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#d3e0f0] bg-[#f7faff] px-3 text-[11px] font-bold text-[#245c9a]"><RefreshCw className="h-3.5 w-3.5" /> Atualizar amostra</button>
    </Surface>
  );
}

export function AdminCustomerDetailV2({ customer, onBack }: {
  customer: CustomerWorkspaceRecord;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<Tab>('summary');
  // Abas financeiras/auditoria continuam montadas após a primeira abertura:
  // voltar à seção não repete consultas Firestore durante a mesma ficha.
  const [visited, setVisited] = useState({ finance: false, activity: false });
  const openTab = (next: Tab) => {
    setTab(next);
    if (next === 'finance' || next === 'activity') {
      setVisited((current) => ({ ...current, [next]: true }));
    }
  };
  const [billing, setBilling] = useState<CustomerBillingSnapshot | null>(null);
  const [billingState, setBillingState] = useState<LoadState>('loading');
  const [billingError, setBillingError] = useState('');

  useEffect(() => {
    let current = true;
    setBillingState('loading');
    setBillingError('');
    readCustomerBilling(customer.workspaceId).then((result) => {
      if (!current) return;
      setBilling(result);
      setBillingState('ready');
    }).catch((reason: unknown) => {
      if (!current) return;
      setBillingError(errorText(reason));
      setBillingState('error');
    });
    return () => { current = false; };
  }, [customer.workspaceId]);

  return (
    <div className="space-y-5" data-testid="admin2-customer-360">
      <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#cbd9eb] bg-white px-4 text-xs font-bold text-[#205a9e] hover:bg-[#eff6ff]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar ao diretório
      </button>
      <section className={styles.sectionCard + ' overflow-hidden'}>
        <div className="border-b border-[#e3ebf6] bg-[linear-gradient(112deg,#eef6ff,#ffffff)] px-5 py-6 sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#c9def8] bg-white text-[#245cab] shadow-sm"><Landmark className="h-6 w-6" aria-hidden="true" /></div>
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#3771ba]">Clientes 360° / Acompanhamento administrativo</p>
                <h2 className="mt-1 text-xl font-black text-[#173357] sm:text-2xl">{customer.name}</h2>
                <p className="mt-2 text-xs text-[#7487a1]">{customer.organizationName || 'Organização não informada'} · UG {customer.ug || 'não cadastrada'}</p>
              </div>
            </div>
            <span className={'rounded-full px-3 py-1.5 text-[11px] font-bold ' + (customer.workspaceStatus === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800')}>{customer.workspaceStatus === 'active' ? 'Workspace ativo' : 'Workspace desativado'}</span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-lg border border-[#d5e3f3] bg-white px-3 py-2 text-[11px] font-semibold text-[#516c91]"><Building2 className="h-3.5 w-3.5" /> {customer.workspaceId}</span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-[#d5e3f3] bg-white px-3 py-2 text-[11px] font-semibold text-[#516c91]"><WalletCards className="h-3.5 w-3.5" /> {billingState === 'ready' ? customerBillingLabel(billing) : 'Assinatura em consulta'}</span>
          </div>
        </div>
        <div role="tablist" aria-label="Seções da ficha Cliente 360°" className="flex gap-1 overflow-x-auto border-b border-[#e5ebf5] bg-white px-3 py-3 sm:px-5">
          {TABS.map(({ id, title, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} aria-controls="admin2-customer-tabpanel"
              id={'admin2-customer-tab-' + id} onClick={() => openTab(id)}
              className={'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ' + (tab === id ? 'bg-[#1c579f] text-white shadow-sm' : 'text-[#637994] hover:bg-[#eff5fe] hover:text-[#265a9f]')}>
              <Icon className="h-4 w-4" aria-hidden="true" /> {title}
            </button>
          ))}
        </div>
        <div role="tabpanel" id="admin2-customer-tabpanel" aria-labelledby={'admin2-customer-tab-' + tab} className="space-y-4 bg-[#f7faff] p-4 sm:p-6">
          {tab === 'summary' && (
            <>
              <div className="grid gap-4 xl:grid-cols-2">
                <Surface title="Identificação institucional" icon={Building2} hint="Fonte: metadados do workspace existente.">
                  <dl>
                    <Info label="Workspace" value={customer.workspaceId} />
                    <Info label="UG" value={customer.ug || 'Não informada'} />
                    <Info label="OM / Organização" value={customer.organizationName || 'Não informada'} />
                    <Info label="Sigla" value={customer.organizationShortName || 'Não informada'} />
                    <Info label="Setor" value={customer.sectionName || 'Não informado'} />
                    <Info label="Última atualização" value={formatCustomerDate(customer.updatedAt)} />
                  </dl>
                </Surface>
                <Surface title="Situação comercial" icon={WalletCards} hint="Resumo obtido de billingAccounts quando a ficha é aberta.">
                  <BillingSummary billing={billing} state={billingState} error={billingError} />
                </Surface>
              </div>
              <ReadNotice>Consulta somente leitura. Esta ficha reúne metadados administrativos; não permite entrar em Empenhos, operar a Central de Depósitos de outro setor ou acessar Drive privado.</ReadNotice>
            </>
          )}
          {visited.finance && (
            <div hidden={tab !== 'finance'} className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
                <Surface title="Contrato financeiro existente" icon={WalletCards} hint="Mensalidade do workspace, não consolidado de vários clientes.">
                  <BillingSummary billing={billing} state={billingState} error={billingError} />
                </Surface>
                <BillingCycles workspaceId={customer.workspaceId} />
              </div>
              <ReadNotice>Mensalidades e competências são exibidas sem confirmar pagamentos, alterar status, acionar cobranças ou suspender acesso. VIPs e trials mantêm os valores armazenados, sem recalcular o contrato.</ReadNotice>
            </div>
          )}
          {visited.activity && (
            <div hidden={tab !== 'activity'} className="space-y-4">
              <AuditSample workspaceId={customer.workspaceId} />
              <Surface title="Marcos conhecidos" icon={Clock3} hint="Datas derivadas dos registros existentes, não ações de auditoria adicionais.">
                <dl><Info label="Atualização do workspace" value={formatCustomerDate(customer.updatedAt)} /></dl>
              </Surface>
            </div>
          )}
          {tab === 'relationship' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Surface title="Contato conhecido" icon={Mail} hint="Fonte: e-mail autorizado do workspace, não uma ficha comercial de contatos.">
                <dl>
                  <Info label="E-mail operacional" value={customer.authorizedEmail || 'Não informado'} />
                  <Info label="Contato comercial" value="Ainda não cadastrado" />
                  <Info label="Telefone" value="Ainda não cadastrado" />
                  <Info label="Organização" value={customer.organizationName || 'Não informada'} />
                </dl>
              </Surface>
              <Surface title="Vínculos do cliente" icon={Users} hint="Modelo comercial 1:N preparado, mas ainda não persistido.">
                <dl>
                  <Info label="Projeção atual" value={'workspace:' + customer.workspaceId} />
                  <Info label="Workspace identificado" value={customer.workspaceId} />
                  <Info label="Conta comercial independente" value="Não cadastrada" />
                  <Info label="Múltiplos workspaces comerciais" value="Pendente de implantação" />
                </dl>
              </Surface>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
