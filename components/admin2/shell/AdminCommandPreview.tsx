'use client';

import { useCallback, useEffect, useState } from 'react';
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
import styles from './AdminCommandPreview.module.css';
import { AdminCustomersDirectory } from '../customers/AdminCustomersDirectory';

function readAreaFromUrl(): AdminCommandSectionId {
  const area = new URLSearchParams(window.location.search).get('area');
  return ADMIN_COMMAND_IDS.find((item) => item === area) || 'overview';
}

function DemoMetric({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'blue',
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Users;
  tone?: 'blue' | 'teal' | 'green' | 'amber';
}) {
  return (
    <div className={styles.metric + ' ' + (tone === 'green' ? styles.metricGreen : tone === 'amber' ? styles.metricAmber : tone === 'teal' ? styles.metricTeal : styles.metricBlue)}>
      <div className="relative z-10 mb-4 flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-[#64758e]">{label}</p>
        <div className={styles.metricIcon}>
          <Icon className="h-[19px] w-[19px]" aria-hidden="true" />
        </div>
      </div>
      <p className="relative z-10 text-[28px] font-extrabold tracking-tight text-[#112749]">{value}</p>
      <p className="relative z-10 mt-2 text-[11px] font-medium text-[#7c8ba0]">{hint}</p>
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
    <section className={styles.sectionCard + ' p-5 sm:p-6'}>
      <p className={styles.sectionEyebrow + ' font-mono uppercase'}>{eyebrow}</p>
      <h3 className="mt-2 text-[16px] font-extrabold text-[#14294b]">{title}</h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Dashboard({ onNavigate }: { onNavigate: (id: AdminCommandSectionId) => void }) {
  return (
    <div className="space-y-5" data-testid="admin2-preview-overview">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DemoMetric label="Clientes cadastrados" value="04" hint="Cenário de demonstração" icon={Users} tone="blue" />
        <DemoMetric label="Workspaces ativos" value="03" hint="Sem conexão com dados reais" icon={Building2} tone="teal" />
        <DemoMetric label="Receita recorrente" value="R$ 140" hint="Valor ilustrativo, VIP excluído" icon={CircleDollarSign} tone="green" />
        <DemoMetric label="Atendimentos abertos" value="02" hint="Exemplos de solicitações" icon={Headset} tone="amber" />
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
                <div key={item.title} className={styles.activityRow + ' flex items-center gap-3'}>
                  <div className={'grid h-9 w-9 shrink-0 place-items-center rounded-lg '
                    + (item.tone === 'amber' ? 'bg-amber-100 text-amber-700' : item.tone === 'green' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700')}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[#213859]">{item.title}</p>
                    <p className="mt-1 text-[10px] text-[#76869a]">{item.subtitle}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
        <SectionCard eyebrow="VISÃO COMERCIAL" title="Composição da carteira">
          <div className="space-y-5">
            <div className="flex h-3 overflow-hidden rounded-full bg-[#e2ebf6]" aria-label="Exemplo de distribuição de assinaturas">
              <div className="w-1/2 bg-[#2359b9]" />
              <div className="w-1/4 bg-[#edaa3d]" />
              <div className="w-1/4 bg-[#26977a]" />
            </div>
            <div className="space-y-3 text-xs">
              {[
                { color: 'bg-[#2359b9]', text: 'Assinaturas regulares', qty: '02' },
                { color: 'bg-[#edaa3d]', text: 'Trial', qty: '01' },
                { color: 'bg-[#26977a]', text: 'VIP isento', qty: '01' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2">
                  <span className={'h-2 w-2 rounded-full ' + item.color} />
                  <span className="flex-1 text-[#5f728c]">{item.text}</span>
                  <span className="font-extrabold text-[#172c4d]">{item.qty}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onNavigate('customers')}
              className="inline-flex w-full items-center justify-between rounded-xl border border-[#164f9d] bg-[#123e8c] px-4 py-3 text-[11px] font-semibold text-white shadow-[0_7px_18px_rgba(24,72,159,0.16)] transition hover:bg-[#1d59b1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
            <div key={item.time} className={styles.timelineCard}>
              <span className="inline-flex rounded-md bg-[#e7f0ff] px-2 py-1 font-mono text-[10px] font-extrabold text-[#2358a5]">{item.time}</span>
              <p className="mt-3 text-[12px] font-bold text-[#203656]">{item.title}</p>
              <p className="mt-1 text-[11px] text-[#73839a]">{item.subtitle}</p>
            </div>
          ))}
        </div>
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
        <div className={styles.genericPanel + ' px-5 py-8'}>
          <p className="max-w-xl text-sm leading-7 text-[#344d70]">{detail}</p>
          <p className="mt-4 text-xs leading-6 text-[#7186a1]">
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    setActiveId(readAreaFromUrl());
    const onPopState = () => setActiveId(readAreaFromUrl());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((id: AdminCommandSectionId) => {
    setActiveId(id);
    const nextUrl = new URL(window.location.href);
    if (id === 'overview') nextUrl.searchParams.delete('area');
    else nextUrl.searchParams.set('area', id);
    window.history.pushState(window.history.state, '', nextUrl);
  }, []);

  const activeItem = ADMIN_COMMAND_NAVIGATION
    .flatMap((group) => group.items)
    .find((item) => item.id === activeId) || ADMIN_COMMAND_NAVIGATION[0].items[0];
  const ActiveIcon = activeItem.icon;

  return (
    <div className="min-h-screen bg-[#eaf1fb] font-montserrat text-[#172c4d] selection:bg-blue-200">

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
              {activeId === 'customers' ? 'Clientes • leitura administrativa protegida' : 'Preview • dados fictícios'}
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
          mobileOpen={mobileOpen}
          onCloseMobile={closeMobile}
        />
        <main className={styles.mainCanvas + ' min-w-0 w-full flex-1 px-4 pb-8 pt-5 sm:px-6 lg:ml-[288px] lg:px-8 lg:pt-6 2xl:px-10'} id="admin2-preview-content" data-testid="admin2-light-content">
          <div className={styles.hero + ' mb-5 rounded-[22px] px-5 py-6 sm:px-7 sm:py-7'}>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.11em] text-[#7185a2]">
              <span>Administração</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="font-extrabold text-[#1a4ca5]">{activeItem.label}</span>
            </div>
            <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[#acc6ee] bg-[#e2efff] text-[#1954af] shadow-[0_6px_16px_rgba(51,107,188,0.1)]">
                  <ActiveIcon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-[#152e56] sm:text-3xl" data-testid="admin2-preview-title">
                    {activeItem.label}
                  </h1>
                  <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-[#657b99]">{activeItem.detail}</p>
                </div>
              </div>
              <div className="hidden items-center gap-2 rounded-xl border border-[#cfdeee] bg-white/65 px-3 py-2 text-[11px] font-semibold text-[#4b6790] md:flex">
                <ShieldCheck className="h-4 w-4 text-[#2d67b3]" aria-hidden="true" />
                Área Administrativa
              </div>
            </div>
          </div>
          <div className={styles.notice + ' mb-5 flex items-start gap-3 px-4 py-3 text-[11px] leading-6'} role="note">
            <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span><strong className="text-[#875613]">Laboratório local:</strong> {activeId === 'customers'
              ? 'Diretório e ficha 360° conectados aos metadados administrativos reais somente após login Google do fundador. Consultas Firestore limitadas e somente leitura; sem mudanças em workspaces, faturamento ou Drive.'
              : 'Visão geral e demais áreas ainda apresentam indicadores ilustrativos. Apenas a seção Clientes está conectada para consulta administrativa, mediante autenticação.'}</span>
          </div>
          {activeId === 'overview' ? (
            <Dashboard onNavigate={navigate} />
          ) : activeId === 'customers' ? (
            <AdminCustomersDirectory />
          ) : (
            <GenericArea activeId={activeId} label={activeItem.label} detail={activeItem.detail} />
          )}
          <footer className="mt-7 border-t border-[#ccd8e8] py-5 text-center font-mono text-[10px] font-semibold text-[#8191a8]">
            EMPROVEX COMMAND · ADMIN 2.0 · PRÉVIA LOCAL ISOLADA
          </footer>
        </main>
      </div>
    </div>
  );
}
