'use client';

import type React from 'react';
import type { User } from 'firebase/auth';
import jsPDF from 'jspdf';
import type { Alert, Empenho, EmpenhoPdfDocument, Invoice, Item } from '../../../lib/types';
import { saveAlert, saveEmpenho, removeAlert, removeEmpenho, removeInvoice } from '../../../lib/firebaseSync';
import { PROMPT_EXTRACAO_EMPENHO } from '../domain/empenhoHelpers';

type ActiveTab = 'painel' | 'empenhos' | 'itens' | 'nova_nf' | 'relatorios' | 'itens_empenho' | 'cronogramas';
type NewEmpenhoForm = { id: string; supplier: string; description: string; pregao: string; date: string; classification: 'QR' | 'CALI' | 'PASA' };
type NewItemForm = { id: string; name: string; unit: string; quantity: string; unitPrice: string };
type ToastType = 'success' | 'error' | 'info';

interface EmpenhoActionsContext {
  user: User | null;
  empenhos: Empenho[];
  setEmpenhos: React.Dispatch<React.SetStateAction<Empenho[]>>;
  alerts: Alert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  newEmpenhoForm: NewEmpenhoForm;
  setNewEmpenhoForm: React.Dispatch<React.SetStateAction<NewEmpenhoForm>>;
  setShowNewEmpenhoModal: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingEmpenhoId: React.Dispatch<React.SetStateAction<string>>;
  setSelectedEmpenhoDetailId: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveTab: React.Dispatch<React.SetStateAction<ActiveTab>>;
  showToast: (message: string, type?: ToastType) => void;
  setCopiedPrompt: React.Dispatch<React.SetStateAction<boolean>>;
  jsonInput: string;
  setJsonError: React.Dispatch<React.SetStateAction<string | null>>;
  setReviewEmpenho: React.Dispatch<React.SetStateAction<any | null>>;
  reviewEmpenho: any | null;
  setJsonInput: React.Dispatch<React.SetStateAction<string>>;
  setShowConfirmSaveModal: React.Dispatch<React.SetStateAction<boolean>>;
  newItemForm: NewItemForm;
  setNewItemForm: React.Dispatch<React.SetStateAction<NewItemForm>>;
  editingEmpenhoId: string;
  setIsDeletingEmpenho: React.Dispatch<React.SetStateAction<boolean>>;
  setEmpenhoToDelete: React.Dispatch<React.SetStateAction<string | null>>;
  activeTab: ActiveTab;
}

/** Ações do domínio de empenhos; estado e persistência continuam injetados pelo orquestrador. */
export function useEmpenhoActions(context: EmpenhoActionsContext) {
  const { user, empenhos, setEmpenhos, alerts, setAlerts, invoices, setInvoices, newEmpenhoForm, setNewEmpenhoForm, setShowNewEmpenhoModal, setEditingEmpenhoId, setSelectedEmpenhoDetailId, setActiveTab, showToast, setCopiedPrompt, jsonInput, setJsonError, setReviewEmpenho, reviewEmpenho, setJsonInput, setShowConfirmSaveModal, newItemForm, setNewItemForm, editingEmpenhoId, setIsDeletingEmpenho, setEmpenhoToDelete, activeTab } = context;

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

  const handleUpdateEmpenhoPregao = async (empenhoId: string, pregao: string): Promise<void> => {
    const currentEmpenho = empenhos.find((emp) => emp.id === empenhoId);
    if (!currentEmpenho) {
      showToast('Empenho não encontrado para alteração do Pregão.', 'error');
      return;
    }

    const normalizedPregao = pregao.trim() || 'Sem Pregão';
    const updatedEmpenho: Empenho = { ...currentEmpenho, pregao: normalizedPregao };

    try {
      if (user) await saveEmpenho(user.uid, updatedEmpenho);
      setEmpenhos((current) => current.map((emp) => emp.id === empenhoId ? updatedEmpenho : emp));
      showToast(`Pregão do empenho ${empenhoId} atualizado para ${normalizedPregao}.`, 'success');
    } catch (error) {
      console.error('Erro ao atualizar Pregão do empenho:', error);
      showToast('Não foi possível atualizar o Pregão do empenho.', 'error');
      throw error;
    }
  };

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
    if (user) {
      try {
        await saveEmpenho(user.uid, newEmp);
      } catch (error) {
        showToast('Erro ao salvar no Firebase. O empenho não foi confirmado.', 'error');
        return;
      }
    }
    setEmpenhos(updatedEmpenhos);
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

  const handleDeleteSpecificEmpenho = async (id: string) => {
    if (!id) return;
    setIsDeletingEmpenho(true);
    try {
      // 1. Remove from local state
      setEmpenhos(prev => prev.filter(e => e.id !== id));

      // 2. Also remove alerts and invoices associated with this empenho if any
      const associatedInvoices = invoices.filter(inv => (inv as Invoice & { commitmentId?: string }).commitmentId === id);
      const associatedAlerts = alerts.filter(a => (a as Alert & { empenhoId?: string }).empenhoId === id);
      setInvoices(prev => prev.filter(inv => (inv as Invoice & { commitmentId?: string }).commitmentId !== id));
      setAlerts(prev => prev.filter(a => (a as Alert & { empenhoId?: string }).empenhoId !== id));
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

  return {
    handleEmpenhoDocumentUploaded,
    handleUpdateEmpenhoPregao,
    handleCreateEmpenho,
    handleDownloadPromptTxt,
    handleDownloadPromptPdf,
    handleCopyPrompt,
    handleProcessJson,
    handleSaveReviewEmpenho,
    handleAddItemToEmpenho,
    handleDeleteItemFromEmpenho,
    handleFinishEmpenhoRegistry,
    handleDeleteSpecificEmpenho,
  };
}
