'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Headset,
  Search,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react';

import {
  ADMIN_COMMAND_IDS,
  ADMIN_COMMAND_NAVIGATION,
  AdminCommandMobileMenuButton,
  AdminCommandSidebar,
  type AdminCommandSectionId,
} from './AdminCommandSidebar';

const DEMO_CUSTOMERS = [
  { id: 'c001', name: 'Aprovisionamento Alfa', unit: 'Unidade Alfa', ug: '000001', status: 'Ativo', billing: 'Trial', activity: 'Hoje' },
  { id: 'c002', name: 'Aprovisionamento Bravo', unit: 'Unidade Bravo', ug: '000002', status: 'Ativo', billing: 'Em dia', activity: 'Ontem' },
  { id: 'c003', name: 'Aprovisionamento Charlie', unit: 'Unidade Charlie', ug: '000003', status: 'Ativo', billing: 'VIP', activity: 'Há 3 dias' },
  { id: 'c004', name: 'Aprovisionamento Delta', unit: 'Unidade Delta', ug: '000004', status: 'Suspenso', billing: 'Pendente', activity: 'Há 6 dias' },
] as const;

function readAreaFromUrl(): AdminCommandSectionId {
  const area = new URLSearchParams(window.location.search).get('area');
  return ADMIN_COMMAND_IDS.find((item) => item === area) || 'overview';
}

function DemoMetric({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Users;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#243650] bg-[#071225]/90 p-5 shadow-[0_15px_45px_rgba(0,5,20,0.13)] transition-[border-color,transform,background-color] duration-200 hover:-translate-y-0.5 hover:border-blue-300/25 hover:bg-[#0B1A33] motion-reduce:transform-none motion-reduce:transition-none">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[11px] font-semibold text-slate-400">{label}</p>
        <div className="grid h-9 w-9 place-items-center rounded-xl border border-blue-300/15 bg-blue-400/[0.08] text-blue-200">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
      <p className="text-[27px] font-extrabold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-[11px] text-slate-500">{hint}</p>
      <span className="pointer-events-none absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-blue-200/20 to-transparent" aria-hidden="true" />
    </div>
  );
}

