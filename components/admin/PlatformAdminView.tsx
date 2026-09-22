'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Building2,
  CirclePause,
  CirclePlay,
  Database,
  DatabaseBackup,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  MonitorSmartphone,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
  WalletCards,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';

import { EditSectorModal } from './EditSectorModal';
import { AdminBackupPanel } from './AdminBackupPanel';
import { AdminConsumptionHub } from './AdminConsumptionHub';
import { AdminCreateSectorPanel } from './AdminCreateSectorPanel';
import { AdminSecurityPanel } from './AdminSecurityPanel';
import { AdminBillingPanel } from './AdminBillingPanel';
import { AdminSessionsPanel } from './AdminSessionsPanel';
import { ToastNotification } from '../layout/ToastNotification';
import { createHgesmFoundingWorkspace } from '../../lib/hgesmWorkspace';
import type {
  CreateSectorWorkspaceInput,
  SectorLifecycleStatus,
  UpdateSectorWorkspaceInput,
} from '../../lib/platformAdminStore';
import type { Workspace } from '../../lib/platformIdentity';
import type { AdminWorkspaceSession } from '../../lib/platformAdminSessions';
import type { AdminWorkspaceUsageEstimate } from '../../lib/platformAdminUsage';
import type {
  FirebaseGlobalMetricDataThrough,
  FirebaseGlobalUsageSnapshot,
  GoogleMonitoringCredentialSource,
} from '../../lib/platformCapacity';
import { setActiveProfileMode } from '../../lib/profileMode';
import type {
  BillingAccount,
  BillingAccountStatus,
  BillingCycle,
  BillingCycleStatus,
  PlatformBillingConfig,
} from '../../lib/billing';
import type { UpdatePlatformBillingConfigInput } from '../../lib/platformBillingStore';

type AdminTabId =
  | 'overview'
  | 'setores'
  | 'novo-setor'
  | 'consumo'
  | 'sessoes'
  | 'assinaturas'
  | 'backups'
  | 'seguranca';

const ADMIN_TABS = [
  {
    id: 'overview',
    label: 'Visão Geral',
    description: 'Resumo da plataforma, saúde dos serviços e pontos que exigem atenção.',
    icon: LayoutDashboard,
  },
  {
    id: 'setores',
    label: 'Setores',
    description: 'Gestão dos workspaces, UGs, responsáveis e ciclo de vida dos usuários.',
    icon: Building2,
  },
  {
    id: 'novo-setor',
    label: 'Cadastrar Setor',
    description: 'Provisionamento completo de uma nova unidade operacional.',
    icon: Plus,
  },
  {
    id: 'consumo',
    label: 'Consumo & Cotas',
    description: 'Telemetria real do Google, estimativas por UG, histórico e limites.',
    icon: BarChart3,
  },
  {
    id: 'sessoes',
    label: 'Sessões',
    description: 'Acompanhamento das sessões simultâneas e encerramento remoto.',
    icon: MonitorSmartphone,
  },
  {
    id: 'assinaturas',
    label: 'Assinaturas',
    description: 'Trial, situação comercial e controle administrativo de cobrança.',
    icon: WalletCards,
  },
  {
    id: 'backups',
    label: 'Backup & Recuperação',
    description: 'Saúde dos backups, recuperação e proteção dos dados administrativos.',
    icon: DatabaseBackup,
  },
  {
    id: 'seguranca',
    label: 'Segurança',
    description: 'Isolamento multi-tenant, integridade e postura de segurança da plataforma.',
    icon: ShieldAlert,
  },
] satisfies Array<{
  id: AdminTabId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}>;

interface AdminBillingViewState {
  config: PlatformBillingConfig | null;
  accounts: BillingAccount[];
  cyclesByWorkspace: Map<string, BillingCycle[]>;
  loading: boolean;
  error: string | null;
  mutatingKey: string | null;
  updateConfig: (input: UpdatePlatformBillingConfigInput) => Promise<unknown>;
  grantTrial: (workspace: Workspace, trialDays?: number) => Promise<unknown>;
  setStatus: (
    workspace: Workspace,
    status: Exclude<BillingAccountStatus, 'exempt'>
  ) => Promise<unknown>;
  setCycleStatus: (
    workspace: Workspace,
    referenceMonth: string,
    status: BillingCycleStatus,
    note?: string
  ) => Promise<unknown>;
}

