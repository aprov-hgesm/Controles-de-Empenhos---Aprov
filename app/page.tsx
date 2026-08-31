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

import { Empenho, Item, Alert, Invoice, InvoiceItem, Comissao, CronogramaEmpenho, CronogramaEntregaColuna } from '../lib/types';
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
  savePlatformLogo,
  getPlatformLogo
} from '../lib/firebaseSync';

const MILITARY_RANKS = [
  'Coronel',
  'Tenente-Coronel',
  'Major',
  'Capitão',
  '1º Tenente',
  '2º Tenente',
  'Aspirante',
  'Subtenente',
  '1º Sargento',
  '2º Sargento',
  '3º Sargento',
  'Cabo',
  'Soldado',
  'Servidor Civil'
];

const normalizeSupplier = (supplier: any): string => {
  if (!supplier) return '';
  if (typeof supplier === 'string') return supplier;
  if (typeof supplier === 'object') {
    if (supplier.razao_social) return String(supplier.razao_social);
    if (supplier.fornecedor) return String(supplier.fornecedor);
    if (supplier.name) return String(supplier.name);
    if (supplier.supplier) return normalizeSupplier(supplier.supplier);
    
    const keys = Object.keys(supplier);
    if (keys.includes('razao_social')) {
      return String(supplier.razao_social);
    }
    if (keys.includes('fornecedor')) {
      return String(supplier.fornecedor);
    }
    for (const key of keys) {
      if (typeof supplier[key] === 'string') {
        return supplier[key];
      }
    }
    return String(supplier.name || Object.values(supplier)[0] || '');
  }
  return String(supplier);
};

export const PROMPT_EXTRACAO_EMPENHO = `# PROMPT FIXO — Extração de Dados de Nota de Empenho
# Use este prompt no Claude, ChatGPT ou Gemini, anexando o PDF da NE

---

Analise o PDF da Nota de Empenho anexado e extraia os dados abaixo.
Retorne SOMENTE o JSON, sem texto antes ou depois, sem explicações, sem blocos markdown.

Formato exato a retornar:

{
  "numero_empenho": "2025NE124",
  "data_emissao": "2025-08-27",
  "tipo_empenho": "Global",
  "valor_total": 12043.80,
  "fornecedor": {
    "razao_social": "JULIANO LUCIO FRANCISCATTO DO AMARAL & CIA LT",
    "cnpj": "02.483.088/0001-75"
  },
  "itens": [
    {
      "num_item": "001",
      "codigo_item": "00002",
      "descricao": "LEGUME PROCESSADO, TIPO MANDIOCA, PREPARO IN NATURA, APRESENTACAO CONGELADO, A VACUO",
      "unidade": "kg",
      "quantidade": 430,
      "valor_unitario": 6.90,
      "valor_total_item": 2967.00
    }
  ]
}

Regras:
- data_emissao sempre no formato AAAA-MM-DD
- Valores numéricos com ponto como separador decimal (não vírgula)
- Extrair TODOS os itens da seção "Lista de Itens" do documento
- unidade: identificar na descrição do item (kg, un, maço, pct, cx, lt, g); se não identificável usar "un"
- Não inventar dados; se um campo não for encontrado, usar null`;

