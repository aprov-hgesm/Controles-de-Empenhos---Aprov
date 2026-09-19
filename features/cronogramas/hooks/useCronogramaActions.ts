'use client';

import type React from 'react';
import type { User } from 'firebase/auth';
import type { CronogramaEmpenho, CronogramaEntregaColuna, Empenho } from '../../../lib/types';
import { saveCronograma } from '../../../lib/firebaseSync';
import { loadJsPdfWithAutoTable } from '../../../lib/pdfToolkit';

type Distribution=Record<string,Record<string,number>>;
interface CronogramaActionsContext {
  user: User|null;
  empenhos: Empenho[];
  cronogramas: CronogramaEmpenho[];
  setCronogramas: React.Dispatch<React.SetStateAction<CronogramaEmpenho[]>>;
  selectedCronogramaEmpenhoId: string|null;
  setSelectedCronogramaEmpenhoId: React.Dispatch<React.SetStateAction<string|null>>;
  cronogramaColunas: CronogramaEntregaColuna[];
  setCronogramaColunas: React.Dispatch<React.SetStateAction<CronogramaEntregaColuna[]>>;
  cronogramaDistribuicao: Distribution;
  setCronogramaDistribuicao: React.Dispatch<React.SetStateAction<Distribution>>;
  cronogramaLocalEntrega:string; setCronogramaLocalEntrega:React.Dispatch<React.SetStateAction<string>>;
  cronogramaHorarioEntrega:string; setCronogramaHorarioEntrega:React.Dispatch<React.SetStateAction<string>>;
  cronogramaObservacoes:string; setCronogramaObservacoes:React.Dispatch<React.SetStateAction<string>>;
  cronogramaResponsavelNome:string; setCronogramaResponsavelNome:React.Dispatch<React.SetStateAction<string>>;
  cronogramaResponsavelCargo:string; setCronogramaResponsavelCargo:React.Dispatch<React.SetStateAction<string>>;
  setIsSavingCronograma:React.Dispatch<React.SetStateAction<boolean>>;
  showToast:(message:string,type?:any)=>void;
  formatDateOnly:(dateStr?:string)=>string;
}

/** Ações e geração de PDF dos cronogramas de entrega. */
export function useCronogramaActions(context:CronogramaActionsContext){
  const { user, empenhos, cronogramas, setCronogramas, selectedCronogramaEmpenhoId, setSelectedCronogramaEmpenhoId, cronogramaColunas, setCronogramaColunas, cronogramaDistribuicao, setCronogramaDistribuicao, cronogramaLocalEntrega, setCronogramaLocalEntrega, cronogramaHorarioEntrega, setCronogramaHorarioEntrega, cronogramaObservacoes, setCronogramaObservacoes, cronogramaResponsavelNome, setCronogramaResponsavelNome, cronogramaResponsavelCargo, setCronogramaResponsavelCargo, setIsSavingCronograma, showToast, formatDateOnly }=context;

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
  const handleGenerateCronogramaPDF = async (emp: Empenho, action: 'download' | 'print' = 'download') => {
    const { jsPDF, autoTable } = await loadJsPdfWithAutoTable();
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
    const pageCount = (doc.internal as any).getNumberOfPages();
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

  return {
    handleSelectEmpenhoForCronograma,
    applyCronogramaPreset,
    applyAllToFirstRemessa,
    clearCronogramaDistribuicao,
    handleAddRemessa,
    handleRemoveRemessa,
    handleSaveCronograma,
    handleGenerateCronogramaPDF
  };
}
