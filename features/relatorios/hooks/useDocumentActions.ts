'use client';

import type React from 'react';
import type { User } from 'firebase/auth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Comissao, Empenho, Invoice } from '../../../lib/types';
import { classRequiresTermoRecebimento, type EmpenhoClassDefinition } from '../../../lib/empenhoClasses';
import { ensureTermoRecebimentoAssignment } from '../../../lib/firebaseSync';
import { getInvoiceRecordKey } from '../../../lib/invoiceIdentity';
import { fetchEmpenhoPdfBlob } from '../../../lib/empenhoDocuments';
import { fetchInvoicePdfBlob } from '../../../lib/invoiceDocuments';

type ToastType='success'|'error'|'info';
interface DocumentActionsContext {
  user: User|null;
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  comissoes: Comissao[];
  empenhos: Empenho[];
  empenhoClasses: EmpenhoClassDefinition[];
  showToast: (message:string,type?:ToastType)=>void;
  formatDateOnly: (dateStr?:string)=>string;
}

/** Geração de termos e relatórios PDF, isolada da composição principal. */
export function useDocumentActions(context:DocumentActionsContext){
  const { user,invoices,setInvoices,comissoes,empenhos,empenhoClasses,showToast,formatDateOnly }=context;

  const requiresTermoRecebimento = (inv: Invoice): boolean => {
    const targetEmp = empenhos.find((emp) => emp.id === inv.empenhoId);
    return classRequiresTermoRecebimento(targetEmp?.classification, empenhoClasses);
  };

  const buildTermoRecebimentoPdf = async (inv: Invoice) => {
    const targetEmp = empenhos.find((emp) => emp.id === inv.empenhoId);
    if (!targetEmp) {
      showToast('Não foi possível localizar o empenho vinculado à Nota Fiscal.', 'error');
      return;
    }

    if (!classRequiresTermoRecebimento(targetEmp.classification, empenhoClasses)) {
      showToast(
        `A classe ${targetEmp.classification || 'QR'} está configurada sem exigência de Termo de Recebimento.`,
        'info'
      );
      return;
    }
    // A comissão é definida pela data efetiva de geração do Termo, nunca pela data da Nota Fiscal.
    const now = new Date();
    const termoEmissaoDate = inv.termoEmissaoDate || now.toISOString();
    const termoReferenceDate = inv.termoEmissaoDate ? new Date(inv.termoEmissaoDate) : now;
    const validTermoReferenceDate = Number.isNaN(termoReferenceDate.getTime()) ? now : termoReferenceDate;
    const termoMonth = `${validTermoReferenceDate.getFullYear()}-${String(validTermoReferenceDate.getMonth() + 1).padStart(2, '0')}`;
    const matchingComissao = comissoes.find(c => c.mesReferencia === termoMonth);
    if (!matchingComissao) {
      showToast(
        `Não existe Comissão de Recebimento cadastrada para o mês de geração do Termo (${termoMonth}). Cadastre a comissão correspondente antes de gerar o TR.`,
        'error'
      );
      return;
    }

    let updatedInvoiceWithTR: Invoice = inv;
    if (user) {
      const maxTermoNumero = invoices.reduce(
        (max, invoice) => invoice.termoNumero && invoice.termoNumero > max ? invoice.termoNumero : max,
        0
      );
      updatedInvoiceWithTR = await ensureTermoRecebimentoAssignment(
        user.uid,
        getInvoiceRecordKey(inv),
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
    const effectiveTermoDate = new Date(updatedInvoiceWithTR.termoEmissaoDate || termoEmissaoDate);
    const termoYear = Number.isNaN(effectiveTermoDate.getTime()) ? now.getFullYear() : effectiveTermoDate.getFullYear();
    setInvoices((prev) => prev.map((item) => (
      getInvoiceRecordKey(item) === getInvoiceRecordKey(inv) ? updatedInvoiceWithTR : item
    )));
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
    centerText(`TERMO DE RECEBIMENTO DE ARTIGOS DE QR Nº ${termoNumero}/${termoYear}`, 11, 'bold', secondaryColor);
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
    const pageCount = (doc.internal as any).getNumberOfPages();
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
      doc.text(`Termo de Recebimento de Artigos de QR Nº ${termoNumero}/${termoYear}`, margin, doc.internal.pageSize.getHeight() - 10);

      // Right side: Page numbering
      const pageText = `Página ${i} de ${pageCount}`;
      const pageTextWidth = doc.getTextWidth(pageText);
      doc.text(pageText, pageWidth - margin - pageTextWidth, doc.internal.pageSize.getHeight() - 10);
    }
     const filename = `Termo_Recebimento_QR_No_${termoNumero}_NF_${inv.id}.pdf`;
    return { doc, filename, invoice: updatedInvoiceWithTR };
  };

  type TermoAction = 'generate' | 'view' | 'print' | 'download';

  const handleTermoRecebimentoAction = async (inv: Invoice, action: TermoAction): Promise<void> => {
    let targetWindow: Window | null = null;
    if (action === 'view' || action === 'print') {
      targetWindow = window.open('', '_blank');
      if (!targetWindow) {
        showToast('O navegador bloqueou a nova janela. Autorize pop-ups para visualizar ou imprimir o Termo.', 'error');
        return;
      }
      targetWindow.opener = null;
      targetWindow.document.write('<!doctype html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#f8fafc;color:#0b1c30"><p>Preparando Termo de Recebimento…</p></body></html>');
    }

    try {
      const result = await buildTermoRecebimentoPdf(inv);
      if (!result) {
        targetWindow?.close();
        return;
      }

      if (action === 'generate') {
        showToast(`Termo de Recebimento nº ${result.invoice.termoNumero} gerado e registrado.`, 'success');
        return;
      }

      if (action === 'download') {
        result.doc.save(result.filename);
        showToast(`Download iniciado: ${result.filename}`, 'success');
        return;
      }

      const pdfBlob = result.doc.output('blob');
      const objectUrl = URL.createObjectURL(pdfBlob);
      if (!targetWindow || targetWindow.closed) {
        URL.revokeObjectURL(objectUrl);
        showToast('A janela do documento foi fechada antes do carregamento.', 'error');
        return;
      }
      targetWindow.location.replace(objectUrl);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5 * 60_000);

      if (action === 'print') {
        window.setTimeout(() => {
          try {
            targetWindow?.focus();
            targetWindow?.print();
          } catch {
            // O PDF permanece aberto para impressão pelo controle nativo do navegador.
          }
        }, 1500);
      }
    } catch (error) {
      targetWindow?.close();
      console.error('Erro ao processar Termo de Recebimento:', error);
      showToast('Não foi possível processar o Termo de Recebimento.', 'error');
    }
  };

  const handleDownloadTermoRecebimento = async (inv: Invoice) => {
    await handleTermoRecebimentoAction(inv, 'download');
  };

  const handleDownloadLiquidacaoConsolidada = async (inv: Invoice): Promise<void> => {
    if (!user) {
      showToast('Faça login novamente antes de gerar a Liquidação Consolidada.', 'error');
      return;
    }

    const targetEmp = empenhos.find((emp) => emp.id === inv.empenhoId);
    if (!targetEmp) {
      showToast('Não foi possível localizar o empenho vinculado à Nota Fiscal.', 'error');
      return;
    }
    if (!targetEmp.notaEmpenhoPdf) {
      showToast('Anexe primeiro o PDF da Nota de Empenho para gerar a Liquidação Consolidada.', 'error');
      return;
    }

    try {
      const shouldIncludeTermo = requiresTermoRecebimento(inv);
      const termo = shouldIncludeTermo ? await buildTermoRecebimentoPdf(inv) : null;
      if (shouldIncludeTermo && !termo) return;

      const [{ PDFDocument }, empenhoBlob] = await Promise.all([
        import('pdf-lib'),
        fetchEmpenhoPdfBlob(user, targetEmp.id, targetEmp.notaEmpenhoPdf),
      ]);

      const merged = await PDFDocument.create();
      const appendPdf = async (sourceBytes: ArrayBuffer) => {
        const source = await PDFDocument.load(sourceBytes);
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
      };

      await appendPdf(await empenhoBlob.arrayBuffer());

      if (inv.notaFiscalPdf) {
        const invoiceBlob = await fetchInvoicePdfBlob(user, inv.notaFiscalPdf);
        await appendPdf(await invoiceBlob.arrayBuffer());
      }

      if (termo) {
        await appendPdf(termo.doc.output('arraybuffer'));
      }

      const bytes = await merged.save();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);
      const safePart = (value: string | undefined, fallback: string) =>
        (value?.trim() || fallback)
          .replace(/[<>:"/\|?*\u0000-\u001F]/g, '-')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^[-.]+|[-.]+$/g, '') || fallback;
      const filename = `NF${safePart(inv.id, 'SemNumero')}.NE${safePart(inv.empenhoId, 'SemNE')}.Pregão${safePart(targetEmp.pregao, 'SemPregao')}.pdf`;

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
      showToast(
        shouldIncludeTermo
          ? `Documento de Liquidação Consolidada gerado: ${filename}`
          : `Documento de Liquidação Consolidada gerado sem TR (classe ${targetEmp.classification || 'QR'}): ${filename}`,
        'success'
      );
    } catch (error) {
      console.error('Erro ao consolidar documentos da liquidação:', error);
      showToast('Não foi possível consolidar os PDFs. Verifique se os documentos anexados são PDFs válidos e não protegidos por senha.', 'error');
    }
  };

  const handleGenerateEmpenhoReportPDF = (emp: Empenho, action: 'download' | 'print' = 'download') => {
    if (!emp) {
      showToast('Nenhum empenho selecionado para exportação.', 'error');
      return;
    }
     const totalCommitted = emp.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const empRequiresTR = classRequiresTermoRecebimento(emp.classification, empenhoClasses);
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
        const formattedTrDate = !empRequiresTR
          ? 'Dispensado'
          : inv.termoEmissaoDate
            ? `${formatDateOnly(inv.termoEmissaoDate)}${inv.termoNumero ? ` (TR Nº ${inv.termoNumero})` : ''}`
            : inv.termoNumero
              ? `Data não registrada (TR Nº ${inv.termoNumero})`
              : 'Pendente';
        const formattedComissaoDate = !empRequiresTR
          ? 'Dispensada'
          : inv.comissaoDate
            ? formatDateOnly(inv.comissaoDate)
            : 'Pendente';
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
    const pageCount = (doc.internal as any).getNumberOfPages();
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

  return { handleDownloadTermoRecebimento, handleTermoRecebimentoAction, handleDownloadLiquidacaoConsolidada, handleGenerateEmpenhoReportPDF };
}
