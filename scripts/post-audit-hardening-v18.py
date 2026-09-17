from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: esperado 1 trecho, encontrados {count}')
    return content.replace(old, new, 1)


# -----------------------------------------------------------------------------
# Firestore: operações atômicas para NF e numeração concorrente de Termos
# -----------------------------------------------------------------------------
path = 'lib/firebaseSync.ts'
content = read(path)
content = replace_once(
    content,
    "  deleteDoc, \n  doc \n} from 'firebase/firestore';",
    "  deleteDoc, \n  doc,\n  runTransaction,\n  writeBatch,\n} from 'firebase/firestore';",
    'firebase imports',
)

invoice_anchor = "export async function removeInvoice(userId: string, id: string): Promise<void> {\n  const path = `invoices/${id}`;\n  try {\n    const docRef = doc(db, 'invoices', id);\n    await deleteDoc(docRef);\n  } catch (error) {\n    handleFirestoreError(error, OperationType.DELETE, path);\n  }\n}\n"
invoice_helpers = invoice_anchor + """

interface CommitInvoiceReceiptChangesInput {
  targetEmpenho: Empenho;
  previousEmpenho?: Empenho;
  invoice: Invoice;
  alert: Alert;
  previousInvoiceId?: string;
}

export async function commitInvoiceReceiptChanges(
  userId: string,
  changes: CommitInvoiceReceiptChangesInput
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'empenhos', changes.targetEmpenho.id), { ...changes.targetEmpenho, userId });
    if (changes.previousEmpenho && changes.previousEmpenho.id !== changes.targetEmpenho.id) {
      batch.set(doc(db, 'empenhos', changes.previousEmpenho.id), { ...changes.previousEmpenho, userId });
    }
    batch.set(doc(db, 'invoices', changes.invoice.id), { ...changes.invoice, userId });
    batch.set(doc(db, 'alerts', changes.alert.id), { ...changes.alert, userId });
    if (changes.previousInvoiceId && changes.previousInvoiceId !== changes.invoice.id) {
      batch.delete(doc(db, 'invoices', changes.previousInvoiceId));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'invoice-receipt-batch');
  }
}

export async function commitInvoiceDeletion(
  userId: string,
  updatedEmpenho: Empenho,
  invoiceId: string
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'empenhos', updatedEmpenho.id), { ...updatedEmpenho, userId });
    batch.delete(doc(db, 'invoices', invoiceId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `invoices/${invoiceId}`);
  }
}

export async function commitAllInvoicesDeletion(
  userId: string,
  updatedEmpenhos: Empenho[],
  invoiceIds: string[]
): Promise<void> {
  try {
    if (updatedEmpenhos.length + invoiceIds.length > 450) {
      throw new Error('Quantidade de operações excede o limite seguro para exclusão em lote.');
    }
    const batch = writeBatch(db);
    updatedEmpenhos.forEach((empenho) => {
      batch.set(doc(db, 'empenhos', empenho.id), { ...empenho, userId });
    });
    invoiceIds.forEach((invoiceId) => batch.delete(doc(db, 'invoices', invoiceId)));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'invoices/bulk');
  }
}

export async function commitAllComissoesDeletion(userId: string, ids: string[]): Promise<void> {
  try {
    if (ids.length > 450) {
      throw new Error('Quantidade de comissões excede o limite seguro para exclusão em lote.');
    }
    const batch = writeBatch(db);
    ids.forEach((id) => batch.delete(doc(db, 'comissoes', id)));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'comissoes/bulk');
  }
}

export async function ensureTermoRecebimentoAssignment(
  userId: string,
  invoiceId: string,
  observedMaxTermoNumero: number,
  preferredEmissionDate: string
): Promise<Invoice> {
  const invoiceRef = doc(db, 'invoices', invoiceId);
  const counterRef = doc(db, 'settings', 'termoRecebimentoCounter');

  try {
    return await runTransaction(db, async (transaction) => {
      const invoiceSnapshot = await transaction.get(invoiceRef);
      const counterSnapshot = await transaction.get(counterRef);
      if (!invoiceSnapshot.exists()) {
        throw new Error(`Nota Fiscal ${invoiceId} não encontrada para numeração do Termo.`);
      }

      const storedInvoice = invoiceSnapshot.data() as Invoice;
      if (storedInvoice.termoNumero) {
        const existingInvoice: Invoice = {
          ...storedInvoice,
          termoEmissaoDate: storedInvoice.termoEmissaoDate || preferredEmissionDate,
        };
        if (!storedInvoice.termoEmissaoDate) {
          transaction.set(invoiceRef, { ...existingInvoice, userId }, { merge: true });
        }
        return existingInvoice;
      }

      const currentCounter = Number(counterSnapshot.data()?.currentNumber || 0);
      const nextNumber = Math.max(currentCounter + 1, observedMaxTermoNumero + 1);
      const updatedInvoice: Invoice = {
        ...storedInvoice,
        termoNumero: nextNumber,
        termoEmissaoDate: storedInvoice.termoEmissaoDate || preferredEmissionDate,
      };

      transaction.set(counterRef, {
        id: 'termoRecebimentoCounter',
        currentNumber: nextNumber,
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
      }, { merge: true });
      transaction.set(invoiceRef, { ...updatedInvoice, userId }, { merge: true });
      return updatedInvoice;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `invoices/${invoiceId}/termo`);
    throw error;
  }
}
"""
content = replace_once(content, invoice_anchor, invoice_helpers, 'invoice atomic helpers')
write(path, content)