function SectionCard({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-[#243650] bg-[#071225]/90 p-5 sm:p-6">
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-blue-300/65">{eyebrow}</p>
      <h3 className="mt-2 text-base font-bold text-white">{title}</h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Dashboard({ onNavigate }: { onNavigate: (id: AdminCommandSectionId) => void }) {
  return (
    <div className="space-y-5" data-testid="admin2-preview-overview">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DemoMetric label="Clientes cadastrados" value="04" hint="Cenário de demonstração" icon={Users} />
        <DemoMetric label="Workspaces ativos" value="03" hint="Sem conexão com dados reais" icon={Building2} />
        <DemoMetric label="Receita recorrente" value="R$ 140" hint="Valor ilustrativo, VIP excluído" icon={CircleDollarSign} />
        <DemoMetric label="Atendimentos abertos" value="02" hint="Exemplos de solicitações" icon={Headset} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <SectionCard eyebrow="CENTRAL DE COMANDO" title="O que merece atenção">
          <div className="space-y-3">
            {[
              { tone: 'amber', title: 'Uma assinatura precisa de acompanhamento', subtitle: 'Financeiro · cliente demonstrativo', icon: WalletCards },
              { tone: 'blue', title: 'Dois atendimentos aguardam revisão', subtitle: 'Atendimento · registros fictícios', icon: Bell },
              { tone: 'green', title: 'Painéis de administração organizados', subtitle: 'Navegação por áreas e contextos', icon: CheckCircle2 },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-center gap-3 rounded-xl border border-white/[0.065] bg-white/[0.025] p-3">
                  <div className={'grid h-9 w-9 shrink-0 place-items-center rounded-lg '
                    + (item.tone === 'amber' ? 'bg-amber-400/10 text-amber-300' : item.tone === 'green' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-blue-400/10 text-blue-200')}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-100">{item.title}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{item.subtitle}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
        <SectionCard eyebrow="VISÃO COMERCIAL" title="Composição da carteira">
          <div className="space-y-5">
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-800" aria-label="Exemplo de distribuição de assinaturas">
              <div className="w-1/2 bg-blue-400" />
              <div className="w-1/4 bg-amber-400" />
              <div className="w-1/4 bg-[#48735d]" />
            </div>
            <div className="space-y-3 text-xs">
              {[
                { color: 'bg-blue-400', text: 'Assinaturas regulares', qty: '02' },
                { color: 'bg-amber-400', text: 'Trial', qty: '01' },
                { color: 'bg-[#48735d]', text: 'VIP isento', qty: '01' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2">
                  <span className={'h-2 w-2 rounded-full ' + item.color} />
                  <span className="flex-1 text-slate-400">{item.text}</span>
                  <span className="font-bold text-slate-100">{item.qty}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onNavigate('customers')}
              className="inline-flex w-full items-center justify-between rounded-xl border border-blue-300/20 bg-blue-400/[0.08] px-4 py-3 text-[11px] font-semibold text-blue-100 transition hover:bg-blue-400/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              Abrir Clientes 360°
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </SectionCard>
      </div>
      <SectionCard eyebrow="LINHA DO TEMPO" title="Atividade administrativa">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { time: '09:40', title: 'Cadastro de novo cliente', subtitle: 'Exemplo de provisionamento' },
            { time: '10:15', title: 'Atualização de assinatura', subtitle: 'Exemplo de confirmação' },
            { time: '11:20', title: 'Atendimento concluído', subtitle: 'Exemplo de resolução' },
          ].map((item) => (
            <div key={item.time} className="rounded-xl border border-white/[0.07] bg-[#0B1930] p-4">
              <span className="font-mono text-[10px] font-semibold text-blue-300">{item.time}</span>
              <p className="mt-2 text-[12px] font-bold text-slate-100">{item.title}</p>
              <p className="mt-1 text-[11px] text-slate-500">{item.subtitle}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function CustomersDemo() {
  const [query, setQuery] = useState('');
  const filteredCustomers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return DEMO_CUSTOMERS.filter((customer) => (
      [customer.name, customer.unit, customer.ug, customer.status, customer.billing]
        .some((field) => field.toLocaleLowerCase('pt-BR').includes(normalized))
    ));
  }, [query]);

  return (
    <div className="space-y-5" data-testid="admin2-preview-customers">
      <SectionCard eyebrow="CLIENTES 360°" title="Diretório administrativo">
        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Pesquisar clientes de demonstração"
            placeholder="Pesquisar cliente, OM, UG ou situação..."
            className="h-11 w-full rounded-xl border border-white/10 bg-[#020817] pl-10 pr-3 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-300/40 focus:ring-2 focus:ring-blue-300/10"
          />
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
          <table className="w-full min-w-[680px] border-collapse text-left text-[12px]">
            <thead className="bg-[#0E2039] text-[10px] uppercase tracking-[0.08em] text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Cliente / OM</th>
                <th className="px-4 py-3 font-semibold">UG</th>
                <th className="px-4 py-3 font-semibold">Workspace</th>
                <th className="px-4 py-3 font-semibold">Assinatura</th>
                <th className="px-4 py-3 font-semibold">Atividade</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="border-t border-white/[0.06] text-slate-300 transition-colors hover:bg-white/[0.03]">
                  <td className="px-4 py-4"><p className="font-semibold text-slate-100">{customer.name}</p><p className="mt-1 text-[11px] text-slate-500">{customer.unit}</p></td>
                  <td className="px-4 py-4 font-mono text-[11px]">{customer.ug}</td>
                  <td className="px-4 py-4"><span className={customer.status === 'Ativo' ? 'text-emerald-300' : 'text-amber-300'}>{customer.status}</span></td>
                  <td className="px-4 py-4">{customer.billing}</td>
                  <td className="px-4 py-4">{customer.activity}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCustomers.length === 0 && (
            <p className="px-4 py-9 text-center text-xs text-slate-400">Nenhum cliente demonstrativo corresponde à pesquisa.</p>
          )}
        </div>
        <p className="mt-4 text-[11px] text-slate-500">A ficha 360° real será implementada pelo W03. Esta prévia demonstra somente o estilo, a navegação e a pesquisa local com informações fictícias.</p>
      </SectionCard>
    </div>
  );
}

function GenericArea({ activeId, label, detail }: { activeId: AdminCommandSectionId; label: string; detail: string }) {
  return (
    <div className="space-y-5" data-testid={'admin2-preview-area-' + activeId}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <DemoMetric label="Visão da área" value="—" hint="Dados reais não carregados" icon={Activity} />
        <DemoMetric label="Itens para acompanhar" value="—" hint="Integração planejada" icon={Clock3} />
        <DemoMetric label="Situação administrativa" value="—" hint="Prévia visual sem operações" icon={ShieldCheck} />
      </div>
      <SectionCard eyebrow="PROTÓTIPO DE NAVEGAÇÃO" title={label}>
        <div className="rounded-xl border border-dashed border-blue-300/20 bg-blue-400/[0.04] px-5 py-8">
          <p className="max-w-xl text-sm leading-7 text-slate-300">{detail}</p>
          <p className="mt-4 text-xs leading-6 text-slate-500">
            A seção já participa da navegação e do comportamento da barra lateral. Os dados,
            formulários e ações serão implementados pelo worker responsável e certificados
            antes de integrar ao produto.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}

export function AdminCommandPreview() {
  const [activeId, setActiveId] = useState<AdminCommandSectionId>('overview');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    setActiveId(readAreaFromUrl());
    const onPopState = () => setActiveId(readAreaFromUrl());
    window.addEventListener('popstate', onPopState);
    try {
      setCollapsed(window.localStorage.getItem('emprovex.admin2.sidebar.collapsed') === 'true');
    } catch {
      // Browser storage may be unavailable; navigation still works.
    }
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((id: AdminCommandSectionId) => {
    setActiveId(id);
    const nextUrl = new URL(window.location.href);
    if (id === 'overview') nextUrl.searchParams.delete('area');
    else nextUrl.searchParams.set('area', id);
    window.history.pushState(window.history.state, '', nextUrl);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try { window.localStorage.setItem('emprovex.admin2.sidebar.collapsed', String(next)); } catch {}
      return next;
    });
  }, []);

  const activeItem = ADMIN_COMMAND_NAVIGATION
    .flatMap((group) => group.items)
    .find((item) => item.id === activeId) || ADMIN_COMMAND_NAVIGATION[0].items[0];
  const ActiveIcon = activeItem.icon;

  return (
    <div className="min-h-screen bg-[#020817] font-montserrat text-slate-100 selection:bg-blue-500/40">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_84%_0%,rgba(36,84,151,0.11),transparent_40%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/25 to-transparent" />
      </div>
      <header className="sticky top-0 z-30 border-b border-[#31517a]/60 bg-[linear-gradient(105deg,#07152d_0%,#10294f_38%,#061023_78%)] shadow-[0_4px_28px_rgba(0,4,20,0.26)] backdrop-blur-xl">
        <div className="flex h-[72px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <AdminCommandMobileMenuButton onClick={() => setMobileOpen(true)} />
            <div className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl border border-blue-300/25 bg-blue-400/10 text-blue-100 shadow-[0_0_20px_rgba(59,130,246,0.1)] sm:grid">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[16px] font-black tracking-[0.025em] text-white">
                EMPROVEX <span className="ml-1 font-mono text-[9px] font-semibold tracking-[0.15em] text-blue-300/85">COMMAND</span>
              </p>
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">Administração da plataforma</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-amber-300/15 bg-amber-300/[0.06] px-3 py-1.5 text-[10px] font-semibold text-amber-100 sm:inline-flex">
              Preview • dados fictícios
            </span>
            <div className="grid h-9 w-9 place-items-center rounded-full border border-blue-300/20 bg-[#102548] text-[10px] font-bold text-blue-100" aria-label="Conta de demonstração">
              AD
            </div>
          </div>
        </div>
      </header>

      <div data-testid="admin2-edge-to-edge-shell" className="relative flex min-h-[calc(100dvh-72px)] w-full items-start gap-0">
        <AdminCommandSidebar
          activeId={activeId}
          onNavigate={navigate}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={closeMobile}
        />
        <main className="min-w-0 flex-1 bg-[#020817] px-4 pb-8 pt-5 sm:px-6 lg:px-8 lg:pt-6 2xl:px-10" id="admin2-preview-content">
          <div className="mb-5 rounded-[22px] border border-[#243650] bg-[#071225]/80 px-5 py-6 sm:px-7 sm:py-7">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-500">
              <span>Administração</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="text-blue-200">{activeItem.label}</span>
            </div>
            <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-blue-300/20 bg-blue-400/[0.09] text-blue-200">
                  <ActiveIcon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl" data-testid="admin2-preview-title">
                    {activeItem.label}
                  </h1>
                  <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-400">{activeItem.detail}</p>
                </div>
              </div>
              <div className="hidden items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] text-slate-400 md:flex">
                <ShieldCheck className="h-4 w-4 text-blue-200" aria-hidden="true" />
                Área Administrativa
              </div>
            </div>
          </div>
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300/15 bg-amber-400/[0.055] px-4 py-3 text-[11px] leading-6 text-amber-100/80" role="note">
            <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span><strong className="text-amber-100">Laboratório local:</strong> navegação e visual interativos. Todos os clientes, valores e eventos são fictícios. Nenhuma operação de Firestore, Firebase Auth, faturamento ou Google Drive é realizada nesta tela.</span>
          </div>
          {activeId === 'overview' ? (
            <Dashboard onNavigate={navigate} />
          ) : activeId === 'customers' ? (
            <CustomersDemo />
          ) : (
            <GenericArea activeId={activeId} label={activeItem.label} detail={activeItem.detail} />
          )}
          <footer className="mt-7 border-t border-white/[0.07] py-5 text-center font-mono text-[10px] text-slate-600">
            EMPROVEX COMMAND · ADMIN 2.0 · PRÉVIA LOCAL ISOLADA
          </footer>
        </main>
      </div>
    </div>
  );
}
