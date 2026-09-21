'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  ArrowLeft,
  CheckCircle2,
  DatabaseBackup,
  HardDrive,
  KeyRound,
  Loader2,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import { auth } from '../../../lib/firebase';
import { usePlatformAdminDirectory } from '../../../hooks/usePlatformAdminDirectory';
import { usePlatformAdminBackups } from '../../../hooks/usePlatformAdminBackups';
import { useFounderAuthBackup } from '../../../hooks/useFounderAuthBackup';
import { resolveWorkspaceContext } from '../../../lib/workspaceContext';
import type { Workspace } from '../../../lib/platformIdentity';

function formatDate(value?: string): string {
  if (!value) return 'Nunca';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR');
}

function formatBytes(value?: number): string {
  if (!value || value <= 0) return '—';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function backupHealth(workspace: Workspace, status?: {
  status: string;
  lastSuccessAt: string;
}) {
  if (!status?.lastSuccessAt) return { label: 'Sem backup', tone: 'warning' as const };
  const timestamp = Date.parse(status.lastSuccessAt);
  if (!Number.isFinite(timestamp)) return { label: 'Verificar', tone: 'warning' as const };
  if (status.status === 'failed') return { label: 'Falha recente', tone: 'danger' as const };
  if (Date.now() - timestamp > 36 * 60 * 60 * 1000) {
    return { label: 'Atrasado', tone: 'warning' as const };
  }
  return {
    label: workspace.status === 'active' ? 'Protegido' : 'Protegido · setor suspenso',
    tone: 'success' as const,
  };
}

export default function PlatformBackupAdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, (current) => {
    setUser(current || null);
    setLoadingAuth(false);
  }), []);

  const context = resolveWorkspaceContext(user?.email);
  const adminUser = context.status === 'platformAdmin' ? user : null;
  const directory = usePlatformAdminDirectory(adminUser);
  const backups = usePlatformAdminBackups(adminUser);
  const authBackup = useFounderAuthBackup(adminUser);

  useEffect(() => {
    if (loadingAuth) return;
    if (!user) {
      window.location.replace('/');
      return;
    }
    if (context.status !== 'platformAdmin') {
      window.location.replace('/');
    }
  }, [context.status, loadingAuth, user]);

  const statusByWorkspace = useMemo(
    () => new Map(backups.statuses.map((status) => [status.workspaceId, status])),
    [backups.statuses]
  );

  const workspaceSummary = useMemo(() => {
    const statuses = directory.directory.workspaces.map((workspace) => ({
      workspace,
      status: statusByWorkspace.get(workspace.id),
    }));
    const healthy = statuses.filter(({ workspace, status }) =>
      backupHealth(workspace, status).tone === 'success'
    ).length;
    return {
      total: statuses.length,
      healthy,
      attention: statuses.length - healthy,
    };
  }, [directory.directory.workspaces, statusByWorkspace]);

  if (loadingAuth || !user || context.status !== 'platformAdmin') {
    return (
      <div className="grid min-h-screen place-items-center bg-[#020817] text-white">
        <div className="flex items-center gap-3 text-sm font-bold text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin text-blue-300" />
          Validando perfil administrativo...
        </div>
      </div>
    );
  }

  const handleAuthBackup = async () => {
    setActionMessage(null);
    try {
      const result = await authBackup.createBackup();
      setActionMessage(
        `Backup de identidades concluído: ${result.userCount} usuários salvos no Drive da conta fundadora.`
      );
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Falha no backup de identidades.');
    }
  };

  return (
    <div className="min-h-screen bg-[#020817] text-white">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#030b1b]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-blue-300/15 bg-blue-500/[0.07]">
              <DatabaseBackup className="h-5 w-5 text-blue-200" />
            </div>
            <div>
              <p className="font-mono text-[8px] font-bold uppercase tracking-[0.22em] text-blue-300/55">
                EMPROVEX // ADMIN
              </p>
              <h1 className="text-base font-extrabold tracking-[0.08em] sm:text-lg">BACKUP E RECUPERAÇÃO</h1>
            </div>
          </div>
          <Link
            href="/admin"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.04] px-3.5 text-xs font-bold text-slate-300 hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Administração
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/[0.09] bg-[#071225]/75 p-6 shadow-[0_30px_90px_rgba(0,8,28,0.30)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.20em] text-blue-200/70">
                <ShieldCheck className="h-4 w-4" /> Resiliência comercial
              </div>
              <h2 className="text-2xl font-extrabold">Proteção lógica dos dados por UG</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
                Cada setor grava o próprio backup no Google Drive autorizado. Esta administração acompanha somente metadados de saúde, sem obter acesso aos empenhos, notas fiscais ou demais registros operacionais de outra UG.
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 text-xs text-slate-400">
              PDFs <strong className="text-white">não são duplicados</strong> no backup lógico.
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <Metric label="UGs monitoradas" value={String(workspaceSummary.total)} detail="Workspaces do diretório administrativo" />
          <Metric label="Protegidas" value={String(workspaceSummary.healthy)} detail="Backup válido nas últimas 36 horas" />
          <Metric label="Atenção" value={String(workspaceSummary.attention)} detail="Sem backup, atrasado ou com falha" />
        </section>

        {(directory.error || backups.error) && (
          <section className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/[0.08] p-4">
            <TriangleAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
            <p className="text-xs leading-relaxed text-amber-100">
              {directory.error || backups.error}
            </p>
          </section>
        )}

        <section className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#071225]/60">
          <div className="border-b border-white/[0.08] px-5 py-5 sm:px-6">
            <h3 className="text-lg font-extrabold">Saúde dos backups por UG</h3>
            <p className="mt-1 text-xs text-slate-400">
              O conteúdo permanece no Drive de cada setor; somente estes indicadores são centralizados.
            </p>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {directory.loading || backups.loading ? (
              <div className="flex items-center gap-2 px-6 py-8 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando monitoramento...
              </div>
            ) : directory.directory.workspaces.length === 0 ? (
              <div className="px-6 py-8 text-sm text-slate-500">Nenhum workspace cadastrado.</div>
            ) : (
              directory.directory.workspaces.map((workspace) => {
                const status = statusByWorkspace.get(workspace.id);
                const health = backupHealth(workspace, status);
                return (
                  <div key={workspace.id} className="grid gap-4 px-5 py-4 sm:px-6 lg:grid-cols-[1.25fr_.7fr_.7fr_.8fr_.8fr] lg:items-center">
                    <div>
                      <p className="text-sm font-extrabold text-white">{workspace.name}</p>
                      <p className="mt-1 font-mono text-[10px] text-slate-500">UG {workspace.ug || '—'} · {workspace.authorizedEmail}</p>
                    </div>
                    <StatusBadge tone={health.tone}>{health.label}</StatusBadge>
                    <div className="text-xs">
                      <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-600">Último backup</span>
                      <span className="mt-1 block font-semibold text-slate-300">{formatDate(status?.lastSuccessAt)}</span>
                    </div>
                    <div className="text-xs">
                      <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-600">Conteúdo</span>
                      <span className="mt-1 block font-semibold text-slate-300">{status?.recordCount || 0} registros · {formatBytes(status?.sizeBytes)}</span>
                    </div>
                    <div className="text-xs">
                      <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-600">Integridade</span>
                      <span className="mt-1 block truncate font-mono text-[10px] text-slate-400">
                        {status?.sha256 ? `${status.sha256.slice(0, 12)}…` : '—'}
                      </span>
                    </div>
                    {status?.lastError && (
                      <p className="lg:col-span-5 rounded-lg border border-red-400/10 bg-red-500/[0.05] px-3 py-2 text-[10px] text-red-200/80">
                        {status.lastError}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/[0.08] bg-[#071225]/60 p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-violet-300/15 bg-violet-500/[0.08]">
                <KeyRound className="h-5 w-5 text-violet-200" />
              </div>
              <div>
                <h3 className="text-base font-extrabold">Backup global de identidades</h3>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
                  Salva UIDs, e-mails, providers, claims e metadados do Firebase Auth exclusivamente no Drive da conta fundadora. Hashes e salts de senha não são incluídos.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleAuthBackup()}
              disabled={authBackup.creating}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-extrabold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {authBackup.creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDrive className="h-4 w-4" />}
              Salvar identidades no Drive fundador
            </button>
          </div>

          {(actionMessage || authBackup.error) && (
            <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-xs text-slate-300">
              {actionMessage || authBackup.error}
            </div>
          )}

          <div className="mt-4 flex items-start gap-2 text-[10px] leading-relaxed text-slate-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <p>
              Em perda total do Firebase Auth, os UIDs e vínculos podem ser reconstruídos a partir deste inventário. Usuários de senha deverão redefinir a credencial, pois hashes de senha são deliberadamente excluídos desta primeira versão.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#071225]/60 p-5">
      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] text-slate-500">{detail}</p>
    </div>
  );
}

function StatusBadge({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'danger';
  children: React.ReactNode;
}) {
  const classes = tone === 'success'
    ? 'border-emerald-400/15 bg-emerald-500/[0.08] text-emerald-200'
    : tone === 'danger'
      ? 'border-red-400/15 bg-red-500/[0.08] text-red-200'
      : 'border-amber-400/15 bg-amber-500/[0.08] text-amber-200';

  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${classes}`}>
      {tone === 'success' ? <CheckCircle2 className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}
      {children}
    </span>
  );
}
