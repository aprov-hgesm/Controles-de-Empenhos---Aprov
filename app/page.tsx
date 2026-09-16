'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Plus, 
  Trash2, 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Menu, 
  Braces, 
  Bell, 
  ArrowLeft, 
  Save, 
  FileText, 
  Check, 
  X, 
  Printer, 
  TrendingUp, 
  Package, 
  Clock, 
  TrendingDown,
  ChevronRight,
  Filter,
  ArrowUpDown,
  Info,
  Layers,
  FileSpreadsheet,
  Users,
  UserCheck,
  FileDown,
  Download,
  Copy,
  Eye,
  LogIn,
  LogOut,
  Loader2,
  Edit,
  Coins,
  CalendarDays,
  CalendarRange,
  CalendarCheck,
  CalendarClock,
  Sparkles,
  RefreshCw,
  Sliders,
  Send,
  Camera,
  Upload,
  Image as ImageIcon
} from 'lucide-react';

import { Empenho, Item, Alert, Invoice, InvoiceItem, Comissao, CronogramaEmpenho, CronogramaEntregaColuna, EmpenhoPdfDocument } from '../lib/types';
import { EmpenhoDocumentActions } from '../components/EmpenhoDocumentActions';
import { MILITARY_RANKS, normalizeSupplier, PROMPT_EXTRACAO_EMPENHO } from '../features/empenhos/domain/empenhoHelpers';
import { usePlatformBranding } from '../hooks/usePlatformBranding';
import { useOperationalViewState } from '../hooks/useOperationalViewState';
import { useEmpenhoActions } from '../features/empenhos/hooks/useEmpenhoActions';
import { useNotasFiscaisActions } from '../features/notas-fiscais/hooks/useNotasFiscaisActions';
import { useDocumentActions } from '../features/relatorios/hooks/useDocumentActions';
import { useCronogramaActions } from '../features/cronogramas/hooks/useCronogramaActions';
import { AppBackground } from '../components/layout/AppBackground';
import { AppHeader } from '../components/layout/AppHeader';
import { AppSidebar } from '../components/layout/AppSidebar';
import { ToastNotification } from '../components/layout/ToastNotification';
import { DashboardView } from '../features/dashboard/components/DashboardView';
import { EmpenhosView } from '../features/empenhos/components/EmpenhosView';
import { NotasFiscaisView } from '../features/notas-fiscais/components/NotasFiscaisView';
import { RelatoriosView } from '../features/relatorios/components/RelatoriosView';
import { ConsultaItensView } from '../features/itens/components/ConsultaItensView';
import { ItensEmpenhoView } from '../features/empenhos/components/ItensEmpenhoView';
import { CronogramasView } from '../features/cronogramas/components/CronogramasView';
import { DeleteEmpenhoModal } from '../features/empenhos/components/DeleteEmpenhoModal';
import { MobileNavigation } from '../components/layout/MobileNavigation';
export { PROMPT_EXTRACAO_EMPENHO } from '../features/empenhos/domain/empenhoHelpers';
import { INITIAL_EMPENHOS, INITIAL_ALERTS, INITIAL_INVOICES, INITIAL_COMISSOES } from '../lib/mockData';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth, googleProvider, db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { 
  seedInitialDataIfNecessary, 
  getEmpenhos, 
  saveEmpenho, 
  removeEmpenho,
  getAlerts, 
  saveAlert, 
  removeAlert,
  getInvoices, 
  saveInvoice, 
  removeInvoice,
  getComissoes, 
  saveComissao,
  removeComissao,
  getCronogramas,
  saveCronograma,
  removeCronograma,
} from '../lib/firebaseSync';

