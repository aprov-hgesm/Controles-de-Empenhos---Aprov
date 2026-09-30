'use client';

import type React from 'react';
import type { User } from 'firebase/auth';
import type {
  Alert,
  Empenho,
  EmpenhoContractingModality,
  EmpenhoPdfDocument,
  Invoice,
  Item,
} from '../../../lib/types';
import { createEmpenho, saveAlert, saveEmpenho, removeEmpenho } from '../../../lib/firebaseSync';
import { PROMPT_EXTRACAO_EMPENHO } from '../domain/empenhoHelpers';
import { normalizeEmpenhoClassCode } from '../../../lib/empenhoClasses';
import { getInvoiceRecordKey, isValidSupplierCnpj, normalizeSupplierCnpj } from '../../../lib/invoiceIdentity';
import { commitEmpenhoSupplierCnpjMigration } from '../../../lib/nsIntegrityService';
import { isValidNsNumber, normalizeNsNumber } from '../../../lib/nsIntegrity';
import { loadJsPdf } from '../../../lib/pdfToolkit';

type ActiveTab = 'inicio' | 'painel' | 'empenhos' | 'fornecedores' | 'itens' | 'nova_nf' | 'relatorios' | 'itens_empenho' | 'cronogramas' | 'avisos';
type NewEmpenhoForm = { id: string; supplier: string; supplierCnpj: string; description: string; pregao: string; date: string; classification: string };
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
     const committedEmpenho = await saveEmpenho(user.uid, updatedEmpenho);
    setEmpenhos((current) => current.map((emp) => emp.id === empenhoId ? committedEmpenho : emp));
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
      if (!user) throw new Error('Sua sessão expirou. Entre novamente para alterar o empenho.');
      const committedEmpenho = await saveEmpenho(user.uid, updatedEmpenho);
      setEmpenhos((current) => current.map((emp) => emp.id === empenhoId ? committedEmpenho : emp));
      showToast(`Pregão do empenho ${empenhoId} atualizado para ${normalizedPregao}.`, 'success');
    } catch (error) {
      console.error('Erro ao atualizar Pregão do empenho:', error);
      showToast(
        error instanceof Error ? error.message : 'Não foi possível atualizar o Pregão do empenho.',
        'error'
      );
      throw error;
    }
  };

  const handleUpdateEmpenhoNotaCredito = async (
    empenhoId: string,
    notaCreditoInput: string
  ): Promise<void> => {
    const currentEmpenho = empenhos.find((emp) => emp.id === empenhoId);
    if (!currentEmpenho) {
      showToast('Empenho não encontrado para alteração da Nota de Crédito.', 'error');
      return;
    }

    const notaCredito = notaCreditoInput.trim().toUpperCase();
    if (notaCredito && !/^\d{4}NC[A-Z0-9]{5,}$/.test(notaCredito)) {
      const error = new Error('Informe a Nota de Crédito no formato AAAANC000000, por exemplo 2026NC412370.');
      showToast(error.message, 'error');
      throw error;
    }

    const { notaCredito: _previousNotaCredito, ...withoutNotaCredito } = currentEmpenho;
    const updatedEmpenho: Empenho = notaCredito
      ? { ...currentEmpenho, notaCredito }
      : withoutNotaCredito;

    try {
      if (!user) throw new Error('Sua sessão expirou. Entre novamente para alterar o empenho.');
      const committedEmpenho = await saveEmpenho(user.uid, updatedEmpenho);
      setEmpenhos((current) => current.map((emp) => (
        emp.id === empenhoId ? committedEmpenho : emp
      )));
      showToast(
        notaCredito
          ? `Nota de Crédito do empenho ${empenhoId} atualizada para ${notaCredito}.`
          : `Nota de Crédito do empenho ${empenhoId} removida.`,
        'success'
      );
    } catch (error) {
      console.error('Erro ao atualizar Nota de Crédito do empenho:', error);
      showToast(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar a Nota de Crédito do empenho.',
        'error'
      );
      throw error;
    }
  };

  const handleUpdateEmpenhoItemDetails = async (
    empenhoId: string,
    itemId: string,
    updates: { itemCompraNumber: string; name: string }
  ): Promise<void> => {
    const currentEmpenho = empenhos.find((emp) => emp.id === empenhoId);
    const currentItem = currentEmpenho?.items.find((item) => item.id === itemId);

    if (!currentEmpenho || !currentItem) {
      const error = new Error('Item do empenho não encontrado para edição.');
      showToast(error.message, 'error');
      throw error;
    }

    const normalizedName = updates.name.trim();
    if (!normalizedName) {
      const error = new Error('O descritivo do item não pode ficar vazio.');
      showToast(error.message, 'error');
      throw error;
    }

    const rawItemCompraNumber = updates.itemCompraNumber.trim();
    const normalizedItemCompraNumber = rawItemCompraNumber
      ? (/^\d+$/.test(rawItemCompraNumber)
          ? rawItemCompraNumber.padStart(5, '0')
          : rawItemCompraNumber)
      : undefined;

    if (!user) {
      const error = new Error('Sua sessão expirou. Entre novamente para editar o item.');
      showToast(error.message, 'error');
      throw error;
    }

    const updatedEmpenho: Empenho = {
      ...currentEmpenho,
      items: currentEmpenho.items.map((item) => (
        item.id === itemId
          ? {
              ...item,
              name: normalizedName,
              itemCompraNumber: normalizedItemCompraNumber,
            }
          : item
      )),
    };

    try {
      const committedEmpenho = await saveEmpenho(user.uid, updatedEmpenho);
      setEmpenhos((current) => current.map((emp) => (
        emp.id === empenhoId ? committedEmpenho : emp
      )));
      showToast(
        `Item ${normalizedItemCompraNumber || itemId} do empenho ${empenhoId} atualizado.`,
        'success'
      );
    } catch (error) {
      console.error('Erro ao atualizar item do empenho:', error);
      showToast(
        error instanceof Error ? error.message : 'Não foi possível atualizar o item do empenho.',
        'error'
      );
      throw error;
    }
  };

  const handleUpdateEmpenhoSupplierCnpj = async (empenhoId: string, cnpjInput: string): Promise<void> => {
    const currentEmpenho = empenhos.find((emp) => emp.id === empenhoId);
    if (!currentEmpenho) {
      showToast('Empenho não encontrado para alteração do CNPJ.', 'error');
      return;
    }

    if (!user) {
      showToast('Faça login novamente antes de alterar o CNPJ do fornecedor.', 'error');
      return;
    }

    const normalizedCnpj = normalizeSupplierCnpj(cnpjInput);
    if (cnpjInput.trim() && (!normalizedCnpj || !isValidSupplierCnpj(normalizedCnpj))) {
      showToast('Informe um CNPJ válido, com formato oficial e dígitos verificadores corretos.', 'error');
      return;
    }

    const currentCnpj = normalizeSupplierCnpj(currentEmpenho.supplierCnpj);
    const linkedInvoices = invoices.filter((invoice) => invoice.empenhoId === empenhoId);

    if (!normalizedCnpj && linkedInvoices.length > 0) {
      showToast(
        'Não é possível remover o CNPJ deste empenho enquanto houver Notas Fiscais vinculadas.',
        'error'
      );
      return;
    }

    const willChangeIdentity = currentCnpj !== normalizedCnpj;
    const nsWithoutUgCount = linkedInvoices.filter(
      (invoice) =>
        Boolean(normalizeNsNumber(invoice.numeroNS)) &&
        !String(invoice.nsUg || '').trim()
    ).length;

    if (willChangeIdentity && linkedInvoices.length > 0) {
      const automaticUgNotice = nsWithoutUgCount > 0
        ? ` ${nsWithoutUgCount} NS(s) legada(s) sem UG receberão automaticamente a UG da unidade autenticada.`
        : '';
      const confirmed = confirm(
        `Alterar o CNPJ do empenho ${empenhoId} migrará ${linkedInvoices.length} Nota(s) Fiscal(is), suas identidades internas e os locks de NS associados.${automaticUgNotice} Deseja continuar?`
      );
      if (!confirmed) return;
    }

    const legacyNsCanonicalOverrides: Record<string, string> = {};
    for (const invoice of linkedInvoices) {
      const storedNs = normalizeNsNumber(invoice.numeroNS);
      if (!storedNs || isValidNsNumber(storedNs)) continue;

      const empenhoYear = empenhoId.match(/^(\d{4})NE/i)?.[1];
      const suggestedNs = /^\d{1,6}$/.test(storedNs)
        ? `${empenhoYear || new Date().getFullYear()}NS${storedNs.padStart(6, '0')}`
        : storedNs;

      const confirmedNs = prompt(
        `A NF ${invoice.id} possui a NS legada "${storedNs}" fora do padrão completo. Confirme ou corrija o número no formato AAAANS000000. A UG será preenchida automaticamente pela unidade do usuário.`,
        suggestedNs
      );

      if (confirmedNs === null) {
        showToast('Migração de CNPJ cancelada antes de alterar qualquer dado.', 'info');
        return;
      }

      const normalizedNs = normalizeNsNumber(confirmedNs);
      if (!isValidNsNumber(normalizedNs)) {
        showToast(
          `A NS informada para a NF ${invoice.id} é inválida. Use o formato AAAANS000000, por exemplo 2026NS000922.`,
          'error'
        );
        return;
      }

      legacyNsCanonicalOverrides[getInvoiceRecordKey(invoice)] = normalizedNs;
    }

    try {
      const result = await commitEmpenhoSupplierCnpjMigration(user.uid, {
        empenhoId,
        targetSupplierCnpj: normalizedCnpj,
        expectedRevision: currentEmpenho.revision,
        legacyNsCanonicalOverrides:
          Object.keys(legacyNsCanonicalOverrides).length > 0
            ? legacyNsCanonicalOverrides
            : undefined,
      });

      setEmpenhos((current) => current.map((emp) => (
        emp.id === empenhoId ? result.updatedEmpenho : emp
      )));

      if (result.invoiceMigrations.length > 0) {
        setInvoices((current) => {
          const migratedSourceKeys = new Set(
            result.invoiceMigrations.map((migration) => migration.sourceRecordKey)
          );
          const retained = current.filter(
            (invoice) => !migratedSourceKeys.has(getInvoiceRecordKey(invoice))
          );
          return [
            ...result.invoiceMigrations.map((migration) => migration.invoice),
            ...retained,
          ];
        });
      }

      if (result.noOp) {
        showToast(`O CNPJ do empenho ${empenhoId} já está consistente.`, 'info');
        return;
      }

      const nsRepairSummary = [
        result.backfilledNsUgCount > 0
          ? `${result.backfilledNsUgCount} NS(s) receberam a UG da unidade`
          : '',
        result.canonicalizedLegacyNsCount > 0
          ? `${result.canonicalizedLegacyNsCount} NS(s) legada(s) foram convertidas para o formato completo`
          : '',
      ].filter(Boolean).join(' ');

      const successMessage = normalizedCnpj
        ? result.migratedInvoiceCount > 0
          ? `CNPJ do empenho ${empenhoId} atualizado. ${result.migratedInvoiceCount} NF(s) e ${result.migratedLockCount} lock(s) de NS foram sincronizados.`
          : `CNPJ do fornecedor atualizado no empenho ${empenhoId}.`
        : `CNPJ removido do empenho ${empenhoId}.`;

      showToast(
        nsRepairSummary ? `${successMessage} ${nsRepairSummary}.` : successMessage,
        'success'
      );
    } catch (error) {
      console.error('Erro ao migrar CNPJ do fornecedor:', error);
      showToast(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o CNPJ do fornecedor.',
        'error'
      );
      throw error;
    }
  };
  const handleUpdateEmpenhoClassification = async (
    empenhoId: string,
    classificationInput: string
  ): Promise<void> => {
    const currentEmpenho = empenhos.find((emp) => emp.id === empenhoId);
    if (!currentEmpenho) {
      showToast('Empenho não encontrado para alteração da classe.', 'error');
      return;
    }

    const classification = normalizeEmpenhoClassCode(classificationInput);
    if (!classification) {
      showToast('Selecione uma classe válida para o empenho.', 'error');
      return;
    }

    const updatedEmpenho: Empenho = {
      ...currentEmpenho,
      classification,
    };

    try {
      if (!user) throw new Error('Sua sessão expirou. Entre novamente para alterar o empenho.');
      const committedEmpenho = await saveEmpenho(user.uid, updatedEmpenho);
      setEmpenhos((current) => current.map((emp) => (
        emp.id === empenhoId ? committedEmpenho : emp
      )));
      showToast(`Classe do empenho ${empenhoId} alterada para ${classification}.`, 'success');
    } catch (error) {
      console.error('Erro ao atualizar classe do empenho:', error);
      showToast(
        error instanceof Error ? error.message : 'Não foi possível atualizar a classe do empenho.',
        'error'
      );
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
     const normalizedSupplierCnpj = normalizeSupplierCnpj(newEmpenhoForm.supplierCnpj);
    if (newEmpenhoForm.supplierCnpj.trim() && (!normalizedSupplierCnpj || !isValidSupplierCnpj(normalizedSupplierCnpj))) {
      showToast('Informe um CNPJ válido, com formato oficial e dígitos verificadores corretos.', 'error');
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
      supplierCnpj: normalizedSupplierCnpj || undefined,
      description: newEmpenhoForm.description,
      date: formattedDate,
      status: 'Ativo',
      items: [],
      pregao: newEmpenhoForm.pregao || 'Sem Pregão',
      modalidadeContratacao: newEmpenhoForm.pregao ? 'PREGAO' : 'OUTRA',
      ...(newEmpenhoForm.pregao
        ? { numeroContratacao: newEmpenhoForm.pregao }
        : {}),
      classification: normalizeEmpenhoClassCode(newEmpenhoForm.classification) || 'QR',
    };
    if (!user) {
      showToast('Sua sessão expirou. Entre novamente antes de cadastrar o empenho.', 'error');
      return;
    }
    let committedEmpenho: Empenho;
    try {
      committedEmpenho = await createEmpenho(user.uid, newEmp);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Erro ao salvar no Firebase. O empenho não foi confirmado.',
        'error'
      );
      return;
    }
    setEmpenhos((current) => [committedEmpenho, ...current.filter((emp) => emp.id !== committedEmpenho.id)]);
    showToast(`Nota de Empenho ${newEmp.id} criada! Adicione itens a ela.`, 'success');
    setNewEmpenhoForm({ id: '', supplier: '', supplierCnpj: '', description: '', pregao: '', date: new Date().toISOString().split('T')[0], classification: 'QR' });
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
  const handleDownloadPromptPdf = async () => {
    try {
      const jsPDF = await loadJsPdf();
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

  const handleProcessEmpenhoPdf = async (file: File): Promise<void> => {
    if (!user) {
      showToast('Sua sessão expirou. Entre novamente antes de importar a Nota de Empenho.', 'error');
      return;
    }
    if (
      file.type !== 'application/pdf'
      && !file.name.toLocaleLowerCase('pt-BR').endsWith('.pdf')
    ) {
      setJsonError('Selecione um arquivo PDF de Nota de Empenho.');
      return;
    }
    if (file.size <= 0 || file.size > 12 * 1024 * 1024) {
      setJsonError('O PDF da Nota de Empenho deve ter até 12 MB.');
      return;
    }

    setJsonError(null);
    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.set('file', file);

      const response = await fetch('/api/empenhos/parse-ne', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const payload = await response.json().catch(() => ({})) as {
        result?: {
          id: string;
          supplier: string;
          supplierCnpj: string;
          description: string;
          date: string;
          valorTotal: number;
          notaCredito: string | null;
          modalidadeContratacao: EmpenhoContractingModality;
          numeroContratacao: string | null;
          pregao: string;
          contrato: string | null;
          classification: string;
          tipoObjeto: 'MATERIAL' | 'SERVICO' | 'OUTRO';
          naturezaDespesa: string | null;
          processo: string;
          ug: string | null;
          pageCountDetected: number;
          itemRowsDetected: number;
          duplicatedRowsIgnored: number;
          warnings: string[];
          items: Array<{
            id: string;
            itemCompraNumber: string;
            sequence: string;
            name: string;
            unit: string;
            quantity: number;
            unitPrice: number;
            declaredTotal: number;
            received: number;
          }>;
        };
        error?: string;
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error || 'Não foi possível interpretar a Nota de Empenho.');
      }

      const result = payload.result;
      setReviewEmpenho({
        id: result.id.toUpperCase(),
        supplier: result.supplier,
        cnpj: result.supplierCnpj,
        description: result.description,
        date: result.date,
        status: 'Ativo',
        items: result.items.map((item) => ({
          id: item.id,
          itemCompraNumber: item.itemCompraNumber,
          name: item.name,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          received: 0,
          declaredTotal: item.declaredTotal,
          sequence: item.sequence,
        })),
        pregao: result.pregao,
        modalidadeContratacao: result.modalidadeContratacao,
        numeroContratacao: result.numeroContratacao || '',
        notaCredito: result.notaCredito || '',
        contrato: result.contrato || '',
        classification: normalizeEmpenhoClassCode(result.classification) || 'QR',
        valorTotalDeclarado: result.valorTotal,
        importSource: 'pdf',
        importWarnings: result.warnings,
        importMetadata: {
          tipoObjeto: result.tipoObjeto,
          naturezaDespesa: result.naturezaDespesa,
          processo: result.processo,
          ug: result.ug,
          pageCountDetected: result.pageCountDetected,
          itemRowsDetected: result.itemRowsDetected,
          duplicatedRowsIgnored: result.duplicatedRowsIgnored,
          fileName: file.name,
        },
      });
      setJsonError(null);
      showToast(
        `NE ${result.id} lida diretamente do PDF. Revise os dados antes de salvar.`,
        'success'
      );
    } catch (error) {
      console.error('Erro ao ler Nota de Empenho diretamente do PDF:', error);
      setJsonError(
        error instanceof Error
          ? error.message
          : 'Não foi possível interpretar a Nota de Empenho.'
      );
    }
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
          itemCompraNumber: item.codigo_item != null
            ? (/^\d+$/.test(String(item.codigo_item).trim()) ? String(item.codigo_item).trim().padStart(5, '0') : String(item.codigo_item).trim())
            : undefined,
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
        modalidadeContratacao: (data.pregao_relacionado || data.pregao)
          ? 'PREGAO'
          : 'OUTRA',
        numeroContratacao: data.numero_contratacao
          || data.numeroContratacao
          || data.pregao_relacionado
          || data.pregao
          || '',
        notaCredito: String(data.nota_credito || data.notaCredito || '').trim().toUpperCase(),
        contrato: String(data.contrato || '').trim(),
        classification: normalizeEmpenhoClassCode(String(data.classificacao || 'QR')) || 'QR',
        valorTotalDeclarado: parseFloat(data.valor_total || data.valorTotal) || null,
        importSource: 'json',
        importWarnings: [],
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
     const normalizedSupplierCnpj = normalizeSupplierCnpj(reviewEmpenho.cnpj);
    if (String(reviewEmpenho.cnpj || '').trim() && (!normalizedSupplierCnpj || !isValidSupplierCnpj(normalizedSupplierCnpj))) {
      showToast('O CNPJ extraído/revisado precisa ter formato oficial e dígitos verificadores corretos.', 'error');
      return;
    }
    const normalizedNotaCredito = String(reviewEmpenho.notaCredito || '').trim().toUpperCase();
    if (normalizedNotaCredito && !/^\d{4}NC[A-Z0-9]{5,}$/.test(normalizedNotaCredito)) {
      showToast('Revise a Nota de Crédito. Use o formato AAAANC000000, por exemplo 2026NC412370.', 'error');
      return;
    }
    if (empenhos.some(emp => emp.id.toUpperCase() === reviewEmpenho.id.toUpperCase())) {
      showToast('Já existe uma Nota de Empenho com este número.', 'error');
      return;
    }
     const finalEmp: Empenho = {
      id: reviewEmpenho.id.toUpperCase(),
      supplier: reviewEmpenho.supplier,
      supplierCnpj: normalizedSupplierCnpj || undefined,
      description: reviewEmpenho.description,
      date: reviewEmpenho.date,
      status: 'Ativo',
      items: reviewEmpenho.items.map((item: Item) => ({
        id: item.id,
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        received: item.received || 0,
        ...(item.itemCompraNumber ? { itemCompraNumber: item.itemCompraNumber } : {}),
      })),
      pregao: reviewEmpenho.modalidadeContratacao === 'PREGAO'
        ? (String(reviewEmpenho.numeroContratacao || reviewEmpenho.pregao || '').trim() || 'Sem Pregão')
        : 'Sem Pregão',
      modalidadeContratacao: (
        ['PREGAO', 'DISPENSA_ELETRONICA', 'OUTRA'].includes(
          String(reviewEmpenho.modalidadeContratacao || '')
        )
          ? reviewEmpenho.modalidadeContratacao
          : (reviewEmpenho.pregao ? 'PREGAO' : 'OUTRA')
      ) as EmpenhoContractingModality,
      ...(String(
        reviewEmpenho.numeroContratacao
        || reviewEmpenho.pregao
        || ''
      ).trim()
        ? {
            numeroContratacao: String(
              reviewEmpenho.numeroContratacao
              || reviewEmpenho.pregao
              || ''
            ).trim(),
          }
        : {}),
      ...(normalizedNotaCredito ? { notaCredito: normalizedNotaCredito } : {}),
      ...(String(reviewEmpenho.contrato || '').trim()
        ? { contrato: String(reviewEmpenho.contrato).trim() }
        : {}),
      classification: normalizeEmpenhoClassCode(String(reviewEmpenho.classification || 'QR')) || 'QR',
    };
    if (!user) {
      showToast('Sua sessão expirou. Entre novamente antes de cadastrar o empenho.', 'error');
      return;
    }
    let committedEmpenho: Empenho;
    try {
      committedEmpenho = await createEmpenho(user.uid, finalEmp);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Erro ao salvar no Firebase.',
        'error'
      );
      return;
    }
    setEmpenhos((current) => [committedEmpenho, ...current.filter((emp) => emp.id !== committedEmpenho.id)]);
     showToast(`Empenho ${committedEmpenho.id} cadastrado com sucesso! ${committedEmpenho.items.length} itens importados.`, 'success');

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
          itemCompraNumber: newItemForm.id.trim()
            ? (/^\d+$/.test(newItemForm.id.trim()) ? newItemForm.id.trim().padStart(5, '0') : newItemForm.id.trim())
            : undefined,
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
     if (!user || !updatedTargetEmp) {
      showToast('Sua sessão expirou ou o empenho não foi localizado.', 'error');
      return;
    }
    try {
      const committedEmpenho = await saveEmpenho(user.uid, updatedTargetEmp);
      setEmpenhos((current) => current.map((emp) => (
        emp.id === committedEmpenho.id ? committedEmpenho : emp
      )));
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Erro ao salvar no Firebase.',
        'error'
      );
      return;
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
     if (!user || !updatedTargetEmp) {
      showToast('Sua sessão expirou ou o empenho não foi localizado.', 'error');
      return;
    }
    try {
      const committedEmpenho = await saveEmpenho(user.uid, updatedTargetEmp);
      setEmpenhos((current) => current.map((emp) => (
        emp.id === committedEmpenho.id ? committedEmpenho : emp
      )));
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Erro ao salvar no Firebase.',
        'error'
      );
      return;
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
      empenhoId: target.id,
      type: 'INFORMATIVO',
      status: 'NOVO',
      source: 'EMPENHO',
      title: `Novo Empenho Cadastrado: ${target.id}`,
      subtitle: `Fornecedor: ${target.supplier}`,
      description: `Aguardando faturamento de ${target.items.length} itens cadastrados no valor de R$ ${target.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
      date: 'Agora',
      createdAt: new Date().toISOString(),
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
    if (!user) {
      showToast('Faça login novamente antes de excluir o empenho.', 'error');
      return;
    }

    setIsDeletingEmpenho(true);
    try {
      const currentEmpenho = empenhos.find((empenho) => empenho.id === id);
      if (!currentEmpenho) {
        throw new Error('O empenho não está mais disponível. Atualize a tela.');
      }
      const result = await removeEmpenho(user.uid, id, currentEmpenho.revision);
      const deletedInvoices = new Set(result.deletedInvoiceRecordKeys);
      const deletedAlerts = new Set(result.deletedAlertIds);

      // O estado local só muda depois que a transação protegida foi confirmada.
      // onSnapshot continuará sendo a fonte de verdade e reconciliará qualquer
      // sessão concorrente sem janela de estado parcialmente excluído.
      setEmpenhos((current) => current.filter((empenho) => empenho.id !== id));
      setInvoices((current) => current.filter(
        (invoice) => !deletedInvoices.has(getInvoiceRecordKey(invoice))
      ));
      setAlerts((current) => current.filter((alert) => !deletedAlerts.has(alert.id)));

      showToast(
        result.deletedInvoiceRecordKeys.length > 0
          ? `Empenho ${id} e ${result.deletedInvoiceRecordKeys.length} NF(s) vinculada(s) excluídos com segurança.`
          : `Empenho ${id} excluído com segurança.`,
        'info'
      );
      setEmpenhoToDelete(null);
      if (activeTab === 'itens_empenho') {
        setActiveTab('empenhos');
      }
    } catch (error) {
      console.error('Erro ao excluir empenho com integridade:', error);
      showToast(
        error instanceof Error
          ? error.message
          : 'Não foi possível excluir o empenho com segurança.',
        'error'
      );
    } finally {
      setIsDeletingEmpenho(false);
    }
  };

  return {
    handleEmpenhoDocumentUploaded,
    handleUpdateEmpenhoPregao,
    handleUpdateEmpenhoNotaCredito,
    handleUpdateEmpenhoSupplierCnpj,
    handleUpdateEmpenhoClassification,
    handleUpdateEmpenhoItemDetails,
    handleCreateEmpenho,
    handleDownloadPromptTxt,
    handleDownloadPromptPdf,
    handleCopyPrompt,
    handleProcessEmpenhoPdf,
    handleProcessJson,
    handleSaveReviewEmpenho,
    handleAddItemToEmpenho,
    handleDeleteItemFromEmpenho,
    handleFinishEmpenhoRegistry,
    handleDeleteSpecificEmpenho,
  };
}