interface PlatformAdminViewProps {
  adminUser: User;
  adminEmail: string;
  customLogo: string | null;
  workspaces: Workspace[];
  loadingDirectory: boolean;
  directoryError: string | null;
  creatingSector: boolean;
  updatingWorkspaceId: string | null;
  changingStatusWorkspaceId: string | null;
  deletingWorkspaceId: string | null;
  resettingPasswordWorkspaceId: string | null;
  sessions: AdminWorkspaceSession[];
  loadingSessions: boolean;
  sessionsError: string | null;
  terminatingSessionId: string | null;
  usage: AdminWorkspaceUsageEstimate[];
  loadingUsage: boolean;
  usageError: string | null;
  globalUsage: FirebaseGlobalUsageSnapshot | null;
  globalUsageConfigured: boolean | null;
  globalUsageObservedAt: string | null;
  globalUsageDataThrough: string | null;
  globalUsageMetricDataThrough: FirebaseGlobalMetricDataThrough | null;
  globalUsageCredentialSource: GoogleMonitoringCredentialSource | null;
  loadingGlobalUsage: boolean;
  globalUsageError: string | null;
  billing: AdminBillingViewState;
  onCreateSector: (input: CreateSectorWorkspaceInput) => Promise<void>;
  onUpdateSector: (input: UpdateSectorWorkspaceInput) => Promise<void>;
  onChangeSectorStatus: (workspaceId: string, status: SectorLifecycleStatus) => Promise<void>;
  onDeleteSector: (workspaceId: string, email: string) => Promise<void>;
  onResetSectorPassword: (workspaceId: string, email: string, newPassword: string) => Promise<void>;
  onTerminateSession: (session: AdminWorkspaceSession) => Promise<void>;
  onRefreshUsage: () => Promise<void>;
  onRefreshGlobalUsage: () => Promise<void>;
  onLogout: () => Promise<void>;
}

