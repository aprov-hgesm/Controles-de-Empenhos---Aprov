'use client';

import dynamic from 'next/dynamic';
import type { User } from 'firebase/auth';
import type { SectorType } from '../../../lib/platformIdentity';
import type { ResolvedWorkspaceContext } from '../../../lib/workspaceContext';
import { AlmoxEmpenhosSurface, AlmoxNotasFiscaisSurface, AlmoxCronogramasSurface } from '../../almoxarifado/financeiro/AlmoxFinancialSurfaces';

import type { ComponentProps, Dispatch, SetStateAction } from 'react';

import { useEmpenhoClasses } from '../../../hooks/useEmpenhoClasses';
import type { useOperationalData } from '../../../hooks/useOperationalData';
import type { useOperationalViewState } from '../../../hooks/useOperationalViewState';
import { OperationalSurfaceLoading } from '../../../components/layout/OperationalSurfaceLoading';
import { OperationalSurfaceTransition } from '../../../components/layout/OperationalSurfaceTransition';
import { useEmpenhoActions } from '../../empenhos/hooks/useEmpenhoActions';
import { useNotasFiscaisActions } from '../../notas-fiscais/hooks/useNotasFiscaisActions';
import { useAvisosActions } from '../../avisos/hooks/useAvisosActions';
import { useDocumentActions } from '../../relatorios/hooks/useDocumentActions';
import { useSagNsImportActions } from '../../relatorios/hooks/useSagNsImportActions';
import { useCronogramaActions } from '../../cronogramas/hooks/useCronogramaActions';
import { DeleteEmpenhoModal } from '../../empenhos/components/DeleteEmpenhoModal';
import type { OperationalActiveTab } from '../../../lib/operationalSubscriptionPlan';

const DashboardView = dynamic(
  () => import('../../dashboard/components/DashboardView').then((module) => module.DashboardView),
  { loading: () => <OperationalSurfaceLoading /> }
);
const EmpenhosView = dynamic(
  () => import('../../empenhos/components/EmpenhosView').then((module) => module.EmpenhosView),
  { loading: () => <OperationalSurfaceLoading /> }
);
const FornecedoresView = dynamic(
  () => import('../../fornecedores/components/FornecedoresView').then((module) => module.FornecedoresView),
  { loading: () => <OperationalSurfaceLoading /> }
);
const NotasFiscaisView = dynamic(
  () => import('../../notas-fiscais/components/NotasFiscaisView').then((module) => module.NotasFiscaisView),
  { loading: () => <OperationalSurfaceLoading /> }
);
const RelatoriosView = dynamic(
  () => import('../../relatorios/components/RelatoriosView').then((module) => module.RelatoriosView),
  { loading: () => <OperationalSurfaceLoading /> }
);
const ConsultaItensView = dynamic(
  () => import('../../itens/components/ConsultaItensView').then((module) => module.ConsultaItensView),
  { loading: () => <OperationalSurfaceLoading /> }
);
const ItensEmpenhoView = dynamic(
  () => import('../../empenhos/components/ItensEmpenhoView').then((module) => module.ItensEmpenhoView),
  { loading: () => <OperationalSurfaceLoading /> }
);
const CronogramasView = dynamic(
  () => import('../../cronogramas/components/CronogramasView').then((module) => module.CronogramasView),
  { loading: () => <OperationalSurfaceLoading /> }
);
const CentralAvisosView = dynamic(
  () => import('../../avisos/components/CentralAvisosView').then((module) => module.CentralAvisosView),
  { loading: () => <OperationalSurfaceLoading /> }
);

