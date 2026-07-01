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
  Info,
  Layers,
  FileSpreadsheet,
  Users,
  UserCheck,
  FileDown,
  LogIn,
  LogOut,
  Loader2,
  Edit
} from 'lucide-react';

import { Empenho, Item, Alert, Invoice, InvoiceItem, Comissao } from '../lib/types';
import { INITIAL_EMPENHOS, INITIAL_ALERTS, INITIAL_INVOICES, INITIAL_COMISSOES } from '../lib/mockData';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
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
  removeComissao
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

  // Navigation & View state
  const [activeTab, setActiveTab] = useState<'painel' | 'empenhos' | 'nova_nf' | 'relatorios' | 'itens_empenho'>('painel');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Core database state
  const [empenhos, setEmpenhos] = useState<Empenho[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [comissoes, setComissoes] = useState<Comissao[]>([]);

  // Listen to auth state changes and fetch Firestore data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setSyncing(true);
        try {
          // Seed mock data if it is a new user
          await seedInitialDataIfNecessary(currentUser.uid);
          
          // Fetch from Firestore
          const [fetchedEmpenhos, fetchedAlerts, fetchedInvoices, fetchedComissoes] = await Promise.all([
            getEmpenhos(currentUser.uid),
            getAlerts(currentUser.uid),
            getInvoices(currentUser.uid),
            getComissoes(currentUser.uid)
          ]);
          
          let finalEmpenhos = [...fetchedEmpenhos];
          let finalInvoices = [...fetchedInvoices];
          let finalComissoes = [...fetchedComissoes];
          let finalAlerts = [...fetchedAlerts];
          let cleanedAny = false;

          if (fetchedInvoices.length > 0) {
            console.log('Clearing existing simulation invoices to leave the tab empty as requested...');
            
            // Revert received quantities on all fetched empenhos for the invoices we are deleting
            for (const invoice of fetchedInvoices) {
              finalEmpenhos = finalEmpenhos.map(emp => {
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

            // Sync deleted state back to Firebase
            try {
              const deletePromises = fetchedInvoices.map(inv => removeInvoice(currentUser.uid, inv.id));
              const savePromises = finalEmpenhos.map(emp => saveEmpenho(currentUser.uid, emp));
              await Promise.all([...deletePromises, ...savePromises]);
              finalInvoices = [];
              cleanedAny = true;
            } catch (err) {
              console.error('Error during auto-cleaning simulation invoices:', err);
            }
          }

          if (fetchedComissoes.length > 0) {
            console.log('Clearing existing simulation comissoes to leave the tab empty as requested...');
            try {
              const deleteComissoesPromises = fetchedComissoes.map(com => removeComissao(currentUser.uid, com.id));
              await Promise.all(deleteComissoesPromises);
              finalComissoes = [];
              cleanedAny = true;
            } catch (err) {
              console.error('Error during auto-cleaning simulation comissoes:', err);
            }
          }

          if (fetchedEmpenhos.length > 0) {
            console.log('Clearing existing simulation empenhos to leave the tab empty as requested...');
            try {
              const deleteEmpenhosPromises = fetchedEmpenhos.map(emp => removeEmpenho(currentUser.uid, emp.id));
              await Promise.all(deleteEmpenhosPromises);
              finalEmpenhos = [];
              cleanedAny = true;
            } catch (err) {
              console.error('Error during auto-cleaning simulation empenhos:', err);
            }
          }

          if (fetchedAlerts.length > 0) {
            console.log('Clearing existing simulation alerts to leave the tab empty as requested...');
            try {
              const deleteAlertsPromises = fetchedAlerts.map(alert => removeAlert(currentUser.uid, alert.id));
              await Promise.all(deleteAlertsPromises);
              finalAlerts = [];
              cleanedAny = true;
            } catch (err) {
              console.error('Error during auto-cleaning simulation alerts:', err);
            }
          }

          setEmpenhos(finalEmpenhos);
          setAlerts(finalAlerts);
          setInvoices(finalInvoices);
          setComissoes(finalComissoes);

          if (cleanedAny) {
            showToast('Dados de simulação apagados! Sistema totalmente limpo e pronto para seus testes.', 'info');
          }
        } catch (error) {
          console.error('Error fetching data from Firestore:', error);
          showToast('Erro ao carregar dados do Firebase', 'error');
        } finally {
          setSyncing(false);
        }
      } else {
        setEmpenhos([]);
        setAlerts([]);
        setInvoices([]);
        setComissoes([]);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

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

  // --- VIEW 1: PAINEL / DASHBOARD STATES ---
  const [expandedEmpenhoId, setExpandedEmpenhoId] = useState<string | null>('2025NE124');
  const [dashboardPregaoFilter, setDashboardPregaoFilter] = useState('Todos');

  // --- VIEW 2: EMPENHOS STATES ---
  const [empenhosSearch, setEmpenhosSearch] = useState('');
  const [empenhosFilter, setEmpenhosFilter] = useState<'Todos' | 'Ativos' | 'Encerrados' | 'Sem Movimentação'>('Todos');
  const [empenhosPregaoFilter, setEmpenhosPregaoFilter] = useState('Todos');
  const [empenhosYearFilter, setEmpenhosYearFilter] = useState('Todos');
  const [empenhosClassFilter, setEmpenhosClassFilter] = useState('Todos');
  const [showNewEmpenhoModal, setShowNewEmpenhoModal] = useState(false);
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

    if (!nfNumber) {
      showToast('Por favor, insira o número da Nota Fiscal.', 'error');
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
      ...(editingInvoice?.comissaoDate ? { comissaoDate: editingInvoice.comissaoDate } : {}),
      ...(editingInvoice?.tesourariaDate ? { tesourariaDate: editingInvoice.tesourariaDate } : {}),
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

  const handleDeleteAllEmpenhos = async () => {
    if (empenhos.length === 0) {
      showToast('Não há Notas de Empenho para apagar.', 'info');
      return;
    }
    if (!confirm('Deseja realmente apagar TODAS as Notas de Empenho, Alertas e Notas Fiscais? Esta ação limpará todo o histórico de empenhos.')) {
      return;
    }

    setEmpenhos([]);
    setAlerts([]);
    setInvoices([]);

    if (user) {
      try {
        const promises = [
          ...empenhos.map(emp => removeEmpenho(user.uid, emp.id)),
          ...alerts.map(a => removeAlert(user.uid, a.id)),
          ...invoices.map(inv => removeInvoice(user.uid, inv.id))
        ];
        await Promise.all(promises);
        showToast('Todas as Notas de Empenho, Alertas e Notas Fiscais foram apagadas com sucesso!', 'info');
      } catch (error) {
        showToast('Erro ao remover no Firebase', 'error');
      }
    } else {
      showToast('Todas as Notas de Empenho foram apagadas com sucesso!', 'info');
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

  const handleDownloadTermoRecebimento = (inv: Invoice) => {
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
    centerText('TERMO DE RECEBIMENTO DE ARTIGOS DE QR', 12, 'bold', secondaryColor);
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

    const filename = `Termo_Recebimento_NF_${inv.id}.pdf`;
    doc.save(filename);
    showToast(`Download iniciado: ${filename}`, 'success');
  };


  // Helper selector for Alerts count
  const criticalAlertsCount = alerts.filter(a => a.type === 'CRÍTICO').length;
  const warningAlertsCount = alerts.filter(a => a.type === 'ATENÇÃO').length;
  const zeroStockAlertsCount = alerts.filter(a => a.type === 'ESTOQUE ZERADO').length;

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
          {/* Insígnia / Brasão do Exército / Hospital fictício bem polido */}
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center shadow-lg border border-white/20">
            <span className="text-3xl font-black text-white tracking-tighter">CEA</span>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Controle de Empenhos - Aprov</h2>
            <p className="text-sm text-gray-300 font-medium mt-2">Hospital Geral de Santa Maria (HGeSM)</p>
          </div>

          <div className="w-full h-[1px] bg-white/10 my-2" />

          <p className="text-xs text-gray-400 leading-relaxed">
            Área de acesso restrito a militares e servidores autorizados do setor logístico de saúde hospitalar.
          </p>

          <button
            onClick={async () => {
              try {
                await signInWithPopup(auth, googleProvider);
              } catch (err: any) {
                console.error(err);
                showToast('Falha na autenticação do Google', 'error');
              }
            }}
            className="w-full h-12 bg-white text-[#0b1c30] rounded-xl font-bold text-sm hover:bg-gray-100 transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-lg active:scale-95 group"
          >
            {/* Google Icon SVG */}
            <svg className="w-5 h-5 flex-shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6-4.53z"
              />
            </svg>
            Entrar com o Google
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
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50/70 backdrop-blur-sm text-[#00288e] rounded-xl font-bold hidden sm:block">CEA</span>
            <h1 className="font-semibold text-lg sm:text-xl text-[#00288e] tracking-tight">Controle de Empenhos - Aprov</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {syncing && (
            <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 animate-pulse bg-blue-50/70 backdrop-blur-sm px-3 py-1 rounded-full">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Sincronizando...
            </div>
          )}

          <div className="flex items-center gap-2 border-l pl-4 border-gray-100/50">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-100 shadow-inner flex-shrink-0">
              <img 
                className="w-full h-full object-cover" 
                alt={user?.displayName || 'Usuário'} 
                referrerPolicy="no-referrer"
                src={user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuB9oN5Qe0LYKx8xWftyrlo25oJgYewAcPzxv_ELo8XqWEwHmFvEs6k9TnvxhITm77Ynmg6m5RUB8G6JkA1z7smqGtGnvkvZVRY7h9xL3c-nCgiIIAB5zk84s0gDapybUbe8L6rOscJ92bNZJVnCXuCxCDS1SDObiYUROFSh-HIepfM7gGBG1125Tgg-_hMR2StdUxafQrQbKXkWBdzXvNrfGTetg50QAXfkohp3wuOv8X6V4zNqCrISM4QmhC31vc_hAjF9QZCPY1A"}
              />
            </div>
            <span className="text-xs font-semibold text-gray-600 hidden md:inline">{user?.displayName || 'Gestor Hospitalar'}</span>
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
            
            {/* User Profile Card */}
            <div className="mx-4 p-4 bg-white/40 backdrop-blur-sm rounded-2xl border border-white/30 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-blue-200 border border-white shadow-sm flex-shrink-0">
                <img 
                  className="w-full h-full object-cover" 
                  alt={user?.displayName || 'Usuário'} 
                  referrerPolicy="no-referrer"
                  src={user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuB9oN5Qe0LYKx8xWftyrlo25oJgYewAcPzxv_ELo8XqWEwHmFvEs6k9TnvxhITm77Ynmg6m5RUB8G6JkA1z7smqGtGnvkvZVRY7h9xL3c-nCgiIIAB5zk84s0gDapybUbe8L6rOscJ92bNZJVnCXuCxCDS1SDObiYUROFSh-HIepfM7gGBG1125Tgg-_hMR2StdUxafQrQbKXkWBdzXvNrfGTetg50QAXfkohp3wuOv8X6V4zNqCrISM4QmhC31vc_hAjF9QZCPY1A"}
                />
              </div>
              <div className="overflow-hidden">
                <p className="font-bold text-sm text-[#0b1c30] truncate">{user?.displayName || 'Gestor Hospitalar'}</p>
                <p className="text-xs text-gray-500 font-medium truncate">{user?.email}</p>
              </div>
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
                <span>Empenhos</span>
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
                <span>Relatórios</span>
              </button>


            </nav>
          </div>

          {/* Sidebar Footer with Logout */}
          <div className="px-6 border-t border-gray-100 pt-4 space-y-3">
            <button
              onClick={async () => {
                try {
                  await signOut(auth);
                  showToast('Você saiu do sistema.', 'info');
                  // Immediately trigger Google login popup with custom parameters for selecting an account
                  await signInWithPopup(auth, googleProvider);
                } catch (err: any) {
                  console.error(err);
                  showToast('Erro ao abrir login do Google', 'error');
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
          
          {/* TAB 1: PAINEL DE CONTROLE / DASHBOARD */}
          {activeTab === 'painel' && (
            <div className="space-y-6">
              
              {/* Screen Title */}
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-[#00288e]">Painel de Controle</h2>
                <p className="text-sm text-gray-500 font-medium">Gestão integrada e status operacional em tempo real</p>
              </div>



              {/* Empenhos Recentes section */}
              <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/30 p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-gray-100/50 pb-3">
                  <div>
                    <h3 className="font-bold text-lg text-[#00288e] tracking-tight">Empenhos Recentes</h3>
                    <p className="text-xs text-gray-500 font-medium">Acompanhe a execução dos contratos ativos</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Filtrar por Pregão:</label>
                    <select
                      value={dashboardPregaoFilter}
                      onChange={(e) => setDashboardPregaoFilter(e.target.value)}
                      className="text-xs font-bold text-gray-700 bg-white/40 backdrop-blur-sm border border-white/30 rounded-lg px-2.5 py-1.5 focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none"
                    >
                      <option value="Todos">Todos os Pregões</option>
                      {uniquePregaos.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  {empenhos
                    .filter(emp => dashboardPregaoFilter === 'Todos' || emp.pregao === dashboardPregaoFilter)
                    .slice(0, dashboardPregaoFilter === 'Todos' ? 3 : undefined)
                    .map((emp) => {
                      const isExpanded = expandedEmpenhoId === emp.id;
                      const totalCommitted = emp.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
                      const totalReceived = emp.items.reduce((sum, item) => sum + item.received * item.unitPrice, 0);
                      const progressPercentage = totalCommitted > 0 ? Math.round((totalReceived / totalCommitted) * 100) : 0;
                      const balance = totalCommitted - totalReceived;

                      return (
                        <div key={emp.id} className="border border-white/20 rounded-xl overflow-hidden shadow-sm hover:border-blue-100/50 transition-all duration-200 bg-white/40 backdrop-blur-sm">
                          
                          {/* Expandable Header */}
                          <div 
                            onClick={() => setExpandedEmpenhoId(isExpanded ? null : emp.id)}
                            className="p-4 sm:p-5 flex justify-between items-start cursor-pointer hover:bg-white/30 transition-colors"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${
                                  emp.status === 'Ativo' ? 'bg-[#dde1ff] text-[#001453]' :
                                  emp.status === 'Encerrado' ? 'bg-gray-100 text-gray-600' :
                                  'bg-amber-100 text-amber-800'
                                }`}>
                                  {emp.status === 'Ativo' ? 'Em Andamento' : emp.status}
                                </span>
                                {emp.pregao && (
                                  <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100">
                                    Pregão: {emp.pregao}
                                  </span>
                                )}
                                {emp.classification && (
                                  <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-100">
                                    Classe: {emp.classification}
                                  </span>
                                )}
                                <span className="text-xs text-gray-400 font-medium">Emitido em {emp.date}</span>
                              </div>
                            <h4 className="text-lg font-bold text-[#00288e]">{emp.id}</h4>
                            <p className="text-sm text-gray-500 font-semibold">{emp.supplier}</p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-400">Clique para ver itens</span>
                            {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                          </div>
                        </div>

                        {/* Summary metrics on dashboard card */}
                        <div className="px-4 sm:px-5 pb-4 grid grid-cols-2 gap-4 border-t border-gray-50 pt-4">
                          <div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Valor Recebido</p>
                            <p className="text-base font-bold text-gray-700">R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Saldo Atual</p>
                            <p className="text-base font-bold text-[#00288e]">R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="px-4 sm:px-5 pb-5 space-y-1">
                          <div className="flex justify-between text-xs font-bold text-gray-500">
                            <span>Consumo: {progressPercentage}%</span>
                            <span>Total do Empenho: R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${progressPercentage === 100 ? 'bg-emerald-500' : 'bg-[#00288e]'}`}
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>
                        </div>

                        {/* Expandable Items List Table */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div 
                              initial={{ height: 0 }}
                              animate={{ height: 'auto' }}
                              exit={{ height: 0 }}
                              className="overflow-hidden bg-[#eff4ff]/30 border-t border-gray-100"
                            >
                              <div className="p-4 sm:p-5">
                                <h5 className="font-bold text-xs text-[#00288e] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                  <Package className="w-4 h-4" /> Detalhamento de Saldo por Item
                                </h5>
                                
                                {emp.items.length === 0 ? (
                                  <p className="text-xs text-gray-500 italic py-2">Nenhum item cadastrado para esta Nota de Empenho.</p>
                                ) : (
                                  <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
                                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                                      <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                          <th className="py-2.5 px-3 font-semibold text-gray-500">Item / ID</th>
                                          <th className="py-2.5 px-3 font-semibold text-gray-500 text-center">Unidade</th>
                                          <th className="py-2.5 px-3 font-semibold text-gray-500 text-right">Empenhado</th>
                                          <th className="py-2.5 px-3 font-semibold text-gray-500 text-right">Recebido</th>
                                          <th className="py-2.5 px-3 font-semibold text-gray-500 text-right">Saldo Restante</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-50">
                                        {emp.items.map((item) => {
                                          const itemBalance = item.quantity - item.received;
                                          return (
                                            <tr key={item.id} className="hover:bg-gray-50/50">
                                              <td className="py-3 px-3">
                                                <p className="font-bold text-gray-800">{item.name}</p>
                                                <span className="text-[10px] text-gray-400 font-mono">ID: {item.id}</span>
                                              </td>
                                              <td className="py-3 px-3 text-center font-medium text-gray-500">{item.unit}</td>
                                              <td className="py-3 px-3 text-right font-medium text-gray-600">{item.quantity.toLocaleString('pt-BR')}</td>
                                              <td className="py-3 px-3 text-right font-bold text-emerald-600">{item.received.toLocaleString('pt-BR')}</td>
                                              <td className="py-3 px-3 text-right font-bold text-[#00288e]">{itemBalance.toLocaleString('pt-BR')}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}

                                <div className="mt-4 flex justify-end gap-3 flex-wrap">
                                  <button 
                                    onClick={() => { setEditingEmpenhoId(emp.id); setActiveTab('itens_empenho'); }}
                                    className="px-3.5 py-1.5 bg-white border border-blue-200 text-[#00288e] rounded-xl text-xs font-bold hover:bg-blue-50 transition-all flex items-center gap-1.5"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Adicionar / Excluir Itens
                                  </button>
                                  <button 
                                    onClick={() => { setSelectedNFCommitmentId(emp.id); setActiveTab('nova_nf'); setNfSubTab('cadastrar'); }}
                                    className="px-3.5 py-1.5 bg-[#00288e] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] transition-all flex items-center gap-1.5"
                                  >
                                    <Save className="w-3.5 h-3.5" /> Lançar Nova NF para este Empenho
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                      </div>
                    );
                  })}

                  {empenhos.filter(emp => dashboardPregaoFilter === 'Todos' || emp.pregao === dashboardPregaoFilter).length === 0 && (
                    <div className="text-center py-8 text-xs text-gray-500 font-medium bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      Nenhum empenho encontrado para o Pregão selecionado ({dashboardPregaoFilter}).
                    </div>
                  )}
                </div>
              </div>


            </div>
          )}

          {/* TAB 2: LISTA DE EMPENHOS / NOTAS DE EMPENHO */}
          {activeTab === 'empenhos' && (
            <div className="space-y-6">
              
              {/* Screen Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-[#00288e]">Notas de Empenho</h2>
                  <p className="text-sm text-gray-500 font-medium">Controle de faturamento, saldos orçamentários e contratos</p>
                </div>
                <div className="flex items-center gap-3 self-start sm:self-auto">
                  {empenhos.length > 0 && (
                    <button
                      onClick={handleDeleteAllEmpenhos}
                      className="px-4 h-12 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm cursor-pointer"
                      title="Apagar todas as notas de empenho cadastradas"
                    >
                      <Trash2 className="w-5 h-5" /> Apagar Todos os Empenhos
                    </button>
                  )}
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
                          <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full ${
                            emp.status === 'Ativo' ? 'bg-blue-50 text-[#00288e]' :
                            emp.status === 'Encerrado' ? 'bg-gray-50 text-gray-500' :
                            'bg-amber-50 text-amber-800'
                          }`}>
                            {emp.status}
                          </span>
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

                        <div className="pt-3 border-t border-gray-50 flex justify-between items-end text-xs">
                          <div>
                            <p className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Total Empenhado</p>
                            <p className="font-extrabold text-gray-700">R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Total Recebido</p>
                            <p className="font-extrabold text-emerald-600">R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
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
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full overflow-hidden"
                    >
                      <div className="bg-[#00288e] text-white p-5 flex justify-between items-center">
                        <h3 className="font-bold text-base tracking-tight">Adicionar Novo Empenho</h3>
                        <button onClick={() => setShowNewEmpenhoModal(false)} className="text-blue-100 hover:text-white transition-all">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

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
                  <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                    <div className="relative flex-1">
                      <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="Buscar Nota Fiscal por nº ou fornecedor..."
                        value={nfSearch}
                        onChange={(e) => setNfSearch(e.target.value)}
                        className="w-full pl-12 pr-4 h-11 rounded-xl border border-gray-200 bg-white focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] transition-all font-medium text-sm text-[#0b1c30] placeholder-gray-400 outline-none"
                      />
                    </div>

                    {/* Month Filter */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap hidden md:inline">Mês da Nota:</span>
                      <select
                        value={nfMonthFilter}
                        onChange={(e) => setNfMonthFilter(e.target.value)}
                        className="h-11 px-4 rounded-xl border border-gray-200 bg-white focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-bold text-sm text-[#0b1c30] shadow-sm min-w-[160px]"
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
                        className="h-11 px-4 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
                        title="Apagar todas as notas fiscais cadastradas"
                      >
                        <Trash2 className="w-4 h-4" />
                        Apagar Todas as Notas
                      </button>
                    )}
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

                        return matchesSearch && matchesMonth;
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

                      // Helper to parse date
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
                        } catch (e) {
                          return isoString;
                        }
                      };

                      return filteredInvoices.map((inv) => (
                        <div key={inv.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4 hover:border-blue-100 transition-all">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-gray-50">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="bg-blue-50 text-[#00288e] text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                                  NF-e #{inv.id}
                                </span>
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
                                      max={balance}
                                      placeholder="0"
                                      value={nfQuantities[item.id] === undefined || nfQuantities[item.id] === 0 ? '' : nfQuantities[item.id]}
                                      onChange={(e) => {
                                        const val = Math.min(balance, Math.max(0, parseFloat(e.target.value) || 0));
                                        setNfQuantities({
                                          ...nfQuantities,
                                          [item.id]: val,
                                        });
                                      }}
                                      className={`w-full h-11 text-center font-bold text-lg rounded-xl focus:ring-2 outline-none transition-all ${
                                        inputVal > 0 
                                          ? 'bg-[#dde1ff] text-[#001453] border-transparent focus:ring-[#00288e]' 
                                          : 'bg-gray-50 text-gray-700 border border-gray-100 focus:ring-blue-200'
                                      }`}
                                    />
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
                <h2 className="text-2xl font-bold tracking-tight text-[#00288e]">Relatórios de Recebimento</h2>
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
                const totalReceived = emp.items.reduce((sum, item) => sum + item.received * item.unitPrice, 0);
                
                // Get linked invoices list
                const linkedInvoices = invoices.filter(inv => inv.empenhoId === emp.id);

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
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">VALOR TOTAL EMPENHADO</span>
                            <span className="text-xl sm:text-2xl font-black text-[#00288e]">
                              R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">TOTAL RECEBIDO (NF-e)</span>
                            <span className="text-xl sm:text-2xl font-black text-emerald-600">
                              R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                                <tr className="bg-gray-50 border-b border-gray-100">
                                  <th className="py-2.5 px-4 font-bold text-gray-500">Número da NF</th>
                                  <th className="py-2.5 px-4 font-bold text-gray-500">Data de Emissão</th>
                                  <th className="py-2.5 px-4 font-bold text-gray-500 text-right">Valor Total da NF</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {linkedInvoices.map((inv) => {
                                  const formattedDate = inv.issueDate.split('-').reverse().join('/');
                                  return (
                                    <tr key={inv.id} className="hover:bg-gray-50/50">
                                      <td className="py-3 px-4 font-bold text-[#00288e]">NF {inv.id}</td>
                                      <td className="py-3 px-4 text-gray-600 font-semibold">{formattedDate || inv.issueDate}</td>
                                      <td className="py-3 px-4 text-right font-extrabold text-emerald-600">
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
                    <div className="flex justify-center">
                      <button 
                        onClick={() => setShowPdfModal(true)}
                        className="px-6 py-3 bg-white border border-gray-200 hover:bg-gray-50 active:scale-95 duration-100 rounded-xl font-bold text-sm text-[#00288e] flex items-center gap-2 shadow-sm"
                      >
                        <Printer className="w-4 h-4" /> Exportar Relatório PDF
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
                            const totalReceived = emp.items.reduce((sum, item) => sum + item.received * item.unitPrice, 0);
                            const pdfInvoices = invoices.filter(inv => inv.empenhoId === emp.id);

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

                                <div className="border-t border-b border-gray-100 py-3 grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="font-bold text-gray-400 text-[9px]">VALOR TOTAL CONTRATADO</p>
                                    <p className="text-base font-black text-gray-800">R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-bold text-gray-400 text-[9px]">TOTAL CONCILIADO POR NF-e</p>
                                    <p className="text-base font-black text-emerald-600">R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
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
                                        <tr className="border-b bg-gray-50">
                                          <th className="py-1 px-2 font-bold text-gray-600">Número da NF</th>
                                          <th className="py-1 px-2 font-bold text-gray-600">Data de Emissão</th>
                                          <th className="py-1 px-2 font-bold text-gray-600 text-right">Valor Total</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y">
                                        {pdfInvoices.map((inv) => {
                                          const formattedDate = inv.issueDate.split('-').reverse().join('/');
                                          return (
                                            <tr key={inv.id}>
                                              <td className="py-2 px-2 font-bold text-[#00288e]">NF {inv.id}</td>
                                              <td className="py-2 px-2 text-gray-600">{formattedDate || inv.issueDate}</td>
                                              <td className="py-2 px-2 text-right font-bold text-emerald-600">
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

                      <div className="p-4 bg-gray-100 flex justify-end gap-3 flex-shrink-0">
                        <button 
                          onClick={() => setShowPdfModal(false)}
                          className="px-4 py-2 bg-gray-200 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-300 transition-all"
                        >
                          Fechar
                        </button>
                        <button 
                          onClick={() => { window.print(); }}
                          className="px-4 py-2 bg-[#00288e] text-white rounded-xl font-bold text-xs hover:bg-[#1e40af] transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <Printer className="w-4 h-4" /> Enviar para Impressora
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
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setActiveTab('empenhos')}
                  className="p-1.5 hover:bg-blue-50 text-[#00288e] rounded-lg transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-[#00288e]">Itens do Empenho</h2>
                  <p className="text-sm text-gray-500 font-medium">Controle e cadastro físico de itens para a dotação: {editingEmpenhoId}</p>
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
                            <button 
                              onClick={handleFinishEmpenhoRegistry}
                              className="px-6 h-12 flex items-center justify-center gap-2 bg-[#00288e] text-white rounded-full font-bold text-xs sm:text-sm shadow-md active:scale-95 duration-100 hover:bg-[#1e40af] transition-all"
                            >
                              <Save className="w-4 h-4" /> Finalizar Cadastro
                            </button>
                          </div>
                        </footer>

                      </div>
                    );
                  })()}
                </section>

              </div>

            </div>
          )}

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
          <span className="text-[10px] mt-0.5">Empenhos</span>
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
          <span className="text-[10px] mt-0.5">Relatórios</span>
        </button>


      </nav>

    </div>
  );
}
