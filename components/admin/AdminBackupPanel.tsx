'use client';

import { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CheckCircle2,
  DatabaseBackup,
  HardDrive,
  KeyRound,
  Loader2,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import { usePlatformAdminBackups } from '../../hooks/usePlatformAdminBackups';
import { useFounderAuthBackup } from '../../hooks/useFounderAuthBackup';
import type { Workspace } from '../../lib/platformIdentity';

interface AdminBackupPanelProps {
  adminUser: User;
  workspaces: Workspace[];
}

function formatDate(value?: string): string {
  if (!value) return 'Nunca';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR');
}

function formatBytes(value?: number): string {
  if (!value || value <= 0) return '—';
  if (value < 1024 * 1024) {
    return Math.max(1, Math.round(value / 1024)) + ' KB';
  }
  return (value / (1024 * 1024)).toFixed(1) + ' MB';
}

function backupHealth(
  workspace: Workspace,
  status?: { status: string; lastSuccessAt: string }
) {
  if (!status?.lastSuccessAt) {
    return { label: 'Sem backup', tone: 'warning' as const };
  }
  const timestamp = Date.parse(status.lastSuccessAt);
  if (!Number.isFinite(timestamp)) {
    return { label: 'Verificar', tone: 'warning' as const };
  }
  if (status.status === 'failed') {
    return { label: 'Falha recente', tone: 'danger' as const };
  }
  if (Date.now() - timestamp > 36 * 60 * 60 * 1000) {
    return { label: 'Atrasado', tone: 'warning' as const };
  }
  return {
    label: workspace.status === 'active'
      ? 'Protegido'
      : 'Protegido · setor suspenso',
    tone: 'success' as const,
  };
}

export function AdminBackupPanel({
  adminUser,
  workspaces,
}: AdminBackupPanelProps) {
  const backups = usePlatformAdminBackups(adminUser);
  const authBackup = useFounderAuthBackup(adminUser);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const statusByWorkspace = useMemo(
    () => new Map(backups.statuses.map((status) => [status.workspaceId, status])),
    [backups.statuses]
  );

  const summary = useMemo(() => {
    const rows = workspaces.map((workspace) => ({
      workspace,
      status: statusByWorkspace.get(workspace.id),
    }));
    const healthy = rows.filter(({ workspace, status }) =>
      backupHealth(workspace, status).tone === 'success'
    ).length;
    return {
      total: rows.length,
      healthy,
      attention: rows.length - healthy,
    };
  }, [statusByWorkspace, workspaces]);

  const handleAuthBackup = async () => {
    setActionMessage(null);
    try {
      const result = await authBackup.createBackup();
      setActionMessage(
        'Backup de identidades concluído: '
          + result.userCount
          + ' usuários salvos no Drive da conta fundadora.'
      );
    } catch (error) {
      setActionMessage(
        error instanceof Error
          ? error.message
          : 'Falha no backup de identidades.'
      );
    }
  };

  return (
    <div data-testid="admin-backup-panel" className="space-y-5">
      <section className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#071225]/65 p-5 shadow-[0_22px_70px_rgba(0,8,28,0.20)] backdrop-blur-xl sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 font-mono text-[8px] font-bold uppercase tracking-[0.20em] text-blue-200/70">
              <DatabaseBackup className="h-4 w-4" />
              Backup &amp; Recuperação
            </div>
            <h3 className="text-xl font-extrabold text-white">
              Saúde dos backups da plataforma
            </h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
              O conteúdo operacional permanece no Google Drive de cada setor.
              A Administração acompanha somente os metadados de saúde e a
              proteção global de identidades.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 text-xs text-slate-400">
            PDFs <strong className="text-white">não são duplicados</strong> no
            backup lógico.
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric
          label="UGs monitoradas"
          value={String(summary.total)}
          detail="Workspaces do diretório administrativo"
        />
        <Metric
          label="Protegidas"
          value={String(summary.healthy)}
          detail="Backup válido nas últimas 36 horas"
        />
        <Metric
          label="Atenção"
          value={String(summary.attention)}
          detail="Sem backup, atrasado ou com falha"
        />
      </section>

      {backups.error && (
        <section className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/[0.08] p-4">
          <TriangleAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
          <p className="text-xs leading-relaxed text-amber-100">
            {backups.error}
          </p>
        </section>
      )}

      <section className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#071225]/60">
        <div className="border-b border-white/[0.08] px-5 py-5 sm:px-6">
          <h4 className="text-lg font-extrabold text-white">
            Saúde dos backups por UG
          </h4>
          <p className="mt-1 text-xs text-slate-400">
            Somente indicadores de saúde e integridade são centralizados.
          </p>
        </div>

        <div className="divide-y divide-white/[0.06]">
          {backups.loading ? (
            <div className="flex items-center gap-2 px-6 py-8 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando monitoramento...
            </div>
          ) : workspaces.length === 0 ? (
            <div className="px-6 py-8 text-sm text-slate-500">
              Nenhum workspace cadastrado.
            </div>
          ) : (
            workspaces.map((workspace) => {
              const status = statusByWorkspace.get(workspace.id);
              const health = backupHealth(workspace, status);
              return (
                <div
                  key={workspace.id}
                  className="grid gap-4 px-5 py-4 sm:px-6 lg:grid-cols-[1.25fr_.7fr_.7fr_.8fr_.8fr] lg:items-center"
                >
                  <div>
                    <p className="text-sm font-extrabold text-white">
                      {workspace.name}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-slate-500">
                      UG {workspace.ug || '—'} · {workspace.authorizedEmail}
                    </p>
                  </div>

                  <StatusBadge tone={health.tone}>
                    {health.label}
                  </StatusBadge>

                  <div className="text-xs">
                    <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-600">
                      Último backup
                    </span>
                    <span className="mt-1 block font-semibold text-slate-300">
                      {formatDate(status?.lastSuccessAt)}
                    </span>
                  </div>

                  <div className="text-xs">
                    <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-600">
                      Conteúdo
                    </span>
                    <span className="mt-1 block font-semibold text-slate-300">
                      {status?.recordCount || 0} registros ·{' '}
                      {formatBytes(status?.sizeBytes)}
                    </span>
                  </div>

                  <div className="text-xs">
                    <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-600">
                      Integridade
                    </span>
                    <span className="mt-1 block truncate font-mono text-[10px] text-slate-400">
                      {status?.sha256 ? status.sha256.slice(0, 12) + '…' : '—'}
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
              <h4 className="text-base font-extrabold text-white">
                Backup global de identidades
              </h4>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
                Salva UIDs, e-mails, providers, claims e metadados do Firebase
                Auth no Drive da conta fundadora. Hashes e salts de senha não
                são incluídos.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleAuthBackup()}
            disabled={authBackup.creating}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-extrabold text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {authBackup.creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <HardDrive className="h-4 w-4" />
            )}
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
            Em perda total do Firebase Auth, UIDs e vínculos podem ser
            reconstruídos a partir deste inventário. Usuários de senha deverão
            redefinir a credencial.
          </p>
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#071225]/60 p-5">
      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">
        {label}
      </p>
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
  const classes =
    tone === 'success'
      ? 'border-emerald-400/15 bg-emerald-500/[0.08] text-emerald-200'
      : tone === 'danger'
        ? 'border-red-400/15 bg-red-500/[0.08] text-red-200'
        : 'border-amber-400/15 bg-amber-500/[0.08] text-amber-200';

  return (
    <span
      className={
        'inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide '
        + classes
      }
    >
      {tone === 'success' ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <TriangleAlert className="h-3 w-3" />
      )}
      {children}
    </span>
  );
}
