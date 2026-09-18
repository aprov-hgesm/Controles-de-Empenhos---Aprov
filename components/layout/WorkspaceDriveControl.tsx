'use client';

import { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CheckCircle2,
  ChevronDown,
  HardDrive,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react';

import { useWorkspaceDriveStorage } from '../../hooks/useWorkspaceDriveStorage';
import type { ResolvedWorkspaceContext } from '../../lib/workspaceContext';

type ToastType = 'success' | 'error' | 'info';

interface WorkspaceDriveControlProps {
  user: User | null;
  workspaceContext: ResolvedWorkspaceContext;
  onNotify?: (message: string, type?: ToastType) => void;
}

export function WorkspaceDriveControl({
  user,
  workspaceContext,
  onNotify,
}: WorkspaceDriveControlProps) {
  const [open, setOpen] = useState(false);
  const {
    settings,
    status,
    loading,
    error,
    connect,
    disconnect,
    clearError,
  } = useWorkspaceDriveStorage(user, workspaceContext);

  const notify = onNotify || (() => undefined);
  const isConnected = status === 'connected';
  const isConfigured = status === 'configured-disconnected' || isConnected;

  if (status === 'unavailable') return null;

  const statusLabel = status === 'loading'
    ? 'Carregando'
    : isConnected
      ? 'Drive conectado'
      : isConfigured
        ? 'Drive configurado'
        : 'Configurar Drive';

  const handleConnect = async () => {
    try {
      const result = await connect();
      notify(
        isConfigured
          ? `Google Drive reconectado ao workspace ${result.settings.workspaceId}.`
          : `Google Drive ativado para o workspace ${result.settings.workspaceId}.`,
        'success'
      );
    } catch (connectionError) {
      notify(
        connectionError instanceof Error
          ? connectionError.message
          : 'Falha ao conectar o Google Drive.',
        'error'
      );
    }
  };

  const handleDisconnect = () => {
    disconnect();
    notify('Autorização temporária do Google Drive descartada. A configuração do workspace foi preservada.', 'info');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="emprovex-header-control emprovex-header-drive-control"
        data-drive-status={status}
        title="Armazenamento Google Drive do setor"
        aria-expanded={open}
        aria-controls="emprovex-drive-panel"
        aria-haspopup="dialog"
      >
        {status === 'loading' ? (
          <Loader2 className="emprovex-header-control__icon h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <HardDrive className="emprovex-header-control__icon h-4 w-4" aria-hidden="true" />
        )}
        <span className="hidden xl:inline">{statusLabel}</span>
        <span className="emprovex-header-control__dot" aria-hidden="true" />
        <ChevronDown className={`emprovex-header-control__chevron h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          id="emprovex-drive-panel"
          role="dialog"
          aria-label="Google Drive do setor"
          className="absolute right-0 top-[calc(100%+0.75rem)] w-[min(94vw,430px)] max-h-[78vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl p-4 z-50"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#00288e] grid place-items-center flex-shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-900">Google Drive do setor</h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{workspaceContext.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              aria-label="Fechar painel do Google Drive"
              title="Fechar painel do Google Drive"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-bold text-slate-500">Workspace</span>
              <span className="font-black text-slate-800 truncate">{'workspaceId' in workspaceContext ? workspaceContext.workspaceId : '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-bold text-slate-500">Configuração</span>
              <span className="inline-flex items-center gap-1.5 font-black text-slate-800">
                {isConfigured ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : null}
                {isConfigured ? 'Pronta' : 'Pendente'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-bold text-slate-500">Sessão Drive</span>
              <span className="font-black text-slate-800">{isConnected ? 'Conectada' : 'Desconectada'}</span>
            </div>
          </div>

          {!isConfigured && (
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
              <div className="flex gap-2">
                <ShieldCheck className="w-4 h-4 text-[#00288e] mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-black text-[#00288e]">Ativação inicial do armazenamento</p>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Autorize o Google Drive usando a mesma Conta Google deste setor. O EMPROVEX criará ou reutilizará a estrutura abaixo sem acessar arquivos fora do escopo autorizado.
                  </p>
                  <div className="mt-2 rounded-lg border border-blue-100 bg-white/70 px-3 py-2 font-mono text-[10px] leading-5 text-slate-600">
                    EMPROVEX<br />
                    ├─ Notas de Empenho<br />
                    └─ Notas Fiscais
                  </div>
                </div>
              </div>
            </div>
          )}

          {settings && (
            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
              <div className="flex gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-black text-emerald-800">Armazenamento documental ativo: Google Drive</p>
                  <p className="text-[11px] text-slate-600 mt-1">Notas de Empenho e Notas Fiscais são armazenadas exclusivamente no Drive do workspace.</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
              <div className="flex items-start gap-2">
                <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
                <button type="button" onClick={clearError} className="ml-auto text-red-400 hover:text-red-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            {!isConnected ? (
              <button
                type="button"
                onClick={handleConnect}
                disabled={loading || status === 'loading'}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#00288e] px-3 py-2.5 text-xs font-black text-white hover:bg-[#001e6a] disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isConfigured ? <RefreshCw className="w-4 h-4" /> : <HardDrive className="w-4 h-4" />}
                {isConfigured ? 'Reconectar Drive' : 'Ativar Google Drive'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDisconnect}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="w-4 h-4" /> Desconectar sessão
              </button>
            )}
          </div>

          <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
            O token do Google Drive não é persistido. Quando a autorização temporária expirar, somente a sessão do Drive será descartada e a opção Reconectar Drive ficará disponível, sem encerrar a sessão do EMPROVEX.
          </p>
        </div>
      )}
    </div>
  );
}