# -----------------------------------------------------------------------------
# Termo: preservar conteúdo; exigir comissão do mês e reservar número em transação
# -----------------------------------------------------------------------------
path = 'features/relatorios/hooks/useDocumentActions.ts'
content = read(path)
content = replace_once(
    content,
    "import { saveInvoice } from '../../../lib/firebaseSync';",
    "import { ensureTermoRecebimentoAssignment } from '../../../lib/firebaseSync';",
    'document action import',
)
old_start = """  const buildTermoRecebimentoPdf = async (inv: Invoice) => {
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
        console.error(\"Erro ao salvar número e data de emissão do termo:\", error);
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
"""
new_start = """  const buildTermoRecebimentoPdf = async (inv: Invoice) => {
    // O conteúdo declaratório do Termo é preservado: a geração pressupõe conferência física já concluída.
    const invMonth = inv.issueDate ? inv.issueDate.substring(0, 7) : '';
    const matchingComissao = comissoes.find(c => c.mesReferencia === invMonth);
    if (!matchingComissao) {
      showToast(
        invMonth
          ? `Não existe Comissão de Recebimento cadastrada para o mês ${invMonth}. Cadastre a comissão correspondente antes de gerar o Termo.`
          : 'A Nota Fiscal não possui mês de emissão válido para localizar a Comissão de Recebimento.',
        'error'
      );
      return;
    }

    let updatedInvoiceWithTR: Invoice = inv;
    const termoEmissaoDate = inv.termoEmissaoDate || inv.registeredAt || new Date().toISOString();
    if (user) {
      const maxTermoNumero = invoices.reduce(
        (max, invoice) => invoice.termoNumero && invoice.termoNumero > max ? invoice.termoNumero : max,
        0
      );
      updatedInvoiceWithTR = await ensureTermoRecebimentoAssignment(
        user.uid,
        inv.id,
        maxTermoNumero,
        termoEmissaoDate
      );
    } else if (!inv.termoNumero) {
      showToast('Faça login novamente antes de gerar o Termo de Recebimento.', 'error');
      return;
    }

    const termoNumero = updatedInvoiceWithTR.termoNumero;
    if (!termoNumero) {
      showToast('Não foi possível reservar a numeração do Termo de Recebimento.', 'error');
      return;
    }
    setInvoices(prev => prev.map(i => i.id === inv.id ? updatedInvoiceWithTR : i));
"""
content = replace_once(content, old_start, new_start, 'safe termo assignment')
write(path, content)


# -----------------------------------------------------------------------------
# NF: persistir atomicamente antes de confirmar estado/sucesso na interface
# -----------------------------------------------------------------------------
path = 'features/notas-fiscais/hooks/useNotasFiscaisActions.ts'
content = read(path)
content = replace_once(
    content,
    "import { saveAlert, saveEmpenho, saveInvoice, removeInvoice, removeComissao, saveComissao } from '../../../lib/firebaseSync';",
    "import { commitAllComissoesDeletion, commitAllInvoicesDeletion, commitInvoiceDeletion, commitInvoiceReceiptChanges, saveInvoice, removeComissao, saveComissao } from '../../../lib/firebaseSync';",
    'nota fiscal persistence imports',
)
content = replace_once(
    content,
    "import { uploadInvoicePdf } from '../../../lib/invoiceDocuments';",
    "import { deleteInvoicePdfUpload, uploadInvoicePdf } from '../../../lib/invoiceDocuments';",
    'invoice blob cleanup import',
)

