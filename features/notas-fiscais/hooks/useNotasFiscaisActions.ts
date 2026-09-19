'use client';

import type React from 'react';
import type { User } from 'firebase/auth';
import type { Alert, Comissao, Empenho, Invoice, InvoiceItem, InvoicePdfDocument } from '../../../lib/types';
import { commitAllComissoesDeletion, commitAllInvoicesDeletion, commitInvoiceDeletion, commitInvoiceReceiptChanges, saveInvoice, removeComissao, saveComissao } from '../../../lib/firebaseSync';
import { deleteInvoicePdfUpload, uploadInvoicePdf } from '../../../lib/invoiceDocuments';
import {
  buildInvoiceRecordKey,
  findInvoiceIdentityConflict,
  getInvoiceRecordKey,
  normalizeSupplierCnpj,
} from '../../../lib/invoiceIdentity';
import {
  isValidNsNumber,
  normalizeNsNumber,
  type NsIntegrityMutation,
} from '../../../lib/nsIntegrity';
import { commitNsIntegrityMutations } from '../../../lib/nsIntegrityService';

type ToastType = 'success' | 'error' | 'info';
type NfSubTab = 'acompanhar' | 'cadastrar' | 'comissao';
interface NotasActionsContext {
  user: User | null;
  empenhos: Empenho[]; setEmpenhos: React.Dispatch<React.SetStateAction<Empenho[]>>;
  alerts: Alert[]; setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  invoices: Invoice[]; setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  comissoes: Comissao[]; setComissoes: React.Dispatch<React.SetStateAction<Comissao[]>>;
  showToast: (message: string, type?: ToastType) => void;
  selectedNFCommitmentId: string; setSelectedNFCommitmentId: React.Dispatch<React.SetStateAction<string>>;
  nfNumber: string; setNfNumber: React.Dispatch<React.SetStateAction<string>>;
  nfDate: string; setNfDate: React.Dispatch<React.SetStateAction<string>>;
  nfQuantities: Record<string, number>; setNfQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  nfSubTab: NfSubTab; setNfSubTab: React.Dispatch<React.SetStateAction<NfSubTab>>;
  editingInvoice: Invoice | null; setEditingInvoice: React.Dispatch<React.SetStateAction<Invoice | null>>;
  setEditingNSId: React.Dispatch<React.SetStateAction<string | null>>; setTempNSValue: React.Dispatch<React.SetStateAction<string>>;
  comissaoMes: string; comissaoBoletimNum: string; setComissaoBoletimNum: React.Dispatch<React.SetStateAction<string>>;
  comissaoBoletimDate: string; setComissaoBoletimDate: React.Dispatch<React.SetStateAction<string>>;
  comissaoPresPosto: string; comissaoPresNome: string; setComissaoPresNome: React.Dispatch<React.SetStateAction<string>>;
  comissaoAux1Posto: string; comissaoAux1Nome: string; setComissaoAux1Nome: React.Dispatch<React.SetStateAction<string>>;
  comissaoAux2Posto: string; comissaoAux2Nome: string; setComissaoAux2Nome: React.Dispatch<React.SetStateAction<string>>;
  comissaoAux3Posto: string; comissaoAux3Nome: string; setComissaoAux3Nome: React.Dispatch<React.SetStateAction<string>>;
}