export default function Home() {
  // Toast / Notifications helper
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Authentication & Loading state
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const { customLogo, handleLogoUpload, handleRemoveLogo } = usePlatformBranding({
    userEmail: user?.email,
    onNotify: showToast,
  });

  // Navigation & View state
  const [activeTab, setActiveTab] = useState<'painel' | 'empenhos' | 'itens' | 'nova_nf' | 'relatorios' | 'itens_empenho' | 'cronogramas'>('painel');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Core database state
  const [empenhos, setEmpenhos] = useState<Empenho[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [cronogramas, setCronogramas] = useState<CronogramaEmpenho[]>([]);

  // State for inline editing of Número da NS in Empenho Report
  const [editingNSId, setEditingNSId] = useState<string | null>(null);
  const [tempNSValue, setTempNSValue] = useState<string>('');

  // Helper to calculate remaining balance by classification
  const getBalanceByClass = (classification: 'QR' | 'CALI' | 'PASA') => {
    const filtered = empenhos.filter(emp => emp.classification === classification);
    return filtered.reduce((total, emp) => {
      const totalCommitted = emp.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const totalReceived = emp.items.reduce((sum, item) => sum + item.received * item.unitPrice, 0);
      return total + (totalCommitted - totalReceived);
    }, 0);
  };

  // Listen to auth state changes in Firebase (Google Authentication)
  useEffect(() => {
    localStorage.removeItem('local_user_session');

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Set up real-time Firebase Firestore subscriptions (onSnapshot)
  useEffect(() => {
    if (!user) {
      setEmpenhos([]);
      setAlerts([]);
      setInvoices([]);
      setComissoes([]);
      return;
    }

    setSyncing(true);

    // Subscribe to all operational collections in real time (shared globally, no owner isolation)
    const unsubscribeEmpenhos = onSnapshot(
      collection(db, 'empenhos'),
      (snapshot) => {
        const fetched = snapshot.docs.map(doc => {
          const data = doc.data() as Empenho;
          return {
            ...data,
            supplier: normalizeSupplier(data.supplier)
          };
        });
        setEmpenhos(fetched);
        setSyncing(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'empenhos');
        setSyncing(false);
      }
    );

    const unsubscribeAlerts = onSnapshot(
      collection(db, 'alerts'),
      (snapshot) => {
        const fetched = snapshot.docs.map(doc => doc.data() as Alert);
        setAlerts(fetched);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'alerts');
      }
    );

    const unsubscribeInvoices = onSnapshot(
      collection(db, 'invoices'),
      (snapshot) => {
        const fetched = snapshot.docs.map(doc => {
          const data = doc.data() as Invoice;
          return {
            ...data,
            supplier: normalizeSupplier(data.supplier)
          };
        });
        setInvoices(fetched);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'invoices');
      }
    );

    const unsubscribeComissoes = onSnapshot(
      collection(db, 'comissoes'),
      (snapshot) => {
        const fetched = snapshot.docs.map(doc => doc.data() as Comissao);
        setComissoes(fetched);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'comissoes');
      }
    );

    const unsubscribeCronogramas = onSnapshot(
      collection(db, 'cronogramas'),
      (snapshot) => {
        const fetched = snapshot.docs.map(doc => doc.data() as CronogramaEmpenho);
        setCronogramas(fetched);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'cronogramas');
      }
    );

    return () => {
      unsubscribeEmpenhos();
      unsubscribeAlerts();
      unsubscribeInvoices();
      unsubscribeComissoes();
      unsubscribeCronogramas();
    };
  }, [user]);

  // Unique list of Pregão codes
  const uniquePregaos = Array.from(new Set(empenhos.map(emp => emp.pregao).filter(Boolean))) as string[];

  // Unique list of Empenho years
  const uniqueEmpenhoYears = Array.from(
    new Set(
      empenhos
        .map(emp => {
          if (!emp.date) return '';
          const parts = emp.date.split('/');
          if (parts.length === 3) {
            return parts[2]; // YYYY
          }
          if (emp.date.includes('-')) {
            return emp.date.split('-')[0];
          }
          return '';
        })
        .filter(Boolean)
    )
  ).sort((a, b) => b.localeCompare(a)) as string[];

  // Unique list of Invoice months (from issueDate)
  const uniqueNfMonths = Array.from(
    new Set(
      invoices
        .map(inv => {
          if (inv.issueDate && inv.issueDate.length >= 7) {
            return inv.issueDate.substring(0, 7); // 'YYYY-MM'
          }
          return '';
        })
        .filter(Boolean)
    )
  ).sort((a, b) => b.localeCompare(a));


  // Sync back to local helper (Legacy fallback kept for compatibility signature)
  const saveToLocalStorage = (newEmpenhos: Empenho[], newAlerts: Alert[], newInvoices: Invoice[]) => {
    setEmpenhos(newEmpenhos);
    setAlerts(newAlerts);
    setInvoices(newInvoices);
  };

  const saveComissoes = (newComissoes: Comissao[]) => {
    setComissoes(newComissoes);
  };

  // Helper to format Date + Time
  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  // Helper to format Date only (DD/MM/YYYY)
  const formatDateOnly = (dateStr?: string) => {
    if (!dateStr) return '—';
    if (dateStr.includes('T')) {
      try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('pt-BR');
        }
      } catch {
        // fallback
      }
    }
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

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
    handleEditInvoice,
    handleDeleteInvoice,
    handleDeleteAllInvoices,
    handleDeleteAllComissoes,
    handleMarkComissao,
    handleMarkTesouraria,
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

  const { handleDownloadTermoRecebimento, handleGenerateEmpenhoReportPDF } = useDocumentActions({
    user, invoices, setInvoices, comissoes, empenhos, showToast, formatDateOnly
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
    formatDateOnly
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












  // Helper selectors for Dashboard stats
  const totalOpenInvoicesCount = invoices.length + 11; // Styled baseline
  const totalLiquidadoValue = invoices.reduce((sum, inv) => sum + inv.totalValue, 0) + 42000; // Mock baseline

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex flex-col items-center justify-center font-sans">
        <Loader2 className="w-12 h-12 text-[#00288e] animate-spin mb-4" />
        <p className="text-sm font-semibold text-gray-500 animate-pulse">Carregando Sistema Logístico...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0b1c30] via-[#001453] to-[#0a1a2e] flex flex-col items-center justify-center p-6 text-white font-sans selection:bg-blue-500 selection:text-white">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/10 shadow-2xl flex flex-col items-center text-center space-y-6"
        >
          {/* Insígnia / Brasão do Exército / Logotipo Institucional */}
          <div className="w-20 h-20 bg-gradient-to-tr from-[#00288e] to-[#1e4fc2] rounded-2xl flex items-center justify-center shadow-xl border border-white/25 overflow-hidden p-2">
            {customLogo ? (
              <img src={customLogo} alt="Logotipo EMPROVEX" className="w-full h-full object-contain" />
            ) : (
              <span className="text-2xl font-extrabold text-white tracking-widest font-montserrat">EMP</span>
            )}
          </div>

          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-wider text-white uppercase font-montserrat">
              EMPROVEX
            </h2>
            <p className="text-xs sm:text-sm font-bold text-blue-200 uppercase tracking-widest mt-1.5 font-montserrat">
              Gestão Logística e Financeira
            </p>
            <p className="text-xs text-gray-300 font-medium mt-1.5">Hospital Geral de Santa Maria (HGeSM)</p>
          </div>

          <div className="w-full h-[1px] bg-white/10 my-2" />

          <p className="text-xs text-gray-400 leading-relaxed">
            Plataforma integrada de Gestão de Empenhos, Provimento Logístico e Execução Financeira
          </p>

          <button
            onClick={async () => {
              setSyncing(true);
              try {
                await signInWithPopup(auth, googleProvider);
                showToast('Acesso autorizado com sucesso!', 'success');
              } catch (err: any) {
                console.error('Erro na autenticação:', err);
                showToast('Falha na autenticação. Verifique sua conta Google.', 'error');
              } finally {
                setSyncing(false);
              }
            }}
            className="w-full h-12 bg-[#00288e] hover:bg-[#001e6a] text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-lg active:scale-95 group"
          >
            <LogIn className="w-5 h-5 flex-shrink-0 group-hover:translate-x-1 transition-transform" />
            Entrar no Sistema
          </button>
        </motion.div>
        
        <p className="absolute bottom-6 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
          Ministério da Defesa • Exército Brasileiro
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f4f8] via-[#e8ecf3] to-[#f4f6fa] text-[#0b1c30] flex flex-col antialiased relative overflow-x-hidden selection:bg-blue-500 selection:text-white">
      
      <AppBackground />

      <ToastNotification toast={toast} onClose={() => setToast(null)} />

      <AppHeader
        customLogo={customLogo}
        syncing={syncing}
        userDisplayName={user?.displayName || 'Aprovisionamento HGeSM'}
        onOpenSidebar={() => setSidebarOpen(true)}
        onLogoUpload={handleLogoUpload}
        onRemoveLogo={handleRemoveLogo}
      />

      {/* Main Framework Wrapper */}
      <div className="flex flex-1 pt-16 min-h-screen z-10 relative">

        <AppSidebar
          activeTab={activeTab}
          open={sidebarOpen}
          userDisplayName={user?.displayName || 'Aprovisionamento HGeSM'}
          onClose={() => setSidebarOpen(false)}
          onNavigate={(tab) => {
            setActiveTab(tab);
            if (tab === 'empenhos') setSelectedEmpenhoDetailId(null);
            setSidebarOpen(false);
          }}
          onLogout={async () => {
            try {
              localStorage.removeItem('local_user_session');
              await signOut(auth);
              setUser(null);
              showToast('Você saiu do sistema.', 'info');
            } catch (err: any) {
              console.error(err);
              showToast('Erro ao sair do sistema', 'error');
            }
          }}
        />

        {/* Content Container Area */}
        <main className="flex-1 lg:pl-6 pb-24 md:pb-12 pt-6 px-4 max-w-7xl mx-auto w-full overflow-hidden">
          
          {/* TAB 1: PAINEL DE CONTROLE / DASHBOARD - SALDO RESTANTE POR CLASSE DETALHADO */}
          {activeTab === 'painel' && (
            <DashboardView
              dashboardClassFilter={dashboardClassFilter}
              dashboardPregaoFilter={dashboardPregaoFilter}
              dashboardSearch={dashboardSearch}
              empenhos={empenhos}
              getBalanceByClass={getBalanceByClass}
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
            <EmpenhosView context={{ copiedPrompt, empenhos, empenhosClassFilter, empenhosFilter, empenhosPregaoFilter, empenhosSearch, empenhosYearFilter, formatDateOnly, handleAddItemToEmpenho, handleCopyPrompt, handleCreateEmpenho, handleDeleteItemFromEmpenho, handleDownloadPromptPdf, handleDownloadPromptTxt, handleDownloadTermoRecebimento, handleEmpenhoDocumentUploaded, handleGenerateEmpenhoReportPDF, handleProcessJson, handleSaveReviewEmpenho, handleSelectEmpenhoForCronograma, invoices, jsonError, jsonInput, newEmpenhoForm, newEmpenhoMode, newItemForm, reviewEmpenho, selectedEmpenhoDetailId, setActiveTab, setEditingEmpenhoId, setEditingInvoice, setEmpenhosClassFilter, setEmpenhosFilter, setEmpenhosPregaoFilter, setEmpenhosSearch, setEmpenhosYearFilter, setEmpenhoToDelete, setJsonError, setJsonInput, setNewEmpenhoForm, setNewEmpenhoMode, setNewItemForm, setNfSubTab, setReviewEmpenho, setSelectedEmpenhoDetailId, setSelectedNFCommitmentId, setSelectedReportInvoice, setShowAddItemFormInDetail, setShowConfirmSaveModal, setShowNewEmpenhoModal, showAddItemFormInDetail, showConfirmSaveModal, showNewEmpenhoModal, showToast, uniqueEmpenhoYears, uniquePregaos, user }} />
          )}
          {/* TAB 3: GESTÃO DE NOTAS FISCAIS */}
          {activeTab === 'nova_nf' && (
            <NotasFiscaisView context={{ comissaoAux1Nome, comissaoAux1Posto, comissaoAux2Nome, comissaoAux2Posto, comissaoAux3Nome, comissaoAux3Posto, comissaoBoletimDate, comissaoBoletimNum, comissaoMes, comissaoPresNome, comissaoPresPosto, comissoes, editingInvoice, empenhos, formatDateOnly, formatDateTime, handleDeleteAllComissoes, handleDeleteAllInvoices, handleDeleteInvoice, handleDownloadTermoRecebimento, handleEditInvoice, handleEmpenhoDocumentUploaded, handleMarkComissao, handleMarkTesouraria, handleSaveComissao, handleSaveInvoice, invoices, nfDate, nfEmpenhoFilter, nfMonthFilter, nfNumber, nfQuantities, nfSearch, nfSortOrder, nfSubTab, nfTramitacaoFilter, selectedNFCommitmentId, setActiveTab, setComissaoAux1Nome, setComissaoAux1Posto, setComissaoAux2Nome, setComissaoAux2Posto, setComissaoAux3Nome, setComissaoAux3Posto, setComissaoBoletimDate, setComissaoBoletimNum, setComissaoMes, setComissaoPresNome, setComissaoPresPosto, setComissoes, setEditingEmpenhoId, setEditingInvoice, setNfDate, setNfEmpenhoFilter, setNfMonthFilter, setNfNumber, setNfQuantities, setNfSearch, setNfSortOrder, setNfSubTab, setNfTramitacaoFilter, setSelectedNFCommitmentId, showToast, uniqueNfMonths, user }} />
          )}

          {/* TAB 4: CONCILIAÇÃO E RELATÓRIO DO RECEBIMENTO */}
          {activeTab === 'relatorios' && (
            <RelatoriosView context={{ editingNSId, empenhos, formatDateOnly, handleDownloadTermoRecebimento, handleGenerateEmpenhoReportPDF, handleSaveNumeroNS, invoices, relatoriosPregaoFilter, reportEndDate, reportSearch, reportStartDate, selectedReportInvoice, setEditingNSId, setRelatoriosPregaoFilter, setReportEndDate, setReportSearch, setReportStartDate, setSelectedReportInvoice, setShowPdfModal, setTempNSValue, showPdfModal, tempNSValue, uniquePregaos }} />
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
            <CronogramasView context={{ applyAllToFirstRemessa, applyCronogramaPreset, clearCronogramaDistribuicao, cronogramaColunas, cronogramaDistribuicao, cronogramaHorarioEntrega, cronogramaLocalEntrega, cronogramaObservacoes, cronogramaResponsavelCargo, cronogramaResponsavelNome, cronogramas, cronogramasClassFilter, cronogramasPregaoFilter, cronogramasSearch, cronogramasStatusFilter, cronogramasYearFilter, empenhos, formatDateOnly, handleAddRemessa, handleGenerateCronogramaPDF, handleRemoveRemessa, handleSaveCronograma, handleSelectEmpenhoForCronograma, isSavingCronograma, selectedCronogramaEmpenhoId, setCronogramaColunas, setCronogramaDistribuicao, setCronogramaHorarioEntrega, setCronogramaLocalEntrega, setCronogramaObservacoes, setCronogramaResponsavelCargo, setCronogramaResponsavelNome, setCronogramasClassFilter, setCronogramasPregaoFilter, setCronogramasSearch, setCronogramasStatusFilter, setCronogramasYearFilter, setSelectedCronogramaEmpenhoId, setShowCronogramaPreviewModal, showCronogramaPreviewModal, uniqueEmpenhoYears, uniquePregaos }} />
          )}

          <DeleteEmpenhoModal
            empenhoToDelete={empenhoToDelete}
            empenhos={empenhos}
            isDeletingEmpenho={isDeletingEmpenho}
            onCancel={() => setEmpenhoToDelete(null)}
            onConfirm={handleDeleteSpecificEmpenho}
          />

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
