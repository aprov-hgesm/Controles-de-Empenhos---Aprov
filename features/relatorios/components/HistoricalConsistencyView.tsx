'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from 'lucide-react';

import {
  repairHistoricalConsistencyIssue,
  scanHistoricalConsistency,
} from '../../../lib/historicalConsistencyService';
import type {
  HistoricalConsistencyIssue,
  HistoricalConsistencyReport,
} from '../../../lib/historicalConsistency';

const severityClass = {
  critical: 'border-rose-200 bg-rose-50/70 text-rose-800',
  warning: 'border-amber-200 bg-amber-50/70 text-amber-800',
  info: 'border-blue-100 bg-blue-50/70 text-blue-800',
} as const;

const repairModeLabel = {
  automatic: 'Reparo seguro disponível',
  manual_review: 'Revisão documental necessária',
  diagnostic_only: 'Somente diagnóstico',
} as const;

export function HistoricalConsistencyView() {
  const [report, setReport] = React.useState<HistoricalConsistencyReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [repairingId, setRepairingId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const runScan = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const next = await scanHistoricalConsistency();
      setReport(next);
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : 'Não foi possível executar o diagnóstico histórico.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const repairIssue = React.useCallback(async (issue: HistoricalConsistencyIssue) => {
    if (issue.repairMode !== 'automatic' || !issue.repairKind) return;

    setRepairingId(issue.id);
    setError(null);
    setMessage(null);
    try {
      const result = await repairHistoricalConsistencyIssue(issue);
      setMessage(result.message);
      const next = await scanHistoricalConsistency();
      setReport(next);
    } catch (repairError) {
      setError(
        repairError instanceof Error
          ? repairError.message
          : 'O reparo foi bloqueado por uma mudança concorrente.'
      );
    } finally {
      setRepairingId(null);
    }
  }, []);

  return (
    <div className="space-y-5" data-testid="historical-consistency-view">
      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2 flex items-center gap-2 text-[#00288e]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              <span className="font-mono text-[10px] font-extrabold uppercase tracking-[0.18em]">
                Integridade Histórica
              </span>
            </div>
            <h3 className="text-xl font-bold tracking-tight text-[#00288e]">
              Diagnóstico e saneamento controlado
            </h3>
            <p className="mt-1 text-sm font-medium leading-relaxed text-gray-500">
              Verifica CNPJ, identidade física das NFs, UG + NS e locks históricos do workspace.
              O EMPROVEX só oferece reparo automático quando a evidência é inequívoca.
            </p>
          </div>

          <button
            type="button"
            data-testid="historical-consistency-scan"
            onClick={runScan}
            disabled={loading || Boolean(repairingId)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#001f70] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <SearchCheck className="h-4 w-4" aria-hidden="true" />
            )}
            {loading ? 'Analisando...' : report ? 'Executar novamente' : 'Executar diagnóstico'}
          </button>
        </div>
      </section>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">
          {error}
        </div>
      ) : null}

      {report ? (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <SummaryCard label="Achados" value={report.totals.issues} />
            <SummaryCard label="Críticos" value={report.totals.critical} emphasis="critical" />
            <SummaryCard label="Alertas" value={report.totals.warnings} emphasis="warning" />
            <SummaryCard label="Reparo seguro" value={report.totals.automatic} emphasis="safe" />
            <SummaryCard label="Revisão humana" value={report.totals.manualReview} />
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-gray-800">Resultado do diagnóstico</h4>
                <p className="text-[11px] font-medium text-gray-500">
                  Workspace {report.workspaceId}
                  {report.workspaceUg ? ` · UG ${report.workspaceUg}` : ' · UG não cadastrada'}
                </p>
              </div>
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-gray-400">
                {new Date(report.generatedAt).toLocaleString('pt-BR')}
              </span>
            </div>

            {report.issues.length === 0 ? (
              <div
                data-testid="historical-consistency-clean"
                className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6 text-center"
              >
                <CheckCircle2 className="mb-3 h-8 w-8 text-emerald-600" aria-hidden="true" />
                <h5 className="text-sm font-extrabold text-emerald-800">
                  Nenhuma inconsistência histórica detectada
                </h5>
                <p className="mt-1 max-w-xl text-xs font-medium leading-relaxed text-emerald-700/80">
                  NFs, CNPJs e identidades de NS conhecidas estão coerentes com as invariantes atuais.
                </p>
              </div>
            ) : (
              <div className="space-y-3" data-testid="historical-consistency-issues">
                {report.issues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    repairing={repairingId === issue.id}
                    onRepair={() => repairIssue(issue)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 p-8 text-center">
          <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-[#00288e]" aria-hidden="true" />
          <p className="text-sm font-bold text-[#00288e]">
            Nenhuma análise histórica executada nesta sessão.
          </p>
          <p className="mx-auto mt-1 max-w-2xl text-xs font-medium leading-relaxed text-gray-500">
            O diagnóstico é somente leitura. Reparos só aparecem depois da análise e continuam sujeitos
            a revalidação transacional antes de qualquer escrita.
          </p>
        </section>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: 'critical' | 'warning' | 'safe';
}) {
  const className = emphasis === 'critical'
    ? 'border-rose-100 bg-rose-50 text-rose-800'
    : emphasis === 'warning'
      ? 'border-amber-100 bg-amber-50 text-amber-800'
      : emphasis === 'safe'
        ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
        : 'border-gray-100 bg-white text-gray-800';

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${className}`}>
      <div className="text-2xl font-black">{value}</div>
      <div className="mt-1 text-[10px] font-extrabold uppercase tracking-wider opacity-70">{label}</div>
    </div>
  );
}

function IssueCard({
  issue,
  repairing,
  onRepair,
}: {
  issue: HistoricalConsistencyIssue;
  repairing: boolean;
  onRepair: () => void;
}) {
  const Icon = issue.severity === 'critical'
    ? AlertTriangle
    : issue.repairMode === 'automatic'
      ? Wrench
      : ShieldAlert;

  return (
    <article
      data-testid={`historical-issue-${issue.code}`}
      className={`rounded-2xl border p-4 ${severityClass[issue.severity]}`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-lg bg-white/70">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h5 className="text-xs font-extrabold">{issue.summary}</h5>
              <span className="rounded-full bg-white/70 px-2 py-0.5 font-mono text-[9px] font-bold uppercase">
                {issue.code}
              </span>
            </div>
            <p className="mt-1 text-[11px] font-medium leading-relaxed opacity-80">
              {issue.detail}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] font-bold opacity-70">
              <span>{issue.entityType}: {issue.entityId}</span>
              <span>{repairModeLabel[issue.repairMode]}</span>
            </div>
          </div>
        </div>

        {issue.repairMode === 'automatic' && issue.repairKind ? (
          <button
            type="button"
            onClick={onRepair}
            disabled={repairing}
            data-testid={`repair-${issue.repairKind}`}
            className="inline-flex h-9 flex-none items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 text-[10px] font-extrabold text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {repairing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {repairing ? 'Revalidando...' : 'Reparar com segurança'}
          </button>
        ) : null}
      </div>
    </article>
  );
}
