'use client';

import { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArchiveRestore,
  CheckCircle2,
  DatabaseBackup,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import { useWorkspaceBackup } from '../../hooks/useWorkspaceBackup';
import type { WorkspaceGoogleDriveSession } from '../../lib/googleDriveWorkspace';
import type { WorkspaceDriveSettings } from '../../lib/workspaceDriveSettings';
import type { ResolvedWorkspaceContext } from '../../lib/workspaceContext';

interface WorkspaceBackupSectionProps {
  user: User | null;
  workspaceContext: ResolvedWorkspaceContext;
  session: WorkspaceGoogleDriveSession | null;
  settings: WorkspaceDriveSettings | null;
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

function formatDate(value?: string): string {
  if (!value) return 'Nenhum backup ainda';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('pt-BR');
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 KB';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function WorkspaceBackupSection({
  user,
  workspaceContext,
  session,
  settings,
  onNotify,
}: WorkspaceBackupSectionProps) {
  const notify = onNotify || (() => undefined);
  const [selectedPlan, setSelectedPlan] = useState<{
    fileId: string;
    fileName: string;
    totalMissing: number;
    totalExisting: number;
  } | null>(null);

  const backup = useWorkspaceBackup({
    user,
    workspaceContext,
    session,
    settings,
  });

  if (!session || !settings) {
    return (
      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
        <div className="flex gap-2">
          <DatabaseBackup className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
          <div>
            <p className="text-xs font-black text-slate-700">Backup operacional</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Reconecte o Google Drive para gerar e consultar os backups lógicos deste workspace.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleManualBackup = async () => {
    try {
      const result = await backup.createBackup('manual');
      notify(
        `Backup concluído: ${result.status.recordCount} registros protegidos no Google Drive.`,
        'success'
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Falha ao gerar backup.', 'error');
    }
  };

  const handlePlan = async (fileId: string, fileName: string) => {
    try {
      const plan = await backup.simulateRestore(fileId);
      setSelectedPlan({
        fileId,
        fileName,
        totalMissing: plan.totalMissing,
        totalExisting: plan.totalExisting,
      });
      notify(
        `Backup validado: ${plan.totalMissing} registros ausentes podem ser recuperados e ${plan.totalExisting} existentes serão preservados.`,
        'info'
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Falha ao validar backup.', 'error');
    }
  };

  const handleRestore = async () => {
    if (!selectedPlan) return;
    const confirmed = window.confirm(
      `Restaurar somente os ${selectedPlan.totalMissing} registros ausentes a partir de "${selectedPlan.fileName}"?\n\nRegistros já existentes NÃO serão sobrescritos. PDFs não fazem parte desta restauração.`
    );
    if (!confirmed) return;

    try {
      const result = await backup.restoreMissing(selectedPlan.fileId);
      notify(
        `Restauração concluída: ${result.totalRestored} registros recuperados; ${result.totalSkippedExisting} existentes preservados.`,
        'success'
      );
      setSelectedPlan(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Falha na restauração.', 'error');
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
      <div className="flex items-start gap-2">
        <DatabaseBackup className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-700" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black text-indigo-900">Backup e recuperação</p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                JSON lógico no Drive · PDFs não são duplicados
              </p>
            </div>
            {backup.status?.status === 'success' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> Protegido
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded-lg border border-white/80 bg-white/70 p-2">
              <span className="block font-bold text-slate-400">Último backup</span>
              <span className="mt-0.5 block font-black text-slate-700">{formatDate(backup.status?.lastSuccessAt)}</span>
            </div>
            <div className="rounded-lg border border-white/80 bg-white/70 p-2">
              <span className="block font-bold text-slate-400">Registros</span>
              <span className="mt-0.5 block font-black text-slate-700">{backup.status?.recordCount || 0}</span>
            </div>
          </div>

          {backup.error && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] font-semibold text-amber-800">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>{backup.error}</span>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleManualBackup()}
              disabled={backup.backingUp || backup.restoring}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-700 px-3 py-2 text-[10px] font-black text-white hover:bg-indigo-600 disabled:opacity-50"
            >
              {backup.backingUp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DatabaseBackup className="h-3.5 w-3.5" />}
              Gerar backup agora
            </button>
            <button
              type="button"
              onClick={() => void backup.refreshHistory()}
              disabled={backup.loadingHistory}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-[10px] font-black text-indigo-800 hover:bg-indigo-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${backup.loadingHistory ? 'animate-spin' : ''}`} />
              Atualizar histórico
            </button>
          </div>

          {backup.history.length > 0 && (
            <div className="mt-3 max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {backup.history.slice(0, 8).map((file) => (
                <div key={file.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/90 bg-white/75 px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-black text-slate-700">{file.name}</p>
                    <p className="text-[9px] text-slate-400">{formatBytes(file.size)} · {formatDate(file.createdTime)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handlePlan(file.id, file.name)}
                    disabled={backup.restoring}
                    className="flex-shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[9px] font-black text-slate-600 hover:bg-slate-50"
                  >
                    Validar
                  </button>
                </div>
              ))}
            </div>
          )}

          {selectedPlan && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
              <div className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-700" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-emerald-800">Backup íntegro e compatível</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-600">
                    {selectedPlan.totalMissing} registros ausentes serão criados. {selectedPlan.totalExisting} registros existentes serão mantidos sem alteração.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleRestore()}
                    disabled={backup.restoring || selectedPlan.totalMissing === 0}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-[10px] font-black text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {backup.restoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                    Restaurar registros ausentes
                  </button>
                </div>
              </div>
            </div>
          )}

          <p className="mt-3 text-[9px] leading-relaxed text-slate-400">
            O EMPROVEX tenta gerar no máximo um backup automático por dia quando este workspace está em uso e o Drive está conectado. São mantidos até 30 backups.
          </p>
        </div>
      </div>
    </div>
  );
}