export default function Home() {
  // Toast / Notifications helper
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Custom Platform Logo State & Upload Handlers
  const [customLogo, setCustomLogo] = useState<string | null>(null);

  // Global Platform Settings (Logotipo & Favicon) Listener - Unconditionally loads and syncs with Firestore
  useEffect(() => {
    try {
      const saved = localStorage.getItem('emprovium_custom_logo');
      if (saved) setCustomLogo(saved);
    } catch (e) {
      console.warn('Erro ao carregar logotipo do armazenamento local:', e);
    }

    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'global'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.logo !== undefined) {
            setCustomLogo(data.logo || null);
            try {
              if (data.logo) {
                localStorage.setItem('emprovium_custom_logo', data.logo);
              } else {
                localStorage.removeItem('emprovium_custom_logo');
              }
            } catch (e) {}
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'settings/global');
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Update browser tab favicon dynamically and reliably across all browsers
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const setFavicon = (dataUrl: string) => {
      try {
        const head = document.head || document.getElementsByTagName('head')[0];
        if (!head) return;

        // Remove all previous icon tags to force browser tab to refresh the icon
        const existingLinks = document.querySelectorAll("link[rel*='icon']");
        existingLinks.forEach(link => link.remove());

        // Create new standard favicon
        const iconLink = document.createElement('link');
        iconLink.rel = 'icon';
        iconLink.type = 'image/png';
        iconLink.href = dataUrl;
        head.appendChild(iconLink);

        // Create shortcut icon
        const shortcutLink = document.createElement('link');
        shortcutLink.rel = 'shortcut icon';
        shortcutLink.type = 'image/png';
        shortcutLink.href = dataUrl;
        head.appendChild(shortcutLink);

        // Create apple touch icon
        const appleLink = document.createElement('link');
        appleLink.rel = 'apple-touch-icon';
        appleLink.href = dataUrl;
        head.appendChild(appleLink);
      } catch (err) {
        console.warn('Erro ao aplicar favicon no documento:', err);
      }
    };

    if (customLogo) {
      // Convert custom image into a clean square 64x64 PNG for crisp browser tab rendering
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, 64, 64);

            // Calculate fit inside 64x64
            const maxDim = 64;
            const ratio = Math.min(maxDim / img.width, maxDim / img.height);
            const w = img.width * ratio;
            const h = img.height * ratio;
            const x = (maxDim - w) / 2;
            const y = (maxDim - h) / 2;

            ctx.drawImage(img, x, y, w, h);
            const faviconDataUrl = canvas.toDataURL('image/png');
            setFavicon(faviconDataUrl);
          } else {
            setFavicon(customLogo);
          }
        } catch (e) {
          setFavicon(customLogo);
        }
      };
      img.onerror = () => {
        setFavicon(customLogo);
      };
      img.src = customLogo;
    } else {
      // Default SVG favicon with EMP branding
      const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#00288e"/><text x="50%" y="54%" dominant-baseline="central" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="20" letter-spacing="1">EMP</text></svg>`;
      const defaultDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(defaultSvg)}`;
      setFavicon(defaultDataUrl);
    }
  }, [customLogo]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showToast('Por favor, selecione um arquivo de imagem válido (PNG, JPG, SVG, WebP).', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('A imagem deve ter no máximo 5MB.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const rawData = ev.target?.result as string;
        if (!rawData) return;

        // Resize / optimize image using canvas to ensure efficient Firestore storage
        const img = new Image();
        img.onload = async () => {
          try {
            const canvas = document.createElement('canvas');
            const maxDim = 480;
            let width = img.width;
            let height = img.height;

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const optimizedDataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9);
              
              setCustomLogo(optimizedDataUrl);
              try {
                localStorage.setItem('emprovium_custom_logo', optimizedDataUrl);
              } catch (err) {
                console.warn('Erro no armazenamento local:', err);
              }

              // Salva no banco de dados Firestore
              await savePlatformLogo(optimizedDataUrl, user?.email || 'aprov1hgesm@gmail.com');
              showToast('Logotipo salvo com sucesso no banco de dados!', 'success');
            }
          } catch (err) {
            console.error('Erro ao processar e salvar imagem:', err);
            showToast('Erro ao salvar logotipo no banco de dados.', 'error');
          }
        };
        img.src = rawData;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCustomLogo(null);
    try {
      localStorage.removeItem('emprovium_custom_logo');
    } catch (e) {}
    try {
      await savePlatformLogo(null, user?.email || 'aprov1hgesm@gmail.com');
      showToast('Logotipo padrão restaurado e sincronizado no banco de dados.', 'info');
    } catch (err) {
      console.error('Erro ao remover logotipo no banco:', err);
      showToast('Logotipo padrão restaurado localmente.', 'info');
    }
  };

  // Authentication & Loading state
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Navigation & View state
  const [activeTab, setActiveTab] = useState<'painel' | 'empenhos' | 'nova_nf' | 'relatorios' | 'itens_empenho' | 'cronogramas'>('painel');
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

  // --- VIEW 1: PAINEL / DASHBOARD STATES ---
  const [expandedEmpenhoId, setExpandedEmpenhoId] = useState<string | null>('2025NE124');
  const [dashboardPregaoFilter, setDashboardPregaoFilter] = useState('Todos');
  const [dashboardClassFilter, setDashboardClassFilter] = useState<'TODAS' | 'QR' | 'CALI' | 'PASA'>('TODAS');
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [dashboardExpandedClass, setDashboardExpandedClass] = useState<string | null>(null);

  // --- VIEW 2: EMPENHOS STATES ---
  const [empenhosSearch, setEmpenhosSearch] = useState('');
  const [empenhosFilter, setEmpenhosFilter] = useState<'Todos' | 'Ativos' | 'Encerrados' | 'Sem Movimentação'>('Todos');
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

    // Redirect to Items view to add items to this new empenho
    setEditingEmpenhoId(newEmp.id);
    setActiveTab('itens_empenho');
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

    // Redirect to Items view
    setEditingEmpenhoId(finalEmp.id);
    setActiveTab('itens_empenho');
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
              <img src={customLogo} alt="Logotipo EMPROVIUM" className="w-full h-full object-contain" />
            ) : (
              <span className="text-2xl font-extrabold text-white tracking-widest font-montserrat">EMP</span>
            )}
          </div>

          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-wider text-white uppercase font-montserrat">
              EMPROVIUM
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
      
      {/* iOS-style background gradient blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-15%] w-[60vw] h-[60vw] rounded-full bg-blue-300/30 blur-[120px]" />
        <div className="absolute bottom-[5%] right-[-10%] w-[55vw] h-[55vw] rounded-full bg-indigo-300/20 blur-[150px]" />
        <div className="absolute top-[30%] right-[15%] w-[45vw] h-[45vw] rounded-full bg-pink-200/25 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[10%] w-[50vw] h-[50vw] rounded-full bg-sky-200/35 blur-[140px]" />
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-16 right-4 left-4 sm:left-auto sm:right-6 z-50 p-4 rounded-xl shadow-xl flex items-center gap-3 border backdrop-blur-md ${
              toast.type === 'success' ? 'bg-emerald-50/90 text-emerald-800 border-emerald-200/80' :
              toast.type === 'error' ? 'bg-rose-50/90 text-rose-800 border-rose-200/80' :
              'bg-blue-50/90 text-blue-800 border-blue-200/80'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600" />}
            <span className="font-medium text-sm">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-auto text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header / App Bar */}
      <header className="bg-white/70 backdrop-blur-md border-b border-white/30 shadow-sm fixed top-0 w-full h-16 z-40 flex justify-between items-center px-6 transition-all duration-300">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-[#00288e] p-1.5 hover:bg-blue-50/50 rounded-lg active:scale-95 duration-150 transition-all"
            id="menu-toggle-btn"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="relative group">
              <label 
                className="w-8 h-8 rounded-lg bg-[#00288e] text-white flex items-center justify-center font-extrabold text-xs tracking-wider shadow-xs flex-shrink-0 font-montserrat cursor-pointer overflow-hidden p-1 hover:ring-2 hover:ring-blue-400 transition-all block"
                title="Clique para alterar o logotipo da plataforma"
              >
                {customLogo ? (
                  <img src={customLogo} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <span>EMP</span>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleLogoUpload} 
                  className="hidden" 
                />
              </label>

              <label 
                className="absolute -bottom-1 -right-1 p-0.5 bg-white text-[#00288e] border border-blue-200 rounded-full shadow-xs cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50 flex items-center justify-center"
                title="Upload de logotipo"
              >
                <Camera className="w-2.5 h-2.5" />
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleLogoUpload} 
                  className="hidden" 
                />
              </label>

              {customLogo && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="absolute -top-1 -right-1 p-0.5 bg-rose-500 text-white rounded-full shadow-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600 flex items-center justify-center"
                  title="Restaurar logotipo padrão"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>

            <div className="flex flex-col">
              <h1 className="font-extrabold text-base sm:text-lg text-[#00288e] tracking-wider uppercase font-montserrat leading-none">
                EMPROVIUM
              </h1>
              <span className="text-[9px] sm:text-[10px] font-bold text-gray-500 tracking-wider uppercase font-montserrat mt-0.5">
                Gestão Logística e Financeira
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {syncing && (
            <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 animate-pulse bg-blue-50/70 backdrop-blur-sm px-3 py-1 rounded-full">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Sincronizando...
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-700 hidden md:inline">
              {user?.displayName || 'Aprovisionamento HGeSM'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Framework Wrapper */}
      <div className="flex flex-1 pt-16 min-h-screen z-10 relative">

        {/* Backdrop for mobile sidebar */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/20 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Persistent Desktop Sidebar & Sliding Mobile Drawer */}
        <aside className={`
          fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] w-72 bg-white/60 backdrop-blur-md border-r border-white/20 py-6 z-40
          flex flex-col justify-between transition-transform duration-300 ease-out shadow-sm lg:shadow-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="space-y-6">
            
            {/* User Profile Card (Text-only without avatar icon) */}
            <div className="mx-4 px-4 py-3 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/40 shadow-xs">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Usuário Conectado</p>
              <p className="font-bold text-sm text-[#0b1c30] truncate mt-0.5">
                {user?.displayName || 'Aprovisionamento HGeSM'}
              </p>
            </div>

            {/* Navigation Menus */}
            <nav className="space-y-1.5 px-3">
              <button 
                onClick={() => { setActiveTab('painel'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 ${
                  activeTab === 'painel' 
                    ? 'bg-[#e5eeff] text-[#00288e]' 
                    : 'text-gray-600 hover:bg-[#eff4ff] hover:text-[#0b1c30]'
                }`}
              >
                <Layers className="w-5 h-5" />
                <span>Dashboard</span>
              </button>

              <button 
                onClick={() => { setActiveTab('empenhos'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 ${
                  activeTab === 'empenhos' || activeTab === 'itens_empenho'
                    ? 'bg-[#e5eeff] text-[#00288e]' 
                    : 'text-gray-600 hover:bg-[#eff4ff] hover:text-[#0b1c30]'
                }`}
              >
                <FileSpreadsheet className="w-5 h-5" />
                <span>Cadastro de Empenhos</span>
              </button>

              <button 
                onClick={() => { setActiveTab('nova_nf'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 ${
                  activeTab === 'nova_nf' 
                    ? 'bg-[#e5eeff] text-[#00288e]' 
                    : 'text-gray-600 hover:bg-[#eff4ff] hover:text-[#0b1c30]'
                }`}
              >
                <FileText className="w-5 h-5" />
                <span>Notas Fiscais</span>
              </button>

              <button 
                onClick={() => { setActiveTab('relatorios'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 ${
                  activeTab === 'relatorios' 
                    ? 'bg-[#e5eeff] text-[#00288e]' 
                    : 'text-gray-600 hover:bg-[#eff4ff] hover:text-[#0b1c30]'
                }`}
              >
                <TrendingUp className="w-5 h-5" />
                <span>Empenhos</span>
              </button>

              <button 
                onClick={() => { setActiveTab('cronogramas'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 ${
                  activeTab === 'cronogramas' 
                    ? 'bg-[#e5eeff] text-[#00288e]' 
                    : 'text-gray-600 hover:bg-[#eff4ff] hover:text-[#0b1c30]'
                }`}
              >
                <CalendarDays className="w-5 h-5" />
                <span>Cronogramas</span>
              </button>


            </nav>
          </div>

          {/* Sidebar Footer with Logout */}
          <div className="px-6 border-t border-gray-100 pt-4 space-y-3">
            <button
              onClick={async () => {
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
              className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl font-bold text-xs transition-all active:scale-95"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair da Conta</span>
            </button>
            <div className="text-[10px] font-semibold text-gray-400">
              v1.2.0 © 2026 Sistema Logístico
            </div>
          </div>
        </aside>

        {/* Content Container Area */}
        <main className="flex-1 lg:pl-6 pb-24 md:pb-12 pt-6 px-4 max-w-7xl mx-auto w-full overflow-hidden">
          
          {/* TAB 1: PAINEL DE CONTROLE / DASHBOARD - SALDO RESTANTE POR CLASSE DETALHADO */}
          {activeTab === 'painel' && (() => {
            // Compute macro totals
            const totalGeralEmpenhado = empenhos.reduce((sum, emp) => {
              return sum + emp.items.reduce((iSum, it) => iSum + it.quantity * it.unitPrice, 0);
            }, 0);

            const totalGeralLiquidado = empenhos.reduce((sum, emp) => {
              return sum + emp.items.reduce((iSum, it) => iSum + it.received * it.unitPrice, 0);
            }, 0);

            const totalGeralSaldo = Math.max(0, totalGeralEmpenhado - totalGeralLiquidado);
            const totalGeralPctExec = totalGeralEmpenhado > 0 ? Math.round((totalGeralLiquidado / totalGeralEmpenhado) * 100) : 0;

            // Class definitions
            const classesConfig: {
              key: 'QR' | 'CALI' | 'PASA';
              name: string;
              description: string;
              borderClass: string;
              badgeBg: string;
              badgeText: string;
              progressColor: string;
              accentText: string;
            }[] = [
              {
                key: 'QR',
                name: 'Classe QR',
                description: 'Quadro de Rancho / Subsistência e Alimentação Geral',
                borderClass: 'border-blue-200',
                badgeBg: 'bg-blue-50',
                badgeText: 'text-blue-800',
                progressColor: 'bg-[#00288e]',
                accentText: 'text-[#00288e]',
              },
              {
                key: 'CALI',
                name: 'Classe CALI',
                description: 'Cálculo de Alimentação / Insumos e Materiais de Apoio',
                borderClass: 'border-amber-200',
                badgeBg: 'bg-amber-50',
                badgeText: 'text-amber-800',
                progressColor: 'bg-amber-600',
                accentText: 'text-amber-700',
              },
              {
                key: 'PASA',
                name: 'Classe PASA',
                description: 'Plano de Apoio / Alimentação e Serviços Especializados',
                borderClass: 'border-emerald-200',
                badgeBg: 'bg-emerald-50',
                badgeText: 'text-emerald-800',
                progressColor: 'bg-emerald-600',
                accentText: 'text-emerald-700',
              },
            ];

            const displayedClasses = dashboardClassFilter === 'TODAS'
              ? classesConfig
              : classesConfig.filter(c => c.key === dashboardClassFilter);

            return (
              <div className="space-y-6">
                
                {/* Header do Painel */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-[#00288e] flex items-center gap-2.5">
                      <Coins className="w-7 h-7 text-[#00288e]" /> Saldo Restante por Classe
                    </h2>
                    <p className="text-sm text-gray-500 font-medium">
                      Detalhamento financeiro em dinheiro (R$), valor contratado e liquidação por classificação
                    </p>
                  </div>

                  {/* Filtro por Pregão no Header */}
                  <div className="flex items-center gap-2 bg-white/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/40 shadow-2xs">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <label className="text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Pregão:</label>
                    <select
                      id="dashboard-pregao-select"
                      value={dashboardPregaoFilter}
                      onChange={(e) => setDashboardPregaoFilter(e.target.value)}
                      className="text-xs font-bold text-[#00288e] bg-transparent outline-none cursor-pointer pr-2"
                    >
                      <option value="Todos">Todos os Pregões</option>
                      {uniquePregaos.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Filtro Rápido de Abas de Classes */}
                <div className="flex flex-wrap items-center gap-2 border-b border-gray-200/70 pb-3">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Filtrar Classe:</span>
                  <button
                    id="filter-class-todas"
                    onClick={() => setDashboardClassFilter('TODAS')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      dashboardClassFilter === 'TODAS'
                        ? 'bg-[#00288e] text-white shadow-xs'
                        : 'bg-white/60 text-gray-600 border border-gray-200 hover:bg-white'
                    }`}
                  >
                    Todas as Classes (Consolidado)
                  </button>
                  {classesConfig.map((cls) => {
                    const stats = getBalanceByClass(cls.key);
                    return (
                      <button
                        key={cls.key}
                        id={`filter-class-${cls.key.toLowerCase()}`}
                        onClick={() => setDashboardClassFilter(cls.key)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          dashboardClassFilter === cls.key
                            ? 'bg-[#00288e] text-white shadow-xs'
                            : 'bg-white/60 text-gray-600 border border-gray-200 hover:bg-white'
                        }`}
                      >
                        <span>{cls.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                          dashboardClassFilter === cls.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700 font-bold'
                        }`}>
                          R$ {stats.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Resumo Macro Geral (Consolidado em Dinheiro) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Saldo Restante Geral */}
                  <div className="bg-gradient-to-br from-blue-900 to-[#00288e] text-white p-5 rounded-2xl shadow-md relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute right-[-10px] bottom-[-15px] opacity-10 text-white select-none pointer-events-none">
                      <Coins className="w-32 h-32" />
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200 bg-white/10 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                        Saldo Total Restante
                      </span>
                      <span className="text-xs font-bold text-blue-200">{totalGeralPctExec}% liquidado</span>
                    </div>
                    <div className="mt-3">
                      <p className="text-3xl font-black tracking-tight text-white">
                        R$ {totalGeralSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-blue-200 font-medium mt-0.5">Disponível para faturamento em todas as classes</p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/15 flex justify-between text-xs text-blue-100">
                      <span>Total de Empenhos: <strong>{empenhos.length}</strong></span>
                      <span>Ativos: <strong>{empenhos.filter(e => e.status === 'Ativo').length}</strong></span>
                    </div>
                  </div>

                  {/* Total Empenhado Geral */}
                  <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl border border-white/40 shadow-xs flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                        Total Geral Contratado
                      </span>
                      <span className="text-[10px] font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">Empenhado</span>
                    </div>
                    <div className="mt-2">
                      <p className="text-2xl font-black text-gray-800">
                        R$ {totalGeralEmpenhado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-400 font-medium">Soma de todos os contratos e pregões</p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500 font-medium">
                      Base de 100% do orçamento vinculado
                    </div>
                  </div>

                  {/* Total Liquidado Geral */}
                  <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl border border-white/40 shadow-xs flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                        Total Liquidado / NF-e
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">Recebido</span>
                    </div>
                    <div className="mt-2">
                      <p className="text-2xl font-black text-emerald-600">
                        R$ {totalGeralLiquidado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-400 font-medium">Faturamento conciliado via Termo de Recebimento</p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {totalGeralPctExec}% do total contratado
                    </div>
                  </div>
                </div>

                {/* Cards de Saldo por Classe (Grandes Destaques) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#00288e]" /> Visão Comparativa por Classe
                    </h3>
                    <span className="text-xs text-gray-400 font-medium">Valores calculados em tempo real</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {classesConfig.map((cls) => {
                      const classEmpenhos = empenhos.filter(emp => (emp.classification || 'QR') === cls.key);
                      const classCommitted = classEmpenhos.reduce((sum, emp) => {
                        return sum + emp.items.reduce((iSum, it) => iSum + it.quantity * it.unitPrice, 0);
                      }, 0);
                      const classReceived = classEmpenhos.reduce((sum, emp) => {
                        return sum + emp.items.reduce((iSum, it) => iSum + it.received * it.unitPrice, 0);
                      }, 0);
                      const classBalance = Math.max(0, classCommitted - classReceived);
                      const classPct = classCommitted > 0 ? Math.round((classReceived / classCommitted) * 100) : 0;
                      const activeCount = classEmpenhos.filter(e => e.status === 'Ativo').length;

                      const isSelected = dashboardClassFilter === cls.key;

                      return (
                        <div 
                          key={cls.key}
                          onClick={() => setDashboardClassFilter(isSelected ? 'TODAS' : cls.key)}
                          className={`bg-white/70 backdrop-blur-md rounded-2xl border p-5 shadow-xs transition-all cursor-pointer hover:shadow-md relative overflow-hidden group ${
                            isSelected ? `${cls.borderClass} ring-2 ring-offset-1 ring-[#00288e]` : 'border-white/40 hover:border-gray-200'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${cls.badgeBg} ${cls.badgeText}`}>
                                {cls.name}
                              </span>
                              <span className="text-[10px] text-gray-400 font-semibold">{classEmpenhos.length} NEs</span>
                            </div>
                            <Coins className={`w-4 h-4 ${cls.accentText}`} />
                          </div>

                          {/* Saldo Restante em Destaque */}
                          <div className="mb-4">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Saldo Restante Disponível</span>
                            <p className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                              R$ {classBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>

                          {/* Métricas Secundárias */}
                          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100 text-xs mb-3">
                            <div>
                              <span className="text-[10px] text-gray-400 font-semibold block uppercase">Empenhado</span>
                              <span className="font-bold text-gray-700">R$ {classCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-gray-400 font-semibold block uppercase">Liquidado (NF-e)</span>
                              <span className="font-bold text-emerald-600">R$ {classReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </div>

                          {/* Barra de Progresso Financeiro */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold text-gray-500">
                              <span>Execução: {classPct}%</span>
                              <span className="text-[10px] text-gray-400">{activeCount} ativos</span>
                            </div>
                            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-500 ${cls.progressColor}`}
                                style={{ width: `${classPct}%` }}
                              />
                            </div>
                          </div>

                          <div className="mt-3 pt-2 text-center">
                            <span className={`text-[10px] font-bold ${cls.accentText} group-hover:underline`}>
                              {isSelected ? 'Mostrando detalhamento abaixo' : 'Clique para filtrar esta classe'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detalhamento Individual dos Empenhos por Classe */}
                <div className="space-y-6 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-lg text-[#00288e] tracking-tight">Detalhamento Financeiro dos Empenhos por Classe</h3>
                      <p className="text-xs text-gray-500 font-medium">Lista analítica com conciliação monetária nota a nota</p>
                    </div>

                    {/* Campo de Busca Rápida */}
                    <div className="relative min-w-[240px]">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text"
                        placeholder="Buscar por NE ou Fornecedor..."
                        value={dashboardSearch}
                        onChange={(e) => setDashboardSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none"
                      />
                      {dashboardSearch && (
                        <button onClick={() => setDashboardSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Itera sobre as classes a exibir */}
                  {displayedClasses.map((cls) => {
                    const rawClassEmpenhos = empenhos.filter(emp => (emp.classification || 'QR') === cls.key);
                    
                    const filteredClassEmpenhos = rawClassEmpenhos.filter(emp => {
                      const matchesPregao = dashboardPregaoFilter === 'Todos' || emp.pregao === dashboardPregaoFilter;
                      const matchesSearch = !dashboardSearch || 
                        emp.id.toLowerCase().includes(dashboardSearch.toLowerCase()) || 
                        emp.supplier.toLowerCase().includes(dashboardSearch.toLowerCase()) ||
                        emp.description.toLowerCase().includes(dashboardSearch.toLowerCase());
                      return matchesPregao && matchesSearch;
                    });

                    const subtotalEmpenhado = filteredClassEmpenhos.reduce((sum, emp) => {
                      return sum + emp.items.reduce((iSum, it) => iSum + it.quantity * it.unitPrice, 0);
                    }, 0);

                    const subtotalLiquidado = filteredClassEmpenhos.reduce((sum, emp) => {
                      return sum + emp.items.reduce((iSum, it) => iSum + it.received * it.unitPrice, 0);
                    }, 0);

                    const subtotalSaldo = Math.max(0, subtotalEmpenhado - subtotalLiquidado);
                    const subtotalPct = subtotalEmpenhado > 0 ? Math.round((subtotalLiquidado / subtotalEmpenhado) * 100) : 0;

                    return (
                      <div 
                        key={cls.key}
                        className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/40 p-5 shadow-xs space-y-4"
                      >
                        {/* Header da Classe */}
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-gray-100 pb-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full ${cls.badgeBg} ${cls.badgeText}`}>
                              {cls.name}
                            </span>
                            <div>
                              <h4 className="font-bold text-sm text-gray-800">{cls.description}</h4>
                              <p className="text-xs text-gray-400 font-medium">
                                {filteredClassEmpenhos.length} {filteredClassEmpenhos.length === 1 ? 'empenho listado' : 'empenhos listados'}
                              </p>
                            </div>
                          </div>

                          {/* Resumo da Classe no Cabeçalho */}
                          <div className="flex items-center gap-4 bg-gray-50/80 px-3.5 py-1.5 rounded-xl border border-gray-100 text-xs">
                            <div>
                              <span className="text-[10px] text-gray-400 font-bold uppercase block">Empenhado</span>
                              <span className="font-bold text-gray-700">R$ {subtotalEmpenhado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="h-6 w-px bg-gray-200" />
                            <div>
                              <span className="text-[10px] text-gray-400 font-bold uppercase block">Liquidado</span>
                              <span className="font-bold text-emerald-600">R$ {subtotalLiquidado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="h-6 w-px bg-gray-200" />
                            <div>
                              <span className="text-[10px] text-gray-400 font-bold uppercase block">Saldo Restante</span>
                              <span className={`font-black ${cls.accentText}`}>R$ {subtotalSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        </div>

                        {/* Tabela de Empenhos da Classe */}
                        {filteredClassEmpenhos.length === 0 ? (
                          <div className="text-center py-6 text-xs text-gray-500 font-medium bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                            Nenhum empenho encontrado para {cls.name} com os filtros aplicados.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
                            <table className="w-full text-left border-collapse text-xs sm:text-sm">
                              <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500 text-[11px] uppercase tracking-wider">
                                  <th className="py-2.5 px-3.5 font-bold">Nota de Empenho</th>
                                  <th className="py-2.5 px-3 font-bold">Fornecedor / Objeto</th>
                                  <th className="py-2.5 px-3 font-bold text-right">Valor Empenhado</th>
                                  <th className="py-2.5 px-3 font-bold text-right">Valor Liquidado</th>
                                  <th className="py-2.5 px-3.5 font-bold text-right">Saldo Restante (R$)</th>
                                  <th className="py-2.5 px-3 font-bold text-center">Execução</th>
                                  <th className="py-2.5 px-3 font-bold text-center">Status</th>
                                  <th className="py-2.5 px-3 font-bold text-right">Ações</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {filteredClassEmpenhos.map((emp) => {
                                  const totalCommitted = emp.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
                                  const totalReceived = emp.items.reduce((sum, item) => sum + item.received * item.unitPrice, 0);
                                  const balance = Math.max(0, totalCommitted - totalReceived);
                                  const pct = totalCommitted > 0 ? Math.round((totalReceived / totalCommitted) * 100) : 0;

                                  return (
                                    <tr key={emp.id} className="hover:bg-blue-50/30 transition-colors">
                                      {/* NE e Pregão */}
                                      <td className="py-3 px-3.5 whitespace-nowrap">
                                        <span className="font-bold text-[#00288e] block">{emp.id}</span>
                                        <span className="text-[10px] text-gray-400 block font-medium">
                                          {emp.pregao ? `Pregão: ${emp.pregao}` : 'Sem pregão'} • {emp.date}
                                        </span>
                                      </td>

                                      {/* Fornecedor & Objeto */}
                                      <td className="py-3 px-3 max-w-[220px]">
                                        <p className="font-bold text-gray-800 truncate" title={emp.supplier}>{emp.supplier}</p>
                                        <p className="text-[11px] text-gray-500 truncate" title={emp.description}>{emp.description}</p>
                                      </td>

                                      {/* Valor Empenhado */}
                                      <td className="py-3 px-3 text-right font-medium text-gray-700 whitespace-nowrap">
                                        R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>

                                      {/* Valor Liquidado */}
                                      <td className="py-3 px-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                                        R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>

                                      {/* Saldo Restante */}
                                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                                        <span className="font-black text-[#00288e] text-sm block">
                                          R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      </td>

                                      {/* Execução */}
                                      <td className="py-3 px-3 text-center whitespace-nowrap">
                                        <span className="text-xs font-bold text-gray-700 block">{pct}%</span>
                                        <div className="w-16 bg-gray-100 h-1.5 rounded-full overflow-hidden mx-auto mt-0.5">
                                          <div 
                                            className={`h-full ${pct === 100 ? 'bg-emerald-500' : 'bg-[#00288e]'}`}
                                            style={{ width: `${pct}%` }}
                                          />
                                        </div>
                                      </td>

                                      {/* Status */}
                                      <td className="py-3 px-3 text-center whitespace-nowrap">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                          emp.status === 'Ativo' ? 'bg-blue-50 text-[#00288e]' :
                                          emp.status === 'Encerrado' ? 'bg-gray-100 text-gray-600' :
                                          'bg-amber-100 text-amber-800'
                                        }`}>
                                          {emp.status}
                                        </span>
                                      </td>

                                      {/* Ações */}
                                      <td className="py-3 px-3 text-right whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-1.5">
                                          <button
                                            id={`btn-view-items-${emp.id}`}
                                            onClick={() => { setEditingEmpenhoId(emp.id); setActiveTab('itens_empenho'); }}
                                            className="px-2.5 py-1 bg-white border border-gray-200 text-gray-700 hover:text-[#00288e] hover:border-blue-300 rounded-lg text-xs font-bold transition-all"
                                            title="Ver itens do empenho"
                                          >
                                            Itens
                                          </button>
                                          <button
                                            id={`btn-launch-nf-${emp.id}`}
                                            onClick={() => { setSelectedNFCommitmentId(emp.id); setActiveTab('nova_nf'); setNfSubTab('cadastrar'); }}
                                            className="px-2.5 py-1 bg-[#00288e] text-white hover:bg-[#1e40af] rounded-lg text-xs font-bold transition-all shadow-2xs"
                                            title="Lançar Nota Fiscal"
                                          >
                                            + NF
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              {/* Rodapé da tabela com totais da classe */}
                              <tfoot>
                                <tr className="bg-gray-50/90 font-bold text-xs border-t border-gray-200">
                                  <td colSpan={2} className="py-2.5 px-3.5 text-gray-600">
                                    Subtotal {cls.name} ({filteredClassEmpenhos.length} empenhos)
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-gray-800">
                                    R$ {subtotalEmpenhado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-emerald-700">
                                    R$ {subtotalLiquidado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-black text-[#00288e] text-sm">
                                    R$ {subtotalSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2.5 px-3 text-center text-gray-600">
                                    {subtotalPct}%
                                  </td>
                                  <td colSpan={2} className="py-2.5 px-3 text-right text-[11px] text-gray-400 font-normal">
                                    Saldo disponível em conta
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })()}

          {/* TAB 2: LISTA DE EMPENHOS / NOTAS DE EMPENHO */}
          {activeTab === 'empenhos' && (
            <div className="space-y-6">
              
              {/* Screen Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-[#00288e]">Cadastro de Empenhos</h2>
                  <p className="text-sm text-gray-500 font-medium">Controle de faturamento, saldos orçamentários e contratos</p>
                </div>
                <div className="flex items-center gap-3 self-start sm:self-auto">
                  <button 
                    onClick={() => setShowNewEmpenhoModal(true)}
                    className="px-5 h-12 bg-[#00288e] text-white font-bold text-sm rounded-xl hover:bg-[#1e40af] transition-all shadow-md active:scale-95 duration-150 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" /> Novo Empenho
                  </button>
                </div>
              </div>

              {/* Filtering & Search Row */}
              <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
                <div className="relative flex-1">
                  <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Filtrar por número ou fornecedor..."
                    value={empenhosSearch}
                    onChange={(e) => setEmpenhosSearch(e.target.value)}
                    className="w-full pl-12 pr-4 h-12 rounded-xl border border-white/30 bg-white/40 backdrop-blur-sm focus:bg-white/60 focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] transition-all font-medium text-sm text-[#0b1c30] placeholder-gray-400 outline-none"
                  />
                </div>

                {/* Pregão Filter Select Dropdown */}
                <div className="flex items-center gap-2 min-w-[200px]">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Pregão:</span>
                  <select
                    value={empenhosPregaoFilter}
                    onChange={(e) => setEmpenhosPregaoFilter(e.target.value)}
                    className="w-full h-12 px-3 border border-white/30 rounded-xl bg-white/40 backdrop-blur-sm text-xs font-bold text-gray-700 outline-none focus:bg-white/60 focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e]"
                  >
                    <option value="Todos">Todos os Pregões</option>
                    {uniquePregaos.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Ano Filter Select Dropdown */}
                <div className="flex items-center gap-2 min-w-[150px]">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Ano:</span>
                  <select
                    value={empenhosYearFilter}
                    onChange={(e) => setEmpenhosYearFilter(e.target.value)}
                    className="w-full h-12 px-3 border border-white/30 rounded-xl bg-white/40 backdrop-blur-sm text-xs font-bold text-gray-700 outline-none focus:bg-white/60 focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e]"
                  >
                    <option value="Todos">Todos os Anos</option>
                    {uniqueEmpenhoYears.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                {/* Classe Filter Select Dropdown */}
                <div className="flex items-center gap-2 min-w-[150px]">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Classe:</span>
                  <select
                    value={empenhosClassFilter}
                    onChange={(e) => setEmpenhosClassFilter(e.target.value)}
                    className="w-full h-12 px-3 border border-white/30 rounded-xl bg-white/40 backdrop-blur-sm text-xs font-bold text-gray-700 outline-none focus:bg-white/60 focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e]"
                  >
                    <option value="Todos">Todas as Classes</option>
                    <option value="QR">QR</option>
                    <option value="CALI">CALI</option>
                    <option value="PASA">PASA</option>
                  </select>
                </div>
                
                {/* Filter chip buttons wrapper */}
                <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
                  {(['Todos', 'Ativos', 'Encerrados', 'Sem Movimentação'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setEmpenhosFilter(filter)}
                      className={`px-4 py-2 rounded-full font-bold text-xs whitespace-nowrap transition-all backdrop-blur-sm ${
                        empenhosFilter === filter 
                          ? 'bg-[#00288e] text-white shadow-sm' 
                          : 'bg-white/40 text-gray-600 hover:bg-white/60 border border-white/20'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid of Commitments */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {empenhos
                  .filter(emp => {
                    const matchesSearch = emp.id.toLowerCase().includes(empenhosSearch.toLowerCase()) || 
                                          emp.supplier.toLowerCase().includes(empenhosSearch.toLowerCase()) ||
                                          emp.description.toLowerCase().includes(empenhosSearch.toLowerCase());
                    const matchesFilter = empenhosFilter === 'Todos' || emp.status === empenhosFilter;
                    const matchesPregao = empenhosPregaoFilter === 'Todos' || emp.pregao === empenhosPregaoFilter;
                    
                    let empYear = '';
                    if (emp.date) {
                      const parts = emp.date.split('/');
                      if (parts.length === 3) {
                        empYear = parts[2];
                      } else if (emp.date.includes('-')) {
                        empYear = emp.date.split('-')[0];
                      }
                    }
                    const matchesYear = empenhosYearFilter === 'Todos' || empYear === empenhosYearFilter;
                    const matchesClass = empenhosClassFilter === 'Todos' || emp.classification === empenhosClassFilter;

                    return matchesSearch && matchesFilter && matchesPregao && matchesYear && matchesClass;
                  })
                  .map((emp) => {
                    const totalCommitted = emp.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
                    const totalReceived = emp.items.reduce((sum, item) => sum + item.received * item.unitPrice, 0);
                    const progressPercentage = totalCommitted > 0 ? Math.round((totalReceived / totalCommitted) * 100) : 0;

                    return (
                      <div 
                        key={emp.id}
                        onClick={() => { setEditingEmpenhoId(emp.id); setActiveTab('itens_empenho'); }}
                        className="bg-white/60 backdrop-blur-md p-5 rounded-2xl border border-white/30 shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-[#dde1ff] hover:bg-white/70"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-[#00288e] font-extrabold text-lg group-hover:underline">{emp.id}</p>
                            <p className="text-gray-500 font-bold text-xs line-clamp-1">{emp.supplier}</p>
                            <p className="text-gray-400 text-[10px] font-semibold mt-0.5">{emp.description}</p>
                            {emp.pregao && (
                              <span className="inline-block mt-1 mr-1.5 bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                                Pregão: {emp.pregao}
                              </span>
                            )}
                            {emp.classification && (
                              <span className="inline-block mt-1 bg-indigo-50 text-indigo-800 border border-indigo-100 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                                Classe: {emp.classification}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full ${
                              emp.status === 'Ativo' ? 'bg-blue-50 text-[#00288e]' :
                              emp.status === 'Encerrado' ? 'bg-gray-50 text-gray-500' :
                              'bg-amber-50 text-amber-800'
                            }`}>
                              {emp.status}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEmpenhoToDelete(emp.id);
                              }}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                              title={`Excluir empenho ${emp.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 mb-4">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Emitido em {emp.date}</span>
                        </div>

                        <div className="space-y-1.5 mb-5">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-gray-400">Progresso de Entrega</span>
                            <span className="text-[#00288e] font-bold">{progressPercentage}%</span>
                          </div>
                          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${progressPercentage === 100 ? 'bg-emerald-500' : 'bg-[#00288e]'}`}
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>
                        </div>

                        <div className="pt-3 border-t border-gray-50 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Empenhado</p>
                            <p className="font-extrabold text-gray-700 text-xs">R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Recebido</p>
                            <p className="font-extrabold text-emerald-600 text-xs">R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">A Receber</p>
                            <p className="font-extrabold text-amber-600 text-xs">R$ {Math.max(0, totalCommitted - totalReceived).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {/* Empty State visual card */}
                <div 
                  onClick={() => setShowNewEmpenhoModal(true)}
                  className="bg-[#eff4ff]/20 rounded-2xl border-2 border-dashed border-blue-200/50 flex flex-col items-center justify-center p-6 text-center hover:bg-[#e5eeff]/30 transition-all cursor-pointer min-h-[220px]"
                >
                  <div className="w-12 h-12 bg-blue-50 text-[#00288e] rounded-full flex items-center justify-center mb-3 shadow-inner">
                    <Plus className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-[#00288e] text-sm">Criar Novo Empenho</h4>
                  <p className="text-xs text-gray-500 font-semibold mt-1 max-w-[200px]">Cadastre novas contratações orçamentárias do hospital</p>
                </div>
              </div>

              {/* New Empenho Modal Dialog Overlay */}
              <AnimatePresence>
                {showNewEmpenhoModal && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className={`bg-white rounded-2xl shadow-xl border border-gray-100 w-full overflow-hidden transition-all duration-300 my-8 ${
                        reviewEmpenho ? 'max-w-5xl' : 'max-w-xl'
                      }`}
                    >
                      {/* Modal Header */}
                      <div className="bg-[#00288e] text-white p-5 flex justify-between items-center">
                        <div>
                          <h3 className="font-bold text-base tracking-tight">
                            {reviewEmpenho ? 'Revisão do Empenho Importado' : 'Adicionar Novo Empenho'}
                          </h3>
                          <p className="text-xs text-blue-200 mt-0.5">
                            {reviewEmpenho ? 'Revise e edite os dados extraídos antes de confirmar o salvamento' : 'Escolha um modo de cadastro para iniciar'}
                          </p>
                        </div>
                        <button 
                          onClick={() => {
                            setShowNewEmpenhoModal(false);
                            setReviewEmpenho(null);
                            setJsonInput('');
                            setJsonError(null);
                          }} 
                          className="text-blue-100 hover:text-white transition-all p-1 hover:bg-white/10 rounded-lg"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Mode selection buttons - Only shown when not actively reviewing an imported JSON */}
                      {!reviewEmpenho && (
                        <div className="flex border-b border-gray-100 p-3 bg-gray-50/50 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setNewEmpenhoMode('manual');
                              setJsonError(null);
                            }}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                              newEmpenhoMode === 'manual'
                                ? 'bg-[#00288e] text-white shadow-sm'
                                : 'bg-transparent text-gray-500 hover:bg-gray-100'
                            }`}
                          >
                            Cadastro Manual
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewEmpenhoMode('json');
                              setJsonError(null);
                            }}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                              newEmpenhoMode === 'json'
                                ? 'bg-[#00288e] text-white shadow-sm'
                                : 'bg-transparent text-gray-500 hover:bg-gray-100'
                            }`}
                          >
                            <Braces className="w-3.5 h-3.5" /> Importar via JSON
                          </button>
                        </div>
                      )}

                      {/* MODE 1: MANUAL REGISTRATION */}
                      {newEmpenhoMode === 'manual' && !reviewEmpenho && (
                        <form onSubmit={handleCreateEmpenho} className="p-5 space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Código do Empenho (NE)</label>
                            <input 
                              type="text" 
                              required
                              placeholder="Ex: 2026NE0044"
                              value={newEmpenhoForm.id}
                              onChange={(e) => setNewEmpenhoForm({ ...newEmpenhoForm, id: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-semibold text-sm text-[#0b1c30]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Data de Emissão do Empenho</label>
                            <input 
                              type="date" 
                              required
                              value={newEmpenhoForm.date}
                              onChange={(e) => setNewEmpenhoForm({ ...newEmpenhoForm, date: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-semibold text-sm text-[#0b1c30]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Fornecedor / Razão Social</label>
                            <input 
                              type="text" 
                              required
                              placeholder="Ex: MedTech Distribuidora Ltda"
                              value={newEmpenhoForm.supplier}
                              onChange={(e) => setNewEmpenhoForm({ ...newEmpenhoForm, supplier: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-semibold text-sm text-[#0b1c30]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Descrição sumária do Contrato</label>
                            <input 
                              type="text" 
                              required
                              placeholder="Ex: Medicamentos de Alta Densidade e Insumos"
                              value={newEmpenhoForm.description}
                              onChange={(e) => setNewEmpenhoForm({ ...newEmpenhoForm, description: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-semibold text-sm text-[#0b1c30]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Pregão Relacionado</label>
                            <input 
                              type="text" 
                              required
                              placeholder="Ex: 01/2025"
                              value={newEmpenhoForm.pregao}
                              onChange={(e) => setNewEmpenhoForm({ ...newEmpenhoForm, pregao: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-semibold text-sm text-[#0b1c30]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Classificação do Empenho</label>
                            <div className="grid grid-cols-3 gap-2">
                              {(['QR', 'CALI', 'PASA'] as const).map((type) => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setNewEmpenhoForm({ ...newEmpenhoForm, classification: type })}
                                  className={`h-11 rounded-xl font-bold text-xs flex items-center justify-center border transition-all ${
                                    newEmpenhoForm.classification === type
                                      ? 'bg-[#00288e] text-white border-[#00288e] shadow-sm'
                                      : 'bg-white/40 text-gray-600 border-white/20 hover:bg-white/60 backdrop-blur-sm'
                                  }`}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                            <button 
                              type="button"
                              onClick={() => setShowNewEmpenhoModal(false)}
                              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-200 transition-all"
                            >
                              Cancelar
                            </button>
                            <button 
                              type="submit"
                              className="px-4 py-2 bg-[#00288e] text-white rounded-xl font-bold text-xs hover:bg-[#1e40af] transition-all shadow-sm"
                            >
                              Prosseguir
                            </button>
                          </div>
                        </form>
                      )}

                      {/* MODE 2: JSON IMPORT INPUT */}
                      {newEmpenhoMode === 'json' && !reviewEmpenho && (
                        <div className="p-5 space-y-4">
                          {/* PROMPT DOWNLOAD & INSTRUCTIONS CARD */}
                          <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-blue-50/90 border border-blue-100 rounded-2xl p-4 space-y-3 shadow-xs">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-[#00288e] text-white rounded-xl shadow-xs shrink-0">
                                  <FileText className="w-4.5 h-4.5" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-[#00288e] uppercase tracking-wider">
                                    Prompt para IA (Claude, ChatGPT ou Gemini)
                                  </h4>
                                  <p className="text-[11px] text-gray-600 font-medium">
                                    Baixe o prompt padronizado em <strong>TXT</strong> ou <strong>PDF</strong> para enviar junto ao PDF do Empenho para a IA converter em JSON.
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-blue-100/80">
                              <button
                                type="button"
                                onClick={handleDownloadPromptTxt}
                                className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95 hover:border-blue-300"
                                title="Baixar o arquivo prompt_extracao_empenho.txt"
                              >
                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                                <span>Baixar Prompt (.TXT)</span>
                              </button>
                              
                              <button
                                type="button"
                                onClick={handleDownloadPromptPdf}
                                className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95 hover:border-rose-300"
                                title="Baixar o arquivo prompt_extracao_empenho.pdf"
                              >
                                <FileDown className="w-3.5 h-3.5 text-rose-600" />
                                <span>Baixar Prompt (.PDF)</span>
                              </button>

                              <button
                                type="button"
                                onClick={handleCopyPrompt}
                                className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95 hover:border-emerald-300 sm:ml-auto"
                                title="Copiar texto do prompt para a área de transferência"
                              >
                                {copiedPrompt ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-emerald-700 font-bold">Copiado!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 text-gray-600" />
                                    <span>Copiar Prompt</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
                                Cole aqui o JSON retornado pela IA
                              </label>
                              <span className="text-[11px] text-gray-400 font-mono">
                                Formato JSON
                              </span>
                            </div>
                            <textarea
                              rows={10}
                              value={jsonInput}
                              onChange={(e) => setJsonInput(e.target.value)}
                              placeholder={`Cole aqui o resultado JSON gerado pela IA...\n\n{\n  "numero_empenho": "2025NE124",\n  "data_emissao": "2025-08-27",\n  "tipo_empenho": "Global",\n  "valor_total": 12043.80,\n  "fornecedor": {\n    "razao_social": "JULIANO LUCIO FRANCISCATTO DO AMARAL & CIA LT",\n    "cnpj": "02.483.088/0001-75"\n  },\n  "itens": [\n    {\n      "num_item": "001",\n      "codigo_item": "00002",\n      "descricao": "LEGUME PROCESSADO, TIPO MANDIOCA...",\n      "unidade": "kg",\n      "quantidade": 430,\n      "valor_unitario": 6.90,\n      "valor_total_item": 2967.00\n    }\n  ]\n}`}
                              className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-mono text-xs text-[#0b1c30] bg-gray-50/50 resize-y"
                            />
                          </div>

                          {jsonError && (
                            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-xs font-semibold flex items-start gap-2.5">
                              <AlertCircle className="w-4.5 h-4.5 shrink-0 text-rose-500" />
                              <span>{jsonError}</span>
                            </div>
                          )}

                          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                            <button
                              type="button"
                              onClick={() => {
                                setShowNewEmpenhoModal(false);
                                setJsonInput('');
                                setJsonError(null);
                              }}
                              className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-200 transition-all"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleProcessJson}
                              className="px-5 py-2.5 bg-[#00288e] text-white rounded-xl font-bold text-xs hover:bg-[#1e40af] transition-all shadow-sm flex items-center gap-1.5"
                            >
                              <Braces className="w-4 h-4" /> Processar JSON
                            </button>
                          </div>
                        </div>
                      )}

                      {/* MODE 2 SUB-VIEW: JSON REVIEW & EDIT SCREEN */}
                      {reviewEmpenho && (
                        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                          
                          {/* Top-level Metadata Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Número do Empenho</label>
                              <input
                                type="text"
                                value={reviewEmpenho.id}
                                onChange={(e) => setReviewEmpenho({ ...reviewEmpenho, id: e.target.value })}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-white text-xs font-bold text-[#0b1c30] focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Data de Emissão</label>
                              <input
                                type="text"
                                value={reviewEmpenho.date}
                                onChange={(e) => setReviewEmpenho({ ...reviewEmpenho, date: e.target.value })}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-white text-xs font-bold text-[#0b1c30] focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none"
                                placeholder="DD/MM/AAAA"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Classificação do Empenho</label>
                              <div className="grid grid-cols-3 gap-1">
                                {(['QR', 'CALI', 'PASA'] as const).map((type) => (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => setReviewEmpenho({ ...reviewEmpenho, classification: type })}
                                    className={`py-1.5 rounded-lg font-bold text-[10px] border transition-all ${
                                      reviewEmpenho.classification === type
                                        ? 'bg-[#00288e] text-white border-[#00288e]'
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                                  >
                                    {type}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Fornecedor / Razão Social</label>
                              <input
                                type="text"
                                value={reviewEmpenho.supplier}
                                onChange={(e) => setReviewEmpenho({ ...reviewEmpenho, supplier: e.target.value })}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-white text-xs font-bold text-[#0b1c30] focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">CNPJ do Fornecedor</label>
                              <input
                                type="text"
                                value={reviewEmpenho.cnpj || ''}
                                onChange={(e) => setReviewEmpenho({ ...reviewEmpenho, cnpj: e.target.value })}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-white text-xs font-bold text-[#0b1c30] focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none"
                                placeholder="00.000.000/0000-00"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Descrição Sumária do Contrato</label>
                              <input
                                type="text"
                                value={reviewEmpenho.description}
                                onChange={(e) => setReviewEmpenho({ ...reviewEmpenho, description: e.target.value })}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-white text-xs font-bold text-[#0b1c30] focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none"
                                placeholder="Ex: Aquisição de Insumos Gerais"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Pregão Relacionado</label>
                              <input
                                type="text"
                                value={reviewEmpenho.pregao}
                                onChange={(e) => setReviewEmpenho({ ...reviewEmpenho, pregao: e.target.value })}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-white text-xs font-bold text-[#0b1c30] focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none"
                                placeholder="Ex: 12/2025"
                              />
                            </div>
                          </div>

                          {/* Alert for Divergence */}
                          {reviewEmpenho && typeof reviewEmpenho.valorTotalDeclarado === 'number' && reviewEmpenho.valorTotalDeclarado > 0 && (
                            (() => {
                              const calculatedTotal = reviewEmpenho.items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
                              const isTotalDivergent = Math.abs(reviewEmpenho.valorTotalDeclarado - calculatedTotal) > 0.05;
                              if (isTotalDivergent) {
                                return (
                                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-xs font-semibold flex items-start gap-2.5">
                                    <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-amber-500" />
                                    <span>
                                      O valor total declarado (R$ {reviewEmpenho.valorTotalDeclarado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) difere da soma calculada dos itens (R$ {calculatedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Revise antes de salvar.
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })()
                          )}

                          {/* Items Section */}
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <h4 className="text-sm font-bold text-[#0b1c30] uppercase tracking-wider">Itens do Empenho ({reviewEmpenho.items.length})</h4>
                              <button
                                type="button"
                                onClick={() => {
                                  const newItem = {
                                    id: `ITEM-${Math.floor(Math.random() * 10000)}`,
                                    name: '',
                                    unit: 'UN',
                                    quantity: 1,
                                    unitPrice: 0,
                                    received: 0,
                                  };
                                  setReviewEmpenho({
                                    ...reviewEmpenho,
                                    items: [...reviewEmpenho.items, newItem],
                                  });
                                }}
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#00288e] rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                              >
                                <Plus className="w-3.5 h-3.5" /> Adicionar Item
                              </button>
                            </div>

                            {/* Scrollable table container */}
                            <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                    <th className="p-3 w-32">Cód. Item</th>
                                    <th className="p-3">Descrição</th>
                                    <th className="p-3 w-16">Unidade</th>
                                    <th className="p-3 w-20">Quantidade</th>
                                    <th className="p-3 w-28">V. Unitário (R$)</th>
                                    <th className="p-3 w-28 text-right">V. Total (R$)</th>
                                    <th className="p-3 w-16 text-center">Ações</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {reviewEmpenho.items.map((item: any, idx: number) => {
                                    const totalRow = item.quantity * item.unitPrice;
                                    return (
                                      <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                        <td className="p-2">
                                          <input
                                            type="text"
                                            value={item.id}
                                            onChange={(e) => {
                                              const updatedItems = [...reviewEmpenho.items];
                                              updatedItems[idx].id = e.target.value;
                                              setReviewEmpenho({ ...reviewEmpenho, items: updatedItems });
                                            }}
                                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#00288e] font-semibold text-gray-700"
                                          />
                                        </td>
                                        <td className="p-2">
                                          <input
                                            type="text"
                                            value={item.name}
                                            onChange={(e) => {
                                              const updatedItems = [...reviewEmpenho.items];
                                              updatedItems[idx].name = e.target.value;
                                              setReviewEmpenho({ ...reviewEmpenho, items: updatedItems });
                                            }}
                                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#00288e] font-semibold text-gray-700"
                                          />
                                        </td>
                                        <td className="p-2">
                                          <input
                                            type="text"
                                            value={item.unit}
                                            onChange={(e) => {
                                              const updatedItems = [...reviewEmpenho.items];
                                              updatedItems[idx].unit = e.target.value;
                                              setReviewEmpenho({ ...reviewEmpenho, items: updatedItems });
                                            }}
                                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#00288e] text-center font-bold text-gray-500"
                                          />
                                        </td>
                                        <td className="p-2">
                                          <input
                                            type="number"
                                            step="any"
                                            value={item.quantity}
                                            onChange={(e) => {
                                              const updatedItems = [...reviewEmpenho.items];
                                              updatedItems[idx].quantity = parseFloat(e.target.value) || 0;
                                              setReviewEmpenho({ ...reviewEmpenho, items: updatedItems });
                                            }}
                                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#00288e] text-center font-bold text-gray-700"
                                          />
                                        </td>
                                        <td className="p-2">
                                          <input
                                            type="number"
                                            step="any"
                                            value={item.unitPrice}
                                            onChange={(e) => {
                                              const updatedItems = [...reviewEmpenho.items];
                                              updatedItems[idx].unitPrice = parseFloat(e.target.value) || 0;
                                              setReviewEmpenho({ ...reviewEmpenho, items: updatedItems });
                                            }}
                                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#00288e] text-right font-bold text-gray-700"
                                          />
                                        </td>
                                        <td className="p-3 text-xs font-bold text-gray-700 text-right">
                                          R$ {totalRow.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-2 text-center">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updatedItems = reviewEmpenho.items.filter((_: any, i: number) => i !== idx);
                                              setReviewEmpenho({ ...reviewEmpenho, items: updatedItems });
                                            }}
                                            className="text-rose-600 hover:text-rose-800 font-extrabold text-xs p-1 hover:bg-rose-50 rounded-lg"
                                          >
                                            Excluir
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-gray-50/80 font-bold border-t border-gray-100 text-xs text-gray-700">
                                    <td colSpan={5} className="p-3 text-right text-gray-500">Valor Total da Lista:</td>
                                    <td className="p-3 text-right text-sm text-[#00288e] font-extrabold">
                                      R$ {reviewEmpenho.items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td></td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>

                          {/* Review footer buttons */}
                          <div className="pt-5 border-t border-gray-100 flex justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setReviewEmpenho(null);
                                setJsonError(null);
                              }}
                              className="px-4 py-2.5 bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold text-xs rounded-xl flex items-center gap-1 transition-all"
                            >
                              <ArrowLeft className="w-4 h-4" /> Voltar
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowConfirmSaveModal(true)}
                              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                            >
                              <Check className="w-4 h-4" /> Confirmar e Salvar Empenho
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Sub-modal: Confirm JSON Save Resumo */}
              <AnimatePresence>
                {showConfirmSaveModal && reviewEmpenho && (
                  <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-md w-full overflow-hidden"
                    >
                      <div className="bg-emerald-600 text-white p-5 flex justify-between items-center">
                        <h3 className="font-bold text-base tracking-tight flex items-center gap-1.5">
                          <CheckCircle2 className="w-5 h-5" /> Confirmar Cadastro
                        </h3>
                        <button 
                          onClick={() => setShowConfirmSaveModal(false)}
                          className="text-emerald-100 hover:text-white transition-all p-1"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="p-5 space-y-4 text-sm text-[#0b1c30]">
                        <p className="text-gray-500 font-semibold text-xs uppercase tracking-wider">Resumo do Novo Empenho</p>
                        
                        <div className="bg-gray-50 p-4 rounded-xl space-y-2 border border-gray-100">
                          <div className="flex justify-between">
                            <span className="text-gray-400 font-bold text-xs">Número NE:</span>
                            <span className="font-extrabold text-gray-800">{reviewEmpenho.id}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400 font-bold text-xs">Fornecedor:</span>
                            <span className="font-extrabold text-gray-800 text-right max-w-[200px] truncate">{reviewEmpenho.supplier}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400 font-bold text-xs">Total de Itens:</span>
                            <span className="font-extrabold text-gray-800">{reviewEmpenho.items.length}</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                            <span className="text-gray-500 font-extrabold text-xs">Valor Total:</span>
                            <span className="font-black text-emerald-600">
                              R$ {reviewEmpenho.items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-gray-400 leading-relaxed font-semibold">
                          Deseja confirmar o cadastro desta Nota de Empenho com as especificações acima? Esta ação persistirá os dados e atualizará o painel de faturamentos de forma definitiva.
                        </p>
                      </div>

                      <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setShowConfirmSaveModal(false)}
                          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-xl font-bold text-xs transition-all"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveReviewEmpenho}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-1"
                        >
                          Salvar Empenho
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

            </div>
          )}

          {/* TAB 3: GESTÃO DE NOTAS FISCAIS */}
          {activeTab === 'nova_nf' && (
            <div className="space-y-6">
              
              {/* Screen Header */}
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-[#00288e]">Notas Fiscais</h2>
                <p className="text-sm text-gray-500 font-medium font-semibold">Cadastre novas Notas Fiscais ou acompanhe a tramitação das notas já cadastradas</p>
              </div>

              {/* Sub-Tabs Toggle */}
              <div className="flex border-b border-gray-200 gap-6 flex-wrap">
                <button
                  onClick={() => setNfSubTab('acompanhar')}
                  className={`pb-3 font-bold text-sm transition-all relative ${
                    nfSubTab === 'acompanhar' 
                      ? 'text-[#00288e]' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Acompanhar Notas Cadastradas
                  {nfSubTab === 'acompanhar' && (
                    <motion.div layoutId="nfActiveSubTabBorder" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00288e]" />
                  )}
                </button>
                <button
                  onClick={() => setNfSubTab('cadastrar')}
                  className={`pb-3 font-bold text-sm transition-all relative ${
                    nfSubTab === 'cadastrar' 
                      ? 'text-[#00288e]' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Cadastrar Nova Nota Fiscal
                  {nfSubTab === 'cadastrar' && (
                    <motion.div layoutId="nfActiveSubTabBorder" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00288e]" />
                  )}
                </button>
                <button
                  onClick={() => setNfSubTab('comissao')}
                  className={`pb-3 font-bold text-sm transition-all relative ${
                    nfSubTab === 'comissao' 
                      ? 'text-[#00288e]' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Comissões de Recebimento
                  {nfSubTab === 'comissao' && (
                    <motion.div layoutId="nfActiveSubTabBorder" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00288e]" />
                  )}
                </button>
              </div>

              {/* Sub-Tab 1: Acompanhar Notas Cadastradas */}
              {nfSubTab === 'acompanhar' && (
                <div className="space-y-4">
                  {/* Search / Filter for Invoices */}
                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                    {/* Row 1: Search, Empenho, Mês, Apagar */}
                    <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
                      <div className="relative flex-1">
                        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                          type="text" 
                          placeholder="Buscar Nota Fiscal por nº, fornecedor ou empenho..."
                          value={nfSearch}
                          onChange={(e) => setNfSearch(e.target.value)}
                          className="w-full pl-12 pr-4 h-11 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] transition-all font-medium text-sm text-[#0b1c30] placeholder-gray-400 outline-none"
                        />
                      </div>

                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                        {/* Empenho Filter */}
                        <div className="flex-1 sm:flex-initial">
                          <select
                            value={nfEmpenhoFilter}
                            onChange={(e) => setNfEmpenhoFilter(e.target.value)}
                            className="w-full sm:w-auto h-11 px-3.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-bold text-xs sm:text-sm text-[#0b1c30] shadow-sm min-w-[150px]"
                          >
                            <option value="Todos">Todos os Empenhos</option>
                            {Array.from(new Set([...empenhos.map(e => e.id), ...invoices.map(i => i.empenhoId)].filter(Boolean))).map(empId => (
                              <option key={empId} value={empId}>
                                NE {empId}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Month Filter */}
                        <div className="flex-1 sm:flex-initial">
                          <select
                            value={nfMonthFilter}
                            onChange={(e) => setNfMonthFilter(e.target.value)}
                            className="w-full sm:w-auto h-11 px-3.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-bold text-xs sm:text-sm text-[#0b1c30] shadow-sm min-w-[150px]"
                          >
                            <option value="Todos">Todos os Meses</option>
                            {uniqueNfMonths.map(monthStr => {
                              const [year, month] = monthStr.split('-');
                              const monthNames = [
                                'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                                'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                              ];
                              const monthIdx = parseInt(month, 10) - 1;
                              const label = `${monthNames[monthIdx]} / ${year}`;
                              return (
                                <option key={monthStr} value={monthStr}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {invoices.length > 0 && (
                          <button
                            onClick={handleDeleteAllInvoices}
                            className="h-11 px-3.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm whitespace-nowrap"
                            title="Apagar todas as notas fiscais cadastradas"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden xl:inline">Apagar Todas</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Status Tramitação (Pills) + Ordenação */}
                    <div className="pt-3 border-t border-gray-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
                      {/* Tramitação Status Pills */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mr-1 hidden sm:inline">Tramitação:</span>
                        
                        <button
                          type="button"
                          onClick={() => setNfTramitacaoFilter('Todos')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            nfTramitacaoFilter === 'Todos'
                              ? 'bg-[#00288e] text-white shadow-sm'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                          }`}
                        >
                          <span>Todas</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            nfTramitacaoFilter === 'Todos' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                          }`}>
                            {invoices.length}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setNfTramitacaoFilter('FaltaComissao')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            nfTramitacaoFilter === 'FaltaComissao'
                              ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-200'
                              : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/60'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Falta Enviar p/ Comissão</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                            nfTramitacaoFilter === 'FaltaComissao' ? 'bg-white/30 text-white' : 'bg-amber-200 text-amber-900'
                          }`}>
                            {invoices.filter(i => !i.comissaoDate).length}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setNfTramitacaoFilter('FaltaTesouraria')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            nfTramitacaoFilter === 'FaltaTesouraria'
                              ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200'
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200/60'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Falta Enviar p/ Tesouraria</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                            nfTramitacaoFilter === 'FaltaTesouraria' ? 'bg-white/30 text-white' : 'bg-indigo-200 text-indigo-900'
                          }`}>
                            {invoices.filter(i => !i.tesourariaDate).length}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setNfTramitacaoFilter('Concluidas')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            nfTramitacaoFilter === 'Concluidas'
                              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/60'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Concluídas / Tesouraria</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                            nfTramitacaoFilter === 'Concluidas' ? 'bg-white/30 text-white' : 'bg-emerald-200 text-emerald-900'
                          }`}>
                            {invoices.filter(i => !!i.tesourariaDate).length}
                          </span>
                        </button>
                      </div>

                      {/* Ordenação Filter */}
                      <div className="flex items-center gap-2 self-end md:self-auto flex-shrink-0">
                        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
                          <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" />
                          Ordenar:
                        </span>
                        <select
                          value={nfSortOrder}
                          onChange={(e) => setNfSortOrder(e.target.value as 'recentes' | 'antigas')}
                          className="h-9 px-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white focus:bg-white focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-bold text-xs text-[#0b1c30] shadow-xs cursor-pointer"
                        >
                          <option value="recentes">Mais Recentes Primeiro (Mais novas)</option>
                          <option value="antigas">Mais Antigas Primeiro (Mais antigas)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* List of Invoices */}
                  <div className="space-y-4">
                    {(() => {
                      const filteredInvoices = invoices.filter(inv => {
                        const term = nfSearch.toLowerCase();
                        const matchesSearch = (
                          inv.id.toLowerCase().includes(term) ||
                          inv.supplier.toLowerCase().includes(term) ||
                          inv.empenhoId.toLowerCase().includes(term)
                        );

                        const matchesMonth = nfMonthFilter === 'Todos' || 
                          (inv.issueDate && inv.issueDate.startsWith(nfMonthFilter));

                        const matchesEmpenho = nfEmpenhoFilter === 'Todos' || inv.empenhoId === nfEmpenhoFilter;

                        let matchesTramitacao = true;
                        if (nfTramitacaoFilter === 'FaltaComissao') {
                          matchesTramitacao = !inv.comissaoDate;
                        } else if (nfTramitacaoFilter === 'FaltaTesouraria') {
                          matchesTramitacao = !inv.tesourariaDate;
                        } else if (nfTramitacaoFilter === 'Concluidas') {
                          matchesTramitacao = !!inv.tesourariaDate;
                        }

                        return matchesSearch && matchesMonth && matchesEmpenho && matchesTramitacao;
                      }).sort((a, b) => {
                        const getTimestamp = (inv: Invoice): number => {
                          const raw = inv.registeredAt || inv.issueDate;
                          if (!raw) return 0;
                          if (raw.includes('/') && raw.split('/').length === 3) {
                            const parts = raw.split('/');
                            return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime() || 0;
                          }
                          const t = new Date(raw).getTime();
                          return isNaN(t) ? 0 : t;
                        };

                        const timeA = getTimestamp(a);
                        const timeB = getTimestamp(b);
                        if (timeA !== timeB) {
                          return nfSortOrder === 'recentes' ? timeB - timeA : timeA - timeB;
                        }
                        return nfSortOrder === 'recentes' 
                          ? b.id.localeCompare(a.id, undefined, { numeric: true }) 
                          : a.id.localeCompare(b.id, undefined, { numeric: true });
                      });

                      if (filteredInvoices.length === 0) {
                        return (
                          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center">
                            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-gray-400">Nenhuma Nota Fiscal encontrada.</p>
                            <button 
                              onClick={() => setNfSubTab('cadastrar')}
                              className="mt-3 text-[#00288e] text-xs font-bold hover:underline animate-pulse"
                            >
                              Lançar nova nota fiscal agora
                            </button>
                          </div>
                        );
                      }

                      return filteredInvoices.map((inv) => (
                        <div key={inv.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4 hover:border-blue-100 transition-all">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-gray-50">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="bg-blue-50 text-[#00288e] text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                                  NF-e #{inv.id}
                                </span>
                                {inv.termoNumero && (
                                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Termo Nº {inv.termoNumero} ({formatDateOnly(inv.termoEmissaoDate || inv.registeredAt || inv.issueDate)})
                                  </span>
                                )}
                                <span className="text-gray-400 text-xs font-semibold">
                                  Empenho: <span className="font-bold text-gray-600">{inv.empenhoId}</span>
                                </span>
                              </div>
                              <h4 className="text-base font-bold text-[#0b1c30] mt-1">{inv.supplier}</h4>
                            </div>
                            <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                              <div className="text-left sm:text-right">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Valor Total</p>
                                <p className="text-lg font-extrabold text-[#00288e]">
                                  R$ {inv.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 border-l pl-3 border-gray-100">
                                <button
                                  onClick={() => handleEditInvoice(inv)}
                                  className="p-2 text-[#00288e] hover:bg-blue-50 rounded-xl transition-all active:scale-95 border border-blue-50 hover:border-blue-100"
                                  title="Editar Nota Fiscal"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteInvoice(inv)}
                                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all active:scale-95 border border-rose-50 hover:border-rose-100"
                                  title="Excluir Nota Fiscal"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                            {/* 1. DATA DE CADASTRAMENTO */}
                            <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 flex items-center gap-3">
                              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <Calendar className="w-5 h-5" />
                              </div>
                              <div>
                                <span className="text-[10px] text-gray-400 font-bold uppercase block">Cadastramento</span>
                                <span className="text-xs font-bold text-gray-700">
                                  {inv.registeredAt ? formatDateTime(inv.registeredAt) : formatDateTime(inv.issueDate)}
                                </span>
                              </div>
                            </div>

                            {/* 2. COMISSÃO DE RECEBIMENTO */}
                            <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 flex flex-col justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${inv.comissaoDate ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                  <CheckCircle2 className="w-5 h-5" />
                                </div>
                                <div>
                                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Comissão de Recebimento</span>
                                  {inv.comissaoDate ? (
                                    <span className="text-xs font-bold text-emerald-700">
                                      Recebido: {formatDateTime(inv.comissaoDate)}
                                    </span>
                                  ) : (
                                    <span className="text-xs font-semibold text-amber-600">Aguardando Envio</span>
                                  )}
                                </div>
                              </div>
                              
                              {!inv.comissaoDate && (
                                <button
                                  onClick={() => handleMarkComissao(inv.id)}
                                  className="mt-1 w-full py-1.5 bg-[#dde1ff] hover:bg-[#00288e] text-[#001453] hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                >
                                  <Check className="w-3.5 h-3.5" /> Enviar p/ Comissão
                                </button>
                              )}
                            </div>

                            {/* 3. SETOR DE TESOURARIA */}
                            <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 flex flex-col justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${inv.tesourariaDate ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                                  <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Setor de Tesouraria (Fim)</span>
                                  {inv.tesourariaDate ? (
                                    <span className="text-xs font-bold text-purple-700">
                                      Pago/Finalizado: {formatDateTime(inv.tesourariaDate)}
                                    </span>
                                  ) : (
                                    <span className="text-xs font-semibold text-gray-400 font-medium">Pendente</span>
                                  )}
                                </div>
                              </div>

                              {!inv.tesourariaDate && (
                                <button
                                  onClick={() => handleMarkTesouraria(inv.id)}
                                  disabled={!inv.comissaoDate}
                                  className={`mt-1 w-full py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    inv.comissaoDate 
                                      ? 'bg-[#00288e] hover:bg-[#1e40af] text-white shadow-sm' 
                                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  }`}
                                  title={!inv.comissaoDate ? "Envie primeiro para a Comissão de Recebimento" : ""}
                                >
                                  <Check className="w-3.5 h-3.5" /> Enviar p/ Tesouraria
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* Show invoice items inside for full details */}
                          <div className="bg-gray-50/30 rounded-xl p-3 border border-gray-100/50 mt-2">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Itens Conciliados</p>
                            <div className="space-y-1.5">
                              {inv.items.map((it, idx) => {
                                const targetEmp = empenhos.find(e => e.id === inv.empenhoId);
                                const targetItem = targetEmp?.items.find(i => i.id === it.itemId);
                                return (
                                  <div key={idx} className="flex justify-between text-xs text-gray-600 font-semibold">
                                    <span>{targetItem ? targetItem.name : `Item ID: ${it.itemId}`} × {it.quantity}</span>
                                    <span className="font-extrabold text-gray-700">R$ {it.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <button
                            onClick={() => handleDownloadTermoRecebimento(inv)}
                            className="w-full mt-3 py-2.5 bg-gradient-to-r from-emerald-600 to-[#00288e] hover:from-emerald-700 hover:to-[#001e6a] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-[0.98]"
                          >
                            <FileDown className="w-4 h-4" /> Gerar Termo de Recebimento de Artigos de QR (PDF)
                          </button>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* Sub-Tab 2: Cadastrar Nova Nota Fiscal */}
              {nfSubTab === 'cadastrar' && (
                <div className="space-y-6">
                  {editingInvoice && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-sm">
                      <div className="flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-amber-900">Modo de Edição de Nota Fiscal</p>
                          <p className="text-xs font-semibold text-amber-700">Você está alterando os dados da Nota Fiscal nº {editingInvoice.id}.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setEditingInvoice(null);
                          setNfNumber('');
                          setNfQuantities({});
                          setNfSubTab('acompanhar');
                          showToast('Edição cancelada.', 'info');
                        }}
                        className="px-4 py-2 bg-white hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
                      >
                        Cancelar Edição
                      </button>
                    </div>
                  )}

                  {/* Step 1: Select Active Commitment */}
                  <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                    <h3 className="font-bold text-sm text-[#00288e] uppercase tracking-wider flex items-center gap-1.5">
                      <Search className="w-4 h-4" /> 1. VINCULAR AO EMPENHO ATIVO
                    </h3>
                    
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Pesquise e selecione a Nota de Empenho vinculada</label>
                      <select 
                        value={selectedNFCommitmentId}
                        onChange={(e) => setSelectedNFCommitmentId(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-bold text-sm text-[#0b1c30] shadow-sm"
                      >
                        {empenhos
                          .filter(emp => emp.status === 'Ativo' || emp.id === selectedNFCommitmentId)
                          .map(emp => (
                            <option key={emp.id} value={emp.id}>
                              {emp.id} - {emp.supplier} ({emp.description})
                            </option>
                          ))}
                      </select>
                    </div>
                  </section>

                  {/* Step 2: Invoice Metadata details */}
                  <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                    <h3 className="font-bold text-sm text-[#00288e] uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4" /> 2. DADOS DA NOTA FISCAL
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Número da Nota Fiscal (NF-e)</label>
                        <input 
                          type="number" 
                          placeholder="Ex: 102938"
                          value={nfNumber}
                          onChange={(e) => setNfNumber(e.target.value)}
                          className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#00288e] outline-none font-semibold text-sm text-[#0b1c30] transition-colors shadow-inner"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Data de Emissão da NF</label>
                        <input 
                          type="date" 
                          value={nfDate}
                          onChange={(e) => setNfDate(e.target.value)}
                          className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#00288e] outline-none font-semibold text-sm text-[#0b1c30] transition-colors shadow-inner"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Step 3: Items reconciliation table */}
                  <section className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <h3 className="font-bold text-xs text-gray-400 uppercase tracking-wider">
                        ITENS DO EMPENHO #{selectedNFCommitmentId}
                      </h3>
                      <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold text-xs">Pendente</span>
                    </div>

                    {/* Grid checklist of items */}
                    {(() => {
                      const targetEmpenho = empenhos.find(e => e.id === selectedNFCommitmentId);
                      if (!targetEmpenho || targetEmpenho.items.length === 0) {
                        return (
                          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center">
                            <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-gray-400">Nenhum item cadastrado neste empenho.</p>
                            <button 
                              onClick={() => { setEditingEmpenhoId(selectedNFCommitmentId); setActiveTab('itens_empenho'); }}
                              className="mt-3 text-[#00288e] text-xs font-bold hover:underline"
                            >
                              Ir cadastrar itens no empenho
                            </button>
                          </div>
                        );
                      }

                      let grandTotal = 0;

                      return (
                        <div className="space-y-4 pb-32">
                          {targetEmpenho.items.map((item) => {
                            const oldItemQty = editingInvoice 
                              ? (editingInvoice.items.find(it => it.itemId === item.id)?.quantity || 0)
                              : 0;
                            const balance = item.quantity - item.received + oldItemQty;
                            const inputVal = nfQuantities[item.id] || 0;
                            const subtotal = inputVal * item.unitPrice;
                            grandTotal += subtotal;

                            return (
                              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm space-y-4 transition-all hover:border-blue-100">
                                <div className="flex justify-between items-start gap-4">
                                  <span className="font-bold text-sm text-gray-800 leading-tight line-clamp-2">{item.name}</span>
                                  <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">ID: {item.id}</span>
                                </div>

                                <div className="flex items-center gap-6 flex-wrap sm:flex-nowrap">
                                  <div className="flex flex-col min-w-[100px]">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Saldo do Empenho</span>
                                    <span className="text-lg font-extrabold text-[#0058be]">
                                      {balance.toLocaleString('pt-BR')} <span className="text-xs font-semibold text-gray-400">{item.unit}</span>
                                    </span>
                                  </div>

                                  <div className="flex-1 min-w-[150px]">
                                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Qtd nesta NF</label>
                                    <input 
                                      type="number"
                                      min="0"
                                      placeholder="0"
                                      value={nfQuantities[item.id] === undefined || nfQuantities[item.id] === 0 ? '' : nfQuantities[item.id]}
                                      onChange={(e) => {
                                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                                        setNfQuantities({
                                          ...nfQuantities,
                                          [item.id]: val,
                                        });
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                          e.preventDefault();
                                        }
                                      }}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      className={`w-full h-11 text-center font-bold text-lg rounded-xl focus:ring-2 outline-none transition-all ${
                                        inputVal > balance
                                          ? 'bg-rose-50 text-rose-700 border-rose-300 focus:ring-rose-200 focus:border-rose-500 border'
                                          : inputVal > 0 
                                            ? 'bg-[#dde1ff] text-[#001453] border-transparent focus:ring-[#00288e]' 
                                            : 'bg-gray-50 text-gray-700 border border-gray-100 focus:ring-blue-200'
                                      }`}
                                    />
                                    {inputVal > balance && (
                                      <p className="text-[10px] text-rose-600 font-bold mt-1 text-center animate-pulse">
                                        Excede o saldo disponível ({balance})
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex justify-between items-center pt-3 border-t border-gray-100 text-xs">
                                  <span className="text-gray-400 font-medium">Vlr. Unit: R$ {item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                  <div className="text-right">
                                    <span className="text-[10px] text-gray-400 font-bold block">Subtotal</span>
                                    <span className="font-bold text-sm text-[#00288e]">
                                      R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {/* Floating bottom footer specifically for the NF totals */}
                          <footer className="fixed bottom-0 left-0 lg:left-72 right-0 bg-white border-t border-gray-100 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] p-4 z-40">
                            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Valor Total da NF</span>
                                <span className="text-xl sm:text-2xl font-extrabold text-[#00288e]">
                                  R$ {grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <button 
                                onClick={handleSaveInvoice}
                                className="h-12 px-6 sm:px-8 bg-[#00288e] text-white rounded-full font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all duration-100 hover:bg-[#1e40af] flex items-center gap-2"
                              >
                                <Save className="w-4 h-4" /> Salvar Recebimento
                              </button>
                            </div>
                          </footer>

                        </div>
                      );
                    })()}
                  </section>
                </div>
              )}

              {/* Sub-Tab 3: Comissões de Recebimento */}
              {nfSubTab === 'comissao' && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 pb-24">
                  {/* Left Column: Register New Committee */}
                  <div className="xl:col-span-6 bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-[#0b1c30] tracking-tight flex items-center gap-2">
                        <Users className="w-5 h-5 text-[#00288e]" /> Cadastrar Comissão de Recebimento
                      </h3>
                      <p className="text-xs text-gray-500 font-medium font-semibold">As comissões são nomeadas mensalmente por Boletim do HGeSM</p>
                    </div>

                    <div className="space-y-4">
                      {/* Month of reference */}
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Mês da Comissão</label>
                        <input 
                          type="month"
                          value={comissaoMes}
                          onChange={(e) => setComissaoMes(e.target.value)}
                          className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#00288e] outline-none font-semibold text-sm text-[#0b1c30] transition-colors shadow-inner"
                        />
                      </div>

                      {/* Bulletin details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Boletim Interno nº</label>
                          <input 
                            type="text"
                            placeholder="Ex: 145"
                            value={comissaoBoletimNum}
                            onChange={(e) => setComissaoBoletimNum(e.target.value)}
                            className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#00288e] outline-none font-semibold text-sm text-[#0b1c30] transition-colors shadow-inner"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Data do Boletim</label>
                          <input 
                            type="date"
                            value={comissaoBoletimDate}
                            onChange={(e) => setComissaoBoletimDate(e.target.value)}
                            className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#00288e] outline-none font-semibold text-sm text-[#0b1c30] transition-colors shadow-inner"
                          />
                        </div>
                      </div>

                      {/* President */}
                      <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100/50 space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b border-blue-100/30">
                          <UserCheck className="w-4 h-4 text-[#00288e]" />
                          <span className="text-xs font-extrabold text-[#00288e] uppercase tracking-wider">Presidente da Comissão</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-1">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Posto/Grad.</label>
                            <select
                              value={comissaoPresPosto}
                              onChange={(e) => setComissaoPresPosto(e.target.value)}
                              className="w-full h-10 px-2 rounded-lg border border-gray-200 bg-white focus:border-[#00288e] outline-none font-bold text-xs text-[#0b1c30]"
                            >
                              {MILITARY_RANKS.map(rank => (
                                <option key={rank} value={rank}>{rank}</option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nome Completo</label>
                            <input 
                              type="text"
                              placeholder="Ex: Carlos Eduardo Souza Silva"
                              value={comissaoPresNome}
                              onChange={(e) => setComissaoPresNome(e.target.value)}
                              className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:border-[#00288e] outline-none font-semibold text-xs text-[#0b1c30] shadow-sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Auxiliaries */}
                      <div className="p-4 bg-gray-50/70 rounded-xl border border-gray-100 space-y-4">
                        <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider block border-b border-gray-200/50 pb-2">
                          Membros Auxiliares (Três Auxiliares)
                        </span>

                        {/* Auxiliary 1 */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">1º Auxiliar</span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-1">
                              <select
                                value={comissaoAux1Posto}
                                onChange={(e) => setComissaoAux1Posto(e.target.value)}
                                className="w-full h-10 px-2 rounded-lg border border-gray-200 bg-white focus:border-[#00288e] outline-none font-bold text-xs text-[#0b1c30]"
                              >
                                {MILITARY_RANKS.map(rank => (
                                  <option key={rank} value={rank}>{rank}</option>
                                ))}
                              </select>
                            </div>
                            <div className="sm:col-span-2">
                              <input 
                                type="text"
                                placeholder="Nome completo do 1º auxiliar"
                                value={comissaoAux1Nome}
                                onChange={(e) => setComissaoAux1Nome(e.target.value)}
                                className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:border-[#00288e] outline-none font-semibold text-xs text-[#0b1c30] shadow-sm"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Auxiliary 2 */}
                        <div className="space-y-1 pt-2 border-t border-gray-200/30">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">2º Auxiliar</span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-1">
                              <select
                                value={comissaoAux2Posto}
                                onChange={(e) => setComissaoAux2Posto(e.target.value)}
                                className="w-full h-10 px-2 rounded-lg border border-gray-200 bg-white focus:border-[#00288e] outline-none font-bold text-xs text-[#0b1c30]"
                              >
                                {MILITARY_RANKS.map(rank => (
                                  <option key={rank} value={rank}>{rank}</option>
                                ))}
                              </select>
                            </div>
                            <div className="sm:col-span-2">
                              <input 
                                type="text"
                                placeholder="Nome completo do 2º auxiliar"
                                value={comissaoAux2Nome}
                                onChange={(e) => setComissaoAux2Nome(e.target.value)}
                                className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:border-[#00288e] outline-none font-semibold text-xs text-[#0b1c30] shadow-sm"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Auxiliary 3 */}
                        <div className="space-y-1 pt-2 border-t border-gray-200/30">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">3º Auxiliar</span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-1">
                              <select
                                value={comissaoAux3Posto}
                                onChange={(e) => setComissaoAux3Posto(e.target.value)}
                                className="w-full h-10 px-2 rounded-lg border border-gray-200 bg-white focus:border-[#00288e] outline-none font-bold text-xs text-[#0b1c30]"
                              >
                                {MILITARY_RANKS.map(rank => (
                                  <option key={rank} value={rank}>{rank}</option>
                                ))}
                              </select>
                            </div>
                            <div className="sm:col-span-2">
                              <input 
                                type="text"
                                placeholder="Nome completo do 3º auxiliar"
                                value={comissaoAux3Nome}
                                onChange={(e) => setComissaoAux3Nome(e.target.value)}
                                className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:border-[#00288e] outline-none font-semibold text-xs text-[#0b1c30] shadow-sm"
                              />
                            </div>
                          </div>
                        </div>

                      </div>

                      <button
                        onClick={handleSaveComissao}
                        className="w-full h-11 bg-[#00288e] text-white rounded-xl font-bold text-xs hover:bg-[#1e40af] transition-all flex items-center justify-center gap-2 shadow-md active:scale-95"
                      >
                        <Save className="w-4 h-4" /> Salvar Comissão de Recebimento
                      </button>

                    </div>
                  </div>

                  {/* Right Column: List Existing Committees */}
                  <div className="xl:col-span-6 space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <div>
                        <h3 className="text-lg font-bold text-[#0b1c30] tracking-tight">Comissões Nomeadas</h3>
                        <p className="text-xs text-gray-500 font-medium">Histórico mensal de comissões ativas no HGeSM</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {comissoes.length > 0 && (
                          <button
                            onClick={handleDeleteAllComissoes}
                            className="px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[11px] flex items-center gap-1.5 active:scale-95 transition-all shadow-sm cursor-pointer"
                            title="Apagar todas as comissões cadastradas"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Apagar Todas
                          </button>
                        )}
                        <span className="bg-blue-50 text-[#00288e] text-xs font-bold px-3 py-1 rounded-full border border-blue-100">
                          {comissoes.length} {comissoes.length === 1 ? 'comissão' : 'comissões'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4 overflow-y-auto max-h-[700px] pr-1">
                      {comissoes.length === 0 ? (
                        <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center">
                          <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-gray-400">Nenhuma comissão cadastrada.</p>
                        </div>
                      ) : (
                        comissoes.map((com) => {
                          const [year, month] = com.mesReferencia.split('-');
                          const monthNames = [
                            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                          ];
                          const monthName = monthNames[parseInt(month, 10) - 1] || com.mesReferencia;

                          return (
                            <div key={com.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4 hover:border-blue-100 transition-all relative group">
                              <div className="flex justify-between items-start gap-4">
                                <div>
                                  <h4 className="text-base font-extrabold text-[#00288e]">
                                    {monthName} de {year}
                                  </h4>
                                  <p className="text-xs text-gray-400 font-semibold mt-0.5">
                                    Mês de Referência: <span className="font-bold text-gray-600">{com.mesReferencia}</span>
                                  </p>
                                </div>
                                <button
                                  onClick={async () => {
                                    if (confirm('Tem certeza que deseja excluir esta comissão?')) {
                                      const updated = comissoes.filter(c => c.id !== com.id);
                                      setComissoes(updated);
                                      if (user) {
                                        try {
                                          await removeComissao(user.uid, com.id);
                                        } catch (error) {
                                          showToast('Erro ao remover no Firebase', 'error');
                                        }
                                      }
                                      showToast('Comissão excluída com sucesso!', 'info');
                                    }
                                  }}
                                  className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all duration-200"
                                  title="Excluir Comissão"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs text-gray-600 space-y-1">
                                <p className="font-bold text-[#0b1c30]">Nomeação por Boletim Interno</p>
                                <p className="font-medium text-gray-500">
                                  Boletim Interno nº <span className="font-bold text-gray-700">{com.boletimNumero}</span> do HGeSM de <span className="font-bold text-gray-700">
                                    {(() => {
                                      try {
                                        const [y, m, d] = com.boletimData.split('-');
                                        return `${d}/${m}/${y}`;
                                      } catch {
                                        return com.boletimData;
                                      }
                                    })()}
                                  </span>
                                </p>
                              </div>

                              <div className="space-y-2">
                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Membros Constituintes</div>
                                
                                {/* President item */}
                                <div className="flex items-center gap-3 bg-blue-50/40 p-2.5 rounded-lg border border-blue-50/80 text-xs">
                                  <div className="w-6 h-6 rounded-full bg-blue-100 text-[#00288e] flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                                    P
                                  </div>
                                  <div>
                                    <span className="font-bold text-gray-400 block text-[9px] uppercase tracking-wider">Presidente</span>
                                    <span className="font-extrabold text-[#00288e]">{com.presidente.postoGraduacao}</span> {com.presidente.nomeCompleto}
                                  </div>
                                </div>

                                {/* Auxiliaries list */}
                                <div className="grid grid-cols-1 gap-2">
                                  {com.auxiliares.map((aux, idx) => (
                                    <div key={idx} className="flex items-center gap-3 bg-gray-50/40 p-2.5 rounded-lg border border-gray-100 text-xs">
                                      <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                                        A{idx + 1}
                                      </div>
                                      <div>
                                        <span className="font-bold text-gray-400 block text-[9px] uppercase tracking-wider">{idx + 1}º Auxiliar</span>
                                        <span className="font-extrabold text-gray-700">{aux.postoGraduacao}</span> {aux.nomeCompleto}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 4: CONCILIAÇÃO E RELATÓRIO DO RECEBIMENTO */}
          {activeTab === 'relatorios' && (
            <div className="space-y-6">
              
              {/* Screen Title */}
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-[#00288e]">Empenhos</h2>
                <p className="text-sm text-gray-500 font-medium">Conciliação de Notas Fiscais, Notas de Empenho e saldos logísticos</p>
              </div>

              {/* Filter form */}
              <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="col-span-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Filtrar por Pregão</label>
                    <select
                      value={relatoriosPregaoFilter}
                      onChange={(e) => {
                        const nextPregao = e.target.value;
                        setRelatoriosPregaoFilter(nextPregao);
                        const filtered = empenhos.filter(emp => nextPregao === 'Todos' || emp.pregao === nextPregao);
                        if (filtered.length > 0) {
                          const isStillValid = filtered.some(emp => emp.id === reportSearch);
                          if (!isStillValid) {
                            setReportSearch(filtered[0].id);
                          }
                        }
                      }}
                      className="w-full h-11 px-3 border border-gray-200 rounded-xl bg-white text-sm font-semibold text-gray-700 outline-none focus:border-[#00288e]"
                    >
                      <option value="Todos">Todos os Pregões</option>
                      {uniquePregaos.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Selecionar Empenho (NE)</label>
                    <select 
                      value={reportSearch}
                      onChange={(e) => setReportSearch(e.target.value)}
                      className="w-full h-11 px-3 border border-gray-200 rounded-xl bg-white text-sm font-semibold text-gray-700 outline-none focus:border-[#00288e]"
                    >
                      {empenhos
                        .filter(emp => relatoriosPregaoFilter === 'Todos' || emp.pregao === relatoriosPregaoFilter)
                        .map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.id} - {emp.supplier}</option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Período Inicial</label>
                    <input 
                      type="date" 
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="w-full h-11 px-3 border border-gray-200 rounded-xl bg-white text-sm font-semibold text-gray-700 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Período Final</label>
                    <input 
                      type="date" 
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="w-full h-11 px-3 border border-gray-200 rounded-xl bg-white text-sm font-semibold text-gray-700 outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button className="h-11 px-6 bg-[#00288e] text-white font-bold text-xs rounded-xl hover:bg-[#1e40af] transition-all flex items-center gap-2 shadow-sm">
                    <Filter className="w-4 h-4" /> Filtrar Conciliação
                  </button>
                </div>
              </section>

              {/* Reconciliation Report Card */}
              {(() => {
                const emp = empenhos.find(e => e.id === reportSearch);
                if (!emp) {
                  return (
                    <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center">
                      <p className="text-sm font-semibold text-gray-400">Selecione uma Nota de Empenho acima para gerar o relatório.</p>
                    </div>
                  );
                }

                const totalCommitted = emp.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
                
                // Get linked invoices list
                const linkedInvoices = invoices.filter(inv => inv.empenhoId === emp.id);
                const totalReceivedNfe = linkedInvoices.reduce((sum, inv) => sum + inv.totalValue, 0);
                const totalPendingToReceive = Math.max(0, totalCommitted - totalReceivedNfe);

                return (
                  <div className="space-y-6">
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                      
                      {/* Card header banner */}
                      <div className="bg-[#00288e] text-white p-5 flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-bold tracking-wider text-blue-100 uppercase">{emp.id} - DETALHAMENTO</p>
                          <h3 className="font-extrabold text-base sm:text-lg">{emp.description}</h3>
                        </div>
                        <span className="bg-white text-[#00288e] px-3 py-1 rounded-full font-bold text-xs tracking-wider uppercase">
                          {emp.status === 'Ativo' ? 'Em Andamento' : emp.status}
                        </span>
                      </div>

                      {/* Numeric summary block */}
                      <div className="p-5 border-b border-gray-50 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">VALOR TOTAL EMPENHADO</span>
                            <span className="text-xl sm:text-2xl font-black text-[#00288e]">
                              R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">TOTAL RECEBIDO (NF-e)</span>
                            <span className="text-xl sm:text-2xl font-black text-emerald-600">
                              R$ {totalReceivedNfe.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">TOTAL A RECEBER</span>
                            <span className={`text-xl sm:text-2xl font-black ${totalPendingToReceive > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                              R$ {totalPendingToReceive.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">QTD. DE NOTAS FISCAIS</span>
                            <span className="text-xl sm:text-2xl font-black text-gray-700">
                              {linkedInvoices.length > 0 ? `0${linkedInvoices.length}` : 'Nenhuma'} 
                              <span className="text-xs font-semibold text-gray-400 ml-1.5">
                                {linkedInvoices.length > 0 && `(NF ${linkedInvoices.map(i => i.id).join(', ')})`}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Items reconciliation lists matching image 1 */}
                      <div className="p-5 space-y-4">
                        <h4 className="font-extrabold text-sm text-gray-700 uppercase tracking-wider">Itens do Empenho</h4>
                        
                        <div className="space-y-4">
                          {emp.items.length === 0 ? (
                            <p className="text-xs text-gray-500 italic py-2">Sem itens vinculados a esta Nota de Empenho.</p>
                          ) : (
                            emp.items.map((item) => {
                              const pct = item.quantity > 0 ? Math.round((item.received / item.quantity) * 100) : 0;
                              const balance = item.quantity - item.received;
                              
                              // Visual variation of bars matching image 1 (Dipirona progress is red, others are blue)
                              const isAlertState = pct <= 30;

                              return (
                                <div key={item.id} className="space-y-1.5">
                                  <div className="flex justify-between items-start text-xs font-bold text-gray-700">
                                    <div>
                                      <p className="font-extrabold text-gray-800">{item.name}</p>
                                      <span className="text-[10px] text-gray-400 font-semibold font-mono">ID: {item.id}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className={`${isAlertState ? 'text-rose-600' : 'text-[#00288e]'}`}>{pct}%</span>
                                      <span className="text-gray-400 ml-2 font-normal">
                                        {balance === 0 ? 'Concluído' : `${balance.toLocaleString('pt-BR')} ${item.unit} rest.`}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full transition-all duration-500 ${isAlertState ? 'bg-rose-600' : 'bg-[#00288e]'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Relatório de Notas Fiscais Cadastradas */}
                      <div className="p-5 border-t border-gray-100 bg-[#f8f9ff]/50 space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="font-extrabold text-sm text-gray-700 uppercase tracking-wider flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#00288e]" /> Notas Fiscais Cadastradas no Empenho
                          </h4>
                          <span className="text-xs bg-[#e5eeff] text-[#00288e] px-2.5 py-0.5 rounded-full font-bold">
                            {linkedInvoices.length} {linkedInvoices.length === 1 ? 'Nota' : 'Notas'}
                          </span>
                        </div>

                        {linkedInvoices.length === 0 ? (
                          <div className="p-6 bg-white rounded-xl text-center border border-dashed border-gray-200">
                            <p className="text-xs text-gray-500 font-medium">Nenhuma nota fiscal cadastrada para este empenho até o momento.</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
                            <table className="w-full text-left border-collapse text-xs sm:text-sm">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-[11px] uppercase tracking-wider">
                                  <th className="py-3 px-3.5 font-bold text-gray-500">Número da NF</th>
                                  <th className="py-3 px-3.5 font-bold text-gray-500">Data de Emissão</th>
                                  <th className="py-3 px-3.5 font-bold text-gray-500">Data de Emissão do TR</th>
                                  <th className="py-3 px-3.5 font-bold text-gray-500">Data da Comissão</th>
                                  <th className="py-3 px-3.5 font-bold text-gray-500">Data da Tesouraria</th>
                                  <th className="py-3 px-3.5 font-bold text-gray-500">Número da NS</th>
                                  <th className="py-3 px-3.5 font-bold text-gray-500 text-right">Valor Total da NF</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {linkedInvoices.map((inv) => {
                                  const formattedIssueDate = formatDateOnly(inv.issueDate);
                                  const effectiveTrDate = inv.termoEmissaoDate || (inv.termoNumero ? (inv.registeredAt || inv.issueDate) : null);
                                  const formattedTrDate = effectiveTrDate ? formatDateOnly(effectiveTrDate) : null;
                                  const formattedComissaoDate = inv.comissaoDate 
                                    ? formatDateOnly(inv.comissaoDate) 
                                    : null;
                                  const formattedTesourariaDate = inv.tesourariaDate 
                                    ? formatDateOnly(inv.tesourariaDate) 
                                    : null;

                                  return (
                                    <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                                      <td className="py-3 px-3.5 whitespace-nowrap">
                                        <button
                                          id={`btn-report-nf-detail-${inv.id}`}
                                          onClick={() => setSelectedReportInvoice(inv)}
                                          className="group inline-flex items-center gap-1.5 font-bold text-[#00288e] hover:text-blue-700 bg-blue-50/70 hover:bg-blue-100/80 px-2.5 py-1 rounded-lg transition-all text-xs border border-blue-200/60 active:scale-95 shadow-xs"
                                          title="Clique para ver os itens detalhados desta Nota Fiscal"
                                        >
                                          <FileText className="w-3.5 h-3.5 text-[#00288e] group-hover:scale-110 transition-transform" />
                                          <span>NF {inv.id}</span>
                                        </button>
                                      </td>
                                      <td className="py-3 px-3.5 text-gray-600 font-semibold whitespace-nowrap">
                                        {formattedIssueDate}
                                      </td>
                                      <td className="py-3 px-3.5 whitespace-nowrap">
                                        {effectiveTrDate ? (
                                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-xs border border-emerald-100">
                                            {formattedTrDate} {inv.termoNumero ? `(TR Nº ${inv.termoNumero})` : ''}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 font-normal italic text-xs">Pendente</span>
                                        )}
                                      </td>
                                      <td className="py-3 px-3.5 whitespace-nowrap">
                                        {inv.comissaoDate ? (
                                          <span className="inline-flex items-center gap-1 font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md text-xs border border-blue-100">
                                            {formattedComissaoDate}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 font-normal italic text-xs">Pendente</span>
                                        )}
                                      </td>
                                      <td className="py-3 px-3.5 whitespace-nowrap">
                                        {inv.tesourariaDate ? (
                                          <span className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md text-xs border border-purple-100">
                                            {formattedTesourariaDate}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 font-normal italic text-xs">Pendente</span>
                                        )}
                                      </td>
                                      <td className="py-3 px-3.5 whitespace-nowrap">
                                        {editingNSId === inv.id ? (
                                          <div className="flex items-center gap-1.5">
                                            <input
                                              type="text"
                                              id={`input-ns-${inv.id}`}
                                              value={tempNSValue}
                                              onChange={(e) => setTempNSValue(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  handleSaveNumeroNS(inv.id, tempNSValue);
                                                } else if (e.key === 'Escape') {
                                                  setEditingNSId(null);
                                                  setTempNSValue('');
                                                }
                                              }}
                                              placeholder="Ex: 2026NS..."
                                              autoFocus
                                              className="w-32 sm:w-36 h-8 px-2 text-xs font-mono font-bold border border-[#00288e] rounded-lg bg-white text-gray-800 outline-none shadow-xs focus:ring-1 focus:ring-[#00288e]"
                                            />
                                            <button
                                              id={`btn-save-ns-${inv.id}`}
                                              type="button"
                                              onClick={() => handleSaveNumeroNS(inv.id, tempNSValue)}
                                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg transition-all shadow-xs flex items-center justify-center"
                                              title="Salvar Número da NS"
                                            >
                                              <Save className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              id={`btn-cancel-ns-${inv.id}`}
                                              type="button"
                                              onClick={() => {
                                                setEditingNSId(null);
                                                setTempNSValue('');
                                              }}
                                              className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-all flex items-center justify-center"
                                              title="Cancelar"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            {inv.numeroNS ? (
                                              <span className="inline-flex items-center gap-1 font-mono font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md text-xs border border-indigo-100 shadow-2xs">
                                                {inv.numeroNS}
                                              </span>
                                            ) : (
                                              <span className="text-gray-400 font-normal italic text-xs">
                                                —
                                              </span>
                                            )}
                                            
                                            <div className="flex items-center gap-1">
                                              <button
                                                id={`btn-edit-ns-${inv.id}`}
                                                type="button"
                                                onClick={() => {
                                                  setEditingNSId(inv.id);
                                                  setTempNSValue(inv.numeroNS || '');
                                                }}
                                                className="p-1 rounded-lg text-gray-400 hover:text-[#00288e] hover:bg-blue-50 transition-all active:scale-95 border border-transparent hover:border-blue-200/50"
                                                title={inv.numeroNS ? "Editar Número da NS" : "Informar Número da NS"}
                                              >
                                                <Edit className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                id={`btn-quick-save-ns-${inv.id}`}
                                                type="button"
                                                onClick={() => {
                                                  setEditingNSId(inv.id);
                                                  setTempNSValue(inv.numeroNS || '');
                                                }}
                                                className="p-1 rounded-lg text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition-all active:scale-95 border border-transparent hover:border-emerald-200/50"
                                                title="Editar e Salvar Número da NS"
                                              >
                                                <Save className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-3 px-3.5 text-right font-extrabold text-emerald-600 whitespace-nowrap">
                                        R$ {inv.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Action button row */}
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <button 
                        id="btn-download-report-pdf-main"
                        onClick={() => {
                          const emp = empenhos.find(e => e.id === reportSearch);
                          if (emp) handleGenerateEmpenhoReportPDF(emp, 'download');
                        }}
                        className="px-5 py-2.5 bg-[#00288e] hover:bg-[#001e6a] text-white active:scale-95 duration-100 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all"
                      >
                        <FileDown className="w-4 h-4" /> Baixar Relatório PDF
                      </button>
                      <button 
                        id="btn-print-report-pdf-main"
                        onClick={() => {
                          const emp = empenhos.find(e => e.id === reportSearch);
                          if (emp) handleGenerateEmpenhoReportPDF(emp, 'print');
                        }}
                        className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 active:scale-95 duration-100 rounded-xl font-bold text-xs sm:text-sm text-gray-700 flex items-center gap-2 shadow-xs transition-all"
                      >
                        <Printer className="w-4 h-4 text-[#00288e]" /> Imprimir / Visualizar PDF
                      </button>
                      <button 
                        id="btn-preview-report-modal"
                        onClick={() => setShowPdfModal(true)}
                        className="px-4 py-2.5 bg-gray-50 border border-gray-200 hover:bg-gray-100 active:scale-95 duration-100 rounded-xl font-semibold text-xs sm:text-sm text-gray-600 flex items-center gap-2 transition-all"
                      >
                        <Eye className="w-4 h-4 text-gray-500" /> Prévia na Tela
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* PDF Print Mock modal overlay */}
              <AnimatePresence>
                {showPdfModal && (
                  <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden"
                    >
                      <div className="bg-[#0b1c30] text-white p-4 flex justify-between items-center flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <Printer className="w-5 h-5 text-blue-400" />
                          <h3 className="font-bold text-sm">Visualização de Impressão de Relatório</h3>
                        </div>
                        <button onClick={() => setShowPdfModal(false)} className="text-gray-400 hover:text-white">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Paper formatted printable report preview */}
                      <div className="p-8 space-y-6 overflow-y-auto bg-gray-50 flex-1 font-sans text-xs sm:text-sm text-gray-800">
                        <div className="bg-white p-8 border shadow-sm max-w-2xl mx-auto space-y-6">
                          
                          {/* Print header */}
                          <div className="flex justify-between items-start border-b pb-4 border-gray-100">
                            <div>
                              <h2 className="text-base font-extrabold text-[#00288e] tracking-tight">CONTROLE DE EMPENHOS - APROV</h2>
                              <p className="text-[10px] text-gray-400 font-bold">Relatório Consolidado de Conciliação e Recebimento</p>
                            </div>
                            <span className="text-[10px] text-gray-500 font-mono">Emissão: {new Date().toLocaleDateString('pt-BR')}</span>
                          </div>

                          {/* Print details */}
                          {(() => {
                            const emp = empenhos.find(e => e.id === reportSearch);
                            if (!emp) return null;
                            const totalCommitted = emp.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
                            const pdfInvoices = invoices.filter(inv => inv.empenhoId === emp.id);
                            const pdfTotalReceivedNfe = pdfInvoices.reduce((sum, inv) => sum + inv.totalValue, 0);

                            return (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <p className="font-bold text-gray-400 uppercase text-[9px] tracking-wider">Código de Empenho (NE)</p>
                                    <p className="font-extrabold text-[#00288e]">{emp.id}</p>
                                  </div>
                                  <div>
                                    <p className="font-bold text-gray-400 uppercase text-[9px] tracking-wider">Fornecedor Contratado</p>
                                    <p className="font-extrabold text-gray-700">{emp.supplier}</p>
                                  </div>
                                  <div className="col-span-2">
                                    <p className="font-bold text-gray-400 uppercase text-[9px] tracking-wider">Objeto do Contrato</p>
                                    <p className="font-semibold text-gray-600">{emp.description}</p>
                                  </div>
                                </div>

                                <div className="border-t border-b border-gray-100 py-3 grid grid-cols-3 gap-4">
                                  <div>
                                    <p className="font-bold text-gray-400 text-[9px]">VALOR TOTAL CONTRATADO</p>
                                    <p className="text-sm sm:text-base font-black text-gray-800">R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                  </div>
                                  <div>
                                    <p className="font-bold text-gray-400 text-[9px]">TOTAL CONCILIADO POR NF-e</p>
                                    <p className="text-sm sm:text-base font-black text-emerald-600">R$ {pdfTotalReceivedNfe.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-bold text-gray-400 text-[9px]">TOTAL A RECEBER</p>
                                    <p className="text-sm sm:text-base font-black text-amber-600">R$ {Math.max(0, totalCommitted - pdfTotalReceivedNfe).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                  </div>
                                </div>

                                {/* Items list */}
                                <div className="space-y-2">
                                  <p className="font-bold text-gray-500 uppercase text-[9px] tracking-wider">Status Físico dos Itens</p>
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b bg-gray-50">
                                        <th className="py-1 px-2 font-bold text-gray-600">ID / Item</th>
                                        <th className="py-1 px-2 font-bold text-gray-600 text-right">Contratado</th>
                                        <th className="py-1 px-2 font-bold text-gray-600 text-right">Conciliado</th>
                                        <th className="py-1 px-2 font-bold text-gray-600 text-right">Saldo Restante</th>
                                        <th className="py-1 px-2 font-bold text-gray-600 text-right">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {emp.items.map((item) => {
                                        const balance = item.quantity - item.received;
                                        return (
                                          <tr key={item.id}>
                                            <td className="py-2 px-2 font-medium">
                                              {item.name} <span className="text-[9px] text-gray-400 font-mono block">({item.id})</span>
                                            </td>
                                            <td className="py-2 px-2 text-right">{item.quantity.toLocaleString('pt-BR')} {item.unit}</td>
                                            <td className="py-2 px-2 text-right text-emerald-600 font-bold">{item.received.toLocaleString('pt-BR')} {item.unit}</td>
                                            <td className="py-2 px-2 text-right text-gray-500">{balance.toLocaleString('pt-BR')} {item.unit}</td>
                                            <td className="py-2 px-2 text-right font-bold text-[#00288e]">
                                              {balance === 0 ? 'CONCLUÍDO' : `${Math.round((item.received / item.quantity) * 100)}%`}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Invoices list */}
                                <div className="space-y-2 pt-4 border-t border-gray-100">
                                  <p className="font-bold text-gray-500 uppercase text-[9px] tracking-wider">Notas Fiscais Cadastradas</p>
                                  {pdfInvoices.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic py-2">Nenhuma nota fiscal cadastrada para este empenho até o momento.</p>
                                  ) : (
                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead>
                                        <tr className="border-b bg-gray-50 text-[10px]">
                                          <th className="py-1.5 px-2 font-bold text-gray-600">Número da NF</th>
                                          <th className="py-1.5 px-2 font-bold text-gray-600">Data de Emissão</th>
                                          <th className="py-1.5 px-2 font-bold text-gray-600">Data de Emissão do TR</th>
                                          <th className="py-1.5 px-2 font-bold text-gray-600">Data da Comissão</th>
                                          <th className="py-1.5 px-2 font-bold text-gray-600">Data da Tesouraria</th>
                                          <th className="py-1.5 px-2 font-bold text-gray-600">Número da NS</th>
                                          <th className="py-1.5 px-2 font-bold text-gray-600 text-right">Valor Total da NF</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y text-[11px]">
                                        {pdfInvoices.map((inv) => {
                                          const formattedIssueDate = formatDateOnly(inv.issueDate);
                                          const effectiveTrDate = inv.termoEmissaoDate || (inv.termoNumero ? (inv.registeredAt || inv.issueDate) : null);
                                          const formattedTrDate = effectiveTrDate 
                                            ? `${formatDateOnly(effectiveTrDate)}${inv.termoNumero ? ` (TR Nº ${inv.termoNumero})` : ''}` 
                                            : 'Pendente';
                                          const formattedComissaoDate = inv.comissaoDate ? formatDateOnly(inv.comissaoDate) : 'Pendente';
                                          const formattedTesourariaDate = inv.tesourariaDate ? formatDateOnly(inv.tesourariaDate) : 'Pendente';
                                          const formattedNS = inv.numeroNS ? inv.numeroNS : '—';

                                          return (
                                            <tr key={inv.id}>
                                              <td className="py-1.5 px-2">
                                                <button
                                                  onClick={() => setSelectedReportInvoice(inv)}
                                                  className="font-bold text-[#00288e] hover:underline"
                                                  title="Clique para ver os itens detalhados desta NF"
                                                >
                                                  NF {inv.id}
                                                </button>
                                              </td>
                                              <td className="py-1.5 px-2 text-gray-600">{formattedIssueDate}</td>
                                              <td className="py-1.5 px-2 text-gray-700">{formattedTrDate}</td>
                                              <td className="py-1.5 px-2 text-gray-700">{formattedComissaoDate}</td>
                                              <td className="py-1.5 px-2 text-gray-700">{formattedTesourariaDate}</td>
                                              <td className="py-1.5 px-2 font-mono font-bold text-indigo-900">{formattedNS}</td>
                                              <td className="py-1.5 px-2 text-right font-bold text-emerald-600">
                                                R$ {inv.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  )}
                                </div>

                              </div>
                            );
                          })()}

                        </div>
                      </div>

                      <div className="p-4 bg-gray-100 flex flex-wrap justify-between items-center gap-3 flex-shrink-0">
                        <button 
                          id="btn-close-pdf-preview"
                          onClick={() => setShowPdfModal(false)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-300 transition-all"
                        >
                          Fechar
                        </button>
                        <div className="flex items-center gap-2">
                          <button 
                            id="btn-download-pdf-from-preview"
                            onClick={() => {
                              const emp = empenhos.find(e => e.id === reportSearch);
                              if (emp) handleGenerateEmpenhoReportPDF(emp, 'download');
                            }}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                          >
                            <FileDown className="w-4 h-4" /> Baixar Arquivo PDF
                          </button>
                          <button 
                            id="btn-print-pdf-from-preview"
                            onClick={() => {
                              const emp = empenhos.find(e => e.id === reportSearch);
                              if (emp) handleGenerateEmpenhoReportPDF(emp, 'print');
                            }}
                            className="px-4 py-2 bg-[#00288e] text-white rounded-xl font-bold text-xs hover:bg-[#1e40af] transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                          >
                            <Printer className="w-4 h-4" /> Imprimir Documento PDF
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Modal de Detalhamento dos Itens da Nota Fiscal */}
              <AnimatePresence>
                {selectedReportInvoice && (
                  <div 
                    id="modal-nf-items-detail-overlay"
                    className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
                  >
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0, y: 12 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.95, opacity: 0, y: 12 }}
                      transition={{ duration: 0.2 }}
                      className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden"
                    >
                      {/* Modal Header */}
                      <div className="bg-gradient-to-r from-[#00288e] to-[#001c66] text-white p-4 sm:p-5 flex justify-between items-center flex-shrink-0 shadow-md">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs flex items-center justify-center">
                            <FileSpreadsheet className="w-5 h-5 text-blue-200" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-black text-base sm:text-lg tracking-tight">
                                Detalhamento da Nota Fiscal #{selectedReportInvoice.id}
                              </h3>
                              {selectedReportInvoice.termoNumero && (
                                <span className="bg-emerald-400/20 text-emerald-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                                  TR Nº {selectedReportInvoice.termoNumero}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-blue-100/90 font-medium mt-0.5">
                              Empenho: <span className="font-bold text-white">{selectedReportInvoice.empenhoId}</span> • Fornecedor: <span className="font-semibold text-blue-50">{selectedReportInvoice.supplier}</span>
                            </p>
                          </div>
                        </div>
                        <button 
                          id="btn-close-nf-modal"
                          onClick={() => setSelectedReportInvoice(null)} 
                          className="p-2 text-blue-200 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95"
                          title="Fechar janela"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Modal Body */}
                      <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-gray-50/50">
                        
                        {/* Summary Metadata Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
                            <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider">Emissão da NF</span>
                            <span className="text-xs font-bold text-gray-800">
                              {formatDateOnly(selectedReportInvoice.issueDate)}
                            </span>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
                            <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider">Cadastramento</span>
                            <span className="text-xs font-bold text-gray-800">
                              {selectedReportInvoice.registeredAt 
                                ? formatDateOnly(selectedReportInvoice.registeredAt) 
                                : formatDateOnly(selectedReportInvoice.issueDate)}
                            </span>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
                            <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider">Comissão Receb.</span>
                            {selectedReportInvoice.comissaoDate ? (
                              <span className="text-xs font-bold text-blue-700">
                                {formatDateOnly(selectedReportInvoice.comissaoDate)}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-amber-600">Aguardando</span>
                            )}
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
                            <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider">Tesouraria</span>
                            {selectedReportInvoice.tesourariaDate ? (
                              <span className="text-xs font-bold text-purple-700">
                                {formatDateOnly(selectedReportInvoice.tesourariaDate)}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-gray-400">Pendente</span>
                            )}
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
                            <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider">Número da NS (Liquidação)</span>
                            {selectedReportInvoice.numeroNS ? (
                              <span className="text-xs font-bold text-indigo-800 font-mono">
                                {selectedReportInvoice.numeroNS}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-gray-400 italic">Não informada</span>
                            )}
                          </div>
                        </div>

                        {/* Detailed items list */}
                        <div className="space-y-2.5">
                          <div className="flex justify-between items-center px-1">
                            <div className="flex items-center gap-1.5">
                              <Package className="w-4 h-4 text-[#00288e]" />
                              <span className="font-extrabold text-gray-700 uppercase text-[11px] tracking-wider">
                                Itens Faturados nesta Nota Fiscal
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                              {selectedReportInvoice.items.length} {selectedReportInvoice.items.length === 1 ? 'item' : 'itens'}
                            </span>
                          </div>

                          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-gray-50/90 border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                                  <th className="py-3 px-3.5">Código</th>
                                  <th className="py-3 px-3.5">Descrição do Material</th>
                                  <th className="py-3 px-3.5 text-center">Und</th>
                                  <th className="py-3 px-3.5 text-right">Quantidade</th>
                                  <th className="py-3 px-3.5 text-right">Valor Unitário</th>
                                  <th className="py-3 px-3.5 text-right">Valor Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {(() => {
                                  const targetEmpenho = empenhos.find(e => e.id === selectedReportInvoice.empenhoId);
                                  return selectedReportInvoice.items.map((invItem, idx) => {
                                    const itemDef = targetEmpenho?.items.find(i => i.id === invItem.itemId);
                                    const itemName = itemDef?.name || `Item #${invItem.itemId}`;
                                    const itemUnit = itemDef?.unit || 'UN';
                                    const itemSubtotal = invItem.subtotal || (invItem.quantity * invItem.unitPrice);

                                    return (
                                      <tr key={invItem.itemId || idx} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="py-3 px-3.5 font-mono font-bold text-[#00288e] whitespace-nowrap">
                                          {invItem.itemId}
                                        </td>
                                        <td className="py-3 px-3.5 font-semibold text-gray-800">
                                          {itemName}
                                        </td>
                                        <td className="py-3 px-3.5 text-center font-medium text-gray-500 uppercase whitespace-nowrap">
                                          <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                            {itemUnit}
                                          </span>
                                        </td>
                                        <td className="py-3 px-3.5 text-right font-extrabold text-gray-800 whitespace-nowrap">
                                          {invItem.quantity.toLocaleString('pt-BR')}
                                        </td>
                                        <td className="py-3 px-3.5 text-right font-medium text-gray-600 whitespace-nowrap">
                                          R$ {invItem.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3 px-3.5 text-right font-black text-emerald-600 whitespace-nowrap">
                                          R$ {itemSubtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                      </tr>
                                    );
                                  });
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Financial summary highlight */}
                        <div className="bg-gradient-to-r from-blue-50/80 via-emerald-50/60 to-emerald-50 p-4 rounded-xl border border-emerald-200/70 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-gray-500 font-extrabold uppercase block tracking-wider">
                              Resumo da Nota Fiscal #{selectedReportInvoice.id}
                            </span>
                            <span className="text-xs text-gray-600 font-medium">
                              Volume total de faturamento: <strong className="text-gray-800">{selectedReportInvoice.items.reduce((s, it) => s + it.quantity, 0).toLocaleString('pt-BR')}</strong> unidades distribuídas em <strong className="text-gray-800">{selectedReportInvoice.items.length}</strong> {selectedReportInvoice.items.length === 1 ? 'item' : 'itens'}.
                            </span>
                          </div>
                          <div className="text-left sm:text-right bg-white px-4 py-2 rounded-xl border border-emerald-200/80 shadow-xs flex-shrink-0">
                            <span className="text-[10px] text-emerald-700 font-black uppercase block tracking-wider">
                              Valor Total da Nota
                            </span>
                            <span className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">
                              R$ {selectedReportInvoice.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                      </div>

                      {/* Modal Footer */}
                      <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-wrap justify-between items-center gap-3 flex-shrink-0">
                        <button
                          id="btn-download-tr-from-modal"
                          onClick={() => handleDownloadTermoRecebimento(selectedReportInvoice)}
                          className="px-4 py-2 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-xs active:scale-95"
                        >
                          <FileDown className="w-4 h-4" /> Gerar Termo de Recebimento (PDF)
                        </button>
                        <button 
                          id="btn-close-nf-modal-footer"
                          onClick={() => setSelectedReportInvoice(null)}
                          className="px-6 py-2 bg-[#00288e] hover:bg-[#001e6a] text-white rounded-xl font-bold text-xs transition-all shadow-xs active:scale-95"
                        >
                          Fechar
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

            </div>
          )}



          {/* TAB 6: GERENCIAR ITENS DO EMPENHO (Itens do Empenho - Screenshot 3) */}
          {activeTab === 'itens_empenho' && (
            <div className="space-y-6">
              
              {/* Screen Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setActiveTab('empenhos')}
                    className="p-1.5 hover:bg-blue-50 text-[#00288e] rounded-lg transition-all"
                    title="Voltar para a lista de empenhos"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold tracking-tight text-[#00288e]">Itens do Empenho</h2>
                      <span className="px-2.5 py-0.5 bg-blue-100 text-[#00288e] font-extrabold text-xs rounded-full">
                        {editingEmpenhoId}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 font-medium">Controle e cadastro físico de itens para a dotação: {editingEmpenhoId}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setEmpenhoToDelete(editingEmpenhoId)}
                    className="px-4 h-11 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm cursor-pointer"
                    title="Excluir este empenho do sistema"
                  >
                    <Trash2 className="w-4 h-4" /> Excluir Empenho
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Side: Add Item Form (lg:col-span-5) */}
                <section className="lg:col-span-5 flex flex-col gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                    <h3 className="font-bold text-sm text-gray-700 uppercase tracking-wider">Adicionar Novo Item</h3>
                    
                    <div className="grid grid-cols-4 gap-3">
                      <div className="col-span-1">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Nº Item</label>
                        <input 
                          type="text" 
                          readOnly 
                          value={newItemForm.id}
                          className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 h-11 font-bold text-sm text-gray-500 outline-none text-center"
                        />
                      </div>

                      <div className="col-span-3">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Unidade de Medida</label>
                        <select 
                          value={newItemForm.unit}
                          onChange={(e) => setNewItemForm({ ...newItemForm, unit: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 bg-white h-11 px-3 text-sm font-bold text-[#0b1c30] outline-none"
                        >
                          <option value="kg">Quilograma (kg)</option>
                          <option value="un">Unidade (un)</option>
                          <option value="fardo">Fardo (fardo)</option>
                          <option value="cx">Caixa (cx)</option>
                          <option value="lt">Litro (lt)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Descrição do Item</label>
                      <textarea 
                        placeholder="Ex: Legume processado, tipo mandioca..."
                        value={newItemForm.name}
                        onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                        className="w-full rounded-xl border border-gray-200 focus:border-[#00288e] p-3 text-sm font-semibold text-[#0b1c30] outline-none min-h-[80px]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Qtd Empenhada</label>
                        <input 
                          type="number" 
                          placeholder="0,00"
                          value={newItemForm.quantity}
                          onChange={(e) => setNewItemForm({ ...newItemForm, quantity: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 focus:border-[#00288e] px-3 h-12 text-sm font-bold text-[#0b1c30]"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Valor Unitário (R$)</label>
                        <input 
                          type="number" 
                          placeholder="0,00"
                          value={newItemForm.unitPrice}
                          onChange={(e) => setNewItemForm({ ...newItemForm, unitPrice: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 focus:border-[#00288e] px-3 h-12 text-sm font-bold text-[#0b1c30]"
                        />
                      </div>
                    </div>

                    {/* Quick multiplication calculation state view */}
                    {(() => {
                      const q = parseFloat(newItemForm.quantity) || 0;
                      const p = parseFloat(newItemForm.unitPrice) || 0;
                      const sub = q * p;
                      return (
                        <div className="bg-[#e5eeff] p-4 rounded-xl flex justify-between items-center border border-blue-100">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total do Item</span>
                          <span className="text-base font-extrabold text-[#00288e]">
                            R$ {sub.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      );
                    })()}

                    <button 
                      onClick={handleAddItemToEmpenho}
                      className="w-full h-12 bg-[#00288e] text-white rounded-full font-bold text-sm shadow-md hover:bg-[#1e40af] transition-all flex items-center justify-center gap-1.5 active:scale-95 duration-100"
                    >
                      <Plus className="w-4 h-4" /> Adicionar Item
                    </button>
                  </div>

                  {/* Operational Insight Card banner (as in screenshot 3) */}
                  <div className="bg-[#dde1ff] text-[#001453] p-4 rounded-2xl flex items-start gap-3 shadow-sm border border-blue-100">
                    <Info className="w-5 h-5 text-[#00288e] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs">Saldo de Orçamento</p>
                      <p className="text-xs font-medium mt-1 leading-snug">
                        O valor total deste empenho consome 12% da dotação orçamentária vigente para esta categoria de insumos de saúde.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Right Side: Added Items List (lg:col-span-7) */}
                <section className="lg:col-span-7 space-y-4">
                  {(() => {
                    const empObj = empenhos.find(e => e.id === editingEmpenhoId);
                    if (!empObj) return null;

                    const totalCommitted = empObj.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

                    return (
                      <div className="space-y-4">
                        <div className="flex justify-between items-end px-1">
                          <h3 className="font-bold text-sm text-gray-700">Itens Adicionados ({empObj.items.length})</h3>
                          <span className="text-xs text-gray-400 font-semibold">Visualizando dados consolidados</span>
                        </div>

                        {/* List of items */}
                        {empObj.items.length === 0 ? (
                          <div className="bg-white p-12 rounded-2xl border-2 border-dashed border-gray-200 text-center">
                            <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-gray-500">Nenhum item adicionado ainda.</p>
                            <p className="text-xs text-gray-400 mt-1">Preencha o formulário ao lado para compor a dotação.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {empObj.items.map((item, index) => {
                              const total = item.quantity * item.unitPrice;
                              return (
                                <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between gap-4 shadow-sm hover:border-[#dde1ff] transition-all">
                                  <div className="flex items-center gap-3">
                                    <div className="bg-[#eff4ff] w-12 h-12 rounded-xl flex flex-col items-center justify-center border border-blue-100/50 flex-shrink-0">
                                      <span className="text-[9px] font-bold text-gray-400">Nº</span>
                                      <span className="font-black text-xs text-[#00288e]">{String(index + 1).padStart(3, '0')}</span>
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-xs sm:text-sm text-gray-800 leading-tight">{item.name}</h4>
                                      <p className="text-xs text-gray-500 font-semibold mt-0.5">
                                        {item.quantity.toLocaleString('pt-BR')} {item.unit} × R$ {item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-4">
                                    <div className="text-right">
                                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total</p>
                                      <p className="font-extrabold text-[#0b1c30]">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <button 
                                      onClick={() => handleDeleteItemFromEmpenho(item.id)}
                                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-all cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Floating bottom save receipt specifically for compiling commitment items */}
                        <footer className="fixed bottom-0 left-0 lg:left-72 right-0 bg-[#e5eeff] border-t border-blue-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40">
                          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Valor Total do Empenho</span>
                              <span className="text-lg sm:text-xl font-extrabold text-[#00288e]">
                                R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setEmpenhoToDelete(editingEmpenhoId)}
                                className="px-4 h-12 flex items-center justify-center gap-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-bold text-xs sm:text-sm hover:bg-rose-100 transition-all cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" /> Excluir Empenho
                              </button>
                              <button 
                                onClick={handleFinishEmpenhoRegistry}
                                className="px-6 h-12 flex items-center justify-center gap-2 bg-[#00288e] text-white rounded-full font-bold text-xs sm:text-sm shadow-md active:scale-95 duration-100 hover:bg-[#1e40af] transition-all cursor-pointer"
                              >
                                <Save className="w-4 h-4" /> Finalizar Cadastro
                              </button>
                            </div>
                          </div>
                        </footer>

                      </div>
                    );
                  })()}
                </section>

              </div>

            </div>
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
          onClick={() => setActiveTab('empenhos')}
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