// O adaptador preserva as mesmas views e ações no Aprovisionamento.
// Somente o Almoxarifado passa pelas superfícies de políticas setoriais W6.
function SectorEmpenhos({ context, user, workspace, sectorType }: {
  context: ComponentProps<typeof EmpenhosView>['context']; user: User | null;
  workspace: ResolvedWorkspaceContext; sectorType?: SectorType;
}) {
  if (sectorType !== 'almoxarifado') return <EmpenhosView context={context} />;
  if (!user || workspace.status !== 'sector' || workspace.sectorType !== 'almoxarifado') return <OperationalSurfaceLoading />;
  return <AlmoxEmpenhosSurface context={context} user={user} workspace={workspace} />;
}
function SectorNotas({ context, user, workspace, sectorType }: {
  context: ComponentProps<typeof NotasFiscaisView>['context']; user: User | null;
  workspace: ResolvedWorkspaceContext; sectorType?: SectorType;
}) {
  if (sectorType !== 'almoxarifado') return <NotasFiscaisView context={context} />;
  if (!user || workspace.status !== 'sector' || workspace.sectorType !== 'almoxarifado') return <OperationalSurfaceLoading />;
  return <AlmoxNotasFiscaisSurface context={context} user={user} workspace={workspace} />;
}
function SectorCronogramas({ context, user, workspace, sectorType }: {
  context: ComponentProps<typeof CronogramasView>['context']; user: User | null;
  workspace: ResolvedWorkspaceContext; sectorType?: SectorType;
}) {
  if (sectorType !== 'almoxarifado') return <CronogramasView context={context} />;
  if (!user || workspace.status !== 'sector' || workspace.sectorType !== 'almoxarifado') return <OperationalSurfaceLoading />;
  return <AlmoxCronogramasSurface context={context} user={user} workspace={workspace} />;
}

type OperationalData = ReturnType<typeof useOperationalData>;
type OperationalViewState = ReturnType<typeof useOperationalViewState>;
type ToastType = 'success' | 'error' | 'info';

interface OperationalWorkspaceProps {
  activeTab: OperationalActiveTab;
  setActiveTab: Dispatch<SetStateAction<OperationalActiveTab>>;
  operationalData: OperationalData;
  viewState: OperationalViewState;
  editingNSId: string | null;
  setEditingNSId: Dispatch<SetStateAction<string | null>>;
  tempNSValue: string;
  setTempNSValue: Dispatch<SetStateAction<string>>;
  showToast: (message: string, type?: ToastType) => void;
  surfaceReady: boolean;
  sectorType?: SectorType;
}

