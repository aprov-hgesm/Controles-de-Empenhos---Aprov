'use client';

import { Check, CircleDot, KeyRound, ShieldAlert } from 'lucide-react';

export type LoginNarrativePhase = 'session' | 'idle' | 'identity' | 'workspace' | 'error';
export type LoginNarrativeMode = 'sector' | 'founder' | null;

interface LoginStatusRailProps {
  phase: LoginNarrativePhase;
  mode?: LoginNarrativeMode;
  className?: string;
}

const phaseCopy = {
  session: {
    eyebrow: 'Sessão',
    title: 'Verificando sessão existente',
    detail: 'O EMPROVEX está verificando se há uma sessão autenticada neste navegador.',
  },
  idle: {
    eyebrow: 'Fluxo de acesso',
    title: 'Aguardando autenticação',
    detail: 'Informe suas credenciais para iniciar o acesso.',
  },
  identity: {
    eyebrow: 'Identidade',
    title: 'Autenticando identidade',
    detail: 'A credencial está sendo processada pelo provedor de autenticação.',
  },
  workspace: {
    eyebrow: 'Workspace',
    title: 'Validando acesso ao workspace',
    detail: 'A identidade autenticada está sendo vinculada ao workspace autorizado.',
  },
  error: {
    eyebrow: 'Acesso',
    title: 'Autenticação não concluída',
    detail: 'Revise a mensagem apresentada e tente novamente.',
  },
} satisfies Record<LoginNarrativePhase, { eyebrow: string; title: string; detail: string }>;

export function LoginStatusRail({
  phase,
  mode = null,
  className = '',
}: LoginStatusRailProps) {
  const copy = phaseCopy[phase];
  const isLivePhase = phase === 'session' || phase === 'identity' || phase === 'workspace' || phase === 'error';
  const identityLabel = mode === 'founder'
    ? 'Google institucional'
    : mode === 'sector'
      ? 'Credencial do setor'
      : 'Identidade';

  const identityDone = phase === 'workspace';
  const identityActive = phase === 'identity';
  const workspaceActive = phase === 'workspace';
  const hasError = phase === 'error';

  return (
    <div
      className={`emprovex-auth-rail ${className}`}
      data-phase={phase}
      role={isLivePhase ? 'status' : undefined}
      aria-live={isLivePhase ? 'polite' : 'off'}
      aria-atomic={isLivePhase ? 'true' : undefined}
    >
      <div className="flex items-start gap-3">
        <div className="emprovex-auth-rail__icon mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          {hasError ? (
            <ShieldAlert className="h-4 w-4" />
          ) : phase === 'identity' ? (
            <KeyRound className="h-4 w-4" />
          ) : (
            <CircleDot className="h-4 w-4" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-blue-300/65">
            {copy.eyebrow}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-200">{copy.title}</p>
          <p className="mt-1 text-[10px] leading-5 text-slate-500">{copy.detail}</p>
        </div>
      </div>

      <div className="emprovex-auth-rail__timeline mt-4 grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2">
        <span
          className="emprovex-auth-step"
          data-state={identityDone ? 'done' : identityActive ? 'active' : hasError ? 'error' : 'idle'}
        >
          {identityDone ? <Check className="h-2.5 w-2.5" /> : <span />}
        </span>
        <span
          className="emprovex-auth-connector"
          data-state={identityDone ? 'done' : identityActive ? 'active' : 'idle'}
        />
        <span
          className="emprovex-auth-step"
          data-state={workspaceActive ? 'active' : hasError ? 'error' : 'idle'}
        >
          <span />
        </span>
        <span className="emprovex-auth-connector" data-state="idle" />
        <span className="emprovex-auth-step" data-state="idle">
          <span />
        </span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500/75">
        <span>{identityLabel}</span>
        <span className="text-center">Workspace</span>
        <span className="text-right">Ambiente</span>
      </div>
    </div>
  );
}
