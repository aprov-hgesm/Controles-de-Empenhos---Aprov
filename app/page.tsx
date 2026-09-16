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










  const handleDownloadTermoRecebimento = async (inv: Invoice) => {
    // 1. Determine or assign sequential term number and register TR emission date
    let termoNumero = inv.termoNumero;
    const termoEmissaoDate = inv.termoEmissaoDate || inv.registeredAt || new Date().toISOString();

    if (!termoNumero) {
      const maxTermoNumero = invoices.reduce((max, i) => (i.termoNumero && i.termoNumero > max ? i.termoNumero : max), 0);
      termoNumero = maxTermoNumero + 1;
    }

    const updatedInvoiceWithTR: Invoice = {
      ...inv,
      termoNumero,
      termoEmissaoDate,
    };

    // Update local state immediately so that the UI immediately displays the TR number & emission date
    setInvoices(prev => prev.map(i => i.id === inv.id ? updatedInvoiceWithTR : i));

    // Save updated invoice with termoNumero and termoEmissaoDate to Firestore
    if (user) {
      try {
        await saveInvoice(user.uid, updatedInvoiceWithTR);
      } catch (error) {
        console.error("Erro ao salvar número e data de emissão do termo:", error);
      }
    }

    // 1. Find matching commission for the month of reference of the invoice
    const invMonth = inv.issueDate ? inv.issueDate.substring(0, 7) : '';
    let matchingComissao = comissoes.find(c => c.mesReferencia === invMonth);

    if (!matchingComissao) {
      if (comissoes.length === 0) {
        showToast('Nenhuma Comissão de Recebimento cadastrada no sistema. Por favor, cadastre a comissão na aba correspondente antes de gerar o termo.', 'error');
        return;
      }
      // If none matches, let's use the first one available but alert the user
      matchingComissao = comissoes[0];
      showToast('Aviso: Nenhuma comissão cadastrada para o mês desta Nota Fiscal. Utilizando comissão cadastrada como fallback.', 'info');
    }

    const targetEmp = empenhos.find(e => e.id === inv.empenhoId);
    const empenhoTotal = targetEmp?.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) || 0;
    const isQtyEqual = inv.totalValue >= (empenhoTotal - 0.01);

    // Helpers for formatting date
    const formatDateToBR = (dateStr?: string) => {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    };

    // Initialize jsPDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Color definitions for a professional look
    const primaryColor = [11, 28, 48]; // #0b1c30
    const secondaryColor = [0, 40, 142]; // #00288e
    const textColor = [50, 50, 50];

    // Margin & dimensions
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 15;

    // Helper functions for PDF styling
    const centerText = (text: string, size: number, style: 'normal' | 'bold' = 'normal', color = primaryColor) => {
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);
      const textWidth = doc.getTextWidth(text);
      doc.text(text, (pageWidth - textWidth) / 2, yPos);
      yPos += size * 0.4 + 2;
    };

    const addSectionHeader = (title: string) => {
      yPos += 3;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(title, margin, yPos);
      yPos += 1.5;
      doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 4.5;
    };

    const addParagraph = (text: string, size: number = 9, style: 'normal' | 'bold' = 'normal', color = textColor, indent = 0) => {
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);
      const splitText = doc.splitTextToSize(text, pageWidth - (margin * 2) - indent);
      splitText.forEach((line: string) => {
        doc.text(line, margin + indent, yPos);
        yPos += size * 0.4 + 1.2;
      });
    };

    // --- 1. HEADER ---
    centerText('MINISTÉRIO DA DEFESA', 9, 'bold');
    centerText('EXÉRCITO BRASILEIRO', 9, 'bold');
    centerText('HOSPITAL GERAL DE SANTA MARIA', 10, 'bold');
    yPos += 4;
    centerText(`TERMO DE RECEBIMENTO DE ARTIGOS DE QR Nº ${termoNumero}/${new Date().getFullYear()}`, 11, 'bold', secondaryColor);
    yPos += 5;

    // --- 1. NOMEAÇÃO DA COMISSÃO ---
    addSectionHeader('1. NOMEAÇÃO DA COMISSÃO');
    const bNum = matchingComissao.boletimNumero;
    const bData = formatDateToBR(matchingComissao.boletimData);
    addParagraph(`A Comissão de Recebimento de material do Hospital Geral de Santa Maria, nomeada por intermédio do Boletim Interno do HGeSM nº ${bNum}, de ${bData}, reuniu-se para fins de examinar e receber os artigos constantes nos documentos abaixo especificados.`, 9, 'normal', textColor);

    // --- 2. IDENTIFICAÇÃO DO MATERIAL ---
    addSectionHeader('2. IDENTIFICAÇÃO DO MATERIAL');
    const tableRows = inv.items.map((it) => {
      const targetItem = targetEmp?.items.find(i => i.id === it.itemId);
      const name = targetItem ? targetItem.name : `Item ID: ${it.itemId}`;
      const unit = targetItem ? targetItem.unit : 'UN';
      return [
        it.itemId,
        name,
        unit,
        it.quantity.toString(),
        it.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        it.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      ];
    });

    autoTable(doc, {
      startY: yPos,
      margin: { left: margin, right: margin },
      head: [['Código', 'Descrição do Material', 'Und', 'Qtd', 'Val. Unit.', 'Total']],
      body: tableRows,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 40, 142] as [number, number, number],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: 50,
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 12, halign: 'center' as const },
        3: { cellWidth: 12, halign: 'center' as const },
        4: { cellWidth: 25, halign: 'right' as const },
        5: { cellWidth: 25, halign: 'right' as const },
      },
      didDrawPage: (data) => {
        yPos = data.cursor ? data.cursor.y + 6 : yPos + 10;
      },
    });

    // Safety margin check after table
    if (yPos > doc.internal.pageSize.getHeight() - 80) {
      doc.addPage();
      yPos = 20;
    }

    // --- 3. DADOS DA NOTA DE EMPENHO ---
    addSectionHeader('3. DADOS DA NOTA DE EMPENHO');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(`Nota de Empenho nº: `, margin, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(inv.empenhoId, margin + 35, yPos);

    doc.setFont('helvetica', 'normal');
    doc.text(`Data de Emissão: `, margin + 75, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(targetEmp?.date || '', margin + 105, yPos);

    doc.setFont('helvetica', 'normal');
    doc.text(`Valor Total: `, margin + 135, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(empenhoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), margin + 155, yPos);
    yPos += 5;

    doc.setFont('helvetica', 'normal');
    doc.text(`Fornecedor Credor: `, margin, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(targetEmp?.supplier || 'Não especificado', margin + 35, yPos);
    yPos += 6;

    // --- 4. DADOS DA NOTA FISCAL ---
    addSectionHeader('4. DADOS DA NOTA FISCAL');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(`Nota Fiscal nº: `, margin, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(inv.id, margin + 35, yPos);

    doc.setFont('helvetica', 'normal');
    doc.text(`Data de Emissão: `, margin + 75, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(formatDateToBR(inv.issueDate), margin + 105, yPos);

    doc.setFont('helvetica', 'normal');
    doc.text(`Valor Total: `, margin + 135, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(inv.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), margin + 155, yPos);
    yPos += 5;

    doc.setFont('helvetica', 'normal');
    doc.text(`Empresa Emitente: `, margin, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(inv.supplier || 'Não especificada', margin + 35, yPos);
    yPos += 8;

    // Safety margin check
    if (yPos > doc.internal.pageSize.getHeight() - 85) {
      doc.addPage();
      yPos = 20;
    }

    // --- 5. ASPECTOS A SEREM VERIFICADOS ---
    addSectionHeader('5. ASPECTOS A SEREM VERIFICADOS');
    
    const renderCheckboxLine = (letter: string, question: string, sim: boolean, nao: boolean, naoCaso: boolean) => {
      // Checkbox visual representations
      const simBox = sim ? '[ X ]' : '[   ]';
      const naoBox = nao ? '[ X ]' : '[   ]';
      const naoCasoBox = naoCaso ? '[ X ]' : '[   ]';

      // Render the sub-item letter and question
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`${letter}.`, margin, yPos);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      const splitQuestion = doc.splitTextToSize(question, pageWidth - margin * 2 - 10);
      splitQuestion.forEach((line: string, idx: number) => {
        doc.text(line, margin + 5, yPos + (idx * 4));
      });
      
      yPos += (splitQuestion.length * 4) + 1;

      // Render the response checkboxes underneath the question
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      
      doc.text(`${simBox} SIM`, margin + 10, yPos);
      doc.text(`${naoBox} NÃO`, margin + 40, yPos);
      doc.text(`${naoCasoBox} NÃO É O CASO`, margin + 70, yPos);
      
      yPos += 6;
    };

    renderCheckboxLine(
      'a',
      'A quantidade fornecida está de acordo com o previsto na Nota de Empenho e na NF?',
      isQtyEqual,
      !isQtyEqual,
      false
    );

    renderCheckboxLine(
      'b',
      'A marca do produto está de acordo com o descrito na Nota de Empenho?',
      false,
      false,
      true
    );

    // Safety margin check
    if (yPos > doc.internal.pageSize.getHeight() - 65) {
      doc.addPage();
      yPos = 20;
    }

    renderCheckboxLine(
      'c',
      'Os produtos estão dentro do prazo de validade?',
      true,
      false,
      false
    );

    renderCheckboxLine(
      'd',
      'Os produtos atendem todas as especificações constantes da Nota de Empenho e do edital?',
      true,
      false,
      false
    );

    // Safety margin check
    if (yPos > doc.internal.pageSize.getHeight() - 55) {
      doc.addPage();
      yPos = 20;
    }

    renderCheckboxLine(
      'e',
      'Os produtos apresentam algum defeito/problema aparente?',
      false,
      true,
      false
    );

    yPos += 4;

    // Safety margin check for signature block
    if (yPos > doc.internal.pageSize.getHeight() - 65) {
      doc.addPage();
      yPos = 25;
    }

    // --- 6. ASSINATURAS ---
    addSectionHeader('6. ASSINATURAS E PARECER FINAL');
    addParagraph('Diante dos exames realizados, a Comissão de Recebimento DECLARA que os artigos constantes na presente Nota Fiscal foram recebidos de acordo com as especificações exigidas.', 8.5, 'normal', textColor);
    yPos += 8;

    const sigColWidth = (pageWidth - margin * 2) / 2;
    
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);
    
    // Line 1 for signatures
    doc.line(margin + 5, yPos, margin + sigColWidth - 5, yPos);
    doc.line(margin + sigColWidth + 5, yPos, pageWidth - margin - 5, yPos);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(matchingComissao.presidente.nomeCompleto.toUpperCase(), margin + 5, yPos + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(`${matchingComissao.presidente.postoGraduacao} - Presidente`, margin + 5, yPos + 7);

    const aux1 = matchingComissao.auxiliares[0] || { nomeCompleto: '_______________________', postoGraduacao: 'Auxiliar' };
    doc.setFont('helvetica', 'bold');
    doc.text(aux1.nomeCompleto.toUpperCase(), margin + sigColWidth + 5, yPos + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(`${aux1.postoGraduacao} - 1º Auxiliar`, margin + sigColWidth + 5, yPos + 7);

    yPos += 18;

    if (yPos > doc.internal.pageSize.getHeight() - 35) {
      doc.addPage();
      yPos = 25;
    }

    doc.setDrawColor(180, 180, 180);
    doc.line(margin + 5, yPos, margin + sigColWidth - 5, yPos);
    doc.line(margin + sigColWidth + 5, yPos, pageWidth - margin - 5, yPos);

    const aux2 = matchingComissao.auxiliares[1] || { nomeCompleto: '_______________________', postoGraduacao: 'Auxiliar' };
    doc.setFont('helvetica', 'bold');
    doc.text(aux2.nomeCompleto.toUpperCase(), margin + 5, yPos + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(`${aux2.postoGraduacao} - 2º Auxiliar`, margin + 5, yPos + 7);

    const aux3 = matchingComissao.auxiliares[2] || { nomeCompleto: '_______________________', postoGraduacao: 'Auxiliar' };
    doc.setFont('helvetica', 'bold');
    doc.text(aux3.nomeCompleto.toUpperCase(), margin + sigColWidth + 5, yPos + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(`${aux3.postoGraduacao} - 3º Auxiliar`, margin + sigColWidth + 5, yPos + 7);

    yPos += 18;

    if (yPos > doc.internal.pageSize.getHeight() - 25) {
      doc.addPage();
      yPos = 25;
    }

    doc.setDrawColor(180, 180, 180);
    doc.line((pageWidth - sigColWidth) / 2, yPos, (pageWidth + sigColWidth) / 2, yPos);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    const vistoText = 'Visto do FISCAL ADMINISTRATIVO';
    const vistoWidth = doc.getTextWidth(vistoText);
    doc.text(vistoText, (pageWidth - vistoWidth) / 2, yPos + 5);

    // --- PAGE FOOTER WITH PAGE NUMBERING AND DOCUMENT IDENTIFIER ---
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Line separator above footer
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.15);
      doc.line(margin, doc.internal.pageSize.getHeight() - 15, pageWidth - margin, doc.internal.pageSize.getHeight() - 15);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      
      // Left side: Document identifier with number
      doc.text(`Termo de Recebimento de Artigos de QR Nº ${termoNumero}/${new Date().getFullYear()}`, margin, doc.internal.pageSize.getHeight() - 10);
      
      // Right side: Page numbering
      const pageText = `Página ${i} de ${pageCount}`;
      const pageTextWidth = doc.getTextWidth(pageText);
      doc.text(pageText, pageWidth - margin - pageTextWidth, doc.internal.pageSize.getHeight() - 10);
    }

    const filename = `Termo_Recebimento_QR_No_${termoNumero}_NF_${inv.id}.pdf`;
    doc.save(filename);
    showToast(`Download iniciado: ${filename}`, 'success');
  };

  const handleGenerateEmpenhoReportPDF = (emp: Empenho, action: 'download' | 'print' = 'download') => {
    if (!emp) {
      showToast('Nenhum empenho selecionado para exportação.', 'error');
      return;
    }

    const totalCommitted = emp.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const pdfInvoices = invoices.filter(inv => inv.empenhoId === emp.id);
    const pdfTotalReceivedNfe = pdfInvoices.reduce((sum, inv) => sum + inv.totalValue, 0);
    const saldoRestante = Math.max(0, totalCommitted - pdfTotalReceivedNfe);
    const pctExec = totalCommitted > 0 ? Math.round((pdfTotalReceivedNfe / totalCommitted) * 100) : 0;

    // Initialize jsPDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const primaryColor = [11, 28, 48]; // #0b1c30
    const secondaryColor = [0, 40, 142]; // #00288e
    const textColor = [50, 50, 50];
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 14;

    const centerText = (text: string, size: number, style: 'normal' | 'bold' = 'normal', color = primaryColor) => {
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);
      const textWidth = doc.getTextWidth(text);
      doc.text(text, (pageWidth - textWidth) / 2, yPos);
      yPos += size * 0.38 + 1.8;
    };

    const addSectionHeader = (title: string) => {
      yPos += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(title, margin, yPos);
      yPos += 1.5;
      doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 4;
    };

    // Header
    centerText('MINISTÉRIO DA DEFESA', 8.5, 'bold');
    centerText('EXÉRCITO BRASILEIRO', 8.5, 'bold');
    centerText('HOSPITAL GERAL DE SANTA MARIA', 9.5, 'bold');
    yPos += 2;
    centerText('RELATÓRIO CONSOLIDADO DE EXECUÇÃO E CONCILIAÇÃO DE EMPENHO', 10.5, 'bold', secondaryColor);
    
    // Sub-info
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    const dateStr = `Emissão do Relatório: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    const dateWidth = doc.getTextWidth(dateStr);
    doc.text(dateStr, (pageWidth - dateWidth) / 2, yPos);
    yPos += 5;

    // 1. DADOS DO EMPENHO
    addSectionHeader('1. DADOS CADASTRAIS DO EMPENHO');
    
    // Draw metadata box
    doc.setFillColor(248, 249, 252);
    doc.setDrawColor(225, 230, 240);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 26, 2, 2, 'FD');

    doc.setFontSize(8);
    // Line 1: NE & Pregao & Data
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('Nota de Empenho (NE):', margin + 3, yPos + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(emp.id, margin + 38, yPos + 5);

    doc.setFont('helvetica', 'bold');
    doc.text('Pregão / Processo:', margin + 70, yPos + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(emp.pregao || 'N/A', margin + 98, yPos + 5);

    doc.setFont('helvetica', 'bold');
    doc.text('Data do Empenho:', margin + 130, yPos + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(emp.date, margin + 157, yPos + 5);

    // Line 2: Supplier
    doc.setFont('helvetica', 'bold');
    doc.text('Fornecedor Credor:', margin + 3, yPos + 11);
    doc.setFont('helvetica', 'normal');
    doc.text(emp.supplier, margin + 38, yPos + 11);

    // Line 3: Description / Objeto
    doc.setFont('helvetica', 'bold');
    doc.text('Objeto da Contratação:', margin + 3, yPos + 17);
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(emp.description || 'Sem descrição cadastrada', pageWidth - margin * 2 - 44);
    doc.text(descLines[0] || '', margin + 38, yPos + 17);

    // Line 4: Totals Summary within box
    doc.setFont('helvetica', 'bold');
    doc.text('Valor Contratado:', margin + 3, yPos + 23);
    doc.setFont('helvetica', 'normal');
    doc.text(totalCommitted.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), margin + 30, yPos + 23);

    doc.setFont('helvetica', 'bold');
    doc.text('Conciliado por NF-e:', margin + 65, yPos + 23);
    doc.setFont('helvetica', 'normal');
    doc.text(pdfTotalReceivedNfe.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), margin + 98, yPos + 23);

    doc.setFont('helvetica', 'bold');
    doc.text('Saldo Restante:', margin + 130, yPos + 23);
    doc.setFont('helvetica', 'normal');
    doc.text(saldoRestante.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + ` (${pctExec}% exec.)`, margin + 153, yPos + 23);

    yPos += 30;

    // 2. STATUS FÍSICO DOS ITENS
    addSectionHeader('2. STATUS E CONCILIAÇÃO FÍSICA DOS ITENS');

    const itemsRows = emp.items.map((it) => {
      const balance = it.quantity - it.received;
      const statusText = balance === 0 ? 'CONCLUÍDO' : `${Math.round((it.received / it.quantity) * 100)}% (${balance} ${it.unit} rest.)`;
      const itemSubtotal = it.quantity * it.unitPrice;

      return [
        it.id,
        it.name,
        it.unit,
        it.quantity.toLocaleString('pt-BR'),
        it.received.toLocaleString('pt-BR'),
        balance.toLocaleString('pt-BR'),
        it.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        itemSubtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        statusText
      ];
    });

    autoTable(doc, {
      startY: yPos,
      margin: { left: margin, right: margin },
      head: [['ID', 'Descrição do Material', 'Und', 'Contratado', 'Conciliado', 'Saldo Físico', 'Val. Unit.', 'Val. Total', 'Execução']],
      body: itemsRows,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 40, 142] as [number, number, number],
        textColor: 255,
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'left',
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: 50,
      },
      columnStyles: {
        0: { cellWidth: 16, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 10, halign: 'center' as const },
        3: { cellWidth: 16, halign: 'right' as const },
        4: { cellWidth: 16, halign: 'right' as const, fontStyle: 'bold', textColor: [0, 130, 70] },
        5: { cellWidth: 16, halign: 'right' as const },
        6: { cellWidth: 18, halign: 'right' as const },
        7: { cellWidth: 20, halign: 'right' as const, fontStyle: 'bold' },
        8: { cellWidth: 25, halign: 'center' as const },
      },
      didDrawPage: (data) => {
        yPos = data.cursor ? data.cursor.y + 6 : yPos + 8;
      },
    });

    // Check page break safety
    if (yPos > doc.internal.pageSize.getHeight() - 65) {
      doc.addPage();
      yPos = 18;
    }

    // 3. NOTAS FISCAIS CADASTRADAS NO EMPENHO
    addSectionHeader('3. NOTAS FISCAIS CADASTRADAS E CICLO DE RECEBIMENTO');

    if (pdfInvoices.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text('Nenhuma nota fiscal cadastrada para este empenho até o momento.', margin, yPos);
      yPos += 8;
    } else {
      const invoicesRows = pdfInvoices.map((inv) => {
        const formattedIssueDate = formatDateOnly(inv.issueDate);
        const effectiveTrDate = inv.termoEmissaoDate || (inv.termoNumero ? (inv.registeredAt || inv.issueDate) : null);
        const formattedTrDate = effectiveTrDate 
          ? `${formatDateOnly(effectiveTrDate)}${inv.termoNumero ? ` (TR Nº ${inv.termoNumero})` : ''}` 
          : 'Pendente';
        const formattedComissaoDate = inv.comissaoDate ? formatDateOnly(inv.comissaoDate) : 'Pendente';
        const formattedTesourariaDate = inv.tesourariaDate ? formatDateOnly(inv.tesourariaDate) : 'Pendente';
        const formattedNS = inv.numeroNS ? inv.numeroNS : '—';

        return [
          `NF ${inv.id}`,
          formattedIssueDate,
          formattedTrDate,
          formattedComissaoDate,
          formattedTesourariaDate,
          formattedNS,
          inv.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        ];
      });

      autoTable(doc, {
        startY: yPos,
        margin: { left: margin, right: margin },
        head: [['Número NF', 'Emissão NF', 'Emissão do TR / Cad.', 'Comissão Recebimento', 'Tesouraria', 'Número da NS', 'Valor da NF']],
        body: invoicesRows,
        theme: 'striped',
        headStyles: {
          fillColor: [11, 28, 48] as [number, number, number],
          textColor: 255,
          fontSize: 7.5,
          fontStyle: 'bold',
          halign: 'left',
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: 50,
        },
        columnStyles: {
          0: { cellWidth: 22, fontStyle: 'bold', textColor: [0, 40, 142] },
          1: { cellWidth: 24 },
          2: { cellWidth: 38 },
          3: { cellWidth: 28 },
          4: { cellWidth: 24 },
          5: { cellWidth: 24, fontStyle: 'bold', textColor: [60, 40, 120] },
          6: { cellWidth: 'auto', halign: 'right' as const, fontStyle: 'bold', textColor: [0, 120, 60] },
        },
        didDrawPage: (data) => {
          yPos = data.cursor ? data.cursor.y + 6 : yPos + 8;
        },
      });
    }

    // Check page break safety for signature block
    if (yPos > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      yPos = 20;
    }

    // 4. SIGNATURE AND VISTO BLOCK
    yPos += 6;
    const sigLineWidth = 80;
    const sigX = (pageWidth - sigLineWidth) / 2;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);
    doc.line(sigX, yPos + 10, sigX + sigLineWidth, yPos + 10);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    const vistoText = 'Visto / Fiscalização Administrativa';
    const vistoW = doc.getTextWidth(vistoText);
    doc.text(vistoText, (pageWidth - vistoW) / 2, yPos + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    const setorText = 'Seção de Aquisições / APROV - HGeSM';
    const setorW = doc.getTextWidth(setorText);
    doc.text(setorText, (pageWidth - setorW) / 2, yPos + 18);

    // Footers across all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.15);
      doc.line(margin, doc.internal.pageSize.getHeight() - 12, pageWidth - margin, doc.internal.pageSize.getHeight() - 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.text(`Hospital Geral de Santa Maria - Relatório de Empenho NE ${emp.id}`, margin, doc.internal.pageSize.getHeight() - 8);

      const pText = `Página ${i} de ${pageCount}`;
      const pWidth = doc.getTextWidth(pText);
      doc.text(pText, pageWidth - margin - pWidth, doc.internal.pageSize.getHeight() - 8);
    }

    if (action === 'download') {
      const filename = `Relatorio_Consolidado_Empenho_${emp.id.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      doc.save(filename);
      showToast(`Download do Relatório PDF concluído: ${filename}`, 'success');
    } else {
      // Direct print / view
      const blobUrl = doc.output('bloburl');
      const win = window.open(blobUrl, '_blank');
      if (win) {
        win.focus();
        showToast('Documento PDF aberto em nova aba para impressão.', 'success');
      } else {
        const filename = `Relatorio_Consolidado_Empenho_${emp.id.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        doc.save(filename);
        showToast('Pop-up bloqueado pelo navegador. O relatório em PDF foi baixado diretamente.', 'info');
      }
    }
  };

  // Helper date calculator for schedule simulation
  const getFutureDate = (daysAhead: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
  };

  // Open & Initialize Cronograma for a specific empenho
  const handleSelectEmpenhoForCronograma = (empId: string) => {
    setSelectedCronogramaEmpenhoId(empId);
    const emp = empenhos.find(e => e.id === empId);
    if (!emp) return;

    const saved = cronogramas.find(c => c.empenhoId === empId);
    if (saved && saved.colunasEntregas && saved.colunasEntregas.length > 0) {
      setCronogramaColunas(saved.colunasEntregas);
      setCronogramaDistribuicao(saved.distribuicao || {});
      setCronogramaLocalEntrega(saved.localEntrega || 'Almoxarifado Geral / Seção de Aprovisionamento - HGeSM');
      setCronogramaHorarioEntrega(saved.horarioEntrega || 'Segunda a Quinta: 08:00 às 11:30 e 13:30 às 16:30 | Sexta: 08:00 às 11:30');
      setCronogramaObservacoes(
        saved.observacoes || 
        '1. As entregas deverão ser efetuadas nas datas previstas acompanhadas das respectivas Notas Fiscais.\n2. Os produtos perecíveis deverão atender rigorosamente aos padrões de qualidade e temperatura estabelecidos no Edital.\n3. Qualquer impossibilidade de entrega deverá ser comunicada formalmente com antecedência mínima de 48 horas.'
      );
      setCronogramaResponsavelNome(saved.responsavelNome || (user?.displayName || ''));
      setCronogramaResponsavelCargo(saved.responsavelCargo || 'Fiscal de Contrato / Seção de Aprovisionamento - HGeSM');
    } else {
      // Default: 2 remessas quinzenais
      const initialCols: CronogramaEntregaColuna[] = [
        { id: 'remessa_1', titulo: '1ª Remessa', dataPrevista: getFutureDate(15) },
        { id: 'remessa_2', titulo: '2ª Remessa', dataPrevista: getFutureDate(30) }
      ];
      setCronogramaColunas(initialCols);

      // Distribute balance equally between the 2 remessas
      const initialDist: { [itemId: string]: { [colunaId: string]: number } } = {};
      emp.items.forEach(it => {
        const saldo = Math.max(0, it.quantity - it.received);
        const half = Math.floor(saldo / 2);
        initialDist[it.id] = {
          'remessa_1': saldo - half,
          'remessa_2': half
        };
      });
      setCronogramaDistribuicao(initialDist);
      setCronogramaLocalEntrega('Almoxarifado Geral / Seção de Aprovisionamento - HGeSM');
      setCronogramaHorarioEntrega('Segunda a Quinta: 08:00 às 11:30 e 13:30 às 16:30 | Sexta: 08:00 às 11:30');
      setCronogramaObservacoes(
        '1. As entregas deverão ser efetuadas nas datas previstas acompanhadas das respectivas Notas Fiscais.\n2. Os produtos perecíveis deverão atender rigorosamente aos padrões de qualidade e temperatura estabelecidos no Edital.\n3. Qualquer impossibilidade de entrega deverá ser comunicada formalmente com antecedência mínima de 48 horas.'
      );
      setCronogramaResponsavelNome(user?.displayName || '');
      setCronogramaResponsavelCargo('Fiscal de Contrato / Seção de Aprovisionamento - HGeSM');
    }
  };

  const applyCronogramaPreset = (numParcelas: number, intervaloDias: number = 30) => {
    const emp = empenhos.find(e => e.id === selectedCronogramaEmpenhoId);
    if (!emp) return;

    const newCols: CronogramaEntregaColuna[] = [];
    for (let i = 1; i <= numParcelas; i++) {
      newCols.push({
        id: `remessa_${i}`,
        titulo: `${i}ª Remessa`,
        dataPrevista: getFutureDate(15 + ((i - 1) * intervaloDias))
      });
    }
    setCronogramaColunas(newCols);

    const newDist: { [itemId: string]: { [colunaId: string]: number } } = {};
    emp.items.forEach(it => {
      const saldo = Math.max(0, it.quantity - it.received);
      const basePart = Math.floor(saldo / numParcelas);
      const remainder = saldo % numParcelas;

      newDist[it.id] = {};
      newCols.forEach((col, idx) => {
        newDist[it.id][col.id] = idx === 0 ? basePart + remainder : basePart;
      });
    });
    setCronogramaDistribuicao(newDist);
    showToast(`Cronograma reconfigurado para ${numParcelas} remessas proporcionais.`, 'info');
  };

  const applyAllToFirstRemessa = () => {
    const emp = empenhos.find(e => e.id === selectedCronogramaEmpenhoId);
    if (!emp || cronogramaColunas.length === 0) return;

    const firstColId = cronogramaColunas[0].id;
    const newDist: { [itemId: string]: { [colunaId: string]: number } } = {};
    emp.items.forEach(it => {
      const saldo = Math.max(0, it.quantity - it.received);
      newDist[it.id] = {};
      cronogramaColunas.forEach(col => {
        newDist[it.id][col.id] = col.id === firstColId ? saldo : 0;
      });
    });
    setCronogramaDistribuicao(newDist);
    showToast('100% do saldo atual alocado na 1ª remessa.', 'info');
  };

  const clearCronogramaDistribuicao = () => {
    const emp = empenhos.find(e => e.id === selectedCronogramaEmpenhoId);
    if (!emp) return;

    const newDist: { [itemId: string]: { [colunaId: string]: number } } = {};
    emp.items.forEach(it => {
      newDist[it.id] = {};
      cronogramaColunas.forEach(col => {
        newDist[it.id][col.id] = 0;
      });
    });
    setCronogramaDistribuicao(newDist);
    showToast('Quantidades do cronograma zeradas para preenchimento manual.', 'info');
  };

  const handleAddRemessa = () => {
    const nextNum = cronogramaColunas.length + 1;
    const newCol: CronogramaEntregaColuna = {
      id: `remessa_${Date.now()}`,
      titulo: `${nextNum}ª Remessa`,
      dataPrevista: getFutureDate(15 * nextNum)
    };
    setCronogramaColunas([...cronogramaColunas, newCol]);
  };

  const handleRemoveRemessa = (colId: string) => {
    if (cronogramaColunas.length <= 1) {
      showToast('O cronograma deve conter pelo menos 1 remessa de entrega.', 'warning');
      return;
    }
    setCronogramaColunas(cronogramaColunas.filter(c => c.id !== colId));
  };

  const handleSaveCronograma = async () => {
    if (!selectedCronogramaEmpenhoId) return;
    const emp = empenhos.find(e => e.id === selectedCronogramaEmpenhoId);
    if (!emp) return;

    setIsSavingCronograma(true);
    try {
      const cronogramaObj: CronogramaEmpenho = {
        id: `crono_${emp.id}`,
        empenhoId: emp.id,
        dataCriacao: new Date().toISOString(),
        localEntrega: cronogramaLocalEntrega,
        horarioEntrega: cronogramaHorarioEntrega,
        observacoes: cronogramaObservacoes,
        responsavelNome: cronogramaResponsavelNome,
        responsavelCargo: cronogramaResponsavelCargo,
        colunasEntregas: cronogramaColunas,
        distribuicao: cronogramaDistribuicao
      };

      setCronogramas(prev => {
        const filtered = prev.filter(c => c.empenhoId !== emp.id);
        return [...filtered, cronogramaObj];
      });

      if (user) {
        await saveCronograma(user.uid, cronogramaObj);
      }

      showToast(`Cronograma do Empenho ${emp.id} salvo com sucesso!`, 'success');
    } catch (err) {
      console.error('Erro ao salvar cronograma:', err);
      showToast('Erro ao salvar cronograma. Tente novamente.', 'error');
    } finally {
      setIsSavingCronograma(false);
    }
  };

  // PDF Generator for Cronograma
  const handleGenerateCronogramaPDF = (emp: Empenho, action: 'download' | 'print' = 'download') => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const primaryColor: [number, number, number] = [0, 40, 142]; // #00288e
    const margin = 12;
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 14;

    // 1. OFFICIAL MILITARY / HOSPITAL HEADER
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('MINISTÉRIO DA DEFESA', pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
    doc.text('EXÉRCITO BRASILEIRO', pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text('HOSPITAL GERAL DE SANTA MARIA', pageWidth / 2, yPos, { align: 'center' });
    yPos += 3.5;
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text('SEÇÃO DE APROVISIONAMENTO / LOGÍSTICA HOSPITALAR', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;

    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.6);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;

    // Document Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('CRONOGRAMA DE ENTREGA DE MATERIAL / GÊNEROS', pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`Planejamento Físico-Financeiro de Remessas • Referência NE: ${emp.id}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;

    // 2. CONTRATAÇÃO & EMPENHO SUMMARY BOX
    const totalCommitted = emp.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const totalReceived = emp.items.reduce((sum, item) => sum + (item.received * item.unitPrice), 0);
    const saldoDisponivelTotal = Math.max(0, totalCommitted - totalReceived);

    const totalProgramadoGeral = emp.items.reduce((acc, it) => {
      const qProgramada = cronogramaColunas.reduce((sum, col) => sum + (Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0), 0);
      return acc + (qProgramada * it.unitPrice);
    }, 0);

    const infoBoxHeight = 32;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(210, 220, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, yPos, pageWidth - (margin * 2), infoBoxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('1. DADOS DA CONTRATAÇÃO E FORNECEDOR', margin + 3, yPos + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(50, 50, 50);

    const col1X = margin + 3;
    const col2X = margin + 65;
    const col3X = margin + 125;

    // Row 1
    doc.text(`Nota de Empenho:`, col1X, yPos + 9);
    doc.setFont('helvetica', 'bold');
    doc.text(emp.id, col1X + 23, yPos + 9);
    doc.setFont('helvetica', 'normal');

    doc.text(`Pregão Eletrônico:`, col2X, yPos + 9);
    doc.setFont('helvetica', 'bold');
    doc.text(emp.pregao || 'Não informado', col2X + 24, yPos + 9);
    doc.setFont('helvetica', 'normal');

    doc.text(`Classe / Categoria:`, col3X, yPos + 9);
    doc.setFont('helvetica', 'bold');
    doc.text(emp.classification || 'QR', col3X + 25, yPos + 9);
    doc.setFont('helvetica', 'normal');

    // Row 2
    doc.text(`Fornecedor Credor:`, col1X, yPos + 14);
    doc.setFont('helvetica', 'bold');
    doc.text(emp.supplier.length > 32 ? emp.supplier.substring(0, 32) + '...' : emp.supplier, col1X + 23, yPos + 14);
    doc.setFont('helvetica', 'normal');

    doc.text(`Data de Emissão NE:`, col2X, yPos + 14);
    doc.setFont('helvetica', 'bold');
    doc.text(formatDateOnly(emp.date), col2X + 26, yPos + 14);
    doc.setFont('helvetica', 'normal');

    doc.text(`Data do Cronograma:`, col3X, yPos + 14);
    doc.setFont('helvetica', 'bold');
    doc.text(new Date().toLocaleDateString('pt-BR'), col3X + 27, yPos + 14);
    doc.setFont('helvetica', 'normal');

    // Row 3
    doc.text(`Objeto Resumido:`, col1X, yPos + 19);
    doc.text(emp.description.length > 80 ? emp.description.substring(0, 80) + '...' : emp.description, col1X + 22, yPos + 19);

    // Row 4 - Financial snapshot
    doc.setFillColor(235, 242, 255);
    doc.roundedRect(margin + 2, yPos + 22, pageWidth - (margin * 2) - 4, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(30, 41, 59);

    doc.text(`TOTAL EMPENHADO: ${totalCommitted.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, col1X + 1, yPos + 26.8);
    doc.text(`JÁ RECEBIDO (NFs): ${totalReceived.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, col2X - 5, yPos + 26.8);
    doc.setTextColor(0, 110, 50);
    doc.text(`SALDO ATUAL: ${saldoDisponivelTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, col3X - 5, yPos + 26.8);
    doc.setTextColor(0, 40, 142);
    doc.text(`TOTAL NO CRONOGRAMA: ${totalProgramadoGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, col3X + 28, yPos + 26.8);

    yPos += infoBoxHeight + 6;

    // 3. TABLE OF SCHEDULED DELIVERIES
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('2. DISTRIBUIÇÃO DAS REMESSAS DE ENTREGA', margin, yPos);
    yPos += 3;

    // Build headers dynamically
    const headers: string[] = ['Item / Descrição', 'Und', 'Emp.', 'Rec.', 'Saldo Disp.'];
    cronogramaColunas.forEach((col) => {
      headers.push(`${col.titulo}\n${formatDateOnly(col.dataPrevista)}`);
    });
    headers.push('Total Prog.', 'Val. Unit.', 'Total (R$)');

    const tableRows = emp.items.map((it) => {
      const saldoDisponivel = Math.max(0, it.quantity - it.received);
      const totalProg = cronogramaColunas.reduce((sum, col) => sum + (Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0), 0);
      const valorTotalProg = totalProg * it.unitPrice;

      const row: string[] = [
        `${it.name}`,
        it.unit,
        String(it.quantity),
        String(it.received),
        String(saldoDisponivel),
      ];

      cronogramaColunas.forEach(col => {
        const val = Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0;
        row.push(val > 0 ? String(val) : '—');
      });

      row.push(
        String(totalProg),
        it.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        valorTotalProg.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      );

      return row;
    });

    // Summary row for table footer
    const summaryRow: string[] = ['TOTAIS GERAIS', '—', '—', '—', '—'];
    cronogramaColunas.forEach(col => {
      const totalColQty = emp.items.reduce((sum, it) => sum + (Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0), 0);
      const totalColVal = emp.items.reduce((sum, it) => sum + ((Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0) * it.unitPrice), 0);
      summaryRow.push(`${totalColQty}\n(${totalColVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`);
    });
    summaryRow.push(
      String(emp.items.reduce((sum, it) => sum + cronogramaColunas.reduce((s, col) => s + (Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0), 0), 0)),
      '—',
      totalProgramadoGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    );

    tableRows.push(summaryRow);

    autoTable(doc, {
      startY: yPos,
      margin: { left: margin, right: margin },
      head: [headers],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 40, 142] as [number, number, number],
        textColor: 255,
        fontSize: 6.5,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
      },
      bodyStyles: {
        fontSize: 6.5,
        textColor: 40,
        valign: 'middle',
      },
      columnStyles: {
        0: { cellWidth: 'auto', fontStyle: 'bold', textColor: [10, 25, 50], halign: 'left' },
        1: { cellWidth: 10, halign: 'center' },
        2: { cellWidth: 10, halign: 'center' },
        3: { cellWidth: 10, halign: 'center' },
        4: { cellWidth: 14, halign: 'center', fontStyle: 'bold', textColor: [0, 100, 50] },
      },
      didParseCell: (data) => {
        if (data.row.index === tableRows.length - 1) {
          data.cell.styles.fillColor = [240, 245, 255];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [0, 40, 142];
        }
      },
      didDrawPage: (data) => {
        yPos = data.cursor ? data.cursor.y + 6 : yPos + 8;
      },
    });

    // 4. DELIVERY INSTRUCTIONS AND CONDITIONS
    if (yPos > doc.internal.pageSize.getHeight() - 55) {
      doc.addPage();
      yPos = 16;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('3. DIRETRIZES E CONDIÇÕES DE RECEBIMENTO', margin, yPos);
    yPos += 3.5;

    const instBoxH = 26;
    doc.setFillColor(252, 253, 255);
    doc.setDrawColor(220, 228, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, yPos, pageWidth - (margin * 2), instBoxH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(50, 50, 50);
    doc.text('Local de Entrega:', margin + 3, yPos + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.text(cronogramaLocalEntrega || 'Almoxarifado Geral / Seção de Aprovisionamento - HGeSM', margin + 26, yPos + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.text('Horário de Recebimento:', margin + 3, yPos + 9);
    doc.setFont('helvetica', 'normal');
    doc.text(cronogramaHorarioEntrega || 'Segunda a Quinta: 08:00 às 11:30 e 13:30 às 16:30 | Sexta: 08:00 às 11:30', margin + 34, yPos + 9);

    doc.setFont('helvetica', 'bold');
    doc.text('Observações e Instruções:', margin + 3, yPos + 13.5);
    doc.setFont('helvetica', 'normal');
    const obsLines = doc.splitTextToSize(cronogramaObservacoes || 'As entregas deverão ser efetuadas nas datas programadas acompanhadas das Notas Fiscais.', pageWidth - (margin * 2) - 38);
    doc.text(obsLines, margin + 35, yPos + 13.5);

    yPos += instBoxH + 8;

    // 5. SIGNATURES & DE ACORDO BLOCK
    if (yPos > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      yPos = 16;
    }

    const boxWidth = (pageWidth - (margin * 2) - 10) / 2;
    const sigY = yPos + 12;

    // Left Signature (HGeSM Fiscal)
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.25);
    doc.line(margin + 5, sigY, margin + boxWidth - 5, sigY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    const sig1Text = cronogramaResponsavelNome || 'Encarregado do Aprovisionamento';
    doc.text(sig1Text, margin + (boxWidth / 2), sigY + 4, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(90, 90, 90);
    const cargo1Text = cronogramaResponsavelCargo || 'Fiscal de Contrato / Seção de Aprovisionamento - HGeSM';
    doc.text(cargo1Text, margin + (boxWidth / 2), sigY + 7.5, { align: 'center' });

    // Right Signature (Fornecedor / De Acordo)
    const rightBoxX = margin + boxWidth + 10;
    doc.line(rightBoxX + 5, sigY, rightBoxX + boxWidth - 5, sigY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    const sig2Text = 'DE ACORDO / CIÊNCIA DO FORNECEDOR';
    doc.text(sig2Text, rightBoxX + (boxWidth / 2), sigY + 4, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(90, 90, 90);
    const cargo2Text = `${emp.supplier} • Assinatura e Carimbo`;
    doc.text(cargo2Text.length > 40 ? cargo2Text.substring(0, 40) + '...' : cargo2Text, rightBoxX + (boxWidth / 2), sigY + 7.5, { align: 'center' });

    // Footers across all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.15);
      doc.line(margin, doc.internal.pageSize.getHeight() - 10, pageWidth - margin, doc.internal.pageSize.getHeight() - 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(`Hospital Geral de Santa Maria • Cronograma de Entrega NE ${emp.id}`, margin, doc.internal.pageSize.getHeight() - 6);

      const pText = `Página ${i} de ${pageCount}`;
      const pWidth = doc.getTextWidth(pText);
      doc.text(pText, pageWidth - margin - pWidth, doc.internal.pageSize.getHeight() - 6);
    }

    if (action === 'download') {
      const filename = `Cronograma_Entrega_NE_${emp.id.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      doc.save(filename);
      showToast(`Download do Cronograma PDF concluído: ${filename}`, 'success');
    } else {
      const blobUrl = doc.output('bloburl');
      const win = window.open(blobUrl, '_blank');
      if (win) {
        win.focus();
        showToast('Cronograma em PDF aberto para impressão.', 'success');
      } else {
        const filename = `Cronograma_Entrega_NE_${emp.id.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        doc.save(filename);
        showToast('Pop-up bloqueado pelo navegador. O cronograma foi baixado diretamente.', 'info');
      }
    }
  };

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