/** Ações de Notas Fiscais e Comissão, com dependências operacionais injetadas. */
export function useNotasFiscaisActions(context: NotasActionsContext) {
  const { user, empenhos, setEmpenhos, alerts, setAlerts, invoices, setInvoices, comissoes, setComissoes, showToast, selectedNFCommitmentId, setSelectedNFCommitmentId, nfNumber, setNfNumber, nfDate, setNfDate, nfQuantities, setNfQuantities, nfSubTab, setNfSubTab, editingInvoice, setEditingInvoice, setEditingNSId, setTempNSValue, comissaoMes, comissaoBoletimNum, setComissaoBoletimNum, comissaoBoletimDate, setComissaoBoletimDate, comissaoPresPosto, comissaoPresNome, setComissaoPresNome, comissaoAux1Posto, comissaoAux1Nome, setComissaoAux1Nome, comissaoAux2Posto, comissaoAux2Nome, setComissaoAux2Nome, comissaoAux3Posto, comissaoAux3Nome, setComissaoAux3Nome } = context;

  // Save or Edit registered Invoice ("Salvar Recebimento")
  const handleSaveInvoice = async (invoicePdfFile?: File | null): Promise<boolean> => {
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
      return false;
    }
     if (!nfNumber.trim()) {
      showToast('Por favor, insira o número da Nota Fiscal.', 'error');
      return false;
    }
     const cleanNfNum = nfNumber.trim();
    const supplierCnpj = normalizeSupplierCnpj(targetEmpenho.supplierCnpj);
    const previousRecordKey = editingInvoice ? getInvoiceRecordKey(editingInvoice) : undefined;
    const identityConflict = findInvoiceIdentityConflict(
      invoices,
      supplierCnpj,
      cleanNfNum,
      previousRecordKey
    );
    if (identityConflict) {
      const conflictSupplier = identityConflict.supplierCnpj
        ? 'para este mesmo CNPJ'
        : 'em um registro legado ainda sem CNPJ';
      showToast(
        `A Nota Fiscal nº ${cleanNfNum} já está cadastrada ${conflictSupplier}. Revise o fornecedor ou edite a NF existente.`,
        'error'
      );
      return false;
    }

    const generatedRecordKey = buildInvoiceRecordKey(supplierCnpj, cleanNfNum);
    const nextRecordKey = generatedRecordKey || previousRecordKey || cleanNfNum;
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
      return false;
    }
     if (isExceeded) {
      showToast(`A quantidade inserida para "${exceededItemName}" excede o saldo disponível do empenho!`, 'error');
      return false;
    }
     // Process & update database state
    const invoiceTotal = enteredItems.reduce((sum, item) => sum + item.subtotal, 0);

    let uploadedInvoicePdf: InvoicePdfDocument | undefined;
    if (invoicePdfFile) {
      if (!user) {
        showToast('Faça login novamente antes de anexar o PDF da Nota Fiscal.', 'error');
        return false;
      }
      try {
        uploadedInvoicePdf = await uploadInvoicePdf(user, selectedNFCommitmentId, cleanNfNum, invoicePdfFile);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Falha ao anexar o PDF da Nota Fiscal.', 'error');
        return false;
      }
    }

    const previousPdfVersions = editingInvoice?.notaFiscalPdfVersions ||
      (editingInvoice?.notaFiscalPdf ? [editingInvoice.notaFiscalPdf] : []);
    const nextPdfVersions = uploadedInvoicePdf
      ? [...previousPdfVersions, uploadedInvoicePdf]
          .filter((document, index, all) => all.findIndex((item) => item.pathname === document.pathname) === index)
          .slice(-25)
      : editingInvoice?.notaFiscalPdfVersions;
    const currentInvoicePdf = uploadedInvoicePdf || editingInvoice?.notaFiscalPdf;

     const invoiceToSave: Invoice = {
      id: cleanNfNum,
      recordKey: nextRecordKey,
      empenhoId: selectedNFCommitmentId,
      supplier: targetEmpenho.supplier,
      supplierCnpj: supplierCnpj || undefined,
      issueDate: nfDate,
      items: enteredItems,
      totalValue: invoiceTotal,
      registeredAt: editingInvoice?.registeredAt || new Date().toISOString(),
      localizacaoAtual: editingInvoice?.localizacaoAtual || (editingInvoice?.tesourariaDate ? 'TESOURARIA' : editingInvoice?.comissaoDate ? 'COMISSAO' : 'APROVISIONAMENTO'),
      ...(editingInvoice?.termoEmissaoDate ? { termoEmissaoDate: editingInvoice.termoEmissaoDate } : {}),
      ...(editingInvoice?.comissaoDate ? { comissaoDate: editingInvoice.comissaoDate } : {}),
      ...(editingInvoice?.tesourariaDate ? { tesourariaDate: editingInvoice.tesourariaDate } : {}),
      ...(editingInvoice?.termoNumero ? { termoNumero: editingInvoice.termoNumero } : {}),
      ...(editingInvoice?.numeroNS ? { numeroNS: editingInvoice.numeroNS } : {}),
      ...(currentInvoicePdf ? { notaFiscalPdf: currentInvoicePdf } : {}),
      ...(nextPdfVersions?.length ? { notaFiscalPdfVersions: nextPdfVersions } : {}),
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
      if (previousRecordKey !== nextRecordKey) {
        updatedInvoices = [invoiceToSave, ...invoices.filter(inv => getInvoiceRecordKey(inv) !== previousRecordKey)];
      } else {
        updatedInvoices = invoices.map(inv => getInvoiceRecordKey(inv) === previousRecordKey ? invoiceToSave : inv);
      }
    } else {
      updatedInvoices = [invoiceToSave, ...invoices];
    }
     const updatedAlerts = [newAlert, ...alerts];
    const oldEmpenhoAdjusted = editingInvoice && editingInvoice.empenhoId !== selectedNFCommitmentId
      ? updatedEmpenhos.find(e => e.id === editingInvoice.empenhoId)
      : undefined;

    if (!updatedTargetEmpenho) {
      if (uploadedInvoicePdf && user) {
        await deleteInvoicePdfUpload(user, selectedNFCommitmentId, cleanNfNum, uploadedInvoicePdf.pathname).catch(() => undefined);
      }
      showToast('Não foi possível consolidar o saldo do empenho selecionado.', 'error');
      return false;
    }

    if (user) {
      try {
        await commitInvoiceReceiptChanges(user.uid, {
          targetEmpenho: updatedTargetEmpenho,
          previousEmpenho: oldEmpenhoAdjusted,
          invoice: invoiceToSave,
          alert: newAlert,
          previousInvoiceRecordKey:
            editingInvoice && previousRecordKey !== nextRecordKey ? previousRecordKey : undefined,
        });
      } catch (error) {
        if (uploadedInvoicePdf) {
          await deleteInvoicePdfUpload(user, selectedNFCommitmentId, cleanNfNum, uploadedInvoicePdf.pathname).catch(() => undefined);
        }
        console.error('Erro ao salvar recebimento de NF atomicamente:', error);
        showToast('Erro ao sincronizar o recebimento com o Firebase. Nenhuma alteração local foi confirmada.', 'error');
        return false;
      }
    }

    setEmpenhos(updatedEmpenhos);
    setInvoices(updatedInvoices);
    setAlerts(updatedAlerts);
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
    return true;
  };

  const handleInvoiceDocumentUploaded = async (invoiceRecordKey: string, document: InvoicePdfDocument) => {
    const targetInvoice = invoices.find((invoice) => getInvoiceRecordKey(invoice) === invoiceRecordKey);
    if (!targetInvoice) {
      throw new Error('Nota Fiscal não encontrada para vincular o documento.');
    }

    const priorVersions = targetInvoice.notaFiscalPdfVersions ||
      (targetInvoice.notaFiscalPdf ? [targetInvoice.notaFiscalPdf] : []);
    const versions = [...priorVersions, document]
      .filter((item, index, all) => all.findIndex((candidate) => candidate.pathname === item.pathname) === index)
      .slice(-25);
    const updatedInvoice: Invoice = {
      ...targetInvoice,
      notaFiscalPdf: document,
      notaFiscalPdfVersions: versions,
    };

    setInvoices((current) => current.map((invoice) => getInvoiceRecordKey(invoice) === invoiceRecordKey ? updatedInvoice : invoice));
    if (user) await saveInvoice(user.uid, updatedInvoice);
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
     const invoiceRecordKey = getInvoiceRecordKey(invoice);
    const updatedInvoices = invoices.filter(inv => getInvoiceRecordKey(inv) !== invoiceRecordKey);
    if (!updatedTargetEmpenho) {
      showToast('Não foi possível localizar o empenho vinculado para reverter o recebimento.', 'error');
      return;
    }
    if (user) {
      try {
        await commitInvoiceDeletion(user.uid, updatedTargetEmpenho, invoiceRecordKey);
      } catch (error) {
        console.error('Erro ao excluir NF atomicamente:', error);
        showToast('Erro ao remover no Firebase. A Nota Fiscal foi mantida na interface.', 'error');
        return;
      }
    }
    setEmpenhos(updatedEmpenhos);
    setInvoices(updatedInvoices);
    showToast(`Nota Fiscal nº ${invoice.id} excluída com sucesso!`, 'info');
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
     if (user) {
      try {
        await commitAllInvoicesDeletion(user.uid, updatedEmpenhos, invoices.map(getInvoiceRecordKey));
      } catch (error) {
        console.error('Erro ao excluir NFs em lote:', error);
        showToast('Erro ao remover no Firebase. As Notas Fiscais foram mantidas na interface.', 'error');
        return;
      }
    }
    setEmpenhos(updatedEmpenhos);
    setInvoices([]);
    showToast('Todas as Notas Fiscais foram apagadas com sucesso!', 'info');
  };

  const handleDeleteAllComissoes = async () => {
    if (comissoes.length === 0) {
      showToast('Não há Comissões para apagar.', 'info');
      return;
    }
    if (!confirm('Deseja realmente apagar TODAS as Comissões de Recebimento cadastradas?')) {
      return;
    }
     if (user) {
      try {
        await commitAllComissoesDeletion(user.uid, comissoes.map(com => com.id));
      } catch (error) {
        console.error('Erro ao excluir comissões em lote:', error);
        showToast('Erro ao remover no Firebase. As Comissões foram mantidas na interface.', 'error');
        return;
      }
    }
    setComissoes([]);
    showToast('Todas as Comissões foram apagadas com sucesso!', 'info');
  };

  const handleMarkComissao = async (invoiceRecordKey: string) => {
    const invoiceLabel = invoices.find((invoice) => getInvoiceRecordKey(invoice) === invoiceRecordKey)?.id || invoiceRecordKey;
    let updatedTargetInvoice: Invoice | null = null;
    const updatedInvoices = invoices.map(inv => {
      if (getInvoiceRecordKey(inv) === invoiceRecordKey) {
        updatedTargetInvoice = {
          ...inv,
          comissaoDate: new Date().toISOString(),
          localizacaoAtual: 'COMISSAO',
        };
        return updatedTargetInvoice;
      }
      return inv;
    });
     if (user && updatedTargetInvoice) {
      try {
        await saveInvoice(user.uid, updatedTargetInvoice);
      } catch (error) {
        showToast('Erro ao salvar no Firebase. A tramitação não foi alterada.', 'error');
        return;
      }
    }
    setInvoices(updatedInvoices);
    showToast(`Nota Fiscal ${invoiceLabel} enviada para a Comissão de Recebimento!`);
  };

  const handleMarkTesouraria = async (invoiceRecordKey: string) => {
    const invoiceLabel = invoices.find((invoice) => getInvoiceRecordKey(invoice) === invoiceRecordKey)?.id || invoiceRecordKey;
    let updatedTargetInvoice: Invoice | null = null;
    const updatedInvoices = invoices.map(inv => {
      if (getInvoiceRecordKey(inv) === invoiceRecordKey) {
        updatedTargetInvoice = {
          ...inv,
          tesourariaDate: new Date().toISOString(),
          localizacaoAtual: 'TESOURARIA',
        };
        return updatedTargetInvoice;
      }
      return inv;
    });
     if (user && updatedTargetInvoice) {
      try {
        await saveInvoice(user.uid, updatedTargetInvoice);
      } catch (error) {
        showToast('Erro ao salvar no Firebase. A tramitação não foi alterada.', 'error');
        return;
      }
    }
    setInvoices(updatedInvoices);
    showToast(`Nota Fiscal ${invoiceLabel} finalizada e enviada para o Setor de Tesouraria!`);
  };

  const handleUpdateInvoiceLocation = async (
    invoiceRecordKey: string,
    localizacaoAtual: NonNullable<Invoice['localizacaoAtual']>
  ): Promise<void> => {
    const targetInvoice = invoices.find((invoice) => getInvoiceRecordKey(invoice) === invoiceRecordKey);
    if (!targetInvoice) {
      showToast('Nota Fiscal não encontrada para alteração de localização.', 'error');
      return;
    }

    const updatedInvoice: Invoice = { ...targetInvoice, localizacaoAtual };
    try {
      if (user) await saveInvoice(user.uid, updatedInvoice);
      setInvoices((current) => current.map((invoice) => getInvoiceRecordKey(invoice) === invoiceRecordKey ? updatedInvoice : invoice));
      const labels = {
        APROVISIONAMENTO: 'Setor de Aprovisionamento',
        COMISSAO: 'Comissão de Recebimento',
        TESOURARIA: 'Tesouraria',
      } as const;
      showToast(`Localização da NF ${targetInvoice.id} alterada para ${labels[localizacaoAtual]}.`, 'success');
    } catch (error) {
      console.error('Erro ao alterar localização da Nota Fiscal:', error);
      showToast('Não foi possível atualizar a localização da Nota Fiscal.', 'error');
      throw error;
    }
  };

  const handleSaveNumeroNS = async (invoiceRecordKey: string, value: string) => {
    const targetInvoice = invoices.find(
      (invoice) => getInvoiceRecordKey(invoice) === invoiceRecordKey
    );
    if (!targetInvoice) {
      showToast('Nota Fiscal não encontrada para alteração do Número da NS.', 'error');
      return;
    }

    if (!user) {
      showToast('Faça login novamente antes de alterar o Número da NS.', 'error');
      return;
    }

    const targetEmpenho = empenhos.find(
      (empenho) => empenho.id === targetInvoice.empenhoId
    );
    if (!targetEmpenho) {
      showToast(
        `O empenho ${targetInvoice.empenhoId} vinculado à NF ${targetInvoice.id} não foi encontrado.`,
        'error'
      );
      return;
    }

    const supplierCnpj =
      normalizeSupplierCnpj(targetInvoice.supplierCnpj) ||
      normalizeSupplierCnpj(targetEmpenho.supplierCnpj);

    if (!supplierCnpj) {
      showToast(
        'Cadastre um CNPJ válido no empenho antes de alterar o Número da NS desta Nota Fiscal.',
        'error'
      );
      return;
    }

    const proposedNs = normalizeNsNumber(value) || null;
    if (proposedNs && !isValidNsNumber(proposedNs)) {
      showToast(
        'Número da NS inválido. Utilize o formato AAAANSNNNNNN, por exemplo 2026NS000123.',
        'error'
      );
      return;
    }

    const expectedCurrentNs = normalizeNsNumber(targetInvoice.numeroNS) || null;
    const mutation: NsIntegrityMutation = {
      invoiceRecordKey,
      invoiceId: targetInvoice.id,
      empenhoId: targetInvoice.empenhoId,
      supplierCnpj,
      expectedCurrentNs,
      proposedNs,
      source: 'manual',
    };

    const knownNsOwnerRecordKeys = proposedNs
      ? invoices
          .filter(
            (invoice) =>
              getInvoiceRecordKey(invoice) !== invoiceRecordKey &&
              normalizeNsNumber(invoice.numeroNS) === proposedNs
          )
          .map(getInvoiceRecordKey)
      : [];

    try {
      const result = await commitNsIntegrityMutations(user.uid, {
        mutations: [mutation],
        knownNsOwnerRecordKeys,
      });

      const updatedTargetInvoice = result.updatedInvoices.find(
        (invoice) => getInvoiceRecordKey(invoice) === invoiceRecordKey
      );
      if (!updatedTargetInvoice) {
        throw new Error('O serviço de integridade não retornou a NF atualizada.');
      }

      setInvoices((current) =>
        current.map((invoice) =>
          getInvoiceRecordKey(invoice) === invoiceRecordKey
            ? updatedTargetInvoice
            : invoice
        )
      );
      setEditingNSId(null);
      setTempNSValue('');

      if (!proposedNs) {
        showToast(
          `Número da NS removido da NF ${targetInvoice.id} com liberação do lock correspondente.`,
          'success'
        );
      } else if (result.noOpCount > 0) {
        showToast(
          `Número da NS (${proposedNs}) confirmado para a NF ${targetInvoice.id}. O vínculo já estava aplicado e o lock foi validado.`,
          'success'
        );
      } else if (expectedCurrentNs && expectedCurrentNs !== proposedNs) {
        showToast(
          `Número da NS alterado de ${expectedCurrentNs} para ${proposedNs} na NF ${targetInvoice.id}.`,
          'success'
        );
      } else {
        showToast(
          `Número da NS (${proposedNs}) salvo com integridade transacional para a NF ${targetInvoice.id}.`,
          'success'
        );
      }
    } catch (error) {
      console.error('Erro ao salvar Número da NS com integridade transacional:', error);
      showToast(
        error instanceof Error
          ? error.message
          : 'Erro ao salvar Número da NS. Nenhuma alteração foi aplicada.',
        'error'
      );
    }
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
    if (user) {
      try {
        await saveComissao(user.uid, newComissao);
      } catch (error) {
        showToast('Erro ao salvar comissão no Firebase', 'error');
        return;
      }
    }
    setComissoes(updatedComissoes);
    showToast(`Comissão de Recebimento de ${comissaoMes} cadastrada com sucesso!`);
     // Reset name fields and bulletin fields
    setComissaoBoletimNum('');
    setComissaoBoletimDate('');
    setComissaoPresNome('');
    setComissaoAux1Nome('');
    setComissaoAux2Nome('');
    setComissaoAux3Nome('');
  };

  return {
    handleSaveInvoice,
    handleInvoiceDocumentUploaded,
    handleEditInvoice,
    handleDeleteInvoice,
    handleDeleteAllInvoices,
    handleDeleteAllComissoes,
    handleMarkComissao,
    handleMarkTesouraria,
    handleUpdateInvoiceLocation,
    handleSaveNumeroNS,
    handleSaveComissao
  };
}
