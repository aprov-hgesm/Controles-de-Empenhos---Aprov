'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { usePlatformBranding } from '../hooks/usePlatformBranding';
import { useOperationalViewState } from '../hooks/useOperationalViewState';
import { useOperationalData } from '../hooks/useOperationalData';
import { useEmpenhoClasses } from '../hooks/useEmpenhoClasses';
import { useEmpenhoActions } from '../features/empenhos/hooks/useEmpenhoActions';
import { useNotasFiscaisActions } from '../features/notas-fiscais/hooks/useNotasFiscaisActions';
import { useAvisosActions } from '../features/avisos/hooks/useAvisosActions';
import { useDocumentActions } from '../features/relatorios/hooks/useDocumentActions';
import { useSagNsImportActions } from '../features/relatorios/hooks/useSagNsImportActions';
import { useCronogramaActions } from '../features/cronogramas/hooks/useCronogramaActions';
import { AppBackground } from '../components/layout/AppBackground';
import { AppHeader } from '../components/layout/AppHeader';
import { AppSidebar } from '../components/layout/AppSidebar';
import { ToastNotification } from '../components/layout/ToastNotification';
import { OperationalSurfaceTransition } from '../components/layout/OperationalSurfaceTransition';
import { DashboardView } from '../features/dashboard/components/DashboardView';
import { InicioView } from '../features/inicio/components/InicioView';
import { EmpenhosView } from '../features/empenhos/components/EmpenhosView';
import { NotasFiscaisView } from '../features/notas-fiscais/components/NotasFiscaisView';
import { RelatoriosView } from '../features/relatorios/components/RelatoriosView';
import { ConsultaItensView } from '../features/itens/components/ConsultaItensView';
import { ItensEmpenhoView } from '../features/empenhos/components/ItensEmpenhoView';
import { CronogramasView } from '../features/cronogramas/components/CronogramasView';
import { CentralAvisosView } from '../features/avisos/components/CentralAvisosView';
import { DeleteEmpenhoModal } from '../features/empenhos/components/DeleteEmpenhoModal';
import { MobileNavigation } from '../components/layout/MobileNavigation';
import { EmprovexLogin } from '../components/auth/EmprovexLogin';
import { EmprovexAuthLoading } from '../components/auth/EmprovexAuthLoading';
import { LoginSuccessTransition } from '../components/auth/LoginSuccessTransition';
import type { OperationalActiveTab } from '../lib/operationalSubscriptionPlan';
import { countPendingNotices } from '../features/avisos/domain/noticeLifecycle';
import { canAccessWarehouseModule } from '../lib/platformModuleAccess';
export default function Home() {
  // Toast / Notifications helper
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showLoginSuccessTransition, setShowLoginSuccessTransition] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  // Navigation drives the realtime subscription profile (Block 14).
  const [activeTab, setActiveTab] = useState<OperationalActiveTab>('inicio');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    user, loadingAuth, syncing, workspaceContext,
    activeOperationalDataReady, activeRealtimeCollectionCount, inicioSnapshot,
    empenhos, setEmpenhos, alerts, setAlerts, invoices, setInvoices,
    comissoes, setComissoes, cronogramas, setCronogramas,
    signInUser, signInSectorUser, signOutUser,
    uniquePregaos, uniqueEmpenhoYears, uniqueNfMonths,
    formatDateTime, formatDateOnly
  } = useOperationalData(activeTab);

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

  const { customLogo } = usePlatformBranding();

  // State for inline editing of Número da NS in Empenho Report
  const [editingNSId, setEditingNSId] = useState<string | null>(null);
  const [tempNSValue, setTempNSValue] = useState<string>('');

  const {
    expandedEmpenhoId, setExpandedEmpenhoId, dashboardPregaoFilter, setDashboardPregaoFilter, dashboardClassFilter, setDashboardClassFilter,
    dashboardSearch, setDashboardSearch, dashboardExpandedClass, setDashboardExpandedClass, selectedEmpenhoDetailId, setSelectedEmpenhoDetailId,
    showAddItemFormInDetail, setShowAddItemFormInDetail, empenhosSearch, setEmpenhosSearch, empenhosFilter, setEmpenhosFilter,
    empenhosPregaoFilter, setEmpenhosPregaoFilter, empenhosYearFilter, setEmpenhosYearFilter, empenhosClassFilter, setEmpenhosClassFilter,
    showNewEmpenhoModal, setShowNewEmpenhoModal, newEmpenhoMode, setNewEmpenhoMode, jsonInput, setJsonInput,
    jsonError, setJsonError, copiedPrompt, setCopiedPrompt, reviewEmpenho, setReviewEmpenho,
    showConfirmSaveModal, setShowConfirmSaveModal, empenhoToDelete, setEmpenhoToDelete, isDeletingEmpenho, setIsDeletingEmpenho,
    newEmpenhoForm, setNewEmpenhoForm, itensSearch, setItensSearch, itensSaldoFilter, setItensSaldoFilter,
    expandedConsultaItem, setExpandedConsultaItem, selectedNFCommitmentId, setSelectedNFCommitmentId, nfNumber, setNfNumber,
    nfDate, setNfDate, nfQuantities, setNfQuantities, nfSearch, setNfSearch,
    nfSubTab, setNfSubTab, nfMonthFilter, setNfMonthFilter, nfEmpenhoFilter, setNfEmpenhoFilter,
    nfTramitacaoFilter, setNfTramitacaoFilter, nfSortOrder, setNfSortOrder, editingInvoice, setEditingInvoice,
    comissaoMes, setComissaoMes, comissaoBoletimNum, setComissaoBoletimNum, comissaoBoletimDate, setComissaoBoletimDate,
    comissaoPresPosto, setComissaoPresPosto, comissaoPresNome, setComissaoPresNome, comissaoAux1Posto, setComissaoAux1Posto,
    comissaoAux1Nome, setComissaoAux1Nome, comissaoAux2Posto, setComissaoAux2Posto, comissaoAux2Nome, setComissaoAux2Nome,
    comissaoAux3Posto, setComissaoAux3Posto, comissaoAux3Nome, setComissaoAux3Nome, reportSearch, setReportSearch,
    reportStartDate, setReportStartDate, reportEndDate, setReportEndDate, showPdfModal, setShowPdfModal,
    selectedReportInvoice, setSelectedReportInvoice, relatoriosPregaoFilter, setRelatoriosPregaoFilter, editingEmpenhoId, setEditingEmpenhoId,
    newItemForm, setNewItemForm, selectedCronogramaEmpenhoId, setSelectedCronogramaEmpenhoId, cronogramasSearch, setCronogramasSearch,
    cronogramasPregaoFilter, setCronogramasPregaoFilter, cronogramasYearFilter, setCronogramasYearFilter, cronogramasClassFilter, setCronogramasClassFilter,
    cronogramasStatusFilter, setCronogramasStatusFilter, cronogramaColunas, setCronogramaColunas, cronogramaDistribuicao, setCronogramaDistribuicao,
    cronogramaLocalEntrega, setCronogramaLocalEntrega, cronogramaHorarioEntrega, setCronogramaHorarioEntrega, cronogramaObservacoes, setCronogramaObservacoes,
    cronogramaResponsavelNome, setCronogramaResponsavelNome, cronogramaResponsavelCargo, setCronogramaResponsavelCargo, showCronogramaPreviewModal, setShowCronogramaPreviewModal,
    isSavingCronograma, setIsSavingCronograma,
  } = useOperationalViewState();

  const {
    handleEmpenhoDocumentUploaded,
    handleUpdateEmpenhoPregao,
    handleUpdateEmpenhoSupplierCnpj,
    handleUpdateEmpenhoClassification,
    handleCreateEmpenho,
    handleDownloadPromptTxt,
    handleDownloadPromptPdf,
    handleCopyPrompt,
    handleProcessJson,
    handleSaveReviewEmpenho,
    handleAddItemToEmpenho,
    handleDeleteItemFromEmpenho,
    handleFinishEmpenhoRegistry,
    handleDeleteSpecificEmpenho
  } = useEmpenhoActions({
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
    setCopiedPrompt,
    jsonInput,
    setJsonError,
    setReviewEmpenho,
    reviewEmpenho,
    setJsonInput,
    setShowConfirmSaveModal,
    newItemForm,
    setNewItemForm,
    editingEmpenhoId,
    setIsDeletingEmpenho,
    setEmpenhoToDelete,
    activeTab
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
    handleSaveComissao
  } = useNotasFiscaisActions({
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
    setComissaoAux3Nome
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

  const pendingNoticeCount =
    activeTab === 'empenhos' || activeTab === 'nova_nf' || activeTab === 'avisos'
      ? countPendingNotices(alerts)
      : inicioSnapshot?.alerts.total ?? 0;

  const { handleApplySagNsImport } = useSagNsImportActions({
    user,
    empenhos,
    invoices,
    setInvoices,
    showToast,
  });

  const { handleDownloadTermoRecebimento, handleTermoRecebimentoAction, handleDownloadLiquidacaoConsolidada, handleGenerateEmpenhoReportPDF } = useDocumentActions({
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
    handleGenerateCronogramaPDF
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
  });

  // Reset NF inputs when changing target empenho
  useEffect(() => {
    const target = empenhos.find(e => e.id === selectedNFCommitmentId);
    if (target) {
      const initialQtys: { [itemId: string]: number } = {};
      target.items.forEach(item => {
        initialQtys[item.id] = 0;
      });
      setNfQuantities(initialQtys);
    }
  }, [selectedNFCommitmentId, empenhos]);












  if (loadingAuth) {
    return <EmprovexAuthLoading hasAuthenticatedIdentity={Boolean(user)} />;
  }

  if (!user) {
    const handleSectorLogin = async (email: string, password: string) => {
      if (isSigningIn) return false;

      setIsSigningIn(true);
      try {
        const resolvedContext = await signInSectorUser(email, password);
        showToast('Acesso autorizado com sucesso!', 'success');
        if (resolvedContext.status === 'sector') {
          setShowLoginSuccessTransition(true);
        }
        return true;
      } catch (error) {
        console.error('Erro na autenticação do setor:', error);
        showToast(
          error instanceof Error
            ? error.message
            : 'Não foi possível entrar no EMPROVEX.',
          'error'
        );
        return false;
      } finally {
        setIsSigningIn(false);
      }
    };

    const handleFounderLogin = async () => {
      if (isSigningIn) return;

      setIsSigningIn(true);
      try {
        const resolvedContext = await signInUser();
        showToast('Acesso institucional autorizado!', 'success');
        if (resolvedContext.status === 'sector') {
          setShowLoginSuccessTransition(true);
        }
      } catch (error) {
        console.error('Erro na autenticação institucional:', error);
        showToast('Falha no acesso institucional com Google.', 'error');
      } finally {
        setIsSigningIn(false);
      }
    };

    return (
      <EmprovexLogin
        customLogo={customLogo}
        isSigningIn={isSigningIn}
        toast={toast}
        onCloseToast={() => setToast(null)}
        onSectorLogin={handleSectorLogin}
        onFounderLogin={handleFounderLogin}
      />
    );
  }

  return (
    <div
      className={`min-h-screen ${activeTab === 'inicio' ? 'bg-[#02040b] text-white' : 'bg-gradient-to-br from-[#f0f4f8] via-[#e8ecf3] to-[#f4f6fa] text-[#0b1c30]'} flex flex-col antialiased relative overflow-x-hidden selection:bg-blue-500 selection:text-white ${showLoginSuccessTransition ? 'emprovex-app-login-entry' : ''}`}
      data-login-entry={showLoginSuccessTransition ? 'true' : 'false'}
      data-active-realtime-collections={activeRealtimeCollectionCount}
    >

      <AppBackground immersive={activeTab === 'inicio'} />

      {showLoginSuccessTransition && workspaceContext.status === 'sector' && (
        <LoginSuccessTransition
          customLogo={customLogo}
          onComplete={() => setShowLoginSuccessTransition(false)}
        />
      )}

      <ToastNotification toast={toast} onClose={() => setToast(null)} />

      <AppHeader
        customLogo={customLogo}
        syncing={syncing || !activeOperationalDataReady}
        userDisplayName={user?.displayName || 'Aprovisionamento HGeSM'}
        workspaceContext={workspaceContext}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      {/* Main Framework Wrapper */}
      <div className="flex flex-1 pt-16 min-h-screen z-10 relative lg:pl-72">

        <AppSidebar
          activeTab={activeTab}
          open={sidebarOpen}
          userDisplayName={user?.displayName || 'Aprovisionamento HGeSM'}
          noticeCount={pendingNoticeCount}
          onClose={() => setSidebarOpen(false)}
          onNavigate={(tab) => {
            setActiveTab(tab);
            if (tab === 'empenhos') setSelectedEmpenhoDetailId(null);
            setSidebarOpen(false);
          }}
          onLogout={async () => {
            try {
              setShowLoginSuccessTransition(false);
              await signOutUser();
              showToast('Você saiu do sistema.', 'info');
            } catch (err: any) {
              console.error(err);
              showToast('Erro ao sair do sistema', 'error');
            }
          }}
          warehouseModuleEnabled={canAccessWarehouseModule(workspaceContext)}
          onOpenWarehouse={() => {
            window.location.assign('/adm-deposito');
          }}
        />

        {/* Content Container Area */}
        <main
          className={`flex-1 w-full overflow-hidden ${activeTab === 'inicio'
            ? 'p-0 pb-20 md:pb-0 max-w-none'
            : 'lg:pl-6 pb-24 md:pb-12 pt-6 px-4 max-w-7xl mx-auto'
          }`}
        >
          {!activeOperationalDataReady ? (
            <section
              data-testid="operational-section-loading"
              className="flex min-h-[320px] items-center justify-center rounded-2xl border border-blue-100 bg-white/75 p-8 text-center shadow-sm backdrop-blur"
            >
              <div>
                <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-blue-100 border-t-[#00288e]" />
                <p className="mt-4 text-sm font-extrabold text-[#00288e]">
                  Sincronizando dados desta seção
                </p>
                <p className="mt-1 text-xs font-medium text-gray-500">
                  O EMPROVEX mantém em tempo real somente as coleções necessárias à tela atual.
                </p>
              </div>
            </section>
          ) : (
            <OperationalSurfaceTransition surfaceKey={activeTab}>
          {/* INÍCIO: EXPERIÊNCIA VISUAL / MAPA OPERACIONAL */}
          {activeTab === 'inicio' && (
            <InicioView
              snapshot={inicioSnapshot}
              userDisplayName={user?.displayName || 'Operador EMPROVEX'}
              onSelectEmpenho={(empenhoId) => {
                setSelectedEmpenhoDetailId(empenhoId);
                setActiveTab('empenhos');
              }}
            />
          )}

          {/* TAB 1: PAINEL DE CONTROLE / DASHBOARD - SALDO RESTANTE POR CLASSE DETALHADO */}
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
          {/* TAB 2: LISTA DE EMPENHOS / NOTAS DE EMPENHO */}
          {activeTab === 'empenhos' && (
            <EmpenhosView context={{ alerts, addEmpenhoClass, copiedPrompt, empenhoClasses, empenhos, empenhosClassFilter, empenhosFilter, empenhosPregaoFilter, empenhosSearch, empenhosYearFilter, formatDateOnly, handleAddItemToEmpenho, handleCopyPrompt, handleCreateEmpenho, handleDeleteItemFromEmpenho, handleDownloadPromptPdf, handleDownloadPromptTxt, handleDownloadTermoRecebimento, handleEmpenhoDocumentUploaded, handleUpdateEmpenhoClassification, handleUpdateEmpenhoPregao, handleUpdateEmpenhoSupplierCnpj, handleGenerateEmpenhoReportPDF, handleProcessJson, handleSaveReviewEmpenho, handleSelectEmpenhoForCronograma, invoices, jsonError, jsonInput, newEmpenhoForm, newEmpenhoMode, newItemForm, reviewEmpenho, savingClassConfig, selectedEmpenhoDetailId, setActiveTab, setEditingEmpenhoId, setEditingInvoice, setEmpenhosClassFilter, setEmpenhosFilter, setEmpenhosPregaoFilter, setEmpenhosSearch, setEmpenhosYearFilter, setEmpenhoToDelete, setJsonError, setJsonInput, setNewEmpenhoForm, setNewEmpenhoMode, setNewItemForm, setNfSubTab, setReviewEmpenho, setSelectedEmpenhoDetailId, setSelectedNFCommitmentId, setSelectedReportInvoice, setShowAddItemFormInDetail, setShowConfirmSaveModal, setShowNewEmpenhoModal, showAddItemFormInDetail, showConfirmSaveModal, showNewEmpenhoModal, showToast, uniqueEmpenhoYears, uniquePregaos, updateEmpenhoClass, user }} />
          )}
          {/* TAB 3: GESTÃO DE NOTAS FISCAIS */}
          {activeTab === 'nova_nf' && (
            <NotasFiscaisView context={{ comissaoAux1Nome, comissaoAux1Posto, comissaoAux2Nome, comissaoAux2Posto, comissaoAux3Nome, comissaoAux3Posto, comissaoBoletimDate, comissaoBoletimNum, comissaoMes, comissaoPresNome, comissaoPresPosto, comissoes, editingInvoice, empenhoClasses, empenhos, formatDateOnly, formatDateTime, handleDeleteAllComissoes, handleDeleteAllInvoices, handleDeleteInvoice, handleDownloadTermoRecebimento, handleTermoRecebimentoAction, handleDownloadLiquidacaoConsolidada, handleEditInvoice, handleEmpenhoDocumentUploaded, handleInvoiceDocumentUploaded, handleInvoiceMirrorDocumentUploaded, handleMarkComissao, handleMarkTesouraria, handleSaveSpedNup, handleUpdateInvoiceLocation, handleSaveComissao, handleSaveInvoice, invoices, nfDate, nfEmpenhoFilter, nfMonthFilter, nfNumber, nfQuantities, nfSearch, nfSortOrder, nfSubTab, nfTramitacaoFilter, selectedNFCommitmentId, setActiveTab, setComissaoAux1Nome, setComissaoAux1Posto, setComissaoAux2Nome, setComissaoAux2Posto, setComissaoAux3Nome, setComissaoAux3Posto, setComissaoBoletimDate, setComissaoBoletimNum, setComissaoMes, setComissaoPresNome, setComissaoPresPosto, setComissoes, setEditingEmpenhoId, setEditingInvoice, setNfDate, setNfEmpenhoFilter, setNfMonthFilter, setNfNumber, setNfQuantities, setNfSearch, setNfSortOrder, setNfSubTab, setNfTramitacaoFilter, setSelectedNFCommitmentId, showToast, uniqueNfMonths, user }} />
          )}

          {/* CENTRAL DE AVISOS */}
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

          {/* TAB 4: CONCILIAÇÃO E RELATÓRIO DO RECEBIMENTO */}
          {activeTab === 'relatorios' && (
            <RelatoriosView context={{ editingNSId, empenhoClasses, empenhos, formatDateOnly, handleApplySagNsImport, handleDownloadTermoRecebimento, handleGenerateEmpenhoReportPDF, handleSaveNumeroNS, invoices, relatoriosPregaoFilter, reportEndDate, reportSearch, reportStartDate, selectedReportInvoice, setEditingNSId, setRelatoriosPregaoFilter, setReportEndDate, setReportSearch, setReportStartDate, setSelectedReportInvoice, setShowPdfModal, setTempNSValue, showPdfModal, tempNSValue, uniquePregaos, workspaceUg: workspaceContext.status === 'sector' ? workspaceContext.ug : null }} />
          )}

          {/* CONSULTA CONSOLIDADA DE ITENS */}
          {activeTab === 'itens' && (
            <ConsultaItensView context={{ empenhos, expandedConsultaItem, handleEmpenhoDocumentUploaded, itensSaldoFilter, itensSearch, setActiveTab, setExpandedConsultaItem, setItensSaldoFilter, setItensSearch, setSelectedEmpenhoDetailId, showToast, user }} />
          )}

          {/* TAB 7: GERENCIAR ITENS DO EMPENHO (Itens do Empenho - Screenshot 3) */}
          {activeTab === 'itens_empenho' && (
            <ItensEmpenhoView context={{ editingEmpenhoId, empenhos, handleAddItemToEmpenho, handleDeleteItemFromEmpenho, handleFinishEmpenhoRegistry, newItemForm, setActiveTab, setEmpenhoToDelete, setNewItemForm }} />
          )}

          {/* ========================================================================= */}
          {/* VIEW 6: CRONOGRAMAS DE ENTREGA (Simulação e Impressão de Cronograma) */}
          {/* ========================================================================= */}
          {activeTab === 'cronogramas' && (
            <CronogramasView context={{ applyAllToFirstRemessa, applyCronogramaPreset, clearCronogramaDistribuicao, cronogramaColunas, cronogramaDistribuicao, cronogramaHorarioEntrega, cronogramaLocalEntrega, cronogramaObservacoes, cronogramaResponsavelCargo, cronogramaResponsavelNome, cronogramas, cronogramasClassFilter, cronogramasPregaoFilter, cronogramasSearch, cronogramasStatusFilter, cronogramasYearFilter, empenhoClasses, empenhos, formatDateOnly, handleAddRemessa, handleGenerateCronogramaPDF, handleRemoveRemessa, handleSaveCronograma, handleSelectEmpenhoForCronograma, isSavingCronograma, selectedCronogramaEmpenhoId, setCronogramaColunas, setCronogramaDistribuicao, setCronogramaHorarioEntrega, setCronogramaLocalEntrega, setCronogramaObservacoes, setCronogramaResponsavelCargo, setCronogramaResponsavelNome, setCronogramasClassFilter, setCronogramasPregaoFilter, setCronogramasSearch, setCronogramasStatusFilter, setCronogramasYearFilter, setSelectedCronogramaEmpenhoId, setShowCronogramaPreviewModal, showCronogramaPreviewModal, uniqueEmpenhoYears, uniquePregaos }} />
          )}

          <DeleteEmpenhoModal
            empenhoToDelete={empenhoToDelete}
            empenhos={empenhos}
            isDeletingEmpenho={isDeletingEmpenho}
            onCancel={() => setEmpenhoToDelete(null)}
            onConfirm={handleDeleteSpecificEmpenho}
          />
            </OperationalSurfaceTransition>
          )}
        </main>
      </div>

      <MobileNavigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setSelectedEmpenhoDetailId={setSelectedEmpenhoDetailId}
      />

    </div>
  );
}