old_persist = """     const updatedAlerts = [newAlert, ...alerts];
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
"""
new_persist = """     const updatedAlerts = [newAlert, ...alerts];
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
          previousInvoiceId: editingInvoice && editingInvoice.id !== nfNumber ? editingInvoice.id : undefined,
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
"""
content = replace_once(content, old_persist, new_persist, 'atomic save invoice')

old_delete = """     const updatedInvoices = invoices.filter(inv => inv.id !== invoice.id);
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
"""
new_delete = """     const updatedInvoices = invoices.filter(inv => inv.id !== invoice.id);
    if (!updatedTargetEmpenho) {
      showToast('Não foi possível localizar o empenho vinculado para reverter o recebimento.', 'error');
      return;
    }
    if (user) {
      try {
        await commitInvoiceDeletion(user.uid, updatedTargetEmpenho, invoice.id);
      } catch (error) {
        console.error('Erro ao excluir NF atomicamente:', error);
        showToast('Erro ao remover no Firebase. A Nota Fiscal foi mantida na interface.', 'error');
        return;
      }
    }
    setEmpenhos(updatedEmpenhos);
    setInvoices(updatedInvoices);
    showToast(`Nota Fiscal nº ${invoice.id} excluída com sucesso!`, 'info');
"""
content = replace_once(content, old_delete, new_delete, 'atomic delete invoice')

old_delete_all = """     setEmpenhos(updatedEmpenhos);
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
"""
new_delete_all = """     if (user) {
      try {
        await commitAllInvoicesDeletion(user.uid, updatedEmpenhos, invoices.map(inv => inv.id));
      } catch (error) {
        console.error('Erro ao excluir NFs em lote:', error);
        showToast('Erro ao remover no Firebase. As Notas Fiscais foram mantidas na interface.', 'error');
        return;
      }
    }
    setEmpenhos(updatedEmpenhos);
    setInvoices([]);
    showToast('Todas as Notas Fiscais foram apagadas com sucesso!', 'info');
"""
content = replace_once(content, old_delete_all, new_delete_all, 'atomic delete all invoices')

old_delete_comissoes = """     setComissoes([]);
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
"""
new_delete_comissoes = """     if (user) {
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
"""
content = replace_once(content, old_delete_comissoes, new_delete_comissoes, 'atomic delete all comissoes')

old_mark_comissao = """     setInvoices(updatedInvoices);
     if (user && updatedTargetInvoice) {
      try {
        await saveInvoice(user.uid, updatedTargetInvoice);
      } catch (error) {
        showToast('Erro ao salvar no Firebase', 'error');
      }
    }
     showToast(`Nota Fiscal ${invoiceId} enviada para a Comissão de Recebimento!`);
"""
new_mark_comissao = """     if (user && updatedTargetInvoice) {
      try {
        await saveInvoice(user.uid, updatedTargetInvoice);
      } catch (error) {
        showToast('Erro ao salvar no Firebase. A tramitação não foi alterada.', 'error');
        return;
      }
    }
    setInvoices(updatedInvoices);
    showToast(`Nota Fiscal ${invoiceId} enviada para a Comissão de Recebimento!`);
"""
content = replace_once(content, old_mark_comissao, new_mark_comissao, 'safe mark comissao')

old_mark_tesouraria = """     setInvoices(updatedInvoices);
     if (user && updatedTargetInvoice) {
      try {
        await saveInvoice(user.uid, updatedTargetInvoice);
      } catch (error) {
        showToast('Erro ao salvar no Firebase', 'error');
      }
    }
     showToast(`Nota Fiscal ${invoiceId} finalizada e enviada para o Setor de Tesouraria!`);
"""
new_mark_tesouraria = """     if (user && updatedTargetInvoice) {
      try {
        await saveInvoice(user.uid, updatedTargetInvoice);
      } catch (error) {
        showToast('Erro ao salvar no Firebase. A tramitação não foi alterada.', 'error');
        return;
      }
    }
    setInvoices(updatedInvoices);
    showToast(`Nota Fiscal ${invoiceId} finalizada e enviada para o Setor de Tesouraria!`);
"""
content = replace_once(content, old_mark_tesouraria, new_mark_tesouraria, 'safe mark tesouraria')

