'use client';

import type React from 'react';
import type { User } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { getCurrentOperationalScope } from '../../../lib/operationalPaths';
import type { SectorWorkspaceContext } from '../../../lib/workspaceContext';
import { EmpenhosView } from '../../empenhos/components/EmpenhosView';
import { NotasFiscaisView } from '../../notas-fiscais/components/NotasFiscaisView';
import { CronogramasView } from '../../cronogramas/components/CronogramasView';
import {
  assertAlmoxFinanceScope, getAlmoxFinanceClasses, isAlmoxFinanceClass,
  validateAlmoxRemittances,
} from './sectorFinancialPolicy';

type EmpContext = React.ComponentProps<typeof EmpenhosView>['context'];
type InvoiceContext = React.ComponentProps<typeof NotasFiscaisView>['context'];
type CronoContext = React.ComponentProps<typeof CronogramasView>['context'];

export interface AlmoxFinancialSurfaceBase {
  /** Resolução de platformAccess, nunca obtida de parâmetros de URL/UG. */
  workspace: SectorWorkspaceContext;
  user: User;
}

/**
 * Bloqueio de montagem adicional às regras de persistência existentes.
 * Operações reais são as dos mesmos hooks de Empenhos, NF e Cronogramas.
 * O W9 é responsável por inicializar esses hooks com sectorType='almoxarifado'.
 */
function authorized(base: AlmoxFinancialSurfaceBase): boolean {
  try {
    const scope = getCurrentOperationalScope(base.user.uid);
    assertAlmoxFinanceScope(base.workspace, scope, auth.currentUser?.uid || null, base.user.uid);
    return true;
  } catch {
    return false;
  }
}

function AccessDenied() {
  return <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
    Acesso financeiro do Almoxarifado indisponível para este workspace.
  </p>;
}

/** Reaproveita a view, as revisões otimistas, os documentos e os hooks legados. */
export function AlmoxEmpenhosSurface(props: AlmoxFinancialSurfaceBase & { context: EmpContext }) {
  if (!authorized(props)) return <AccessDenied />;
  const context = props.context;
  const allowed = getAlmoxFinanceClasses(context.empenhoClasses);
  const requireClass = (classification: string): void => {
    if (!isAlmoxFinanceClass(classification)) {
      throw new Error('ALMOX_FOOD_CLASS_NOT_APPLICABLE');
    }
  };
  const safeContext: EmpContext = {
    ...context,
    empenhoClasses: allowed,
    handleCreateEmpenho: (...args: any[]) => {
      requireClass(context.newEmpenhoForm.classification);
      return context.handleCreateEmpenho(...args);
    },
    handleSaveReviewEmpenho: (...args: any[]) => {
      requireClass(String(context.reviewEmpenho?.classification || ''));
      return context.handleSaveReviewEmpenho(...args);
    },
    handleUpdateEmpenhoClassification: async (id: string, code: string) => {
      requireClass(code);
      return context.handleUpdateEmpenhoClassification(id, code);
    },
    addEmpenhoClass: (code, description) => {
      requireClass(code);
      return context.addEmpenhoClass(code, description, false);
    },
    updateEmpenhoClass: (code, description) => {
      requireClass(code);
      return context.updateEmpenhoClass(code, description, false);
    },
    // Nunca oferecer saída para fluxo específico de TR no Almoxarifado.
    handleDownloadTermoRecebimento: () => {
      throw new Error('ALMOX_TERMO_DISABLED');
    },
  };
  return <EmpenhosView context={safeContext} sectorType="almoxarifado" />;
}

/** Mesmas coleções, vínculo NF ↔ empenho, commit transacional e anexos. */
export function AlmoxNotasFiscaisSurface(props: AlmoxFinancialSurfaceBase & { context: InvoiceContext }) {
  if (!authorized(props)) return <AccessDenied />;
  const context = props.context;
  const unsupported = () => { throw new Error('ALMOX_COMMISSION_TR_DISABLED'); };
  const safeContext: InvoiceContext = {
    ...context,
    empenhoClasses: getAlmoxFinanceClasses(context.empenhoClasses),
    nfSubTab: context.nfSubTab === 'comissao' ? 'acompanhar' : context.nfSubTab,
    nfTramitacaoFilter: context.nfTramitacaoFilter === 'FaltaComissao' ? 'EmTramitacao' : context.nfTramitacaoFilter,
    setNfSubTab: (tab: InvoiceContext['nfSubTab']) => {
      if (tab !== 'comissao') context.setNfSubTab(tab);
    },
    setNfTramitacaoFilter: (filter: InvoiceContext['nfTramitacaoFilter']) => {
      if (filter !== 'FaltaComissao') context.setNfTramitacaoFilter(filter);
    },
    handleMarkComissao: unsupported,
    handleSaveComissao: unsupported,
    handleDeleteAllComissoes: unsupported,
    handleTermoRecebimentoAction: unsupported,
    handleDownloadTermoRecebimento: unsupported,
    handleUpdateInvoiceLocation: (...args: any[]) => {
      if (args[1] === 'COMISSAO') throw new Error('ALMOX_COMMISSION_TR_DISABLED');
      return context.handleUpdateInvoiceLocation(...args);
    },
  };
  return <NotasFiscaisView context={safeContext} sectorType="almoxarifado" />;
}

/** Reutiliza saveCronograma, PDF e confirmação de envio Gmail do domínio atual. */
export function AlmoxCronogramasSurface(props: AlmoxFinancialSurfaceBase & { context: CronoContext }) {
  if (!authorized(props)) return <AccessDenied />;
  const context = props.context;
  const safeContext: CronoContext = {
    ...context,
    empenhoClasses: getAlmoxFinanceClasses(context.empenhoClasses),
    handleSaveCronograma: (...args: any[]) => {
      const emp = context.empenhos.find((item) => item.id === context.selectedCronogramaEmpenhoId);
      if (!emp) throw new Error('ALMOX_EMPENHO_NOT_FOUND');
      const previous = context.cronogramas.find((item) => item.empenhoId === emp.id);
      const errors = validateAlmoxRemittances(emp, {
        id: previous?.id || 'crono_' + emp.id,
        empenhoId: emp.id, dataCriacao: previous?.dataCriacao || new Date().toISOString(),
        colunasEntregas: context.cronogramaColunas,
        distribuicao: context.cronogramaDistribuicao,
      });
      if (errors.length) throw new Error('ALMOX_INVALID_REMESSA: ' + errors.join(', '));
      return context.handleSaveCronograma(...args);
    },
  };
  return <CronogramasView context={safeContext} sectorType="almoxarifado" />;
}
