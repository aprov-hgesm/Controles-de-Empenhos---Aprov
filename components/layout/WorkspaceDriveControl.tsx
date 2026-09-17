'use client';

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowRightLeft,
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
import {
  countDocumentStorage,
  migrateLegacyDocumentsToDrive,
  type DocumentMigrationCounts,
  type DocumentMigrationProgress,
} from '../../lib/documentDriveMigration';
import { getEmpenhos, getInvoices } from '../../lib/firebaseSync';
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
  const [migrationCounts, setMigrationCounts] = useState<DocumentMigrationCounts | null>(null);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [migrationConfirmOpen, setMigrationConfirmOpen] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<DocumentMigrationProgress | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [migrationFailures, setMigrationFailures] = useState<string[]>([]);
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

  const refreshMigrationCounts = async () => {
    if (!user) return;
    try {
      const [empenhos, invoices] = await Promise.all([
        getEmpenhos(user.uid),
        getInvoices(user.uid),
      ]);
      setMigrationCounts(countDocumentStorage(empenhos, invoices));
    } catch (countError) {
      setMigrationError(countError instanceof Error ? countError.message : 'Falha ao analisar os documentos atuais.');
    }
  };

  useEffect(() => {
    if (!open || !user || status === 'unavailable') return;
    void refreshMigrationCounts();
  }, [open, user, status]);

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
        `Google Drive conectado ao workspace ${result.settings.workspaceId}.`,
        'success'
      );
      await refreshMigrationCounts();
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
    setMigrationConfirmOpen(false);
    disconnect();
    notify('Autorização temporária do Google Drive descartada. A configuração do workspace foi preservada.', 'info');
  };

  const requestMigration = () => {
    if (!user || !isConnected) {
      setMigrationError('Reconecte o Google Drive antes de iniciar a migração.');
      return;
    }
    setMigrationError(null);
    setMigrationConfirmOpen(true);
  };

  const handleMigration = async () => {
    if (!user || !isConnected) {
      setMigrationConfirmOpen(false);
      setMigrationError('Reconecte o Google Drive antes de iniciar a migração.');
      return;
    }

    setMigrationConfirmOpen(false);
    setMigrationBusy(true);
    setMigrationError(null);
    setMigrationFailures([]);
    setMigrationProgress(null);

    try {
      const [empenhos, invoices] = await Promise.all([
        getEmpenhos(user.uid),
        getInvoices(user.uid),
      ]);
      const before = countDocumentStorage(empenhos, invoices);
      setMigrationCounts(before);

      if (before.totalLegacy === 0) {
        notify('Não há PDFs legados do Vercel Blob pendentes de migração.', 'info');
        return;
      }

      const result = await migrateLegacyDocumentsToDrive(
        user,
        empenhos,
        invoices,
        setMigrationProgress
      );

      setMigrationFailures(
        result.failures.map((failure) => `${failure.kind === 'empenho' ? 'NE' : 'NF'} ${failure.id}: ${failure.message}`)
      );
      await refreshMigrationCounts();

      if (result.failed === 0) {
        notify(`${result.migrated} PDF(s) migrado(s) e verificado(s) no Google Drive.`, 'success');
      } else {
        setMigrationError(`${result.failed} PDF(s) não puderam ser migrados. A origem no Blob foi preservada.`);
        notify('Migração concluída parcialmente. Consulte os detalhes no painel do Drive.', 'error');
      }
    } catch (migrationException) {
      const message = migrationException instanceof Error
        ? migrationException.message
        : 'Falha inesperada durante a migração documental.';
      setMigrationError(message);
      notify(message, 'error');
    } finally {
      setMigrationBusy(false);
    }
  };

  const migrationPercent = migrationProgress && migrationProgress.total > 0
    ? Math.round((migrationProgress.processed / migrationProgress.total) * 100)
    : 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/80 px-3 py-2 text-[11px] font-extrabold text-slate-700 transition hover:bg-slate-50 active:scale-95"
        title="Armazenamento Google Drive do setor"
      >
        {status === 'loading' ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#00288e]" />
        ) : (
          <HardDrive className={`w-4 h-4 ${isConnected ? 'text-emerald-600' : isConfigured ? 'text-amber-600' : 'text-slate-500'}`} />
        )}
        <span className="hidden xl:inline">{statusLabel}</span>
        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : isConfigured ? 'bg-amber-400' : 'bg-slate-300'}`} />
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] w-[min(94vw,430px)] max-h-[78vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl p-4 z-50">
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
            <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
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

          {settings && (
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
              <div className="flex gap-2">
                <ShieldCheck className="w-4 h-4 text-[#00288e] mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-black text-[#00288e]">Google Drive é o destino oficial de novos PDFs</p>
                  <p className="text-[11px] text-slate-600 mt-1">A estrutura EMPROVEX está provisionada para Notas de Empenho e Notas Fiscais.</p>
                </div>
              </div>
            </div>
          )}

          {settings && migrationCounts && (
            <div className="mt-3 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-slate-600" />
                <p className="text-xs font-black text-slate-800">Migração Blob → Drive</p>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="rounded-lg bg-amber-50 p-2 text-center">
                  <div className="text-base font-black text-amber-700">{migrationCounts.totalLegacy}</div>
                  <div className="text-[9px] font-bold text-amber-600 uppercase">Blob pendente</div>
                </div>
                <div className="rounded-lg bg-blue-50 p-2 text-center">
                  <div className="text-base font-black text-blue-700">{migrationCounts.empenhoLegacy}</div>
                  <div className="text-[9px] font-bold text-blue-600 uppercase">NEs</div>
                </div>
                <div className="rounded-lg bg-emerald-50 p-2 text-center">
                  <div className="text-base font-black text-emerald-700">{migrationCounts.drive}</div>
                  <div className="text-[9px] font-bold text-emerald-600 uppercase">No Drive</div>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">Notas Fiscais pendentes: <strong>{migrationCounts.invoiceLegacy}</strong>. Os arquivos do Blob permanecem intactos até a auditoria final.</p>

              {migrationProgress && (
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                    <span className="truncate pr-2">{migrationProgress.currentLabel}</span>
                    <span>{migrationProgress.processed}/{migrationProgress.total}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-[#00288e] transition-all" style={{ width: `${migrationPercent}%` }} />
                  </div>
                </div>
              )}

              {migrationConfirmOpen && !migrationBusy && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-2">
                    <TriangleAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-amber-900">Confirmar migração definitiva para o Drive?</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-amber-800">
                        Os PDFs originais do Vercel Blob não serão apagados nesta etapa. Cada arquivo será enviado ao Google Drive e verificado por tamanho e SHA-256 antes de o Firestore passar a apontar para o Drive.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMigrationConfirmOpen(false)}
                      className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-[11px] font-black text-amber-800 hover:bg-amber-100"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleMigration}
                      className="rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-black text-white hover:bg-emerald-800"
                    >
                      Confirmar e iniciar
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={requestMigration}
                disabled={migrationBusy || migrationConfirmOpen || !isConnected || migrationCounts.totalLegacy === 0}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2.5 text-xs font-black text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {migrationBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                {migrationBusy
                  ? 'Migrando e verificando...'
                  : migrationCounts.totalLegacy === 0
                    ? 'Migração concluída'
                    : migrationConfirmOpen
                      ? 'Confirmação pendente'
                      : 'Migrar PDFs automaticamente'}
              </button>
            </div>
          )}

          {(error || migrationError) && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
              <div className="flex items-start gap-2">
                <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{migrationError || error}</span>
                <button type="button" onClick={() => { clearError(); setMigrationError(null); }} className="ml-auto text-red-400 hover:text-red-700"><X className="w-3.5 h-3.5" /></button>
              </div>
              {migrationFailures.length > 0 && (
                <div className="mt-2 max-h-24 overflow-y-auto space-y-1 text-[10px]">
                  {migrationFailures.slice(0, 6).map((failure) => <div key={failure}>• {failure}</div>)}
                  {migrationFailures.length > 6 && <div>+ {migrationFailures.length - 6} falha(s) adicional(is)</div>}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            {!isConnected ? (
              <button
                type="button"
                onClick={handleConnect}
                disabled={loading || status === 'loading' || migrationBusy}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#00288e] px-3 py-2.5 text-xs font-black text-white hover:bg-[#001e6a] disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isConfigured ? <RefreshCw className="w-4 h-4" /> : <HardDrive className="w-4 h-4" />}
                {isConfigured ? 'Reconectar Drive' : 'Configurar Drive'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={migrationBusy}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" /> Desconectar sessão
              </button>
            )}
          </div>

          <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
            O token do Google Drive não é persistido. Após recarregar o sistema, a configuração permanece, mas o Drive precisa ser reconectado para operações com arquivos.
          </p>
        </div>
      )}
    </div>
  );
}