export function OperationalWorkspace({
  activeTab,
  setActiveTab,
  operationalData,
  viewState,
  editingNSId,
  setEditingNSId,
  tempNSValue,
  setTempNSValue,
  showToast,
  surfaceReady,
  sectorType,
}: OperationalWorkspaceProps) {
  const {
    user,
    workspaceContext,
    empenhos,
    setEmpenhos,
    alerts,
    setAlerts,
    invoices,
    setInvoices,
    comissoes,
    setComissoes,
    cronogramas,
    setCronogramas,
    uniquePregaos,
    uniqueEmpenhoYears,
    uniqueNfMonths,
    formatDateTime,
    formatDateOnly,
  } = operationalData;

  const {
    dashboardPregaoFilter,
    setDashboardPregaoFilter,
    dashboardClassFilter,
    setDashboardClassFilter,
    dashboardSearch,
    setDashboardSearch,
    selectedEmpenhoDetailId,
    setSelectedEmpenhoDetailId,
    showAddItemFormInDetail,
    setShowAddItemFormInDetail,
    empenhosSearch,
    setEmpenhosSearch,
    empenhosFilter,
    setEmpenhosFilter,
    empenhosPregaoFilter,
    setEmpenhosPregaoFilter,
    empenhosYearFilter,
    setEmpenhosYearFilter,
    empenhosClassFilter,
    setEmpenhosClassFilter,
    showNewEmpenhoModal,
    setShowNewEmpenhoModal,
    newEmpenhoMode,
    setNewEmpenhoMode,
    jsonError,
    setJsonError,
    reviewEmpenho,
    setReviewEmpenho,
    showConfirmSaveModal,
    setShowConfirmSaveModal,
    empenhoToDelete,
    setEmpenhoToDelete,
    isDeletingEmpenho,
    setIsDeletingEmpenho,
    newEmpenhoForm,
    setNewEmpenhoForm,
    itensSearch,
    setItensSearch,
    itensSaldoFilter,
    setItensSaldoFilter,
    expandedConsultaItem,
    setExpandedConsultaItem,
    selectedNFCommitmentId,
    setSelectedNFCommitmentId,
    nfNumber,
    setNfNumber,
    nfDate,
    setNfDate,
    nfQuantities,
    setNfQuantities,
    nfPdfFile,
    setNfPdfFile,
    nfSearch,
    setNfSearch,
    nfSubTab,
    setNfSubTab,
    nfMonthFilter,
    setNfMonthFilter,
    nfEmpenhoFilter,
    setNfEmpenhoFilter,
    nfTramitacaoFilter,
    setNfTramitacaoFilter,
    nfSortOrder,
    setNfSortOrder,
    editingInvoice,
    setEditingInvoice,
    comissaoMes,
    setComissaoMes,
    comissaoBoletimNum,
    setComissaoBoletimNum,
    comissaoBoletimDate,
    setComissaoBoletimDate,
    comissaoPresPosto,
    setComissaoPresPosto,
    comissaoPresNome,
    setComissaoPresNome,
    comissaoAux1Posto,
    setComissaoAux1Posto,
    comissaoAux1Nome,
    setComissaoAux1Nome,
    comissaoAux2Posto,
    setComissaoAux2Posto,
    comissaoAux2Nome,
    setComissaoAux2Nome,
    comissaoAux3Posto,
    setComissaoAux3Posto,
    comissaoAux3Nome,
    setComissaoAux3Nome,
    reportSearch,
    setReportSearch,
    reportStartDate,
    setReportStartDate,
    reportEndDate,
    setReportEndDate,
    showPdfModal,
    setShowPdfModal,
    selectedReportInvoice,
    setSelectedReportInvoice,
    relatoriosPregaoFilter,
    setRelatoriosPregaoFilter,
    editingEmpenhoId,
    setEditingEmpenhoId,
    newItemForm,
    setNewItemForm,
    selectedCronogramaEmpenhoId,
    setSelectedCronogramaEmpenhoId,
    cronogramasSearch,
    setCronogramasSearch,
    cronogramasPregaoFilter,
    setCronogramasPregaoFilter,
    cronogramasYearFilter,
    setCronogramasYearFilter,
    cronogramasClassFilter,
    setCronogramasClassFilter,
    cronogramasStatusFilter,
    setCronogramasStatusFilter,
    cronogramaColunas,
    setCronogramaColunas,
    cronogramaDistribuicao,
    setCronogramaDistribuicao,
    cronogramaLocalEntrega,
    setCronogramaLocalEntrega,
    cronogramaHorarioEntrega,
    setCronogramaHorarioEntrega,
    cronogramaObservacoes,
    setCronogramaObservacoes,
    cronogramaResponsavelNome,
    setCronogramaResponsavelNome,
    cronogramaResponsavelCargo,
    setCronogramaResponsavelCargo,
    showCronogramaPreviewModal,
    setShowCronogramaPreviewModal,
    isSavingCronograma,
    setIsSavingCronograma,
  } = viewState;

  const {
    empenhoClasses,
    savingClassConfig,
    addEmpenhoClass,
    updateEmpenhoClass,
  } = useEmpenhoClasses({
    user,
    workspaceContext,
    empenhos,
    enabled: ['painel', 'empenhos', 'nova_nf', 'relatorios', 'cronogramas'].includes(activeTab),
  });

  const {
    handleEmpenhoDocumentUploaded,
    handleUpdateEmpenhoPregao,
    handleUpdateEmpenhoNotaCredito,
    handleUpdateEmpenhoSupplierCnpj,
    handleUpdateEmpenhoClassification,
    handleUpdateEmpenhoItemDetails,
    handleCreateEmpenho,
    handleProcessEmpenhoPdf,
    handleSaveReviewEmpenho,
    handleAddItemToEmpenho,
    handleDeleteItemFromEmpenho,
    handleFinishEmpenhoRegistry,
    handleDeleteSpecificEmpenho,
  } = useEmpenhoActions({
    sectorType,
    user,
    empenhos,
    setEmpenhos,
    alerts,
    setAlerts,
    invoices,
    setInvoices,
    newEmpenhoForm,
    setNewEmpenhoForm,
    setShowNewEmpenhoModal,
    setEditingEmpenhoId,
    setSelectedEmpenhoDetailId,
    setActiveTab,
    showToast,
    setJsonError,
    setReviewEmpenho,
    reviewEmpenho,
    setShowConfirmSaveModal,
    newItemForm,
    setNewItemForm,
    editingEmpenhoId,
    setIsDeletingEmpenho,
    setEmpenhoToDelete,
    activeTab,
  });

  const {
    handleSaveInvoice,
    handleInvoiceDocumentUploaded,
    handleInvoiceMirrorDocumentUploaded,
    handleEditInvoice,
    handleDeleteInvoice,
    handleDeleteAllInvoices,
    handleDeleteAllComissoes,
    handleMarkComissao,
    handleMarkTesouraria,
    handleSaveSpedNup,
    handleUpdateInvoiceLocation,
    handleSaveNumeroNS,
    handleSaveComissao,
  } = useNotasFiscaisActions({
    sectorType,
    user,
    empenhos,
    setEmpenhos,
    alerts,
    setAlerts,
    invoices,
    setInvoices,
    comissoes,
    setComissoes,
    showToast,
    selectedNFCommitmentId,
    setSelectedNFCommitmentId,
    nfNumber,
    setNfNumber,
    nfDate,
    setNfDate,
    nfQuantities,
    setNfQuantities,
    nfSubTab,
    setNfSubTab,
    editingInvoice,
    setEditingInvoice,
    setEditingNSId,
    setTempNSValue,
    comissaoMes,
    comissaoBoletimNum,
    setComissaoBoletimNum,
    comissaoBoletimDate,
    setComissaoBoletimDate,
    comissaoPresPosto,
    comissaoPresNome,
    setComissaoPresNome,
    comissaoAux1Posto,
    comissaoAux1Nome,
    setComissaoAux1Nome,
    comissaoAux2Posto,
    comissaoAux2Nome,
    setComissaoAux2Nome,
    comissaoAux3Posto,
    comissaoAux3Nome,
    setComissaoAux3Nome,
  });

  const {
    updateNoticeStatus,
    markAllUnreadAsRead,
  } = useAvisosActions({
    user,
    alerts,
    setAlerts,
    showToast,
  });

  const { handleApplySagNsImport } = useSagNsImportActions({
    user,
    empenhos,
    invoices,
    setInvoices,
    showToast,
  });

  const {
    handleDownloadTermoRecebimento,
    handleTermoRecebimentoAction,
    handleDownloadLiquidacaoConsolidada,
    handleGenerateEmpenhoReportPDF,
  } = useDocumentActions({
    user,
    invoices,
    setInvoices,
    comissoes,
    empenhos,
    empenhoClasses,
    showToast,
    formatDateOnly,
    institutionalProfile: workspaceContext.status === 'sector'
      ? workspaceContext.institutionalProfile
      : null,
  });

  const {
    handleSelectEmpenhoForCronograma,
    applyCronogramaPreset,
    applyAllToFirstRemessa,
    clearCronogramaDistribuicao,
    handleAddRemessa,
    handleRemoveRemessa,
    handleSaveCronograma,
    handleGenerateCronogramaPDF,
    handleSendCronogramaEmail,
    confirmCronogramaEmail,
    cancelCronogramaEmail,
    updateCronogramaEmailRecipient,
    cronogramaEmailConfirmation,
    isPreparingCronogramaEmail,
    saveEmailInSupplierRecord,
    setSaveEmailInSupplierRecord,
    isSendingCronogramaEmail,
  } = useCronogramaActions({
    user,
    empenhos,
    cronogramas,
    setCronogramas,
    selectedCronogramaEmpenhoId,
    setSelectedCronogramaEmpenhoId,
    cronogramaColunas,
    setCronogramaColunas,
    cronogramaDistribuicao,
    setCronogramaDistribuicao,
    cronogramaLocalEntrega,
    setCronogramaLocalEntrega,
    cronogramaHorarioEntrega,
    setCronogramaHorarioEntrega,
    cronogramaObservacoes,
    setCronogramaObservacoes,
    cronogramaResponsavelNome,
    setCronogramaResponsavelNome,
    cronogramaResponsavelCargo,
    setCronogramaResponsavelCargo,
    setIsSavingCronograma,
    showToast,
    formatDateOnly,
    institutionalProfile: workspaceContext.status === 'sector'
      ? workspaceContext.institutionalProfile
      : null,
    workspaceContext,
  });

  return (
    <>
      {surfaceReady && activeTab !== 'inicio' && (
        <OperationalSurfaceTransition surfaceKey={activeTab}>
          {activeTab === 'painel' && (
            <DashboardView
              dashboardClassFilter={dashboardClassFilter}
              dashboardPregaoFilter={dashboardPregaoFilter}
              dashboardSearch={dashboardSearch}
              empenhos={empenhos}
              empenhoClasses={empenhoClasses}
              setActiveTab={setActiveTab}
              setDashboardClassFilter={setDashboardClassFilter}
              setDashboardPregaoFilter={setDashboardPregaoFilter}
              setDashboardSearch={setDashboardSearch}
              setEditingEmpenhoId={setEditingEmpenhoId}
              setNfSubTab={setNfSubTab}
              setSelectedNFCommitmentId={setSelectedNFCommitmentId}
              uniquePregaos={uniquePregaos}
            />
          )}

          {activeTab === 'empenhos' && (
            <SectorEmpenhos user={user} workspace={workspaceContext} sectorType={sectorType} context={{ alerts, addEmpenhoClass, empenhoClasses, empenhos, empenhosClassFilter, empenhosFilter, empenhosPregaoFilter, empenhosSearch, empenhosYearFilter, formatDateOnly, handleAddItemToEmpenho, handleCreateEmpenho, handleDeleteItemFromEmpenho, handleDownloadTermoRecebimento, handleEmpenhoDocumentUploaded, handleUpdateEmpenhoClassification, handleUpdateEmpenhoItemDetails, handleUpdateEmpenhoPregao, handleUpdateEmpenhoNotaCredito, handleUpdateEmpenhoSupplierCnpj, handleGenerateEmpenhoReportPDF, handleProcessEmpenhoPdf, handleSaveReviewEmpenho, handleSelectEmpenhoForCronograma, invoices, jsonError, newEmpenhoForm, newEmpenhoMode, newItemForm, reviewEmpenho, savingClassConfig, selectedEmpenhoDetailId, setActiveTab, setEditingEmpenhoId, setEditingInvoice, setEmpenhosClassFilter, setEmpenhosFilter, setEmpenhosPregaoFilter, setEmpenhosSearch, setEmpenhosYearFilter, setEmpenhoToDelete, setJsonError, setNewEmpenhoForm, setNewEmpenhoMode, setNewItemForm, setNfSubTab, setReviewEmpenho, setSelectedEmpenhoDetailId, setSelectedNFCommitmentId, setSelectedReportInvoice, setShowAddItemFormInDetail, setShowConfirmSaveModal, setShowNewEmpenhoModal, showAddItemFormInDetail, showConfirmSaveModal, showNewEmpenhoModal, showToast, uniqueEmpenhoYears, uniquePregaos, updateEmpenhoClass, user }} />
          )}

          {activeTab === 'fornecedores' && (
            <FornecedoresView
              user={user}
              empenhos={empenhos}
              setEmpenhos={setEmpenhos}
              showToast={showToast}
            />
          )}

          {activeTab === 'nova_nf' && (
            <SectorNotas user={user} workspace={workspaceContext} sectorType={sectorType} context={{ comissaoAux1Nome, comissaoAux1Posto, comissaoAux2Nome, comissaoAux2Posto, comissaoAux3Nome, comissaoAux3Posto, comissaoBoletimDate, comissaoBoletimNum, comissaoMes, comissaoPresNome, comissaoPresPosto, comissoes, editingInvoice, empenhoClasses, empenhos, formatDateOnly, formatDateTime, handleDeleteAllComissoes, handleDeleteAllInvoices, handleDeleteInvoice, handleDownloadTermoRecebimento, handleTermoRecebimentoAction, handleDownloadLiquidacaoConsolidada, handleEditInvoice, handleEmpenhoDocumentUploaded, handleInvoiceDocumentUploaded, handleInvoiceMirrorDocumentUploaded, handleMarkComissao, handleMarkTesouraria, handleSaveSpedNup, handleUpdateInvoiceLocation, handleSaveComissao, handleSaveInvoice, invoices, setInvoices, nfDate, nfEmpenhoFilter, nfMonthFilter, nfNumber, nfQuantities, nfPdfFile, setNfPdfFile, nfSearch, nfSortOrder, nfSubTab, nfTramitacaoFilter, selectedNFCommitmentId, setActiveTab, setComissaoAux1Nome, setComissaoAux1Posto, setComissaoAux2Nome, setComissaoAux2Posto, setComissaoAux3Nome, setComissaoAux3Posto, setComissaoBoletimDate, setComissaoBoletimNum, setComissaoMes, setComissaoPresNome, setComissaoPresPosto, setComissoes, setEditingEmpenhoId, setEditingInvoice, setNfDate, setNfEmpenhoFilter, setNfMonthFilter, setNfNumber, setNfQuantities, setNfSearch, setNfSortOrder, setNfSubTab, setNfTramitacaoFilter, setSelectedNFCommitmentId, showToast, uniqueNfMonths, user }} />
          )}

          {activeTab === 'avisos' && (
            <CentralAvisosView
              alerts={alerts}
              empenhos={empenhos}
              onUpdateStatus={updateNoticeStatus}
              onMarkAllRead={markAllUnreadAsRead}
              onOpenEmpenho={(empenhoId) => {
                setSelectedEmpenhoDetailId(empenhoId);
                setActiveTab('empenhos');
              }}
            />
          )}

          {activeTab === 'relatorios' && (
            <RelatoriosView context={{ editingNSId, empenhoClasses, empenhos, formatDateOnly, handleApplySagNsImport, handleDownloadTermoRecebimento, handleGenerateEmpenhoReportPDF, handleSaveNumeroNS, invoices, relatoriosPregaoFilter, reportEndDate, reportSearch, reportStartDate, selectedReportInvoice, setEditingNSId, setRelatoriosPregaoFilter, setReportEndDate, setReportSearch, setReportStartDate, setSelectedReportInvoice, setShowPdfModal, setTempNSValue, showPdfModal, tempNSValue, uniquePregaos, workspaceUg: workspaceContext.status === 'sector' ? workspaceContext.ug : null }} />
          )}

          {activeTab === 'itens' && (
            <ConsultaItensView context={{ empenhos, expandedConsultaItem, handleEmpenhoDocumentUploaded, itensSaldoFilter, itensSearch, setActiveTab, setExpandedConsultaItem, setItensSaldoFilter, setItensSearch, setSelectedEmpenhoDetailId, showToast, user }} />
          )}

          {activeTab === 'itens_empenho' && (
            <ItensEmpenhoView context={{ editingEmpenhoId, empenhos, handleAddItemToEmpenho, handleDeleteItemFromEmpenho, handleFinishEmpenhoRegistry, newItemForm, setActiveTab, setEmpenhoToDelete, setNewItemForm }} />
          )}

          {activeTab === 'cronogramas' && (
            <SectorCronogramas user={user} workspace={workspaceContext} sectorType={sectorType} context={{ applyAllToFirstRemessa, applyCronogramaPreset, clearCronogramaDistribuicao, cronogramaColunas, cronogramaDistribuicao, cronogramaHorarioEntrega, cronogramaLocalEntrega, cronogramaObservacoes, cronogramaResponsavelCargo, cronogramaResponsavelNome, cronogramas, cronogramasClassFilter, cronogramasPregaoFilter, cronogramasSearch, cronogramasStatusFilter, cronogramasYearFilter, empenhoClasses, empenhos, formatDateOnly, handleAddRemessa, handleGenerateCronogramaPDF, handleSendCronogramaEmail, confirmCronogramaEmail, cancelCronogramaEmail, updateCronogramaEmailRecipient, cronogramaEmailConfirmation, isPreparingCronogramaEmail, saveEmailInSupplierRecord, setSaveEmailInSupplierRecord, handleRemoveRemessa, handleSaveCronograma, handleSelectEmpenhoForCronograma, handleUpdateEmpenhoItemDetails, isSavingCronograma, isSendingCronogramaEmail, selectedCronogramaEmpenhoId, setCronogramaColunas, setCronogramaDistribuicao, setCronogramaHorarioEntrega, setCronogramaLocalEntrega, setCronogramaObservacoes, setCronogramaResponsavelCargo, setCronogramaResponsavelNome, setCronogramasClassFilter, setCronogramasPregaoFilter, setCronogramasSearch, setCronogramasStatusFilter, setCronogramasYearFilter, setSelectedCronogramaEmpenhoId, setShowCronogramaPreviewModal, showCronogramaPreviewModal, uniqueEmpenhoYears, uniquePregaos }} />
          )}
        </OperationalSurfaceTransition>
      )}

      {surfaceReady && (
        <DeleteEmpenhoModal
          empenhoToDelete={empenhoToDelete}
          empenhos={empenhos}
          isDeletingEmpenho={isDeletingEmpenho}
          onCancel={() => setEmpenhoToDelete(null)}
          onConfirm={handleDeleteSpecificEmpenho}
        />
      )}
    </>
  );
}
