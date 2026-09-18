'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Building2,
  Database,
  CirclePause,
  CirclePlay,
  Loader2,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { CreateSectorModal } from './CreateSectorModal';
import { EditSectorModal } from './EditSectorModal';
import { createHgesmFoundingWorkspace } from '../../lib/hgesmWorkspace';
import type {
  CreateSectorWorkspaceInput,
  SectorLifecycleStatus,
  UpdateSectorWorkspaceInput,
} from '../../lib/platformAdminStore';
import type { Workspace } from '../../lib/platformIdentity';
import { setActiveProfileMode } from '../../lib/profileMode';

interface PlatformAdminViewProps {
  adminEmail: string;
  workspaces: Workspace[];
  loadingDirectory: boolean;
  directoryError: string | null;
  creatingSector: boolean;
  updatingWorkspaceId: string | null;
  changingStatusWorkspaceId: string | null;
  onCreateSector: (input: CreateSectorWorkspaceInput) => Promise<void>;
  onUpdateSector: (input: UpdateSectorWorkspaceInput) => Promise<void>;
  onChangeSectorStatus: (workspaceId: string, status: SectorLifecycleStatus) => Promise<void>;
  onLogout: () => Promise<void>;
}

export function PlatformAdminView({
  adminEmail,
  workspaces,
  loadingDirectory,
  directoryError,
  creatingSector,
  updatingWorkspaceId,
  changingStatusWorkspaceId,
  onCreateSector,
  onUpdateSector,
  onChangeSectorStatus,
  onLogout,
}: PlatformAdminViewProps) {
  const router = useRouter();
  const [showCreateSector, setShowCreateSector] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const visibleWorkspaces = useMemo(
    () => workspaces.length > 0 ? workspaces : [createHgesmFoundingWorkspace('')],
    [workspaces]
  );

  const persistentDirectoryReady = !loadingDirectory && !directoryError;

  const activeWorkspaceCount = visibleWorkspaces.filter((workspace) => workspace.status === 'active').length;
  const disabledWorkspaceCount = visibleWorkspaces.filter((workspace) => workspace.status === 'disabled').length;

  const handleCreateSector = async (input: CreateSectorWorkspaceInput) => {
    const resultName = input.workspaceName.trim();
    await onCreateSector(input);
    setSuccessMessage(`Setor ${resultName} cadastrado e provisionado com sucesso.`);
    window.setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handleUpdateSector = async (input: UpdateSectorWorkspaceInput) => {
    const resultName = input.workspaceName.trim();
    await onUpdateSector(input);
    setSuccessMessage(`Setor ${resultName} atualizado com sucesso.`);
    window.setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handleChangeSectorStatus = async (workspace: Workspace) => {
    if (workspace.legacyWorkspace) return;

    const nextStatus: SectorLifecycleStatus = workspace.status === 'active' ? 'disabled' : 'active';
    const confirmed = window.confirm(
      nextStatus === 'disabled'
        ? `Suspender ${workspace.name}? O acesso operacional será bloqueado imediatamente.`
        : `Reativar ${workspace.name}? A conta poderá voltar a acessar o workspace.`
    );
    if (!confirmed) return;

    await onChangeSectorStatus(workspace.id, nextStatus);
    setSuccessMessage(
      nextStatus === 'disabled'
        ? `Setor ${workspace.name} suspenso. O acesso operacional foi bloqueado.`
        : `Setor ${workspace.name} reativado com sucesso.`
    );
    window.setTimeout(() => setSuccessMessage(null), 5000);
  };

  const returnToHgesm = () => {
    setActiveProfileMode('sector');
    router.replace('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#08152d] to-[#0a1d3f] text-white">
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#00288e] flex items-center justify-center font-black tracking-wider shadow-lg shadow-blue-950/30">
              EMP
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold tracking-[0.18em] text-base sm:text-lg">EMPROVEX</h1>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full border border-blue-400/30 bg-blue-500/10 text-[10px] font-bold uppercase tracking-wider text-blue-200">
                  Administração
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">Administração da Plataforma</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={returnToHgesm}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-3.5 py-2 text-xs font-bold text-blue-100 transition hover:bg-blue-500/20"
              title="Alternar para o perfil operacional do HGeSM"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar ao HGeSM</span>
            </button>

            <button
              type="button"
              onClick={() => void onLogout()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 sm:py-10 space-y-8">
        <section className="rounded-3xl border border-white/10 bg-white/[0.055] backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/10 overflow-hidden relative">
          <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 text-blue-200 text-xs font-bold uppercase tracking-[0.16em] mb-3">
                <ShieldCheck className="w-4 h-4" />
                Perfil administrativo
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Central de Administração EMPROVEX</h2>
              <p className="mt-2 text-sm text-slate-300 max-w-2xl leading-relaxed">
                A mesma conta institucional alterna entre o perfil operacional do HGeSM e este perfil de administração. Enquanto este modo estiver ativo, nenhuma subscription operacional de empenhos, notas fiscais, comissões ou cronogramas é aberta.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 min-w-0 lg:min-w-[310px]">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <UserCog className="w-4 h-4" />
                Conta institucional
              </div>
              <p className="text-sm font-bold text-white break-all">{adminEmail}</p>
            </div>
          </div>
        </section>

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

        {successMessage && (
          <section className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.08] px-5 py-3 text-xs font-bold text-emerald-200">
            {successMessage}
          </section>
        )}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            icon={<LockKeyhole className="w-5 h-5" />}
            label="Setores suspensos"
            value={String(disabledWorkspaceCount)}
            detail="Leituras e escritas operacionais bloqueadas"
          />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.045] overflow-hidden">
          <div className="px-5 sm:px-6 py-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-extrabold">Setores</h3>
              <p className="text-xs text-slate-400 mt-1">Workspaces operacionais reconhecidos pela plataforma.</p>
            </div>
            <button
              type="button"
              disabled={!persistentDirectoryReady || creatingSector}
              onClick={() => setShowCreateSector(true)}
              title={persistentDirectoryReady ? 'Cadastrar novo setor' : 'Aguardando acesso ao diretório administrativo no Firestore'}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 border border-blue-400/20 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-500 disabled:bg-blue-600/30 disabled:text-blue-100/60 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Cadastrar novo setor
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            {loadingDirectory && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-400">
                Sincronizando diretório administrativo…
              </div>
            )}

            {visibleWorkspaces.map((workspace) => (
              <WorkspaceCard
                key={workspace.id}
                workspace={workspace}
                disabled={!persistentDirectoryReady}
                editing={updatingWorkspaceId === workspace.id}
                changingStatus={changingStatusWorkspaceId === workspace.id}
                onEdit={() => setEditingWorkspace(workspace)}
                onChangeStatus={() => void handleChangeSectorStatus(workspace)}
              />
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-5 h-5 text-blue-300" />
              <h3 className="font-extrabold">Estado da migração</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Workspaces ativos operam isoladamente. A suspensão administrativa bloqueia novas leituras e escritas imediatamente, sem apagar documentos, configurações ou histórico do setor.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
              <h3 className="font-extrabold">Cadastro seguro</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Cadastro cria a identidade Firebase no servidor e vincula o UID antes do primeiro acesso. Edição institucional e ciclo de vida preservam workspace ID, e-mail de acesso e UID.
            </p>
          </div>
        </section>
      </main>

      <CreateSectorModal
        open={showCreateSector}
        creating={creatingSector}
        onClose={() => setShowCreateSector(false)}
        onCreate={handleCreateSector}
      />

      <EditSectorModal
        workspace={editingWorkspace}
        saving={Boolean(editingWorkspace && updatingWorkspaceId === editingWorkspace.id)}
        onClose={() => setEditingWorkspace(null)}
        onSave={handleUpdateSector}
      />
    </div>
  );
}

function WorkspaceCard({
  workspace,
  disabled,
  editing,
  changingStatus,
  onEdit,
  onChangeStatus,
}: {
  workspace: Workspace;
  disabled: boolean;
  editing: boolean;
  changingStatus: boolean;
  onEdit: () => void;
  onChangeStatus: () => void;
}) {
  const isActive = workspace.status === 'active';
  const founder = Boolean(workspace.legacyWorkspace);

  return (
    <div className={`rounded-2xl border p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 ${
      isActive
        ? 'border-emerald-400/20 bg-emerald-500/[0.06]'
        : 'border-amber-400/20 bg-amber-500/[0.06]'
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-950/30 border border-white/10 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Workspace ID</div>
            <div className="text-sm font-mono font-bold text-slate-200 mt-1 break-all">{workspace.id}</div>
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
              disabled={disabled || editing || changingStatus}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              {editing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
              Editar cadastro
            </button>
            <button
              type="button"
              onClick={onChangeStatus}
              disabled={disabled || editing || changingStatus}
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-400/15 text-blue-200 flex items-center justify-center mb-4">
        {icon}
      </div>
      <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-slate-500">{label}</div>
      <div className="text-xl font-extrabold mt-1">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{detail}</div>
    </div>
  );
}
