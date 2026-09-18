'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Building2,
  Database,
  HardDrive,
  LockKeyhole,
  LogOut,
  Plus,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { CreateSectorModal } from './CreateSectorModal';
import { createHgesmFoundingWorkspace } from '../../lib/hgesmWorkspace';
import type { CreateSectorWorkspaceInput } from '../../lib/platformAdminStore';
import type { Workspace } from '../../lib/platformIdentity';
import { setActiveProfileMode } from '../../lib/profileMode';

interface PlatformAdminViewProps {
  adminEmail: string;
  workspaces: Workspace[];
  loadingDirectory: boolean;
  directoryError: string | null;
  creatingSector: boolean;
  onCreateSector: (input: CreateSectorWorkspaceInput) => Promise<void>;
  onLogout: () => Promise<void>;
}

export function PlatformAdminView({
  adminEmail,
  workspaces,
  loadingDirectory,
  directoryError,
  creatingSector,
  onCreateSector,
  onLogout,
}: PlatformAdminViewProps) {
  const router = useRouter();
  const [showCreateSector, setShowCreateSector] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const visibleWorkspaces = useMemo(
    () => workspaces.length > 0 ? workspaces : [createHgesmFoundingWorkspace('')],
    [workspaces]
  );

  const persistentDirectoryReady = !loadingDirectory && !directoryError;

  const handleCreateSector = async (input: CreateSectorWorkspaceInput) => {
    const resultName = input.workspaceName.trim();
    await onCreateSector(input);
    setSuccessMessage(`Setor ${resultName} cadastrado e provisionado com sucesso.`);
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
            icon={<LockKeyhole className="w-5 h-5" />}
            label="Contexto operacional"
            value="Suspenso"
            detail="Nenhuma subscription operacional neste perfil"
          />
          <AdminMetric
            icon={<HardDrive className="w-5 h-5" />}
            label="Armazenamento por setor"
            value="Preparado"
            detail="Medição será ativada em bloco posterior"
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
              <WorkspaceCard key={workspace.id} workspace={workspace} />
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
              O HGeSM continua operando nas coleções legadas. Os novos perfis cadastrados aqui contêm somente metadados administrativos e ainda não possuem coleções operacionais próprias.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
              <h3 className="font-extrabold">Cadastro seguro</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Workspace e conta Google são criados atomicamente. IDs e e-mails duplicados são bloqueados e os futuros setores continuam isolados por workspace.
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
    </div>
  );
}

function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  return (
    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
      <div className="flex items-start gap-4 min-w-0">
        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center text-emerald-300 flex-shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-extrabold text-white">{workspace.name}</h4>
            <span className="inline-flex rounded-full bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              {workspace.status === 'active' ? 'Ativo' : 'Inativo'}
            </span>
            {workspace.legacyWorkspace && (
              <span className="inline-flex rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Fundador
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1 break-all">{workspace.authorizedEmail}</p>
          <p className="text-[11px] text-slate-500 mt-1">{workspace.institutionalProfile.organizationName}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:min-w-[430px]">
        <div className="rounded-xl bg-slate-950/30 border border-white/10 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Workspace ID</div>
          <div className="text-sm font-mono font-bold text-slate-200 mt-1 break-all">{workspace.id}</div>
        </div>
        <div className="rounded-xl bg-slate-950/30 border border-white/10 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Dados</div>
          <div className="text-sm font-bold text-slate-200 mt-1">
            {workspace.legacyWorkspace ? 'Workspace fundador' : 'Provisionado'}
          </div>
        </div>
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
