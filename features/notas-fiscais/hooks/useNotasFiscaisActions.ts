'use client';

import type React from 'react';
import type { User } from 'firebase/auth';
import type { Alert, Comissao, Empenho, Invoice, InvoiceItem, InvoicePdfDocument } from '../../../lib/types';
import { saveAlert, saveEmpenho, saveInvoice, removeInvoice, removeComissao, saveComissao } from '../../../lib/firebaseSync';
import { uploadInvoicePdf } from '../../../lib/invoiceDocuments';

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
    if (!editingInvoice && invoices.some(inv => inv.id.trim() === cleanNfNum)) {
      showToast(`A Nota Fiscal nº ${cleanNfNum} já está cadastrada no sistema! Utilize o botão de edição na lista de notas para alterá-la.`, 'error');
      return false;
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
      id: nfNumber,
      empenhoId: selectedNFCommitmentId,
      supplier: targetEmpenho.supplier,
      issueDate: nfDate,
      items: enteredItems,
      totalValue: invoiceTotal,
      registeredAt: editingInvoice?.registeredAt || new Date().toISOString(),
      localizacaoAtual: editingInvoice?.localizacaoAtual || (editingInvoice?.tesourariaDate ? 'TESOURARIA' : editingInvoice?.comissaoDate ? 'COMISSAO' : 'APROVISIONAMENTO'),
      ...(editingInvoice?.termoEmissaoDate ? { termoEmissaoDate: editingInvoice.termoEmissaoDate } : {}),
      ...(editingInvoice?.comissaoDate ? { comissaoDate: editingInvoice.comissaoDate } : {}),
      ...(editingInvoice?.tesourariaDate ? { tesourariaDate: editingInvoice.tesourariaDate } : {}),
      ...(editingInvoice?.termoNumero ? { termoNumero: editingInvoice.termoNumero } : {}),
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
    return true;
  };

  const handleInvoiceDocumentUploaded = async (invoiceId: string, document: InvoicePdfDocument) => {
    const targetInvoice = invoices.find((invoice) => invoice.id === invoiceId);
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

    setInvoices((current) => current.map((invoice) => invoice.id === invoiceId ? updatedInvoice : invoice));
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

  const handleMarkComissao = async (invoiceId: string) => {
    let updatedTargetInvoice: Invoice | null = null;
    const updatedInvoices = invoices.map(inv => {
      if (inv.id === invoiceId) {
        updatedTargetInvoice = {
          ...inv,
          comissaoDate: new Date().toISOString(),
          localizacaoAtual: 'COMISSAO',
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
          localizacaoAtual: 'TESOURARIA',
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

  const handleUpdateInvoiceLocation = async (
    invoiceId: string,
    localizacaoAtual: NonNullable<Invoice['localizacaoAtual']>
  ): Promise<void> => {
    const targetInvoice = invoices.find((invoice) => invoice.id === invoiceId);
    if (!targetInvoice) {
      showToast('Nota Fiscal não encontrada para alteração de localização.', 'error');
      return;
    }

    const updatedInvoice: Invoice = { ...targetInvoice, localizacaoAtual };
    try {
      if (user) await saveInvoice(user.uid, updatedInvoice);
      setInvoices((current) => current.map((invoice) => invoice.id === invoiceId ? updatedInvoice : invoice));
      const labels = {
        APROVISIONAMENTO: 'Setor de Aprovisionamento',
        COMISSAO: 'Comissão de Recebimento',
        TESOURARIA: 'Tesouraria',
      } as const;
      showToast(`Localização da NF ${invoiceId} alterada para ${labels[localizacaoAtual]}.`, 'success');
    } catch (error) {
      console.error('Erro ao alterar localização da Nota Fiscal:', error);
      showToast('Não foi possível atualizar a localização da Nota Fiscal.', 'error');
      throw error;
    }
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