old_save_ns = """     setInvoices(updatedInvoices);
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
"""
new_save_ns = """     if (user && updatedTargetInvoice) {
      try {
        await saveInvoice(user.uid, updatedTargetInvoice);
      } catch (error) {
        console.error(error);
        showToast('Erro ao salvar Número da NS no Firebase', 'error');
        return;
      }
    }
    setInvoices(updatedInvoices);
    setEditingNSId(null);
    setTempNSValue('');
    showToast(
"""
content = replace_once(content, old_save_ns, new_save_ns, 'safe save NS')

old_save_comissao = """     const updatedComissoes = [newComissao, ...comissoes];
    setComissoes(updatedComissoes);
     if (user) {
      try {
        await saveComissao(user.uid, newComissao);
      } catch (error) {
        showToast('Erro ao salvar comissão no Firebase', 'error');
      }
    }
     showToast(`Comissão de Recebimento de ${comissaoMes} cadastrada com sucesso!`);
"""
new_save_comissao = """     const updatedComissoes = [newComissao, ...comissoes];
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
"""
content = replace_once(content, old_save_comissao, new_save_comissao, 'safe save comissao')
write(path, content)


# -----------------------------------------------------------------------------
# Empenho: não confirmar criação local se persistência falhar
# -----------------------------------------------------------------------------
path = 'features/empenhos/hooks/useEmpenhoActions.ts'
content = read(path)
old_create = """     const updatedEmpenhos = [newEmp, ...empenhos];
    setEmpenhos(updatedEmpenhos);
     if (user) {
      try {
        await saveEmpenho(user.uid, newEmp);
      } catch (error) {
        showToast('Erro ao salvar no Firebase', 'error');
      }
    }
     showToast(`Nota de Empenho ${newEmp.id} criada! Adicione itens a ela.`, 'success');
"""
new_create = """     const updatedEmpenhos = [newEmp, ...empenhos];
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
"""
content = replace_once(content, old_create, new_create, 'safe create empenho')
write(path, content)


# -----------------------------------------------------------------------------
# Comissão individual: persistir antes de retirar da interface
# -----------------------------------------------------------------------------
path = 'features/notas-fiscais/components/NotasFiscaisView.tsx'
content = read(path)
old_inline_delete = """                                    if (confirm('Tem certeza que deseja excluir esta comissão?')) {
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
"""
new_inline_delete = """                                    if (confirm('Tem certeza que deseja excluir esta comissão?')) {
                                      if (user) {
                                        try {
                                          await removeComissao(user.uid, com.id);
                                        } catch (error) {
                                          showToast('Erro ao remover no Firebase. A comissão foi mantida.', 'error');
                                          return;
                                        }
                                      }
                                      const updated = comissoes.filter(c => c.id !== com.id);
                                      setComissoes(updated);
                                      showToast('Comissão excluída com sucesso!', 'info');
                                    }
"""
content = replace_once(content, old_inline_delete, new_inline_delete, 'safe inline commission delete')
write(path, content)


# -----------------------------------------------------------------------------
# CI permanente: orçamento de erros TypeScript + testes + build
# -----------------------------------------------------------------------------
path = 'package.json'
content = read(path)
content = replace_once(
    content,
    '    "build": "next build",\n    "start": "next start",',
    '    "build": "next build",\n    "typecheck": "tsc --noEmit",\n    "start": "next start",',
    'package typecheck script',
)
write(path, content)

ci = """name: Application CI

on:
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  validate-application:
    runs-on: ubuntu-24.04
    timeout-minutes: 12
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: TypeScript error budget
        shell: bash
        run: |
          npm run typecheck > /tmp/typecheck.txt 2>&1 || true
          cat /tmp/typecheck.txt
          current=$(grep -c 'error TS[0-9]' /tmp/typecheck.txt || true)
          budget=$(node -p "require('./ops/typescript-error-budget.json').maxErrors")
          echo "TypeScript diagnostics: $current / budget: $budget"
          if [ "$current" -gt "$budget" ]; then
            echo 'TypeScript error budget exceeded.'
            exit 1
          fi

      - name: Recovery tests
        run: npm run test:recovery

      - name: Production build
        run: npm run build

      - name: Diff hygiene
        run: git diff --check
"""
Path('.github/workflows/application-ci.yml').write_text(ci, encoding='utf-8')
