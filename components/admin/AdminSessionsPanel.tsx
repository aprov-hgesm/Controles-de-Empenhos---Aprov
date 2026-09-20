'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Clock3,
  Infinity as InfinityIcon,
  Loader2,
  MonitorSmartphone,
  ShieldCheck,
  Unplug,
  Users,
} from 'lucide-react';

import type { Workspace } from '../../lib/platformIdentity';
import {
  isAdminWorkspaceSessionActive,
  type AdminWorkspaceSession,
} from '../../lib/platformAdminSessions';
import { DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT } from '../../lib/platformCapacity';

interface AdminSessionsPanelProps {
  workspaces: Workspace[];
  sessions: AdminWorkspaceSession[];
  loading: boolean;
  error: string | null;
  terminatingSessionId: string | null;
  onTerminateSession: (session: AdminWorkspaceSession) => Promise<void>;
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortId(value: string): string {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

export function AdminSessionsPanel({
  workspaces,
  sessions,
  loading,
  error,
  terminatingSessionId,
  onTerminateSession,
  onNotify,
}: AdminSessionsPanelProps) {
  const [now, setNow] = useState(() => Date.now());
  const [candidate, setCandidate] = useState<AdminWorkspaceSession | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const externalWorkspaces = useMemo(
    () => workspaces.filter((workspace) => !workspace.legacyWorkspace),
    [workspaces]
  );

  const activeSessions = useMemo(
    () => sessions.filter((session) => isAdminWorkspaceSessionActive(session, now)),
    [now, sessions]
  );

  const fullWorkspaceCount = externalWorkspaces.filter((workspace) => (
    activeSessions.filter((session) => session.workspaceId === workspace.id).length
      >= DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT
  )).length;

  const confirmTermination = async () => {
    if (!candidate) return;
    try {
      await onTerminateSession(candidate);
      onNotify('Sessão encerrada remotamente. A vaga foi liberada.', 'success');
      setCandidate(null);
    } catch (terminationError) {
      onNotify(
        terminationError instanceof Error
          ? terminationError.message
          : 'Não foi possível encerrar a sessão.',
        'error'
      );
    }
  };

  return (
    <section
      data-testid="admin-sessions-panel"
      className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#071225]/60 shadow-[0_22px_70px_rgba(0,8,28,0.18)] backdrop-blur-xl"
    >
      <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-cyan-200/65">
            <MonitorSmartphone className="h-4 w-4" />
            Bloco 16.2 · capacidade operacional
          </div>
          <h3 className="text-lg font-extrabold text-white">Sessões simultâneas por UG</h3>
          <p className="mt-1 text-xs text-slate-400">
            Acompanhe as vagas ocupadas e encerre acessos externos quando necessário.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:min-w-[300px]">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Ativas agora</p>
            <p data-testid="admin-active-session-count" className="mt-1 text-xl font-black text-white">
              {activeSessions.length}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">UGs lotadas</p>
            <p className="mt-1 text-xl font-black text-white">{fullWorkspaceCount}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-blue-300/15 bg-blue-400/[0.06] px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-blue-300/15 bg-blue-400/[0.08] text-blue-200">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-white">Conta fundadora</p>
              <p className="text-[11px] text-slate-400">Administração e perfil operacional HGeSM</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-300/15 bg-blue-400/[0.08] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-blue-100">
            <InfinityIcon className="h-3.5 w-3.5" />
            Ilimitada
          </span>
        </div>

        {loading && (
          <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-xs text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Sincronizando sessões da plataforma…
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-300/15 bg-rose-400/[0.06] px-4 py-3 text-xs text-rose-100">
            {error}
          </div>
        )}

        {!loading && externalWorkspaces.length === 0 && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-4 text-xs text-slate-400">
            Nenhum setor externo cadastrado.
          </div>
        )}

        {externalWorkspaces.map((workspace) => {
          const workspaceSessions = activeSessions.filter(
            (session) => session.workspaceId === workspace.id
          );
          const occupied = workspaceSessions.length;
          const full = occupied >= DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT;

          return (
            <div
              key={workspace.id}
              data-testid={`admin-session-workspace-${workspace.id}`}
              className="rounded-2xl border border-white/[0.08] bg-slate-950/20 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-extrabold text-white">{workspace.name}</h4>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-0.5 font-mono text-[9px] font-bold text-slate-300">
                      UG {workspace.ug || '—'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{workspace.authorizedEmail}</p>
                </div>

                <div className={`inline-flex items-center gap-2 self-start rounded-xl border px-3 py-2 text-xs font-extrabold sm:self-auto ${
                  full
                    ? 'border-amber-300/20 bg-amber-400/[0.07] text-amber-100'
                    : 'border-emerald-300/15 bg-emerald-400/[0.06] text-emerald-100'
                }`}>
                  <Users className="h-4 w-4" />
                  {occupied} / {DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT} sessões
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {workspaceSessions.length === 0 ? (
                  <div className="lg:col-span-2 rounded-xl border border-dashed border-white/[0.08] px-4 py-3 text-xs text-slate-500">
                    Nenhuma sessão ativa neste setor.
                  </div>
                ) : workspaceSessions.map((session) => (
                  <div
                    key={session.sessionId}
                    data-testid={`admin-session-${session.sessionId}`}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.55)]" />
                          <p className="text-xs font-extrabold text-white">{session.slotId}</p>
                        </div>
                        <p className="mt-1 truncate font-mono text-[9px] text-slate-500" title={session.sessionId}>
                          {shortId(session.sessionId)}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={terminatingSessionId === session.sessionId}
                        onClick={() => setCandidate(session)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-300/15 bg-rose-400/[0.06] px-2.5 text-[10px] font-extrabold text-rose-100 transition hover:bg-rose-400/[0.11] disabled:opacity-50"
                      >
                        {terminatingSessionId === session.sessionId
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Unplug className="h-3.5 w-3.5" />}
                        Encerrar
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                      <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />Início {formatDateTime(session.startedAt)}</span>
                      <span className="text-right">Último sinal {formatDateTime(session.lastSeenAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {candidate && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#020817]/88 p-4 backdrop-blur-xl">
          <div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-[1.75rem] border border-rose-300/15 bg-[#071225] p-6 shadow-2xl">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl border border-rose-300/15 bg-rose-400/[0.07] text-rose-200">
              <Unplug className="h-5 w-5" />
            </div>
            <h4 className="text-lg font-extrabold text-white">Encerrar sessão remotamente?</h4>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              O acesso desta sessão será revogado e a vaga será liberada. O operador poderá entrar novamente depois, criando uma nova sessão.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCandidate(null)} className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-xs font-bold text-slate-300">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmTermination()}
                disabled={terminatingSessionId === candidate.sessionId}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-300/20 bg-rose-500/20 px-4 py-2.5 text-xs font-extrabold text-rose-100 disabled:opacity-50"
              >
                {terminatingSessionId === candidate.sessionId && <Loader2 className="h-4 w-4 animate-spin" />}
                Encerrar sessão
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
