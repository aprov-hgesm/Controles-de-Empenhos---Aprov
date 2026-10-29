'use client';

import { useRef } from 'react';
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
import { MAX_EMPENHO_PDF_BYTES, uploadEmpenhoPdf } from '../../../lib/empenhoDocuments';
import { assertWorkspacePdfIsSafeForStorage } from '../../../lib/pdfSecurity';
import { normalizeEmpenhoClassCode } from '../../../lib/empenhoClasses';
import { getInvoiceRecordKey, isValidSupplierCnpj, normalizeSupplierCnpj } from '../../../lib/invoiceIdentity';
import { commitEmpenhoSupplierCnpjMigration } from '../../../lib/nsIntegrityService';
import { isValidNsNumber, normalizeNsNumber } from '../../../lib/nsIntegrity';
import { loadInvoicesForEmpenho } from '../../../lib/historicalInvoiceQueries';
import { mergeInvoiceCollections } from '../../../lib/invoiceHotHistory';

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
  setJsonError: React.Dispatch<React.SetStateAction<string | null>>;
  setReviewEmpenho: React.Dispatch<React.SetStateAction<any | null>>;
  reviewEmpenho: any | null;
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
  const { user, empenhos, setEmpenhos, alerts, setAlerts, invoices, setInvoices, newEmpenhoForm, setNewEmpenhoForm, setShowNewEmpenhoModal, setEditingEmpenhoId, setSelectedEmpenhoDetailId, setActiveTab, showToast, setJsonError, setReviewEmpenho, reviewEmpenho, setShowConfirmSaveModal, newItemForm, setNewItemForm, editingEmpenhoId, setIsDeletingEmpenho, setEmpenhoToDelete, activeTab } = context;

  // O PDF original permanece apenas em memória até a confirmação do cadastro.
  const pendingImportedPdfRef = useRef<File | null>(null);
  // Reutiliza o mesmo upload quando o Firestore não confirma uma tentativa anterior.
  const pendingDriveUploadRef = useRef<{
    sourceFile: File;
    empenhoId: string;
    document: EmpenhoPdfDocument;
  } | null>(null);

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
    let linkedInvoices = invoices.filter((invoice) => invoice.empenhoId === empenhoId);

    try {
      const historical = await loadInvoicesForEmpenho(empenhoId);
      if (historical.truncated) {
        showToast(
          'O histórico de Notas Fiscais deste empenho atingiu o limite de segurança. A alteração de CNPJ foi bloqueada para evitar migração parcial.',
          'error'
        );
        return;
      }
      linkedInvoices = mergeInvoiceCollections(linkedInvoices, historical.invoices)
        .filter((invoice) => invoice.empenhoId === empenhoId);
    } catch (error) {
      console.error('Erro ao carregar histórico de NFs antes da migração de CNPJ:', error);
      showToast(
        'Não foi possível validar todas as Notas Fiscais vinculadas. O CNPJ não foi alterado.',
        'error'
      );
      return;
    }

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

  const handleProcessEmpenhoPdf = async (file: File): Promise<void> => {
    pendingImportedPdfRef.current = null;
    pendingDriveUploadRef.current = null;
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
    if (file.size <= 0 || file.size > MAX_EMPENHO_PDF_BYTES) {
      setJsonError('O PDF da Nota de Empenho deve ter até 10 MB para ser salvo no Google Drive.');
      return;
    }

    setJsonError(null);
    try {
      await assertWorkspacePdfIsSafeForStorage(file, { maxBytes: MAX_EMPENHO_PDF_BYTES });
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
      pendingImportedPdfRef.current = file;
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
      pendingImportedPdfRef.current = null;
      console.error('Erro ao ler Nota de Empenho diretamente do PDF:', error);
      setJsonError(
        error instanceof Error
          ? error.message
          : 'Não foi possível interpretar a Nota de Empenho.'
      );
    }
  };

  // Save the NE reviewed after direct PDF extraction
  const handleSaveReviewEmpenho = async () => {
    if (!reviewEmpenho) return;
    if (reviewEmpenho.importSource !== 'pdf') {
      showToast('Cadastro por JSON desativado. Utilize Cadastro Manual ou Importar PDF da NE.', 'error');
      return;
    }
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
    const sourceFile = pendingImportedPdfRef.current;
    if (!sourceFile) {
      showToast('O PDF original não está mais disponível. Selecione novamente a Nota de Empenho.', 'error');
      return;
    }

    // Primeiro confirma o arquivo no Drive; depois cadastra a NE já vinculada ao PDF.
    // Um erro de upload nunca produz um empenho sem seu documento.
    let uploadedDocument: EmpenhoPdfDocument;
    const previousUpload = pendingDriveUploadRef.current;
    if (previousUpload?.sourceFile === sourceFile && previousUpload.empenhoId === finalEmp.id) {
      uploadedDocument = previousUpload.document;
    } else {
      try {
        // Alguns navegadores fornecem PDFs com MIME vazio; a assinatura já foi validada.
        const pdfToStore = sourceFile.type === 'application/pdf'
          ? sourceFile
          : new File([sourceFile], sourceFile.name, {
              type: 'application/pdf',
              lastModified: sourceFile.lastModified,
            });
        uploadedDocument = await uploadEmpenhoPdf(user, finalEmp.id, pdfToStore);
        pendingDriveUploadRef.current = {
          sourceFile,
          empenhoId: finalEmp.id,
          document: uploadedDocument,
        };
      } catch (error) {
        showToast(
          error instanceof Error
            ? `PDF não salvo no Google Drive: ${error.message} O empenho não foi cadastrado.`
            : 'Falha ao salvar o PDF no Google Drive. O empenho não foi cadastrado.',
          'error'
        );
        return;
      }
    }

    finalEmp.notaEmpenhoPdf = uploadedDocument;
    finalEmp.notaEmpenhoPdfVersions = [uploadedDocument];

    let committedEmpenho: Empenho;
    try {
      committedEmpenho = await createEmpenho(user.uid, finalEmp);
    } catch (error) {
      // Firestore pode ter confirmado a transação antes de uma falha de rede.
      // Preservar o PDF evita apagar o documento de um empenho potencialmente gravado.
      showToast(
        error instanceof Error
          ? `Cadastro não confirmado no Firebase: ${error.message} O PDF foi preservado no Drive. Atualize a lista antes de tentar novamente.`
          : 'Cadastro não confirmado no Firebase. O PDF foi preservado no Drive. Atualize a lista antes de tentar novamente.',
        'error'
      );
      return;
    }
    setEmpenhos((current) => [committedEmpenho, ...current.filter((emp) => emp.id !== committedEmpenho.id)]);
    pendingImportedPdfRef.current = null;
    pendingDriveUploadRef.current = null;
    showToast(`Empenho ${committedEmpenho.id} cadastrado com sucesso! ${committedEmpenho.items.length} itens importados e PDF salvo no Google Drive.`, 'success');

    // Clean states
    setReviewEmpenho(null);
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
    handleProcessEmpenhoPdf,
    handleSaveReviewEmpenho,
    handleAddItemToEmpenho,
    handleDeleteItemFromEmpenho,
    handleFinishEmpenhoRegistry,
    handleDeleteSpecificEmpenho,
  };
}
