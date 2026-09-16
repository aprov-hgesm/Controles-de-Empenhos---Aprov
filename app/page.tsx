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

  const handleEmpenhoDocumentUploaded = async (
    empenhoId: string,
    document: EmpenhoPdfDocument
  ): Promise<void> => {
    if (!user) throw new Error('Sua sessão expirou. Entre novamente para anexar o documento.');

    const currentEmpenho = empenhos.find((emp) => emp.id === empenhoId);
    if (!currentEmpenho) throw new Error('Empenho não encontrado para vincular o documento.');

    const existingVersions = currentEmpenho.notaEmpenhoPdfVersions
      || (currentEmpenho.notaEmpenhoPdf ? [currentEmpenho.notaEmpenhoPdf] : []);
    const versions = [
      document,
      ...existingVersions.filter((version) => version.pathname !== document.pathname),
    ].slice(0, 25);
    const updatedEmpenho: Empenho = {
      ...currentEmpenho,
      notaEmpenhoPdf: document,
      notaEmpenhoPdfVersions: versions,
    };

    await saveEmpenho(user.uid, updatedEmpenho);
    setEmpenhos((current) => current.map((emp) => emp.id === empenhoId ? updatedEmpenho : emp));
  };

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

  // --- VIEW 1: PAINEL / DASHBOARD STATES ---
  const [expandedEmpenhoId, setExpandedEmpenhoId] = useState<string | null>('2025NE124');
  const [dashboardPregaoFilter, setDashboardPregaoFilter] = useState('Todos');
  const [dashboardClassFilter, setDashboardClassFilter] = useState<'TODAS' | 'QR' | 'CALI' | 'PASA'>('TODAS');
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [dashboardExpandedClass, setDashboardExpandedClass] = useState<string | null>(null);

  // --- VIEW 2: EMPENHOS STATES ---
  const [selectedEmpenhoDetailId, setSelectedEmpenhoDetailId] = useState<string | null>(null);
  const [showAddItemFormInDetail, setShowAddItemFormInDetail] = useState(false);
  const [empenhosSearch, setEmpenhosSearch] = useState('');
  const [empenhosFilter, setEmpenhosFilter] = useState<'Todos' | 'Com Saldo' | 'Ativos' | 'Encerrados'>('Todos');
  const [empenhosPregaoFilter, setEmpenhosPregaoFilter] = useState('Todos');
  const [empenhosYearFilter, setEmpenhosYearFilter] = useState('Todos');
  const [empenhosClassFilter, setEmpenhosClassFilter] = useState('Todos');
  const [showNewEmpenhoModal, setShowNewEmpenhoModal] = useState(false);
  const [newEmpenhoMode, setNewEmpenhoMode] = useState<'manual' | 'json'>('manual');
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [reviewEmpenho, setReviewEmpenho] = useState<any | null>(null);
  const [showConfirmSaveModal, setShowConfirmSaveModal] = useState(false);
  const [empenhoToDelete, setEmpenhoToDelete] = useState<string | null>(null);
  const [isDeletingEmpenho, setIsDeletingEmpenho] = useState(false);
  const [newEmpenhoForm, setNewEmpenhoForm] = useState<{
    id: string;
    supplier: string;
    description: string;
    pregao: string;
    date: string;
    classification: 'QR' | 'CALI' | 'PASA';
  }>({
    id: '',
    supplier: '',
    description: '',
    pregao: '',
    date: new Date().toISOString().split('T')[0],
    classification: 'QR',
  });

  // --- CONSULTA CONSOLIDADA DE ITENS STATES ---
  const [itensSearch, setItensSearch] = useState('');
  const [itensSaldoFilter, setItensSaldoFilter] = useState<'Todos' | 'Com saldo' | 'Sem saldo'>('Todos');
  const [expandedConsultaItem, setExpandedConsultaItem] = useState<string | null>(null);

  // --- VIEW 3: NOVA NF STATES ---
  const [selectedNFCommitmentId, setSelectedNFCommitmentId] = useState<string>('2024NE0015');
  const [nfNumber, setNfNumber] = useState('');
  const [nfDate, setNfDate] = useState(new Date().toISOString().split('T')[0]);
  const [nfQuantities, setNfQuantities] = useState<{ [itemId: string]: number }>({});
  const [nfSearch, setNfSearch] = useState('');
  const [nfSubTab, setNfSubTab] = useState<'acompanhar' | 'cadastrar' | 'comissao'>('acompanhar');
  const [nfMonthFilter, setNfMonthFilter] = useState('Todos');
  const [nfEmpenhoFilter, setNfEmpenhoFilter] = useState('Todos');
  const [nfTramitacaoFilter, setNfTramitacaoFilter] = useState<'Todos' | 'FaltaComissao' | 'FaltaTesouraria' | 'Concluidas'>('Todos');
  const [nfSortOrder, setNfSortOrder] = useState<'recentes' | 'antigas'>('recentes');
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // --- COMISSÃO DE RECEBIMENTO FORM STATES ---
  const [comissaoMes, setComissaoMes] = useState('2026-06');
  const [comissaoBoletimNum, setComissaoBoletimNum] = useState('');
  const [comissaoBoletimDate, setComissaoBoletimDate] = useState('');
  const [comissaoPresPosto, setComissaoPresPosto] = useState('Capitão');
  const [comissaoPresNome, setComissaoPresNome] = useState('');
  const [comissaoAux1Posto, setComissaoAux1Posto] = useState('Tenente');
  const [comissaoAux1Nome, setComissaoAux1Nome] = useState('');
  const [comissaoAux2Posto, setComissaoAux2Posto] = useState('Sargento');
  const [comissaoAux2Nome, setComissaoAux2Nome] = useState('');
  const [comissaoAux3Posto, setComissaoAux3Posto] = useState('Cabo');
  const [comissaoAux3Nome, setComissaoAux3Nome] = useState('');

  // --- VIEW 4: RELATORIOS STATES ---
  const [reportSearch, setReportSearch] = useState('2025NE124');
  const [reportStartDate, setReportStartDate] = useState('2026-06-01');
  const [reportEndDate, setReportEndDate] = useState('2026-06-29');
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedReportInvoice, setSelectedReportInvoice] = useState<Invoice | null>(null);
  const [relatoriosPregaoFilter, setRelatoriosPregaoFilter] = useState('Todos');

  // --- VIEW 5: ITENS DO EMPENHO STATES (Add/Manage commitment items) ---
  const [editingEmpenhoId, setEditingEmpenhoId] = useState<string>('2025NE124');
  const [newItemForm, setNewItemForm] = useState({
    id: '00004',
    name: '',
    unit: 'kg',
    quantity: '',
    unitPrice: '',
  });

  // --- VIEW 6: CRONOGRAMAS STATES ---
  const [selectedCronogramaEmpenhoId, setSelectedCronogramaEmpenhoId] = useState<string | null>(null);
  const [cronogramasSearch, setCronogramasSearch] = useState('');
  const [cronogramasPregaoFilter, setCronogramasPregaoFilter] = useState('Todos');
  const [cronogramasYearFilter, setCronogramasYearFilter] = useState('Todos');
  const [cronogramasClassFilter, setCronogramasClassFilter] = useState('Todos');
  const [cronogramasStatusFilter, setCronogramasStatusFilter] = useState<'Todos' | 'Com Saldo' | 'Ativos' | 'Encerrados'>('Todos');

  // Active Cronograma Draft states
  const [cronogramaColunas, setCronogramaColunas] = useState<CronogramaEntregaColuna[]>([]);
  const [cronogramaDistribuicao, setCronogramaDistribuicao] = useState<{ [itemId: string]: { [colunaId: string]: number } }>({});
  const [cronogramaLocalEntrega, setCronogramaLocalEntrega] = useState('Almoxarifado Geral / Seção de Aprovisionamento - HGeSM');
  const [cronogramaHorarioEntrega, setCronogramaHorarioEntrega] = useState('Segunda a Quinta: 08:00 às 11:30 e 13:30 às 16:30 | Sexta: 08:00 às 11:30');
  const [cronogramaObservacoes, setCronogramaObservacoes] = useState(
    '1. As entregas deverão ser efetuadas nas datas previstas acompanhadas das respectivas Notas Fiscais.\n2. Os produtos perecíveis deverão atender rigorosamente aos padrões de qualidade e temperatura estabelecidos no Edital.\n3. Qualquer impossibilidade de entrega deverá ser comunicada formalmente com antecedência mínima de 48 horas.'
  );
  const [cronogramaResponsavelNome, setCronogramaResponsavelNome] = useState('');
  const [cronogramaResponsavelCargo, setCronogramaResponsavelCargo] = useState('Fiscal de Contrato / Seção de Aprovisionamento - HGeSM');
  const [showCronogramaPreviewModal, setShowCronogramaPreviewModal] = useState(false);
  const [isSavingCronograma, setIsSavingCronograma] = useState(false);

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

  // Handler to register new Commitment
  const handleCreateEmpenho = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpenhoForm.id || !newEmpenhoForm.supplier || !newEmpenhoForm.description) {
      showToast('Por favor, preencha todos os campos do empenho.', 'error');
      return;
    }

    if (empenhos.some(emp => emp.id.toUpperCase() === newEmpenhoForm.id.toUpperCase())) {
      showToast('Já existe uma Nota de Empenho com este número.', 'error');
      return;
    }

    let formattedDate = '';
    if (newEmpenhoForm.date) {
      const parts = newEmpenhoForm.date.split('-');
      if (parts.length === 3) {
        formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else {
        formattedDate = new Date().toLocaleDateString('pt-BR');
      }
    } else {
      formattedDate = new Date().toLocaleDateString('pt-BR');
    }

    const newEmp: Empenho = {
      id: newEmpenhoForm.id.toUpperCase(),
      supplier: newEmpenhoForm.supplier,
      description: newEmpenhoForm.description,
      date: formattedDate,
      status: 'Ativo',
      items: [],
      pregao: newEmpenhoForm.pregao || 'Sem Pregão',
      classification: newEmpenhoForm.classification,
    };

    const updatedEmpenhos = [newEmp, ...empenhos];
    setEmpenhos(updatedEmpenhos);

    if (user) {
      try {
        await saveEmpenho(user.uid, newEmp);
      } catch (error) {
        showToast('Erro ao salvar no Firebase', 'error');
      }
    }

    showToast(`Nota de Empenho ${newEmp.id} criada! Adicione itens a ela.`, 'success');
    setNewEmpenhoForm({ id: '', supplier: '', description: '', pregao: '', date: new Date().toISOString().split('T')[0], classification: 'QR' });
    setShowNewEmpenhoModal(false);

    // Redirect to Detail view of this new empenho
    setEditingEmpenhoId(newEmp.id);
    setSelectedEmpenhoDetailId(newEmp.id);
    setActiveTab('empenhos');
  };

  // Download prompt as TXT
  const handleDownloadPromptTxt = () => {
    const blob = new Blob([PROMPT_EXTRACAO_EMPENHO], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'prompt_extracao_empenho.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Prompt baixado com sucesso em formato .TXT!', 'success');
  };

  // Download prompt as PDF
  const handleDownloadPromptPdf = () => {
    try {
      const doc = new jsPDF();
      
      // Header banner
      doc.setFillColor(0, 40, 142); // #00288e
      doc.rect(0, 0, 210, 22, 'F');
      
      // Header title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('PROMPT FIXO — EXTRAÇÃO DE NOTA DE EMPENHO', 14, 14);
      
      // Subtitle
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text('Copie e utilize este prompt no Claude, ChatGPT ou Gemini anexando o PDF da NE.', 14, 28);
      
      // Box for prompt content
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(12, 33, 186, 250, 2, 2, 'FD');
      
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8.5);
      doc.setFont('courier', 'normal');
      
      const splitText = doc.splitTextToSize(PROMPT_EXTRACAO_EMPENHO, 176);
      doc.text(splitText, 16, 41);
      
      doc.save('prompt_extracao_empenho.pdf');
      showToast('Prompt baixado com sucesso em formato .PDF!', 'success');
    } catch (err) {
      showToast('Erro ao gerar arquivo PDF do prompt.', 'error');
    }
  };

  // Copy prompt to clipboard
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(PROMPT_EXTRACAO_EMPENHO);
    setCopiedPrompt(true);
    showToast('Prompt copiado para a área de transferência!', 'success');
    setTimeout(() => setCopiedPrompt(false), 3000);
  };

  // Process imported JSON data
  const handleProcessJson = () => {
    try {
      let cleanText = jsonInput.trim();
      // Remove automatically markdown blocks if they exist (```json and ```)
      cleanText = cleanText.replace(/^```(?:json)?\s*/i, '');
      cleanText = cleanText.replace(/\s*```$/i, '');
      cleanText = cleanText.trim();

      if (!cleanText) {
        setJsonError('Por favor, cole o conteúdo JSON antes de processar.');
        return;
      }

      const data = JSON.parse(cleanText);

      // Validate required fields
      if (!data.numero_empenho || !data.data_emissao || !data.fornecedor || !data.itens) {
        setJsonError('JSON incompleto. Certifique-se de usar o prompt correto na IA externa. Campos obrigatórios ausentes: numero_empenho, data_emissao, fornecedor, itens.');
        return;
      }

      if (!Array.isArray(data.itens) || data.itens.length === 0) {
        setJsonError('Nenhum item encontrado no JSON. Verifique o documento original.');
        return;
      }

      let formattedDate = data.data_emissao;
      // Convert YYYY-MM-DD to DD/MM/YYYY
      if (formattedDate.includes('-')) {
        const parts = formattedDate.split('-');
        if (parts.length === 3) {
          formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }

      // Extract supplier name and CNPJ flexibly
      let supplierName = '';
      let supplierCnpj = data.cnpj || '';
      if (typeof data.fornecedor === 'object' && data.fornecedor !== null) {
        supplierName = data.fornecedor.razao_social || data.fornecedor.nome || data.fornecedor.name || '';
        supplierCnpj = data.fornecedor.cnpj || supplierCnpj;
      } else if (typeof data.fornecedor === 'string') {
        supplierName = data.fornecedor;
      }

      const mappedReviewItems = data.itens.map((item: any, idx: number) => {
        const itemQty = parseFloat(item.quantidade ?? item.quantity) || 0;
        const itemPrice = parseFloat(item.valor_unitario ?? item.unit_price ?? item.unitPrice) || 0;
        const rawCode = item.codigo_item || item.num_item || item.id || `0000${idx + 1}`;
        return {
          id: String(rawCode).padStart(5, '0'),
          name: item.descricao || item.name || `Item ${idx + 1}`,
          unit: item.unidade || item.unit || 'un',
          quantity: itemQty,
          unitPrice: itemPrice,
          received: 0,
        };
      });

      const parsedEmpenho = {
        id: String(data.numero_empenho).toUpperCase().trim(),
        supplier: supplierName,
        cnpj: supplierCnpj,
        description: data.descricao_sumaria || data.descricao || (data.tipo_empenho ? `Empenho ${data.tipo_empenho}` : 'Insumos e Suprimentos'),
        date: formattedDate,
        status: 'Ativo',
        items: mappedReviewItems,
        pregao: data.pregao_relacionado || data.pregao || '',
        classification: data.classificacao || 'QR',
        valorTotalDeclarado: parseFloat(data.valor_total || data.valorTotal) || null,
      };

      setReviewEmpenho(parsedEmpenho);
      setJsonError(null);
    } catch (error: any) {
      setJsonError('O texto colado não é um JSON válido. Verifique se copiou o conteúdo completo gerado pela IA. Erro: ' + error.message);
    }
  };

  // Save the reviewed empenho from JSON
  const handleSaveReviewEmpenho = async () => {
    if (!reviewEmpenho) return;
    if (!reviewEmpenho.id || !reviewEmpenho.supplier || !reviewEmpenho.description) {
      showToast('Por favor, preencha número, fornecedor e descrição do empenho.', 'error');
      return;
    }

    if (empenhos.some(emp => emp.id.toUpperCase() === reviewEmpenho.id.toUpperCase())) {
      showToast('Já existe uma Nota de Empenho com este número.', 'error');
      return;
    }

    const finalEmp: Empenho = {
      id: reviewEmpenho.id.toUpperCase(),
      supplier: reviewEmpenho.supplier,
      description: reviewEmpenho.description,
      date: reviewEmpenho.date,
      status: 'Ativo',
      items: reviewEmpenho.items,
      pregao: reviewEmpenho.pregao || 'Sem Pregão',
      classification: reviewEmpenho.classification || 'QR',
    };

    const updatedEmpenhos = [finalEmp, ...empenhos];
    setEmpenhos(updatedEmpenhos);

    if (user) {
      try {
        await saveEmpenho(user.uid, finalEmp);
      } catch (error) {
        showToast('Erro ao salvar no Firebase', 'error');
      }
    }

    showToast(`Empenho ${finalEmp.id} cadastrado com sucesso! ${finalEmp.items.length} itens importados.`, 'success');
    
    // Clean states
    setReviewEmpenho(null);
    setJsonInput('');
    setJsonError(null);
    setShowConfirmSaveModal(false);
    setShowNewEmpenhoModal(false);

    // Redirect to Detail view of this imported empenho
    setEditingEmpenhoId(finalEmp.id);
    setSelectedEmpenhoDetailId(finalEmp.id);
    setActiveTab('empenhos');
  };

  // Handler to add item to the editing commitment
  const handleAddItemToEmpenho = async () => {
    if (!newItemForm.name || !newItemForm.quantity || !newItemForm.unitPrice) {
      showToast('Por favor, preencha todos os campos do item.', 'error');
      return;
    }

    const qty = parseFloat(newItemForm.quantity);
    const price = parseFloat(newItemForm.unitPrice);

    if (qty <= 0 || price <= 0) {
      showToast('Quantidade e valor devem ser maiores que zero.', 'error');
      return;
    }

    let updatedTargetEmp: Empenho | null = null;
    const updatedEmpenhos = empenhos.map(emp => {
      if (emp.id === editingEmpenhoId) {
        // Generate a simple unique ID for item if needed
        const itemId = `ITEM-${Math.floor(Math.random() * 10000)}`;
        const newItem: Item = {
          id: itemId,
          name: newItemForm.name,
          unit: newItemForm.unit,
          quantity: qty,
          unitPrice: price,
          received: 0,
        };
        updatedTargetEmp = {
          ...emp,
          items: [...emp.items, newItem],
        };
        return updatedTargetEmp;
      }
      return emp;
    });

    setEmpenhos(updatedEmpenhos);

    if (user && updatedTargetEmp) {
      try {
        await saveEmpenho(user.uid, updatedTargetEmp);
      } catch (error) {
        showToast('Erro ao salvar no Firebase', 'error');
      }
    }

    showToast('Item adicionado ao empenho com sucesso!');

    // Reset item form
    setNewItemForm({
      id: `0000${Math.floor(Math.random() * 10) + 5}`,
      name: '',
      unit: 'kg',
      quantity: '',
      unitPrice: '',
    });
  };

  // Delete item from editing commitment
  const handleDeleteItemFromEmpenho = async (itemId: string) => {
    let updatedTargetEmp: Empenho | null = null;
    const updatedEmpenhos = empenhos.map(emp => {
      if (emp.id === editingEmpenhoId) {
        updatedTargetEmp = {
          ...emp,
          items: emp.items.filter(item => item.id !== itemId),
        };
        return updatedTargetEmp;
      }
      return emp;
    });

    setEmpenhos(updatedEmpenhos);

    if (user && updatedTargetEmp) {
      try {
        await saveEmpenho(user.uid, updatedTargetEmp);
      } catch (error) {
        showToast('Erro ao salvar no Firebase', 'error');
      }
    }

    showToast('Item excluído do empenho.', 'info');
  };

  // Finish editing commitment
  const handleFinishEmpenhoRegistry = async () => {
    const target = empenhos.find(e => e.id === editingEmpenhoId);
    if (!target || target.items.length === 0) {
      showToast('Por favor, adicione pelo menos um item antes de finalizar.', 'error');
      return;
    }

    // Add alert notification about the new commitment
    const newAlert: Alert = {
      id: `alt-${Date.now()}`,
      type: 'ATENÇÃO',
      title: `Novo Empenho Cadastrado: ${target.id}`,
      subtitle: `Fornecedor: ${target.supplier}`,
      description: `Aguardando faturamento de ${target.items.length} itens cadastrados no valor de R$ ${target.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
      date: 'Agora',
    };

    setAlerts([newAlert, ...alerts]);

    if (user) {
      try {
        await saveAlert(user.uid, newAlert);
      } catch (error) {
        showToast('Erro ao salvar no Firebase', 'error');
      }
    }

    showToast(`Cadastro do Empenho ${editingEmpenhoId} finalizado com sucesso!`);
    setActiveTab('empenhos');
  };

  // Save or Edit registered Invoice ("Salvar Recebimento")
  const handleSaveInvoice = async () => {
    // 1. Revert effect of editingInvoice on empenhos first if in edit mode
    let baseEmpenhos = empenhos;
    if (editingInvoice) {
      baseEmpenhos = empenhos.map(emp => {
        if (emp.id === editingInvoice.empenhoId) {
          const revertedItems = emp.items.map(item => {
            const oldQty = editingInvoice.items.find(it => it.itemId === item.id)?.quantity || 0;
            return {
              ...item,
              received: Math.max(0, item.received - oldQty),
            };
          });
          const allFullyReceived = revertedItems.every(i => i.received >= i.quantity);
          return {
            ...emp,
            items: revertedItems,
            status: (allFullyReceived ? 'Encerrado' : 'Ativo') as any,
          };
        }
        return emp;
      });
    }

    const targetEmpenho = baseEmpenhos.find(e => e.id === selectedNFCommitmentId);
    if (!targetEmpenho) {
      showToast('Selecione um empenho válido.', 'error');
      return;
    }

    if (!nfNumber.trim()) {
      showToast('Por favor, insira o número da Nota Fiscal.', 'error');
      return;
    }

    const cleanNfNum = nfNumber.trim();
    if (!editingInvoice && invoices.some(inv => inv.id.trim() === cleanNfNum)) {
      showToast(`A Nota Fiscal nº ${cleanNfNum} já está cadastrada no sistema! Utilize o botão de edição na lista de notas para alterá-la.`, 'error');
      return;
    }

    // Validate quantities entered
    const enteredItems: InvoiceItem[] = [];
    let isAnyQtyEntered = false;
    let isExceeded = false;
    let exceededItemName = '';

    targetEmpenho.items.forEach(item => {
      const qtyEntered = nfQuantities[item.id] || 0;
      if (qtyEntered > 0) {
        isAnyQtyEntered = true;
        const availableBalance = item.quantity - item.received;
        if (qtyEntered > availableBalance) {
          isExceeded = true;
          exceededItemName = item.name;
        }

        enteredItems.push({
          itemId: item.id,
          quantity: qtyEntered,
          unitPrice: item.unitPrice,
          subtotal: qtyEntered * item.unitPrice,
        });
      }
    });

    if (!isAnyQtyEntered) {
      showToast('Por favor, insira a quantidade para pelo menos um item da NF.', 'error');
      return;
    }

    if (isExceeded) {
      showToast(`A quantidade inserida para "${exceededItemName}" excede o saldo disponível do empenho!`, 'error');
      return;
    }

    // Process & update database state
    const invoiceTotal = enteredItems.reduce((sum, item) => sum + item.subtotal, 0);

    const invoiceToSave: Invoice = {
      id: nfNumber,
      empenhoId: selectedNFCommitmentId,
      supplier: targetEmpenho.supplier,
      issueDate: nfDate,
      items: enteredItems,
      totalValue: invoiceTotal,
      registeredAt: editingInvoice?.registeredAt || new Date().toISOString(),
      ...(editingInvoice?.termoEmissaoDate ? { termoEmissaoDate: editingInvoice.termoEmissaoDate } : {}),
      ...(editingInvoice?.comissaoDate ? { comissaoDate: editingInvoice.comissaoDate } : {}),
      ...(editingInvoice?.tesourariaDate ? { tesourariaDate: editingInvoice.tesourariaDate } : {}),
      ...(editingInvoice?.termoNumero ? { termoNumero: editingInvoice.termoNumero } : {}),
    };

    // Update received quantities in empenhos (applying the new invoice quantities)
    let updatedTargetEmpenho: Empenho | null = null;
    const updatedEmpenhos = baseEmpenhos.map(emp => {
      if (emp.id === selectedNFCommitmentId) {
        const updatedItems = emp.items.map(item => {
          const qtyEntered = nfQuantities[item.id] || 0;
          return {
            ...item,
            received: item.received + qtyEntered,
          };
        });

        // Determine if all items are fully received
        const allFullyReceived = updatedItems.every(i => i.received >= i.quantity);
        updatedTargetEmpenho = {
          ...emp,
          items: updatedItems,
          status: (allFullyReceived ? 'Encerrado' : 'Ativo') as any,
          lastNFDaysAgo: 0,
        };
        return updatedTargetEmpenho;
      }
      return emp;
    });

    // Create a warning/success notification alert
    const newAlert: Alert = {
      id: `alt-${Date.now()}`,
      type: 'ATENÇÃO',
      title: editingInvoice 
        ? `NF ${nfNumber} editada com sucesso!`
        : `NF ${nfNumber} recebida com sucesso!`,
      subtitle: `Fornecedor: ${targetEmpenho.supplier}`,
      description: `Conciliação realizada para o Empenho ${selectedNFCommitmentId}. Valor: R$ ${invoiceTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
      date: 'Agora',
    };

    // Update invoices array
    let updatedInvoices: Invoice[];
    if (editingInvoice) {
      // If the ID (invoice number) changed, remove old and insert new. Otherwise, replace in-place
      if (editingInvoice.id !== nfNumber) {
        updatedInvoices = [invoiceToSave, ...invoices.filter(inv => inv.id !== editingInvoice.id)];
      } else {
        updatedInvoices = invoices.map(inv => inv.id === editingInvoice.id ? invoiceToSave : inv);
      }
    } else {
      updatedInvoices = [invoiceToSave, ...invoices];
    }

    const updatedAlerts = [newAlert, ...alerts];

    setEmpenhos(updatedEmpenhos);
    setInvoices(updatedInvoices);
    setAlerts(updatedAlerts);

    if (user) {
      try {
        const promises: Promise<any>[] = [
          // 1. Save the new or updated target empenho
          updatedTargetEmpenho ? saveEmpenho(user.uid, updatedTargetEmpenho) : Promise.resolve(),
          
          // 2. Save the saved invoice
          saveInvoice(user.uid, invoiceToSave),
          
          // 3. Save the new alert
          saveAlert(user.uid, newAlert)
        ];

        // If the old empenho was different and it got reverted, save it too!
        if (editingInvoice && editingInvoice.empenhoId !== selectedNFCommitmentId) {
          const oldEmpenhoAdjusted = updatedEmpenhos.find(e => e.id === editingInvoice.empenhoId);
          if (oldEmpenhoAdjusted) {
            promises.push(saveEmpenho(user.uid, oldEmpenhoAdjusted));
          }
        }

        // If we edited and changed the invoice number, delete the old document
        if (editingInvoice && editingInvoice.id !== nfNumber) {
          promises.push(removeInvoice(user.uid, editingInvoice.id));
        }

        await Promise.all(promises);
      } catch (error) {
        showToast('Erro ao sincronizar com o Firebase', 'error');
      }
    }

    showToast(editingInvoice 
      ? `Recebimento da NF nº ${nfNumber} editado com sucesso!`
      : `Recebimento da NF nº ${nfNumber} salvo com sucesso!`
    );
    
    // Reset form fields and editing status
    setNfNumber('');
    setNfQuantities({});
    setEditingInvoice(null);
    
    // Redirect to accompanying subtab of Notas Fiscais
    setNfSubTab('acompanhar');
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setSelectedNFCommitmentId(invoice.empenhoId);
    setNfNumber(invoice.id);
    if (invoice.issueDate) {
      setNfDate(invoice.issueDate);
    }
    
    // Populate quantities
    const initialQuantities: { [itemId: string]: number } = {};
    invoice.items.forEach(item => {
      initialQuantities[item.itemId] = item.quantity;
    });
    setNfQuantities(initialQuantities);
    
    // Redirect to register subtab
    setNfSubTab('cadastrar');
    showToast(`Editando Nota Fiscal nº ${invoice.id}. Insira as novas quantidades e salve.`, 'info');
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    if (!confirm(`Tem certeza que deseja excluir a Nota Fiscal nº ${invoice.id}? Esta ação reverterá as quantidades recebidas no empenho.`)) {
      return;
    }

    // Undone/revert the invoice's quantities in the related empenho
    let updatedTargetEmpenho: Empenho | null = null;
    const updatedEmpenhos = empenhos.map(emp => {
      if (emp.id === invoice.empenhoId) {
        const updatedItems = emp.items.map(item => {
          const oldQty = invoice.items.find(it => it.itemId === item.id)?.quantity || 0;
          return {
            ...item,
            received: Math.max(0, item.received - oldQty),
          };
        });
        const allFullyReceived = updatedItems.every(i => i.received >= i.quantity);
        updatedTargetEmpenho = {
          ...emp,
          items: updatedItems,
          status: (allFullyReceived ? 'Encerrado' : 'Ativo') as any,
          lastNFDaysAgo: 1,
        };
        return updatedTargetEmpenho;
      }
      return emp;
    });

    const updatedInvoices = invoices.filter(inv => inv.id !== invoice.id);
    setEmpenhos(updatedEmpenhos);
    setInvoices(updatedInvoices);

    if (user) {
      try {
        await Promise.all([
          updatedTargetEmpenho ? saveEmpenho(user.uid, updatedTargetEmpenho) : Promise.resolve(),
          removeInvoice(user.uid, invoice.id),
        ]);
        showToast(`Nota Fiscal nº ${invoice.id} excluída com sucesso!`, 'info');
      } catch (error) {
        showToast('Erro ao remover no Firebase', 'error');
      }
    } else {
      showToast(`Nota Fiscal nº ${invoice.id} excluída com sucesso!`, 'info');
    }
  };

  const handleDeleteAllInvoices = async () => {
    if (invoices.length === 0) {
      showToast('Não há Notas Fiscais para apagar.', 'info');
      return;
    }
    if (!confirm('Deseja realmente apagar TODAS as Notas Fiscais cadastradas? Esta ação reverterá as quantidades recebidas em todos os empenhos.')) {
      return;
    }

    // Revert received quantities for all invoices we are deleting
    let updatedEmpenhos = [...empenhos];
    for (const invoice of invoices) {
      updatedEmpenhos = updatedEmpenhos.map(emp => {
        if (emp.id === invoice.empenhoId) {
          const updatedItems = emp.items.map(item => {
            const oldQty = invoice.items.find(it => it.itemId === item.id)?.quantity || 0;
            return {
              ...item,
              received: Math.max(0, item.received - oldQty),
            };
          });
          const allFullyReceived = updatedItems.every(i => i.received >= i.quantity);
          return {
            ...emp,
            items: updatedItems,
            status: (allFullyReceived ? 'Encerrado' : 'Ativo') as any,
          };
        }
        return emp;
      });
    }

    setEmpenhos(updatedEmpenhos);
    setInvoices([]);

    if (user) {
      try {
        const promises = [
          ...updatedEmpenhos.map(emp => saveEmpenho(user.uid, emp)),
          ...invoices.map(inv => removeInvoice(user.uid, inv.id))
        ];
        await Promise.all(promises);
        showToast('Todas as Notas Fiscais foram apagadas com sucesso!', 'info');
      } catch (error) {
        showToast('Erro ao remover no Firebase', 'error');
      }
    } else {
      showToast('Todas as Notas Fiscais foram apagadas com sucesso!', 'info');
    }
  };

  const handleDeleteAllComissoes = async () => {
    if (comissoes.length === 0) {
      showToast('Não há Comissões para apagar.', 'info');
      return;
    }
    if (!confirm('Deseja realmente apagar TODAS as Comissões de Recebimento cadastradas?')) {
      return;
    }

    setComissoes([]);

    if (user) {
      try {
        const promises = comissoes.map(com => removeComissao(user.uid, com.id));
        await Promise.all(promises);
        showToast('Todas as Comissões foram apagadas com sucesso!', 'info');
      } catch (error) {
        showToast('Erro ao remover no Firebase', 'error');
      }
    } else {
      showToast('Todas as Comissões foram apagadas com sucesso!', 'info');
    }
  };

  const handleDeleteSpecificEmpenho = async (id: string) => {
    if (!id) return;
    setIsDeletingEmpenho(true);
    try {
      // 1. Remove from local state
      setEmpenhos(prev => prev.filter(e => e.id !== id));
      
      // 2. Also remove alerts and invoices associated with this empenho if any
      const associatedInvoices = invoices.filter(inv => inv.commitmentId === id);
      const associatedAlerts = alerts.filter(a => a.empenhoId === id);
      setInvoices(prev => prev.filter(inv => inv.commitmentId !== id));
      setAlerts(prev => prev.filter(a => a.empenhoId !== id));

      // 3. Remove from Firebase if user is logged in
      if (user) {
        await removeEmpenho(user.uid, id);
        await Promise.all([
          ...associatedInvoices.map(inv => removeInvoice(user.uid, inv.id)),
          ...associatedAlerts.map(a => removeAlert(user.uid, a.id))
        ]);
      }

      showToast(`Empenho ${id} excluído com sucesso!`, 'info');
      setEmpenhoToDelete(null);
      if (activeTab === 'itens_empenho') {
        setActiveTab('empenhos');
      }
    } catch (error) {
      console.error('Erro ao excluir empenho:', error);
      showToast('Erro ao excluir o empenho.', 'error');
    } finally {
      setIsDeletingEmpenho(false);
    }
  };

  const handleMarkComissao = async (invoiceId: string) => {
    let updatedTargetInvoice: Invoice | null = null;
    const updatedInvoices = invoices.map(inv => {
      if (inv.id === invoiceId) {
        updatedTargetInvoice = {
          ...inv,
          comissaoDate: new Date().toISOString(),
        };
        return updatedTargetInvoice;
      }
      return inv;
    });

    setInvoices(updatedInvoices);

    if (user && updatedTargetInvoice) {
      try {
        await saveInvoice(user.uid, updatedTargetInvoice);
      } catch (error) {
        showToast('Erro ao salvar no Firebase', 'error');
      }
    }

    showToast(`Nota Fiscal ${invoiceId} enviada para a Comissão de Recebimento!`);
  };

  const handleMarkTesouraria = async (invoiceId: string) => {
    let updatedTargetInvoice: Invoice | null = null;
    const updatedInvoices = invoices.map(inv => {
      if (inv.id === invoiceId) {
        updatedTargetInvoice = {
          ...inv,
          tesourariaDate: new Date().toISOString(),
        };
        return updatedTargetInvoice;
      }
      return inv;
    });

    setInvoices(updatedInvoices);

    if (user && updatedTargetInvoice) {
      try {
        await saveInvoice(user.uid, updatedTargetInvoice);
      } catch (error) {
        showToast('Erro ao salvar no Firebase', 'error');
      }
    }

    showToast(`Nota Fiscal ${invoiceId} finalizada e enviada para o Setor de Tesouraria!`);
  };

  const handleSaveNumeroNS = async (invoiceId: string, value: string) => {
    const trimmed = value.trim();
    let updatedTargetInvoice: Invoice | null = null;
    const updatedInvoices = invoices.map(inv => {
      if (inv.id === invoiceId) {
        updatedTargetInvoice = {
          ...inv,
          numeroNS: trimmed ? trimmed : undefined,
        };
        return updatedTargetInvoice;
      }
      return inv;
    });

    setInvoices(updatedInvoices);
    setEditingNSId(null);
    setTempNSValue('');

    if (user && updatedTargetInvoice) {
      try {
        await saveInvoice(user.uid, updatedTargetInvoice);
      } catch (error) {
        console.error(error);
        showToast('Erro ao salvar Número da NS no Firebase', 'error');
        return;
      }
    }

    showToast(
      trimmed 
        ? `Número da NS (${trimmed}) salvo para a NF ${invoiceId}!` 
        : `Número da NS removido da NF ${invoiceId}!`,
      'success'
    );
  };

  const handleSaveComissao = async () => {
    if (!comissaoBoletimNum) {
      showToast('Por favor, informe o número do Boletim Interno.', 'error');
      return;
    }
    if (!comissaoBoletimDate) {
      showToast('Por favor, informe a data do Boletim Interno.', 'error');
      return;
    }
    if (!comissaoPresNome) {
      showToast('Por favor, preencha o nome do Presidente.', 'error');
      return;
    }
    if (!comissaoAux1Nome || !comissaoAux2Nome || !comissaoAux3Nome) {
      showToast('Por favor, preencha o nome de todos os três auxiliares.', 'error');
      return;
    }

    const exists = comissoes.some(c => c.mesReferencia === comissaoMes);
    if (exists) {
      showToast(`Já existe uma comissão cadastrada para o mês ${comissaoMes}.`, 'error');
      return;
    }

    const newComissao: Comissao = {
      id: `com-${Date.now()}`,
      mesReferencia: comissaoMes,
      boletimNumero: comissaoBoletimNum,
      boletimData: comissaoBoletimDate,
      presidente: {
        postoGraduacao: comissaoPresPosto,
        nomeCompleto: comissaoPresNome,
      },
      auxiliares: [
        { postoGraduacao: comissaoAux1Posto, nomeCompleto: comissaoAux1Nome },
        { postoGraduacao: comissaoAux2Posto, nomeCompleto: comissaoAux2Nome },
        { postoGraduacao: comissaoAux3Posto, nomeCompleto: comissaoAux3Nome },
      ],
    };

    const updatedComissoes = [newComissao, ...comissoes];
    setComissoes(updatedComissoes);

    if (user) {
      try {
        await saveComissao(user.uid, newComissao);
      } catch (error) {
        showToast('Erro ao salvar comissão no Firebase', 'error');
      }
    }

    showToast(`Comissão de Recebimento de ${comissaoMes} cadastrada com sucesso!`);

    // Reset name fields and bulletin fields
    setComissaoBoletimNum('');
    setComissaoBoletimDate('');
    setComissaoPresNome('');
    setComissaoAux1Nome('');
    setComissaoAux2Nome('');
    setComissaoAux3Nome('');
  };

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
            <div id="view-cronogramas" className="w-full max-w-7xl mx-auto space-y-6 pb-24">
              
              {/* CASE 1: LIST OF EMPENHOS FOR CRONOGRAMAS */}
              {selectedCronogramaEmpenhoId === null ? (
                <div className="space-y-6">
                  
                  {/* Header Title & Subtitle */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-6 rounded-2xl border border-white/30 shadow-sm">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#00288e]/10 flex items-center justify-center text-[#00288e]">
                          <CalendarDays className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black tracking-tight text-[#0b1c30]">
                            Cronogramas de Entrega
                          </h2>
                          <p className="text-xs text-gray-500 font-medium mt-0.5">
                            Planejamento e simulação física de entregas com base no saldo atualizado dos itens de cada empenho para envio às empresas fornecedoras.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Search and Filters Bar */}
                  <div className="bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-sm space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      
                      {/* Search Bar */}
                      <div className="md:col-span-6 relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Buscar por número do empenho, fornecedor ou objeto..."
                          value={cronogramasSearch}
                          onChange={(e) => setCronogramasSearch(e.target.value)}
                          className="w-full h-11 pl-10 pr-4 bg-white/80 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e] transition-all"
                        />
                        {cronogramasSearch && (
                          <button
                            onClick={() => setCronogramasSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Filter: Pregão */}
                      <div className="md:col-span-2">
                        <select
                          value={cronogramasPregaoFilter}
                          onChange={(e) => setCronogramasPregaoFilter(e.target.value)}
                          className="w-full h-11 px-3 bg-white/80 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e] transition-all cursor-pointer"
                        >
                          <option value="Todos">Todos os Pregões</option>
                          {uniquePregaos.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>

                      {/* Filter: Ano */}
                      <div className="md:col-span-2">
                        <select
                          value={cronogramasYearFilter}
                          onChange={(e) => setCronogramasYearFilter(e.target.value)}
                          className="w-full h-11 px-3 bg-white/80 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e] transition-all cursor-pointer"
                        >
                          <option value="Todos">Todos os Anos</option>
                          {uniqueEmpenhoYears.map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>

                      {/* Filter: Classe */}
                      <div className="md:col-span-2">
                        <select
                          value={cronogramasClassFilter}
                          onChange={(e) => setCronogramasClassFilter(e.target.value)}
                          className="w-full h-11 px-3 bg-white/80 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e] transition-all cursor-pointer"
                        >
                          <option value="Todos">Todas as Classes</option>
                          <option value="QR">QR - Ração Operacional</option>
                          <option value="CALI">CALI - Alimentos</option>
                          <option value="PASA">PASA - Apoio de Saúde</option>
                        </select>
                      </div>

                    </div>

                    {/* Status Filter Chips */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2 flex items-center gap-1">
                        <Filter className="w-3.5 h-3.5" /> Status do Saldo:
                      </span>
                      {[
                        { id: 'Todos', label: 'Todos os Empenhos' },
                        { id: 'Com Saldo', label: 'Com Saldo Disponível' },
                        { id: 'Ativos', label: 'Ativos' },
                        { id: 'Encerrados', label: 'Encerrados / 100% Entregues' },
                      ].map((chip) => (
                        <button
                          key={chip.id}
                          onClick={() => setCronogramasStatusFilter(chip.id as any)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                            cronogramasStatusFilter === chip.id
                              ? 'bg-[#00288e] text-white shadow-sm'
                              : 'bg-white/80 text-gray-600 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Empenhos Grid for Cronogramas */}
                  {(() => {
                    const filtered = empenhos.filter(emp => {
                      // Text search
                      const matchesSearch = 
                        emp.id.toLowerCase().includes(cronogramasSearch.toLowerCase()) ||
                        emp.supplier.toLowerCase().includes(cronogramasSearch.toLowerCase()) ||
                        emp.description.toLowerCase().includes(cronogramasSearch.toLowerCase());
                      if (!matchesSearch) return false;

                      // Pregão filter
                      if (cronogramasPregaoFilter !== 'Todos' && emp.pregao !== cronogramasPregaoFilter) {
                        return false;
                      }

                      // Year filter
                      if (cronogramasYearFilter !== 'Todos') {
                        let empYear = '';
                        if (emp.date) {
                          const parts = emp.date.split('/');
                          if (parts.length === 3) empYear = parts[2];
                          else if (emp.date.includes('-')) empYear = emp.date.split('-')[0];
                        }
                        if (empYear !== cronogramasYearFilter) return false;
                      }

                      // Class filter
                      if (cronogramasClassFilter !== 'Todos' && emp.classification !== cronogramasClassFilter) {
                        return false;
                      }

                      // Status filter
                      const totalCommitted = emp.items.reduce((s, it) => s + (it.quantity * it.unitPrice), 0);
                      const totalReceived = emp.items.reduce((s, it) => s + (it.received * it.unitPrice), 0);
                      const saldo = Math.max(0, totalCommitted - totalReceived);

                      if (cronogramasStatusFilter === 'Com Saldo' && saldo <= 0) return false;
                      if (cronogramasStatusFilter === 'Ativos' && emp.status !== 'Ativo') return false;
                      if (cronogramasStatusFilter === 'Encerrados' && emp.status !== 'Encerrado' && saldo > 0) return false;

                      return true;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/20 p-12 text-center space-y-3">
                          <Package className="w-12 h-12 text-gray-300 mx-auto" />
                          <h3 className="text-base font-bold text-gray-700">Nenhum empenho encontrado com os filtros selecionados</h3>
                          <p className="text-xs text-gray-500">Tente ajustar seus termos de busca ou filtros acima.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {filtered.map(emp => {
                          const totalCommitted = emp.items.reduce((s, it) => s + (it.quantity * it.unitPrice), 0);
                          const totalReceived = emp.items.reduce((s, it) => s + (it.received * it.unitPrice), 0);
                          const saldoDisponivel = Math.max(0, totalCommitted - totalReceived);
                          const percentExecuted = totalCommitted > 0 ? Math.min(100, Math.round((totalReceived / totalCommitted) * 100)) : 0;
                          const itemsComSaldo = emp.items.filter(it => (it.quantity - it.received) > 0).length;
                          const savedCrono = cronogramas.find(c => c.empenhoId === emp.id);

                          return (
                            <div 
                              key={emp.id}
                              className="bg-white/80 hover:bg-white backdrop-blur-md rounded-2xl border border-white/40 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                            >
                              {/* Card Header */}
                              <div className="p-5 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="px-2.5 py-1 bg-[#00288e]/10 text-[#00288e] font-extrabold text-xs rounded-lg tracking-wider">
                                        NE {emp.id}
                                      </span>
                                      {emp.classification && (
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider ${
                                          emp.classification === 'QR' ? 'bg-amber-100 text-amber-800' :
                                          emp.classification === 'CALI' ? 'bg-emerald-100 text-emerald-800' :
                                          'bg-purple-100 text-purple-800'
                                        }`}>
                                          {emp.classification}
                                        </span>
                                      )}
                                    </div>
                                    <h4 className="font-extrabold text-sm text-[#0b1c30] mt-2 line-clamp-1 group-hover:text-[#00288e] transition-colors">
                                      {emp.supplier}
                                    </h4>
                                  </div>

                                  {savedCrono ? (
                                    <span className="px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded-lg flex items-center gap-1 shrink-0">
                                      <CheckCircle2 className="w-3 h-3" /> Configurado
                                    </span>
                                  ) : (
                                    <span className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-lg shrink-0">
                                      Pendente
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                  {emp.description}
                                </p>

                                {/* Meta details */}
                                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                                  <span>Pregão: <strong className="text-gray-700">{emp.pregao || '—'}</strong></span>
                                  <span>Emissão: <strong className="text-gray-700">{formatDateOnly(emp.date)}</strong></span>
                                </div>

                                {/* Progress Bar */}
                                <div className="space-y-1.5 pt-2">
                                  <div className="flex justify-between text-[11px] font-semibold">
                                    <span className="text-gray-500">Execução:</span>
                                    <span className={percentExecuted === 100 ? 'text-emerald-600 font-bold' : 'text-[#00288e] font-bold'}>
                                      {percentExecuted}% entregue
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        percentExecuted === 100 ? 'bg-emerald-500' : 'bg-[#00288e]'
                                      }`}
                                      style={{ width: `${percentExecuted}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Financial Metrics Grid */}
                                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 text-center">
                                  <div className="bg-gray-50 p-2 rounded-xl">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Empenhado</span>
                                    <span className="text-xs font-bold text-gray-800">
                                      R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </span>
                                  </div>
                                  <div className="bg-gray-50 p-2 rounded-xl">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Recebido</span>
                                    <span className="text-xs font-bold text-gray-700">
                                      R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </span>
                                  </div>
                                  <div className={`p-2 rounded-xl ${saldoDisponivel > 0 ? 'bg-emerald-50/70 border border-emerald-100' : 'bg-gray-50'}`}>
                                    <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider block">Saldo Disp.</span>
                                    <span className={`text-xs font-extrabold ${saldoDisponivel > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                                      R$ {saldoDisponivel.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </span>
                                  </div>
                                </div>

                                {/* Items count badge */}
                                <div className="text-[11px] text-gray-500 flex items-center justify-between">
                                  <span>Total de itens: <strong>{emp.items.length}</strong></span>
                                  <span className="text-emerald-700 font-semibold">{itemsComSaldo} com saldo a entregar</span>
                                </div>
                              </div>

                              {/* Card Footer Actions */}
                              <div className="p-3 bg-gray-50/70 border-t border-gray-100 flex items-center gap-2">
                                <button
                                  onClick={() => handleSelectEmpenhoForCronograma(emp.id)}
                                  className="flex-1 py-2.5 px-4 bg-[#00288e] hover:bg-[#001e6a] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
                                >
                                  <CalendarDays className="w-4 h-4" />
                                  {savedCrono ? 'Editar Cronograma' : 'Gerar Cronograma'}
                                </button>
                                {savedCrono && (
                                  <button
                                    onClick={() => handleGenerateCronogramaPDF(emp, 'print')}
                                    title="Imprimir PDF Rápido"
                                    className="p-2.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl transition-all cursor-pointer active:scale-95"
                                  >
                                    <Printer className="w-4 h-4 text-[#00288e]" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                </div>
              ) : (
                /* CASE 2: DETAIL / CRONOGRAMA SIMULATION & GENERATION VIEW */
                (() => {
                  const targetEmp = empenhos.find(e => e.id === selectedCronogramaEmpenhoId);
                  if (!targetEmp) return null;

                  const totalCommitted = targetEmp.items.reduce((s, it) => s + (it.quantity * it.unitPrice), 0);
                  const totalReceived = targetEmp.items.reduce((s, it) => s + (it.received * it.unitPrice), 0);
                  const saldoDisponivelTotal = Math.max(0, totalCommitted - totalReceived);

                  // Total programado na simulação
                  const totalProgramadoGeral = targetEmp.items.reduce((acc, it) => {
                    const qProgramada = cronogramaColunas.reduce((sum, col) => sum + (Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0), 0);
                    return acc + (qProgramada * it.unitPrice);
                  }, 0);

                  const saldoRestanteNaoProgramado = saldoDisponivelTotal - totalProgramadoGeral;
                  const percentualCobertura = saldoDisponivelTotal > 0 ? Math.round((totalProgramadoGeral / saldoDisponivelTotal) * 100) : 0;

                  return (
                    <div className="space-y-6">

                      {/* Top Action Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-white/30 shadow-sm">
                        <button
                          onClick={() => setSelectedCronogramaEmpenhoId(null)}
                          className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-[#00288e] transition-colors cursor-pointer"
                        >
                          <ArrowLeft className="w-4 h-4" /> Voltar para Lista de Cronogramas
                        </button>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => setShowCronogramaPreviewModal(true)}
                            className="px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                          >
                            <Eye className="w-4 h-4 text-blue-600" /> Prévia do Documento
                          </button>
                          <button
                            onClick={() => handleGenerateCronogramaPDF(targetEmp, 'print')}
                            className="px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                          >
                            <Printer className="w-4 h-4 text-emerald-600" /> Imprimir
                          </button>
                          <button
                            onClick={() => handleGenerateCronogramaPDF(targetEmp, 'download')}
                            className="px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                          >
                            <Download className="w-4 h-4 text-purple-600" /> Baixar PDF
                          </button>
                          <button
                            onClick={handleSaveCronograma}
                            disabled={isSavingCronograma}
                            className="px-4 py-2 bg-[#00288e] hover:bg-[#001e6a] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                          >
                            {isSavingCronograma ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" /> Salvar Cronograma
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Header Card with Empenho Details & Simulation Notice */}
                      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/40 p-6 shadow-sm space-y-5">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-3 py-1 bg-[#00288e] text-white font-extrabold text-sm rounded-xl tracking-wider shadow-sm">
                                NE {targetEmp.id}
                              </span>
                              {targetEmp.pregao && (
                                <span className="px-2.5 py-1 bg-blue-50 text-blue-800 font-bold text-xs rounded-lg border border-blue-100">
                                  Pregão: {targetEmp.pregao}
                                </span>
                              )}
                              {targetEmp.classification && (
                                <span className="px-2.5 py-1 bg-amber-50 text-amber-800 font-bold text-xs rounded-lg border border-amber-100">
                                  Classe: {targetEmp.classification}
                                </span>
                              )}
                              <span className="px-2.5 py-1 bg-gray-100 text-gray-600 font-medium text-xs rounded-lg">
                                Emissão: {formatDateOnly(targetEmp.date)}
                              </span>
                            </div>

                            <h3 className="text-xl font-extrabold text-[#0b1c30]">
                              {targetEmp.supplier}
                            </h3>
                            <p className="text-xs text-gray-600 leading-relaxed max-w-4xl">
                              {targetEmp.description}
                            </p>
                          </div>
                        </div>

                        {/* Official Simulation Warning */}
                        <div className="bg-amber-50/80 border border-amber-200 text-amber-900 rounded-xl p-3.5 flex items-start gap-3 text-xs leading-relaxed">
                          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <strong>Simulação Operacional de Cronograma:</strong> A geração ou alteração deste cronograma é uma projeção física para envio à empresa fornecedora e <strong>NÃO altera o saldo oficial</strong> do empenho ou das notas fiscais. O saldo disponível abaixo é atualizado dinamicamente em tempo real conforme forem sendo cadastradas novas Notas Fiscais para este empenho.
                          </div>
                        </div>

                        {/* Financial Metrics Summary Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                          <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Saldo Total Disponível</span>
                            <span className="text-base font-extrabold text-slate-800">
                              R$ {saldoDisponivelTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="bg-blue-50/70 border border-blue-100 p-3.5 rounded-xl">
                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">Total no Cronograma</span>
                            <span className="text-base font-extrabold text-[#00288e]">
                              R$ {totalProgramadoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className={`p-3.5 rounded-xl border ${
                            saldoRestanteNaoProgramado === 0 
                              ? 'bg-emerald-50/70 border-emerald-100' 
                              : saldoRestanteNaoProgramado > 0 
                              ? 'bg-amber-50/70 border-amber-100' 
                              : 'bg-rose-50/70 border-rose-100'
                          }`}>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Saldo Restante</span>
                            <span className={`text-base font-extrabold ${
                              saldoRestanteNaoProgramado === 0 
                                ? 'text-emerald-700' 
                                : saldoRestanteNaoProgramado > 0 
                                ? 'text-amber-700' 
                                : 'text-rose-700'
                            }`}>
                              R$ {saldoRestanteNaoProgramado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="bg-purple-50/70 border border-purple-100 p-3.5 rounded-xl">
                            <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider block">Cobertura do Saldo</span>
                            <span className="text-base font-extrabold text-purple-800">
                              {percentualCobertura}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* SECTION 1: REMESSAS CONFIGURATION & PRESETS */}
                      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/40 p-6 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                          <div>
                            <h4 className="text-sm font-extrabold text-[#0b1c30] flex items-center gap-2">
                              <CalendarRange className="w-4 h-4 text-[#00288e]" /> 1. Configuração de Remessas e Datas de Entrega
                            </h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Defina o número de entregas parceladas e as datas estimadas para a empresa fornecedora.
                            </p>
                          </div>

                          {/* Quick Presets */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-bold text-gray-400 mr-1">Presets:</span>
                            <button
                              onClick={() => applyCronogramaPreset(1, 0)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            >
                              1x Única (100%)
                            </button>
                            <button
                              onClick={() => applyCronogramaPreset(2, 15)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            >
                              2x Quinzenais
                            </button>
                            <button
                              onClick={() => applyCronogramaPreset(3, 30)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            >
                              3x Mensais
                            </button>
                            <button
                              onClick={() => applyCronogramaPreset(4, 30)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            >
                              4x Mensais
                            </button>
                            <button
                              onClick={() => applyCronogramaPreset(6, 30)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            >
                              6x Mensais
                            </button>
                          </div>
                        </div>

                        {/* Remessas Cards Strip */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
                          {cronogramaColunas.map((col, index) => (
                            <div 
                              key={col.id}
                              className="bg-gray-50/90 border border-gray-200/80 rounded-xl p-3 space-y-2.5 relative group hover:border-[#00288e]/40 transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <input
                                  type="text"
                                  value={col.titulo}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCronogramaColunas(cronogramaColunas.map(c => c.id === col.id ? { ...c, titulo: val } : c));
                                  }}
                                  className="text-xs font-extrabold text-[#00288e] bg-transparent border-b border-transparent focus:border-[#00288e] focus:outline-none w-28"
                                />
                                {cronogramaColunas.length > 1 && (
                                  <button
                                    onClick={() => handleRemoveRemessa(col.id)}
                                    title="Remover Remessa"
                                    className="text-gray-400 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Data Prevista:</label>
                                <input
                                  type="date"
                                  value={col.dataPrevista}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCronogramaColunas(cronogramaColunas.map(c => c.id === col.id ? { ...c, dataPrevista: val } : c));
                                  }}
                                  className="w-full h-8 px-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#00288e]"
                                />
                              </div>
                            </div>
                          ))}

                          {/* Add Remessa Button Card */}
                          <button
                            onClick={handleAddRemessa}
                            className="h-full min-h-[92px] border-2 border-dashed border-gray-200 hover:border-[#00288e] rounded-xl p-3 flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-[#00288e] bg-white/40 hover:bg-blue-50/30 transition-all cursor-pointer group"
                          >
                            <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-bold">+ Adicionar Remessa</span>
                          </button>
                        </div>

                        {/* Quick Distribution Helpers */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
                          <span className="text-xs text-gray-500 font-medium">Ações automáticas para preenchimento:</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => applyCronogramaPreset(cronogramaColunas.length)}
                              className="px-3 py-1.5 bg-blue-50 text-[#00288e] hover:bg-blue-100 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Sparkles className="w-3.5 h-3.5" /> Distribuir Saldo Igualmente
                            </button>
                            <button
                              onClick={applyAllToFirstRemessa}
                              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            >
                              Alocar 100% na 1ª Remessa
                            </button>
                            <button
                              onClick={clearCronogramaDistribuicao}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            >
                              Zerar Quantidades
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* SECTION 2: INTERACTIVE ITEMS TABLE */}
                      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm overflow-hidden space-y-3">
                        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-extrabold text-[#0b1c30] flex items-center gap-2">
                              <FileSpreadsheet className="w-4 h-4 text-[#00288e]" /> 2. Tabela de Quantidades por Item e Remessa de Entrega
                            </h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Preencha ou ajuste manualmente as quantidades a serem entregues pela empresa em cada remessa.
                            </p>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                                <th className="py-3 px-4 min-w-[200px]">Item / Descrição</th>
                                <th className="py-3 px-2 text-center w-14">Und</th>
                                <th className="py-3 px-2 text-center w-20">Empenhado</th>
                                <th className="py-3 px-2 text-center w-20">Já Recebido</th>
                                <th className="py-3 px-3 text-center w-28 bg-emerald-50 text-emerald-800 font-black">
                                  Saldo Atual Disp.
                                </th>
                                
                                {/* Dynamic Remessa Columns */}
                                {cronogramaColunas.map((col, idx) => (
                                  <th key={col.id} className="py-3 px-2 text-center min-w-[110px] bg-blue-50/60 text-[#00288e]">
                                    <div className="font-extrabold">{col.titulo}</div>
                                    <div className="text-[9px] font-medium text-gray-500 lowercase">{formatDateOnly(col.dataPrevista)}</div>
                                  </th>
                                ))}

                                <th className="py-3 px-2 text-center w-24">Total Prog.</th>
                                <th className="py-3 px-2 text-right w-24">Val. Unit.</th>
                                <th className="py-3 px-4 text-right w-28 font-bold">Total (R$)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-xs">
                              {targetEmp.items.map((it, itemIndex) => {
                                const saldoDisponivel = Math.max(0, it.quantity - it.received);
                                const totalProgramadoItem = cronogramaColunas.reduce((sum, col) => {
                                  return sum + (Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0);
                                }, 0);
                                const saldoRestanteItem = saldoDisponivel - totalProgramadoItem;
                                const valorTotalProgItem = totalProgramadoItem * it.unitPrice;

                                const isExact = totalProgramadoItem === saldoDisponivel;
                                const isExceeded = totalProgramadoItem > saldoDisponivel;

                                return (
                                  <tr key={it.id} className="hover:bg-blue-50/20 transition-colors">
                                    {/* Description */}
                                    <td className="py-3.5 px-4 font-semibold text-gray-900">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-extrabold text-gray-400">#{it.id}</span>
                                        <span className="text-xs font-bold text-gray-800">{it.name}</span>
                                      </div>
                                    </td>

                                    {/* Unit */}
                                    <td className="py-3.5 px-2 text-center text-gray-500 font-medium uppercase text-[11px]">
                                      {it.unit}
                                    </td>

                                    {/* Empenhado */}
                                    <td className="py-3.5 px-2 text-center font-medium text-gray-600">
                                      {it.quantity}
                                    </td>

                                    {/* Recebido */}
                                    <td className="py-3.5 px-2 text-center font-medium text-gray-500">
                                      {it.received}
                                    </td>

                                    {/* Saldo Disponível */}
                                    <td className="py-3.5 px-3 text-center bg-emerald-50/60 font-black text-emerald-700">
                                      {saldoDisponivel}
                                    </td>

                                    {/* Dynamic Inputs for each Remessa */}
                                    {cronogramaColunas.map((col) => {
                                      const currentVal = cronogramaDistribuicao[it.id]?.[col.id] ?? 0;

                                      return (
                                        <td key={col.id} className="py-2.5 px-2 text-center bg-blue-50/30">
                                          <input
                                            type="number"
                                            min="0"
                                            max={it.quantity * 2}
                                            value={currentVal === 0 ? '' : currentVal}
                                            placeholder="0"
                                            onChange={(e) => {
                                              const raw = e.target.value;
                                              const num = raw === '' ? 0 : Math.max(0, parseInt(raw) || 0);
                                              setCronogramaDistribuicao(prev => ({
                                                ...prev,
                                                [it.id]: {
                                                  ...(prev[it.id] || {}),
                                                  [col.id]: num
                                                }
                                              }));
                                            }}
                                            className={`w-20 h-8 px-2 text-center font-extrabold text-xs rounded-lg border focus:outline-none transition-all ${
                                              currentVal > 0 
                                                ? 'bg-white border-[#00288e] text-[#00288e] ring-1 ring-[#00288e]/20' 
                                                : 'bg-white/80 border-gray-200 text-gray-400 focus:border-[#00288e]'
                                            }`}
                                          />
                                        </td>
                                      );
                                    })}

                                    {/* Total Programado */}
                                    <td className="py-3.5 px-2 text-center">
                                      <div className="flex flex-col items-center">
                                        <span className={`font-black text-xs ${
                                          isExact ? 'text-emerald-700' : isExceeded ? 'text-rose-600' : 'text-blue-700'
                                        }`}>
                                          {totalProgramadoItem}
                                        </span>
                                        {isExact ? (
                                          <span className="text-[9px] font-bold text-emerald-600">100%</span>
                                        ) : isExceeded ? (
                                          <span className="text-[9px] font-bold text-rose-600">+{totalProgramadoItem - saldoDisponivel}</span>
                                        ) : (
                                          <span className="text-[9px] font-bold text-amber-600">-{saldoRestanteItem}</span>
                                        )}
                                      </div>
                                    </td>

                                    {/* Unit Price */}
                                    <td className="py-3.5 px-2 text-right text-gray-500 font-medium text-xs">
                                      R$ {it.unitPrice.toFixed(2)}
                                    </td>

                                    {/* Total Price (R$) */}
                                    <td className="py-3.5 px-4 text-right font-extrabold text-gray-900 text-xs">
                                      R$ {valorTotalProgItem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>

                            {/* Summary Footer */}
                            <tfoot>
                              <tr className="bg-gray-50/90 border-t-2 border-gray-200 font-extrabold text-xs text-gray-800">
                                <td colSpan={5} className="py-3.5 px-4 text-right uppercase tracking-wider text-[11px] text-gray-600">
                                  TOTAIS GERAIS DO CRONOGRAMA:
                                </td>

                                {/* Totais por remessa */}
                                {cronogramaColunas.map((col) => {
                                  const totalQtyCol = targetEmp.items.reduce((s, it) => s + (Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0), 0);
                                  const totalValCol = targetEmp.items.reduce((s, it) => s + ((Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0) * it.unitPrice), 0);

                                  return (
                                    <td key={col.id} className="py-3.5 px-2 text-center bg-blue-50/70 text-[#00288e]">
                                      <div className="font-black">{totalQtyCol} un</div>
                                      <div className="text-[10px] text-[#00288e]/80">R$ {totalValCol.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                                    </td>
                                  );
                                })}

                                <td className="py-3.5 px-2 text-center font-black text-[#00288e]">
                                  {targetEmp.items.reduce((sum, it) => sum + cronogramaColunas.reduce((s, col) => s + (Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0), 0), 0)}
                                </td>
                                <td className="py-3.5 px-2 text-right text-gray-400">—</td>
                                <td className="py-3.5 px-4 text-right font-black text-[#00288e] text-sm">
                                  R$ {totalProgramadoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      {/* SECTION 3: INSTRUCTIONS & SIGNATURE DETAILS */}
                      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/40 p-6 shadow-sm space-y-4">
                        <div>
                          <h4 className="text-sm font-extrabold text-[#0b1c30] flex items-center gap-2">
                            <Info className="w-4 h-4 text-[#00288e]" /> 3. Informações Complementares para o Fornecedor e Assinatura
                          </h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Estes dados sairão impressos no cabeçalho e rodapé do documento oficial em PDF enviado para a empresa.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-600 block">Local de Entrega:</label>
                            <input
                              type="text"
                              value={cronogramaLocalEntrega}
                              onChange={(e) => setCronogramaLocalEntrega(e.target.value)}
                              placeholder="ex: Almoxarifado Geral / Seção de Aprovisionamento - HGeSM"
                              className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e]"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-600 block">Horário Autorizado de Recebimento:</label>
                            <input
                              type="text"
                              value={cronogramaHorarioEntrega}
                              onChange={(e) => setCronogramaHorarioEntrega(e.target.value)}
                              placeholder="ex: Segunda a Quinta: 08:00 às 11:30 e 13:30 às 16:30 | Sexta: 08:00 às 11:30"
                              className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e]"
                            />
                          </div>

                          <div className="md:col-span-2 space-y-1.5">
                            <label className="text-xs font-bold text-gray-600 block">Observações e Instruções para a Empresa Fornecedora:</label>
                            <textarea
                              rows={3}
                              value={cronogramaObservacoes}
                              onChange={(e) => setCronogramaObservacoes(e.target.value)}
                              placeholder="Insira diretrizes de entrega, exigências de temperatura, lotes e validade..."
                              className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e] leading-relaxed"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-600 block">Nome do Responsável / Fiscal HGeSM:</label>
                            <input
                              type="text"
                              value={cronogramaResponsavelNome}
                              onChange={(e) => setCronogramaResponsavelNome(e.target.value)}
                              placeholder="Nome e Posto/Graduação do Encarregado"
                              className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e]"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-600 block">Cargo / Função do Responsável:</label>
                            <input
                              type="text"
                              value={cronogramaResponsavelCargo}
                              onChange={(e) => setCronogramaResponsavelCargo(e.target.value)}
                              placeholder="ex: Fiscal de Contrato / Seção de Aprovisionamento - HGeSM"
                              className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Modal de Prévia do Cronograma */}
                      <AnimatePresence>
                        {showCronogramaPreviewModal && (
                          <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
                            <motion.div
                              initial={{ scale: 0.95, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.95, opacity: 0 }}
                              className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-4xl w-full overflow-hidden my-8"
                            >
                              {/* Modal Header */}
                              <div className="p-4 bg-[#00288e] text-white flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Eye className="w-5 h-5 text-blue-200" />
                                  <h3 className="font-bold text-sm">Prévia de Impressão do Cronograma Oficial</h3>
                                </div>
                                <button
                                  onClick={() => setShowCronogramaPreviewModal(false)}
                                  className="text-blue-100 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                              </div>

                              {/* Document Sheet Preview */}
                              <div className="p-8 space-y-6 bg-slate-50 overflow-y-auto max-h-[75vh]">
                                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-6 text-gray-800 font-sans">
                                  
                                  {/* Official Header */}
                                  <div className="text-center space-y-1 border-b border-gray-300 pb-4">
                                    <p className="text-xs font-extrabold text-[#00288e] tracking-widest uppercase">MINISTÉRIO DA DEFESA • EXÉRCITO BRASILEIRO</p>
                                    <p className="text-xs font-bold text-gray-700">HOSPITAL GERAL DE SANTA MARIA (HGeSM)</p>
                                    <p className="text-[11px] text-gray-500 font-medium">SEÇÃO DE APROVISIONAMENTO / LOGÍSTICA HOSPITALAR</p>
                                    <h2 className="text-sm font-black text-[#00288e] pt-2 uppercase tracking-wide">
                                      CRONOGRAMA DE ENTREGA DE MATERIAL / GÊNEROS (NE: {targetEmp.id})
                                    </h2>
                                  </div>

                                  {/* Contract Details */}
                                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <div>
                                      <span className="text-gray-400 font-bold block text-[10px] uppercase">Nota de Empenho:</span>
                                      <strong className="text-gray-900">{targetEmp.id}</strong>
                                    </div>
                                    <div>
                                      <span className="text-gray-400 font-bold block text-[10px] uppercase">Pregão:</span>
                                      <strong className="text-gray-900">{targetEmp.pregao || '—'}</strong>
                                    </div>
                                    <div>
                                      <span className="text-gray-400 font-bold block text-[10px] uppercase">Classe:</span>
                                      <strong className="text-gray-900">{targetEmp.classification || 'QR'}</strong>
                                    </div>
                                    <div className="sm:col-span-2">
                                      <span className="text-gray-400 font-bold block text-[10px] uppercase">Fornecedor:</span>
                                      <strong className="text-gray-900">{targetEmp.supplier}</strong>
                                    </div>
                                    <div>
                                      <span className="text-gray-400 font-bold block text-[10px] uppercase">Data Emissão NE:</span>
                                      <strong className="text-gray-900">{formatDateOnly(targetEmp.date)}</strong>
                                    </div>
                                    <div className="sm:col-span-3 pt-2 border-t border-gray-200 flex flex-wrap justify-between gap-2">
                                      <span>Total Empenhado: <strong>R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                                      <span>Já Faturado em NF: <strong>R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                                      <span className="text-emerald-700 font-black">Saldo Atual: R$ {saldoDisponivelTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                  </div>

                                  {/* Remessas Table in Preview */}
                                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <table className="w-full text-xs text-left border-collapse">
                                      <thead className="bg-[#00288e] text-white text-[10px] uppercase">
                                        <tr>
                                          <th className="p-2">Item</th>
                                          <th className="p-2 text-center">Und</th>
                                          <th className="p-2 text-center">Saldo Disp.</th>
                                          {cronogramaColunas.map(col => (
                                            <th key={col.id} className="p-2 text-center">
                                              {col.titulo} ({formatDateOnly(col.dataPrevista)})
                                            </th>
                                          ))}
                                          <th className="p-2 text-center">Total Prog.</th>
                                          <th className="p-2 text-right">Total (R$)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {targetEmp.items.map(it => {
                                          const saldo = Math.max(0, it.quantity - it.received);
                                          const prog = cronogramaColunas.reduce((s, col) => s + (Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0), 0);
                                          return (
                                            <tr key={it.id} className="hover:bg-gray-50">
                                              <td className="p-2 font-medium">{it.name}</td>
                                              <td className="p-2 text-center text-gray-500 uppercase">{it.unit}</td>
                                              <td className="p-2 text-center font-bold text-emerald-700">{saldo}</td>
                                              {cronogramaColunas.map(col => (
                                                <td key={col.id} className="p-2 text-center font-semibold">
                                                  {cronogramaDistribuicao[it.id]?.[col.id] || '—'}
                                                </td>
                                              ))}
                                              <td className="p-2 text-center font-bold text-[#00288e]">{prog}</td>
                                              <td className="p-2 text-right font-bold">R$ {(prog * it.unitPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                      <tfoot>
                                        <tr className="bg-gray-100 font-extrabold">
                                          <td colSpan={3} className="p-2 text-right uppercase text-[10px]">TOTAL:</td>
                                          {cronogramaColunas.map(col => (
                                            <td key={col.id} className="p-2 text-center text-[#00288e]">
                                              {targetEmp.items.reduce((s, it) => s + (Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0), 0)} un
                                            </td>
                                          ))}
                                          <td className="p-2 text-center text-[#00288e]">
                                            {targetEmp.items.reduce((sum, it) => sum + cronogramaColunas.reduce((s, col) => s + (Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0), 0), 0)}
                                          </td>
                                          <td className="p-2 text-right text-[#00288e]">
                                            R$ {totalProgramadoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>

                                  {/* Instructions in Preview */}
                                  <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 text-xs space-y-1.5">
                                    <p><strong>Local de Entrega:</strong> {cronogramaLocalEntrega}</p>
                                    <p><strong>Horário de Recebimento:</strong> {cronogramaHorarioEntrega}</p>
                                    <p className="whitespace-pre-line"><strong>Observações:</strong> {cronogramaObservacoes}</p>
                                  </div>

                                  {/* Signatures in Preview */}
                                  <div className="grid grid-cols-2 gap-8 pt-8 border-t border-gray-200 text-center text-xs">
                                    <div className="space-y-1">
                                      <div className="w-48 h-[1px] bg-gray-400 mx-auto mb-2" />
                                      <p className="font-bold text-gray-900">{cronogramaResponsavelNome || 'Encarregado do Aprovisionamento'}</p>
                                      <p className="text-[10px] text-gray-500">{cronogramaResponsavelCargo}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="w-48 h-[1px] bg-gray-400 mx-auto mb-2" />
                                      <p className="font-bold text-gray-900">DE ACORDO / CIÊNCIA DO FORNECEDOR</p>
                                      <p className="text-[10px] text-gray-500">{targetEmp.supplier}</p>
                                    </div>
                                  </div>

                                </div>
                              </div>

                              {/* Modal Footer */}
                              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                                <button
                                  onClick={() => setShowCronogramaPreviewModal(false)}
                                  className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-100 transition-all cursor-pointer"
                                >
                                  Fechar
                                </button>
                                <button
                                  onClick={() => {
                                    setShowCronogramaPreviewModal(false);
                                    handleGenerateCronogramaPDF(targetEmp, 'print');
                                  }}
                                  className="px-4 py-2 bg-[#00288e] text-white font-bold text-xs rounded-xl hover:bg-[#001e6a] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                                >
                                  <Printer className="w-4 h-4" /> Imprimir Documento Oficial
                                </button>
                              </div>
                            </motion.div>
                          </div>
                        )}
                      </AnimatePresence>

                    </div>
                  );
                })()
              )}

            </div>
          )}

          {/* Modal de Confirmação de Exclusão de Empenho Específico */}
          <AnimatePresence>
            {empenhoToDelete && (() => {
              const targetEmp = empenhos.find(e => e.id === empenhoToDelete);
              const totalCommitted = targetEmp ? targetEmp.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) : 0;

              return (
                <div 
                  id="modal-confirm-delete-empenho-overlay"
                  className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm"
                >
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 10 }}
                    className="bg-white rounded-2xl shadow-2xl border border-rose-100 max-w-lg w-full overflow-hidden"
                  >
                    {/* Header */}
                    <div className="bg-rose-600 text-white p-5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-base tracking-tight">Confirmar Exclusão de Empenho</h3>
                          <p className="text-xs text-rose-100 mt-0.5">Esta ação é permanente e irreversível</p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setEmpenhoToDelete(null)}
                        className="text-rose-100 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-4">
                      <p className="text-sm text-gray-700 font-medium">
                        Você tem certeza que deseja excluir o empenho abaixo?
                      </p>

                      {/* Info Card */}
                      <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Número do Empenho:</span>
                          <span className="text-sm font-extrabold text-rose-800">{empenhoToDelete}</span>
                        </div>
                        {targetEmp && (
                          <>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-500 font-semibold">Fornecedor:</span>
                              <span className="font-bold text-gray-800 text-right max-w-[240px] truncate">{targetEmp.supplier}</span>
                            </div>
                            {targetEmp.pregao && (
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-500 font-semibold">Pregão:</span>
                                <span className="font-bold text-gray-800">{targetEmp.pregao}</span>
                              </div>
                            )}
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-500 font-semibold">Qtd. de Itens:</span>
                              <span className="font-bold text-gray-800">{targetEmp.items.length} item(ns)</span>
                            </div>
                            <div className="flex justify-between items-center text-xs pt-2 border-t border-rose-100">
                              <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Valor Total:</span>
                              <span className="font-extrabold text-gray-900">
                                R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3.5 flex items-start gap-2.5 text-xs">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>Atenção:</strong> Ao confirmar, este empenho e todos os registros e notas associadas a ele serão excluídos permanentemente.
                        </span>
                      </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        disabled={isDeletingEmpenho}
                        onClick={() => setEmpenhoToDelete(null)}
                        className="px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={isDeletingEmpenho}
                        onClick={() => handleDeleteSpecificEmpenho(empenhoToDelete)}
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        {isDeletingEmpenho ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Excluindo...
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" /> Confirmar Exclusão
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                </div>
              );
            })()}
          </AnimatePresence>

        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Visual Sync) */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full h-16 flex justify-around items-center bg-white/70 backdrop-blur-md border-t border-white/20 shadow-lg z-30 rounded-t-2xl">
        <button 
          onClick={() => setActiveTab('painel')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'painel' ? 'text-[#00288e] font-extrabold' : 'text-gray-400'
          }`}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Painel</span>
        </button>

        <button 
          onClick={() => { setActiveTab('empenhos'); setSelectedEmpenhoDetailId(null); }}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'empenhos' || activeTab === 'itens_empenho' ? 'text-[#00288e] font-extrabold' : 'text-gray-400'
          }`}
        >
          <FileSpreadsheet className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Cad. Empenhos</span>
        </button>

        <button 
          onClick={() => setActiveTab('nova_nf')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'nova_nf' ? 'text-[#00288e] font-extrabold' : 'text-gray-400'
          }`}
        >
          <div className="p-2 bg-[#00288e] text-white rounded-xl shadow-md -translate-y-4 scale-110 active:scale-95 duration-100 transition-all border-4 border-white/70 backdrop-blur-sm">
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 -translate-y-3.5">Notas Fiscais</span>
        </button>

        <button 
          onClick={() => setActiveTab('relatorios')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'relatorios' ? 'text-[#00288e] font-extrabold' : 'text-gray-400'
          }`}
        >
          <TrendingUp className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Empenhos</span>
        </button>

        <button 
          onClick={() => setActiveTab('cronogramas')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'cronogramas' ? 'text-[#00288e] font-extrabold' : 'text-gray-400'
          }`}
        >
          <CalendarDays className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Cronogramas</span>
        </button>


      </nav>

    </div>
  );
}
