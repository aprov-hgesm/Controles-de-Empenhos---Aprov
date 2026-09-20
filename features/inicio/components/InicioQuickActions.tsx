'use client';

import {
  ArrowRight,
  CalendarClock,
  FilePlus2,
  FileText,
  PackageSearch,
  RotateCcw,
  ScrollText,
} from 'lucide-react';

import type { OperationalActiveTab } from '../../../lib/operationalSubscriptionPlan';
import type { InicioResumeTarget } from '../hooks/useInicioWorkMemory';
import styles from './InicioQuickActions.module.css';

interface InicioQuickActionsProps {
  resumeTarget: InicioResumeTarget | null;
  onResume: () => void;
  onCreateEmpenho: () => void;
  onRegisterInvoice: () => void;
  onNavigate: (tab: OperationalActiveTab) => void;
}

const RESUME_LABELS: Record<InicioResumeTarget['tab'], string> = {
  painel: 'Painel de Controle',
  empenhos: 'Empenhos',
  itens: 'Consulta de Itens',
  nova_nf: 'Notas Fiscais',
  relatorios: 'Relatórios',
  cronogramas: 'Cronogramas',
};

export function InicioQuickActions({
  resumeTarget,
  onResume,
  onCreateEmpenho,
  onRegisterInvoice,
  onNavigate,
}: InicioQuickActionsProps) {
  const resumeLabel = resumeTarget
    ? resumeTarget.tab === 'empenhos' && resumeTarget.empenhoId
      ? `Empenho ${resumeTarget.empenhoId}`
      : RESUME_LABELS[resumeTarget.tab]
    : null;

  return (
    <aside className={styles.root} aria-label="Atalhos operacionais">
      {resumeTarget && resumeLabel && (
        <button
          type="button"
          className={styles.resume}
          onClick={onResume}
          aria-label={`Continuar de onde parei: ${resumeLabel}`}
        >
          <span className={styles.resumeIcon} aria-hidden="true">
            <RotateCcw />
          </span>
          <span className={styles.resumeCopy}>
            <small>Continuar de onde parei</small>
            <strong>{resumeLabel}</strong>
          </span>
          <ArrowRight className={styles.resumeArrow} aria-hidden="true" />
        </button>
      )}

      <div className={styles.header}>
        <span>Ações rápidas</span>
        <i aria-hidden="true" />
      </div>

      <div className={styles.grid}>
        <button type="button" onClick={onCreateEmpenho} className={styles.action}>
          <FilePlus2 aria-hidden="true" />
          <span>Novo empenho</span>
        </button>

        <button type="button" onClick={onRegisterInvoice} className={styles.action}>
          <FileText aria-hidden="true" />
          <span>Cadastrar NF</span>
        </button>

        <button type="button" onClick={() => onNavigate('itens')} className={styles.action}>
          <PackageSearch aria-hidden="true" />
          <span>Itens</span>
        </button>

        <button type="button" onClick={() => onNavigate('relatorios')} className={styles.action}>
          <ScrollText aria-hidden="true" />
          <span>Relatórios</span>
        </button>

        <button type="button" onClick={() => onNavigate('cronogramas')} className={styles.action}>
          <CalendarClock aria-hidden="true" />
          <span>Cronogramas</span>
        </button>
      </div>
    </aside>
  );
}