export function PlatformAdminView({
  adminUser,
  adminEmail,
  customLogo,
  workspaces,
  loadingDirectory,
  directoryError,
  creatingSector,
  updatingWorkspaceId,
  changingStatusWorkspaceId,
  deletingWorkspaceId,
  resettingPasswordWorkspaceId,
  sessions,
  loadingSessions,
  sessionsError,
  terminatingSessionId,
  usage,
  loadingUsage,
  usageError,
  globalUsage,
  globalUsageConfigured,
  globalUsageObservedAt,
  globalUsageDataThrough,
  globalUsageMetricDataThrough,
  globalUsageCredentialSource,
  loadingGlobalUsage,
  globalUsageError,
  billing,
  onCreateSector,
  onUpdateSector,
  onChangeSectorStatus,
  onDeleteSector,
  onResetSectorPassword,
  onTerminateSession,
  onRefreshUsage,
  onRefreshGlobalUsage,
  onLogout,
}: PlatformAdminViewProps) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<AdminTabId>('overview');
  const [sectorQuery, setSectorQuery] = useState('');
  const [sectorStatusFilter, setSectorStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Workspace | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusCandidate, setStatusCandidate] = useState<Workspace | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showAdminToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab') as AdminTabId | null;
    if (requestedTab && ADMIN_TABS.some((tab) => tab.id === requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, []);

  const changeAdminTab = useCallback((tab: AdminTabId) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === 'overview') {
      url.searchParams.delete('tab');
    } else {
      url.searchParams.set('tab', tab);
    }
    window.history.replaceState(window.history.state, '', url);
  }, []);

  const visibleWorkspaces = useMemo(
    () => workspaces.length > 0 ? workspaces : [createHgesmFoundingWorkspace('')],
    [workspaces]
  );

  const persistentDirectoryReady = !loadingDirectory && !directoryError;

  const activeWorkspaceCount = visibleWorkspaces.filter((workspace) => workspace.status === 'active').length;
  const disabledWorkspaceCount = visibleWorkspaces.filter((workspace) => workspace.status === 'disabled').length;

  const filteredWorkspaces = useMemo(() => {
    const query = sectorQuery.trim().toLocaleLowerCase('pt-BR');
    return visibleWorkspaces.filter((workspace) => {
      const matchesStatus =
        sectorStatusFilter === 'all' || workspace.status === sectorStatusFilter;
      if (!matchesStatus) return false;
      if (!query) return true;

      return [
        workspace.name,
        workspace.ug,
        workspace.authorizedEmail,
        workspace.id,
        workspace.institutionalProfile.organizationName,
        workspace.institutionalProfile.organizationShortName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('pt-BR').includes(query));
    });
  }, [sectorQuery, sectorStatusFilter, visibleWorkspaces]);

  const attentionItems = [
    directoryError ? 'Diretório administrativo com pendência de persistência.' : null,
    sessionsError ? 'Monitoramento de sessões requer atenção.' : null,
    usageError ? 'Telemetria estimada por UG requer atenção.' : null,
    globalUsageError ? 'Telemetria global do Firebase requer atenção.' : null,
    billing.error ? 'Controle administrativo de assinaturas requer atenção.' : null,
    disabledWorkspaceCount > 0
      ? disabledWorkspaceCount + ' setor(es) está(ão) suspenso(s).'
      : null,
  ].filter((item): item is string => Boolean(item));

  const handleCreateSector = async (input: CreateSectorWorkspaceInput) => {
    const resultName = input.workspaceName.trim();
    await onCreateSector(input);
    showAdminToast(`Setor ${resultName} cadastrado e provisionado com sucesso.`, 'success');
  };

  const handleUpdateSector = async (input: UpdateSectorWorkspaceInput) => {
    const resultName = input.workspaceName.trim();
    await onUpdateSector(input);
    showAdminToast(`Setor ${resultName} atualizado com sucesso.`, 'success');
  };

  const requestChangeSectorStatus = (workspace: Workspace) => {
    if (workspace.legacyWorkspace) return;
    setStatusCandidate(workspace);
  };

  const confirmChangeSectorStatus = async () => {
    const workspace = statusCandidate;
    if (!workspace || workspace.legacyWorkspace) return;

    const nextStatus: SectorLifecycleStatus = workspace.status === 'active' ? 'disabled' : 'active';
    try {
      await onChangeSectorStatus(workspace.id, nextStatus);
      setStatusCandidate(null);
      showAdminToast(
        nextStatus === 'disabled'
          ? `Setor ${workspace.name} suspenso. O acesso operacional foi bloqueado.`
          : `Setor ${workspace.name} reativado com sucesso.`,
        nextStatus === 'disabled' ? 'info' : 'success'
      );
    } catch (error) {
      showAdminToast(
        error instanceof Error ? error.message : 'Não foi possível alterar o status deste setor.',
        'error'
      );
    }
  };

  const requestDeleteSector = (workspace: Workspace) => {
    if (workspace.legacyWorkspace) return;
    setDeleteError(null);
    setDeleteCandidate(workspace);
  };

  const confirmDeleteSector = async () => {
    const workspace = deleteCandidate;
    if (!workspace || workspace.legacyWorkspace) return;

    setDeleteError(null);
    try {
      await onDeleteSector(workspace.id, workspace.authorizedEmail);
      setEditingWorkspace((current) => current?.id === workspace.id ? null : current);
      setDeleteCandidate(null);
      showAdminToast(`Setor ${workspace.name} excluído definitivamente.`, 'success');
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : 'Não foi possível excluir este usuário com segurança.'
      );
    }
  };

  const returnToHgesm = () => {
    setActiveProfileMode('sector');
    router.replace('/');
  };

  const activeTabConfig = ADMIN_TABS.find((tab) => tab.id === activeTab) || ADMIN_TABS[0];
  const ActiveTabIcon = activeTabConfig.icon;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#020817] text-white selection:bg-blue-500 selection:text-white">
      <ToastNotification toast={toast} onClose={() => setToast(null)} />

      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(37,99,235,0.14),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(56,189,248,0.08),transparent_28%),linear-gradient(145deg,#020817_0%,#061126_48%,#071a34_100%)]" />
        <div className="absolute left-[7%] top-32 h-72 w-72 rounded-full bg-blue-500/[0.06] blur-3xl" />
        <div className="absolute -right-20 top-[28%] h-96 w-96 rounded-full bg-cyan-400/[0.035] blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/35 to-transparent" />
        <div className="absolute left-[12%] top-28 hidden h-px w-[28%] bg-gradient-to-r from-blue-300/0 via-blue-300/20 to-blue-300/0 lg:block" />
        <div className="absolute right-[10%] top-40 hidden h-px w-[22%] bg-gradient-to-r from-cyan-200/0 via-cyan-200/15 to-cyan-200/0 lg:block" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#030b1b]/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="relative grid h-11 w-11 shrink-0 place-items-center">
              <span className="absolute inset-0 rounded-2xl border border-blue-300/15 bg-blue-500/[0.06] shadow-[0_0_30px_rgba(37,99,235,0.12)]" />
              <span className="absolute inset-[5px] rounded-xl border border-white/[0.08]" />
              <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-[#071a3a]">
                {customLogo ? (
                  <img src={customLogo} alt="Logo EMPROVEX" className="h-full w-full object-contain p-0.5" />
                ) : (
                  <span className="text-[9px] font-black tracking-[0.10em] text-white">EMP</span>
                )}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 lg:hidden">
                <div>
                  <p className="font-mono text-[7px] font-bold uppercase tracking-[0.22em] text-blue-300/55">Central de comando</p>
                  <h1 className="mt-0.5 text-base font-extrabold tracking-[0.16em] text-white sm:text-lg">EMPROVEX</h1>
                </div>
                <span className="hidden rounded-full border border-blue-300/15 bg-blue-400/[0.07] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-blue-200 sm:inline-flex">
                  Administração
                </span>
              </div>
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.10em] text-slate-500">Governança da plataforma</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={returnToHgesm}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-300/15 bg-blue-400/[0.07] px-3.5 text-xs font-bold text-blue-100 transition hover:border-blue-300/25 hover:bg-blue-400/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/50"
              title="Alternar para o perfil operacional do HGeSM"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar ao HGeSM</span>
            </button>

            <button
              type="button"
              onClick={() => void onLogout()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3.5 text-xs font-bold text-slate-300 transition hover:border-white/[0.14] hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/50"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[1640px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
        <div className="grid min-w-0 gap-5 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[268px_minmax(0,1fr)]">
          <aside
            data-testid="admin-tab-navigation"
            data-layout="sidebar"
            className="min-w-0 lg:sticky lg:top-24 lg:self-start"
          >
            <div className="overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#030b1b]/88 shadow-[0_24px_70px_rgba(0,8,28,0.24)] backdrop-blur-2xl">
              <div className="border-b border-white/[0.07] p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-blue-300/15 bg-blue-500/[0.08] text-blue-100">
                    <UserCog className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-blue-300/55">
                      Administração
                    </p>
                    <p className="truncate text-xs font-extrabold text-white">{adminEmail}</p>
                  </div>
                </div>
              </div>

              <nav aria-label="Áreas administrativas" className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 lg:grid-cols-1">
                {ADMIN_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const selected = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => changeAdminTab(tab.id)}
                      aria-pressed={selected}
                      data-testid={'admin-tab-' + tab.id}
                      className={
                        'group flex min-h-12 min-w-0 items-center gap-3 rounded-xl border px-3 text-left transition '
                        + (selected
                          ? 'border-blue-300/25 bg-blue-500/15 text-blue-50 shadow-[inset_3px_0_0_rgba(96,165,250,0.72)]'
                          : 'border-transparent bg-transparent text-slate-400 hover:border-white/[0.07] hover:bg-white/[0.035] hover:text-white')
                      }
                    >
                      <span className={
                        'grid h-8 w-8 shrink-0 place-items-center rounded-lg border '
                        + (selected
                          ? 'border-blue-300/20 bg-blue-400/[0.10] text-blue-200'
                          : 'border-white/[0.06] bg-white/[0.025] text-slate-500 group-hover:text-slate-300')
                      }>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[11px] font-extrabold">{tab.label}</span>
                        <span className="mt-0.5 hidden truncate text-[9px] text-slate-600 lg:block">
                          {tab.id === 'consumo'
                            ? 'Google + UG'
                            : tab.id === 'assinaturas'
                              ? 'Billing OBSERVE'
                              : tab.id === 'sessoes'
                                ? 'Tempo real'
                                : 'Gestão'}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </nav>

              <div className="border-t border-white/[0.07] p-3">
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={returnToHgesm}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-300/12 bg-blue-400/[0.055] px-3 text-[10px] font-extrabold text-blue-100 transition hover:bg-blue-400/[0.10]"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    Voltar ao HGeSM
                  </button>
                  <button
                    type="button"
                    onClick={() => void onLogout()}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-[10px] font-extrabold text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
                  >
                    <LogOut className="h-4 w-4" />
                    Encerrar sessão
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-5">
        <motion.section
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0.12 : 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.09] bg-[#071225]/72 p-5 shadow-[0_24px_70px_rgba(0,8,28,0.24)] backdrop-blur-2xl sm:p-6"
        >
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-500/[0.10] blur-3xl" />
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-blue-200/45 to-transparent" />
          <div className="pointer-events-none absolute left-0 top-14 h-32 w-px bg-gradient-to-b from-transparent via-blue-300/25 to-transparent" />
          <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.20em] text-blue-200/70">
                <ShieldCheck className="w-4 h-4" />
                Perfil administrativo
              </div>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-blue-300/15 bg-blue-400/[0.07] text-blue-200">
                  <ActiveTabIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-blue-300/55">
                    Central de Administração EMPROVEX
                  </p>
                  <h2 className="mt-0.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                    {activeTabConfig.label}
                  </h2>
                </div>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
                {activeTabConfig.description}
              </p>
            </div>

            <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-slate-950/30 px-4 py-3.5 shadow-inner shadow-black/10 lg:min-w-[310px]">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">Setores ativos</p>
                  <p className="mt-1 text-lg font-black text-white">{activeWorkspaceCount}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">Google Cloud</p>
                  <p className={
                    'mt-1 text-sm font-extrabold '
                    + (globalUsageConfigured === true
                      ? 'text-emerald-300'
                      : globalUsageConfigured === false
                        ? 'text-amber-300'
                        : 'text-slate-300')
                  }>
                    {globalUsageConfigured === true
                      ? 'Conectado'
                      : globalUsageConfigured === false
                        ? 'Configurar'
                        : 'Verificando'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {directoryError && (
          <section className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.08] px-5 py-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-extrabold text-amber-200">Persistência administrativa aguardando liberação</h3>
              <p className="text-xs text-amber-100/80 mt-1 leading-relaxed">{directoryError}</p>
              <p className="text-[11px] text-amber-100/60 mt-2 leading-relaxed">
                O ambiente operacional do HGeSM continua independente e não é afetado por esta pendência.
              </p>
            </div>
          </section>
        )}

        {activeTab === 'overview' && (
          <div data-testid="admin-overview-tab" className="space-y-5">
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AdminMetric
                icon={<Building2 className="w-5 h-5" />}
                label="Setores cadastrados"
                value={String(visibleWorkspaces.length)}
                detail={workspaces.length > 0 ? 'Diretório administrativo persistente' : 'HGeSM exibido pelo registro fundador'}
              />
              <AdminMetric
                icon={<ShieldCheck className="w-5 h-5" />}
                label="Setores ativos"
                value={String(activeWorkspaceCount)}
                detail="Acesso operacional liberado"
              />
              <AdminMetric
                icon={<MonitorSmartphone className="w-5 h-5" />}
                label="Sessões monitoradas"
                value={String(sessions.length)}
                detail="Sessões atualmente conhecidas pelo painel"
              />
              <AdminMetric
                icon={<Database className="w-5 h-5" />}
                label="Firebase global"
                value={
                  globalUsageConfigured === true
                    ? 'Conectado'
                    : globalUsageConfigured === false
                      ? 'Configurar'
                      : 'Verificando'
                }
                detail="Telemetria global independente da estimativa por UG"
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
              <div className="rounded-[2rem] border border-white/[0.08] bg-[#071225]/60 p-5 backdrop-blur-xl sm:p-6">
                <div className="flex items-start gap-3">
                  <div className={
                    'grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl border '
                    + (attentionItems.length > 0
                      ? 'border-amber-300/15 bg-amber-400/[0.07] text-amber-200'
                      : 'border-emerald-300/15 bg-emerald-400/[0.07] text-emerald-200')
                  }>
                    {attentionItems.length > 0
                      ? <AlertTriangle className="h-5 w-5" />
                      : <ShieldCheck className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Atenção necessária
                    </p>
                    <h3 className="mt-1 text-lg font-extrabold text-white">
                      {attentionItems.length > 0
                        ? attentionItems.length + ' ponto(s) para revisar'
                        : 'Nenhuma pendência administrativa detectada'}
                    </h3>
                    {attentionItems.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {attentionItems.map((item) => (
                          <div
                            key={item}
                            className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 text-xs text-slate-300"
                          >
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-300" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs leading-relaxed text-slate-400">
                        Diretório, telemetria e ciclo de vida dos setores não apresentam alertas conhecidos nesta visão.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/[0.08] bg-[#071225]/60 p-5 backdrop-blur-xl sm:p-6">
                <p className="font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-blue-300/60">
                  Ações rápidas
                </p>
                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    onClick={() => changeAdminTab('novo-setor')}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-300/15 bg-blue-500/10 px-3.5 text-left text-xs font-extrabold text-blue-100 transition hover:bg-blue-500/15"
                  >
                    <Plus className="h-4 w-4" />
                    Cadastrar novo setor
                  </button>
                  <button
                    type="button"
                    onClick={() => changeAdminTab('consumo')}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 text-left text-xs font-extrabold text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Ver consumo e cotas
                  </button>
                  <button
                    type="button"
                    onClick={() => changeAdminTab('backups')}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 text-left text-xs font-extrabold text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    <DatabaseBackup className="h-4 w-4" />
                    Revisar backups
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'setores' && (
          <section
            data-testid="admin-sectors-tab"
            className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#071225]/60 shadow-[0_22px_70px_rgba(0,8,28,0.18)] backdrop-blur-xl"
          >
            <div className="border-b border-white/10 px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-lg font-extrabold">Setores</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Workspaces operacionais reconhecidos pela plataforma.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!persistentDirectoryReady || creatingSector}
                  onClick={() => changeAdminTab('novo-setor')}
                  title={persistentDirectoryReady ? 'Cadastrar novo setor' : 'Aguardando acesso ao diretório administrativo no Firestore'}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-300/20 bg-blue-600 px-4 text-xs font-extrabold text-white shadow-lg shadow-blue-950/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-600/25 disabled:text-blue-100/45"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar novo setor
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={sectorQuery}
                    onChange={(event) => setSectorQuery(event.target.value)}
                    placeholder="Buscar por UG, OM, setor, e-mail ou workspace..."
                    className="min-h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 pl-10 pr-3 text-xs font-semibold text-white outline-none placeholder:text-slate-600 focus:border-blue-300/25 focus:ring-2 focus:ring-blue-300/10"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto">
                  {([
                    ['all', 'Todos'],
                    ['active', 'Ativos'],
                    ['disabled', 'Suspensos'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSectorStatusFilter(value)}
                      className={
                        'min-h-10 rounded-xl border px-3 text-[10px] font-extrabold uppercase tracking-[0.10em] transition '
                        + (sectorStatusFilter === value
                          ? 'border-blue-300/20 bg-blue-500/12 text-blue-100'
                          : 'border-white/[0.07] bg-white/[0.025] text-slate-500 hover:text-white')
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              {loadingDirectory && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-400">
                  Sincronizando diretório administrativo…
                </div>
              )}

              {!loadingDirectory && filteredWorkspaces.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/[0.10] px-4 py-8 text-center text-xs text-slate-500">
                  Nenhum setor corresponde aos filtros atuais.
                </div>
              )}

              {filteredWorkspaces.map((workspace) => (
                <WorkspaceCard
                  key={workspace.id}
                  workspace={workspace}
                  disabled={!persistentDirectoryReady}
                  editing={updatingWorkspaceId === workspace.id}
                  changingStatus={changingStatusWorkspaceId === workspace.id}
                  deleting={deletingWorkspaceId === workspace.id}
                  onEdit={() => setEditingWorkspace(workspace)}
                  onChangeStatus={() => requestChangeSectorStatus(workspace)}
                  onDelete={() => requestDeleteSector(workspace)}
                />
              ))}
            </div>
          </section>
        )}

        {activeTab === 'novo-setor' && (
          <AdminCreateSectorPanel
            creating={creatingSector}
            disabled={!persistentDirectoryReady}
            onCreate={handleCreateSector}
            onCreated={() => changeAdminTab('setores')}
          />
        )}

        {activeTab === 'consumo' && (
          <AdminConsumptionHub
            workspaces={visibleWorkspaces}
            sessions={sessions}
            usage={usage}
            globalUsage={globalUsage}
            globalUsageConfigured={globalUsageConfigured}
            globalUsageObservedAt={globalUsageObservedAt}
            globalUsageDataThrough={globalUsageDataThrough}
            globalUsageMetricDataThrough={globalUsageMetricDataThrough}
            globalUsageCredentialSource={globalUsageCredentialSource}
            loadingUsage={loadingUsage}
            loadingGlobalUsage={loadingGlobalUsage}
            usageError={usageError}
            globalUsageError={globalUsageError}
            onRefreshUsage={onRefreshUsage}
            onRefreshGlobalUsage={onRefreshGlobalUsage}
          />
        )}

        {activeTab === 'sessoes' && (
          <AdminSessionsPanel
            workspaces={visibleWorkspaces}
            sessions={sessions}
            loading={loadingSessions}
            error={sessionsError}
            terminatingSessionId={terminatingSessionId}
            onTerminateSession={onTerminateSession}
            onNotify={showAdminToast}
          />
        )}

        {activeTab === 'assinaturas' && (
          <AdminBillingPanel
            workspaces={visibleWorkspaces}
            config={billing.config}
            accounts={billing.accounts}
            cyclesByWorkspace={billing.cyclesByWorkspace}
            loading={billing.loading}
            error={billing.error}
            mutatingKey={billing.mutatingKey}
            onUpdateConfig={billing.updateConfig}
            onGrantTrial={billing.grantTrial}
            onSetStatus={billing.setStatus}
            onSetCycleStatus={billing.setCycleStatus}
          />
        )}

        {activeTab === 'backups' && (
          <AdminBackupPanel
            adminUser={adminUser}
            workspaces={visibleWorkspaces}
          />
        )}

        {activeTab === 'seguranca' && (
          <AdminSecurityPanel
            directoryReady={persistentDirectoryReady}
            workspaceCount={visibleWorkspaces.length}
            activeWorkspaceCount={activeWorkspaceCount}
            suspendedWorkspaceCount={disabledWorkspaceCount}
            globalUsageConfigured={globalUsageConfigured}
          />
        )}
          </div>
        </div>
      </main>

      <EditSectorModal
        workspace={editingWorkspace}
        saving={Boolean(editingWorkspace && updatingWorkspaceId === editingWorkspace.id)}
        resettingPassword={Boolean(editingWorkspace && resettingPasswordWorkspaceId === editingWorkspace.id)}
        onClose={() => setEditingWorkspace(null)}
        onSave={handleUpdateSector}
        onResetPassword={onResetSectorPassword}
      />

      {statusCandidate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#020817]/85 p-4 backdrop-blur-xl">
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="status-sector-title"
            aria-describedby="status-sector-description"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-blue-300/15 bg-[#071225] p-6 shadow-[0_30px_100px_rgba(0,8,28,0.55)]"
          >
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-blue-200/50 to-transparent" />
            <div className="flex items-start gap-4">
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${
                statusCandidate.status === 'active'
                  ? 'border-amber-300/20 bg-amber-400/[0.08] text-amber-200'
                  : 'border-emerald-300/20 bg-emerald-400/[0.08] text-emerald-200'
              }`}>
                {statusCandidate.status === 'active'
                  ? <CirclePause className="h-5 w-5" />
                  : <CirclePlay className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[8px] font-bold uppercase tracking-[0.20em] text-blue-300/55">EMPROVEX // CICLO DE VIDA</p>
                <h2 id="status-sector-title" className="mt-1.5 text-xl font-extrabold text-white">
                  {statusCandidate.status === 'active' ? 'Suspender setor?' : 'Reativar setor?'}
                </h2>
                <p id="status-sector-description" className="mt-2 text-sm leading-relaxed text-slate-400">
                  {statusCandidate.status === 'active'
                    ? `O acesso operacional de ${statusCandidate.name} será bloqueado imediatamente, sem apagar dados ou histórico.`
                    : `O acesso operacional de ${statusCandidate.name} será liberado novamente para a conta autorizada.`}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/[0.07] bg-slate-950/25 px-4 py-3">
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Conta autorizada</div>
              <div className="mt-1 break-all text-xs font-bold text-slate-300">{statusCandidate.authorizedEmail}</div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={changingStatusWorkspaceId === statusCandidate.id}
                onClick={() => setStatusCandidate(null)}
                className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/[0.07] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={changingStatusWorkspaceId === statusCandidate.id}
                onClick={() => void confirmChangeSectorStatus()}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-2.5 text-xs font-extrabold transition disabled:cursor-wait disabled:opacity-60 ${
                  statusCandidate.status === 'active'
                    ? 'border-amber-300/20 bg-amber-500 text-slate-950 hover:bg-amber-400'
                    : 'border-emerald-300/20 bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                }`}
              >
                {changingStatusWorkspaceId === statusCandidate.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : statusCandidate.status === 'active'
                    ? <CirclePause className="h-4 w-4" />
                    : <CirclePlay className="h-4 w-4" />}
                {changingStatusWorkspaceId === statusCandidate.id
                  ? 'Processando…'
                  : statusCandidate.status === 'active'
                    ? 'Confirmar suspensão'
                    : 'Confirmar reativação'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {deleteCandidate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-sector-title"
            aria-describedby="delete-sector-description"
            className="relative w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-rose-300/15 bg-[#071225] p-6 shadow-[0_30px_100px_rgba(0,8,28,0.55)]"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-500/10 text-rose-300">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-rose-300">
                  Exclusão permanente
                </div>
                <h2 id="delete-sector-title" className="mt-1 text-xl font-extrabold text-white">
                  Excluir {deleteCandidate.name}?
                </h2>
                <p id="delete-sector-description" className="mt-2 text-sm leading-relaxed text-slate-300">
                  Esta ação removerá o usuário de acesso, o workspace e os dados deste setor armazenados no EMPROVEX. Arquivos eventualmente existentes no Google Drive externo não serão apagados.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-rose-400/15 bg-rose-500/[0.06] px-4 py-3 text-xs leading-relaxed text-rose-100">
              <strong>Esta operação não pode ser desfeita.</strong> O HGeSM fundador continua protegido e não pode ser excluído por este fluxo.
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/25 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Usuário</div>
              <div className="mt-1 break-all text-sm font-bold text-slate-200">{deleteCandidate.authorizedEmail}</div>
              <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Workspace</div>
              <div className="mt-1 break-all font-mono text-xs font-bold text-slate-300">{deleteCandidate.id}</div>
            </div>

            {deleteError && (
              <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-xs leading-relaxed text-rose-200">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={deletingWorkspaceId === deleteCandidate.id}
                onClick={() => {
                  setDeleteError(null);
                  setDeleteCandidate(null);
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingWorkspaceId === deleteCandidate.id}
                onClick={() => void confirmDeleteSector()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-600 px-5 py-2.5 text-xs font-extrabold text-white transition hover:bg-rose-500 disabled:cursor-wait disabled:opacity-60"
              >
                {deletingWorkspaceId === deleteCandidate.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Trash2 className="h-4 w-4" />}
                {deletingWorkspaceId === deleteCandidate.id ? 'Excluindo…' : 'Confirmar exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkspaceCard({
  workspace,
  disabled,
  editing,
  changingStatus,
  deleting,
  onEdit,
  onChangeStatus,
  onDelete,
}: {
  workspace: Workspace;
  disabled: boolean;
  editing: boolean;
  changingStatus: boolean;
  deleting: boolean;
  onEdit: () => void;
  onChangeStatus: () => void;
  onDelete: () => void;
}) {
  const isActive = workspace.status === 'active';
  const founder = Boolean(workspace.legacyWorkspace);

  return (
    <div className={`group relative overflow-hidden rounded-2xl border p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(0,8,28,0.22)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 ${
      isActive
        ? 'border-emerald-300/15 bg-emerald-400/[0.045]'
        : 'border-amber-300/15 bg-amber-400/[0.045]'
    }`}>
      <div className="flex items-start gap-4 min-w-0">
        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${
          isActive
            ? 'bg-emerald-500/10 border-emerald-400/20 text-emerald-300'
            : 'bg-amber-500/10 border-amber-400/20 text-amber-300'
        }`}>
          <Building2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-extrabold text-white">{workspace.name}</h4>
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              isActive
                ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-300'
                : 'bg-amber-400/10 border-amber-400/20 text-amber-300'
            }`}>
              {isActive ? 'Ativo' : 'Suspenso'}
            </span>
            {founder && (
              <span className="inline-flex rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Fundador
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1 break-all">{workspace.authorizedEmail}</p>
          <p className="text-[11px] text-slate-500 mt-1">{workspace.institutionalProfile.organizationName}</p>
        </div>
      </div>

      <div className="lg:min-w-[470px] space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-950/30 border border-white/10 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Workspace ID</div>
            <div className="text-sm font-mono font-bold text-slate-200 mt-1 break-all">{workspace.id}</div>
          </div>
          <div className="rounded-xl bg-slate-950/30 border border-white/10 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">UG da OM</div>
            <div className="text-sm font-mono font-bold text-slate-200 mt-1">{workspace.ug || 'Não cadastrada'}</div>
          </div>
          <div className="rounded-xl bg-slate-950/30 border border-white/10 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Ciclo de vida</div>
            <div className="text-sm font-bold text-slate-200 mt-1">
              {founder ? 'Protegido' : isActive ? 'Operação liberada' : 'Acesso bloqueado'}
            </div>
          </div>
        </div>

        {!founder && (
          <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <button
              type="button"
              onClick={onEdit}
              disabled={disabled || editing || changingStatus || deleting}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              {editing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
              Editar cadastro
            </button>
            <button
              type="button"
              onClick={onChangeStatus}
              disabled={disabled || editing || changingStatus || deleting}
              className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition disabled:opacity-50 ${
                isActive
                  ? 'border-amber-400/20 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
                  : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
              }`}
            >
              {changingStatus
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : isActive
                  ? <CirclePause className="w-4 h-4" />
                  : <CirclePlay className="w-4 h-4" />}
              {isActive ? 'Suspender setor' : 'Reativar setor'}
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={disabled || editing || changingStatus || deleting}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {deleting ? 'Excluindo…' : 'Excluir usuário'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminMetric({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071225]/60 p-5 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-blue-300/15 hover:bg-[#09182f]/70">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-blue-300/15 bg-blue-400/[0.08] text-blue-200 shadow-[0_0_24px_rgba(37,99,235,0.08)]">
        {icon}
      </div>
      <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-slate-500">{label}</div>
      <div className="text-xl font-extrabold mt-1">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{detail}</div>
    </div>
  );
}
