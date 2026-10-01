'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Compass,
  HardDrive,
  KeyRound,
  ListChecks,
  X,
} from 'lucide-react';

interface SectorFirstAccessChecklistProps {
  userUid: string;
  workspaceName: string;
  ug: string | null;
  onOpenCredentials: () => void;
}

interface StoredChecklistState {
  sectorReviewed?: boolean;
  navigationReviewed?: boolean;
  completed?: boolean;
}

function storageKey(userUid: string): string {
  return `emprovex:saas-r1:first-access:${userUid}`;
}

export function SectorFirstAccessChecklist({
  userUid,
  workspaceName,
  ug,
  onOpenCredentials,
}: SectorFirstAccessChecklistProps) {
  const [open, setOpen] = useState(false);
  const [completed, setCompleted] = useState(true);
  const [sectorReviewed, setSectorReviewed] = useState(false);
  const [navigationReviewed, setNavigationReviewed] = useState(false);

  const identityLine = useMemo(
    () => [workspaceName, ug ? `UG ${ug}` : null].filter(Boolean).join(' · '),
    [ug, workspaceName]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(userUid));
      const stored = raw ? JSON.parse(raw) as StoredChecklistState : {};
      const isCompleted = stored.completed === true;
      setSectorReviewed(stored.sectorReviewed === true);
      setNavigationReviewed(stored.navigationReviewed === true);
      setCompleted(isCompleted);
      setOpen(!isCompleted);
    } catch {
      setCompleted(false);
      setOpen(true);
    }
  }, [userUid]);

  const persist = (next: StoredChecklistState) => {
    try {
      localStorage.setItem(storageKey(userUid), JSON.stringify(next));
    } catch {
      // O checklist é apenas UX local; falha de storage nunca bloqueia a operação.
    }
  };

  const toggleSectorReviewed = () => {
    const next = !sectorReviewed;
    setSectorReviewed(next);
    persist({
      sectorReviewed: next,
      navigationReviewed,
      completed: false,
    });
  };

  const toggleNavigationReviewed = () => {
    const next = !navigationReviewed;
    setNavigationReviewed(next);
    persist({
      sectorReviewed,
      navigationReviewed: next,
      completed: false,
    });
  };

  const finish = () => {
    persist({
      sectorReviewed,
      navigationReviewed,
      completed: true,
    });
    setCompleted(true);
    setOpen(false);
  };

  if (completed) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-30 inline-flex items-center gap-2 rounded-full border border-blue-300/15 bg-[#071225]/95 px-4 py-2 text-xs font-extrabold text-blue-100 shadow-xl shadow-slate-950/20 backdrop-blur-xl md:bottom-6"
      >
        <ListChecks className="h-4 w-4" />
        Primeiros passos
      </button>
    );
  }

  return (
    <aside
      aria-label="Primeiros passos no EMPROVEX"
      className="fixed bottom-24 right-4 z-30 w-[min(380px,calc(100vw-2rem))] rounded-[1.5rem] border border-white/[0.09] bg-[#071225]/95 p-4 text-white shadow-[0_24px_80px_rgba(0,8,28,0.45)] backdrop-blur-2xl md:bottom-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-blue-300">
            <ListChecks className="h-4 w-4" />
            Primeiro acesso
          </div>
          <h2 className="mt-1.5 text-base font-extrabold">Primeiros passos</h2>
          <p className="mt-1 text-[11px] leading-5 text-slate-400">
            Um checklist curto para começar. Nada aqui bloqueia o uso do sistema.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fechar primeiros passos"
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-300/10 bg-emerald-400/[0.045] px-3 py-2.5">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          <div>
            <p className="text-xs font-bold text-slate-200">Acesso realizado</p>
            <p className="mt-0.5 text-[10px] leading-4 text-slate-500">Sua sessão foi validada para este workspace.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleSectorReviewed}
          className="flex w-full items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 text-left transition hover:bg-white/[0.045]"
        >
          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${sectorReviewed ? 'border-blue-300/30 bg-blue-500/25 text-blue-100' : 'border-white/15 text-transparent'}`}>
            <Check className="h-3 w-3" />
          </span>
          <div>
            <p className="text-xs font-bold text-slate-200">Conferir dados do setor</p>
            <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{identityLine || 'Workspace autorizado'}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={toggleNavigationReviewed}
          className="flex w-full items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 text-left transition hover:bg-white/[0.045]"
        >
          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${navigationReviewed ? 'border-blue-300/30 bg-blue-500/25 text-blue-100' : 'border-white/15 text-transparent'}`}>
            <Check className="h-3 w-3" />
          </span>
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Compass className="h-3.5 w-3.5 text-blue-300" />
              Conhecer a navegação principal
            </p>
            <p className="mt-0.5 text-[10px] leading-4 text-slate-500">Use o menu lateral para acessar Empenhos, Recebimentos, Relatórios e demais módulos.</p>
          </div>
        </button>

        <div className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
          <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <div>
            <p className="text-xs font-bold text-slate-200">Google Drive é opcional</p>
            <p className="mt-0.5 text-[10px] leading-4 text-slate-500">Conecte pelo topo quando quiser usar armazenamento e integrações associadas. O núcleo do EMPROVEX funciona sem essa conexão.</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onOpenCredentials}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] font-bold text-slate-300 transition hover:bg-white/10"
        >
          <KeyRound className="h-4 w-4" />
          Alterar minha senha
        </button>
        <button
          type="button"
          onClick={finish}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-[11px] font-extrabold text-white transition hover:bg-blue-500"
        >
          <CheckCircle2 className="h-4 w-4" />
          Começar a usar
        </button>
      </div>
    </aside>
  );
}
