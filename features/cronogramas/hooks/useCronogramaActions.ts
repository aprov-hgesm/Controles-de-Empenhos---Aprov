'use client';

import { useState } from 'react';
import type React from 'react';
import type { User } from 'firebase/auth';
import type { CronogramaEmpenho, CronogramaEmailEnvio, CronogramaEntregaColuna, Empenho } from '../../../lib/types';
import { recordCronogramaEmailSend, saveCronograma } from '../../../lib/firebaseSync';
import { snapshotCronogramaRemessas } from '../domain/cronogramaDeliveryTracking';
import { getCronogramaPdfLayout, splitCronogramaRemessas, wrapCronogramaPdfLines } from '../domain/cronogramaPdfLayout';
import { fetchEmpenhoPdfBlob } from '../../../lib/empenhoDocuments';
import { loadJsPdfWithAutoTable } from '../../../lib/pdfToolkit';
import { resolveInstitutionalDocumentIdentity } from '../../../lib/institutionalDocumentProfile';
import type { WorkspaceInstitutionalProfile } from '../../../lib/platformIdentity';
import { resolveSupplierEmailForEmpenho, saveSupplierEmailForEmpenho } from '../../../lib/supplierEmailResolver';
import { isValidSupplierCnpj, normalizeSupplierCnpj } from '../../../lib/invoiceIdentity';
import { authorizeWorkspaceGmail, sendWorkspaceGmailMessage } from '../../../lib/googleWorkspaceMail';
import { loadWorkspaceDriveSettings } from '../../../lib/workspaceDriveSettings';
import { isOperationalSectorContext, type ResolvedWorkspaceContext } from '../../../lib/workspaceContext';

type Distribution=Record<string,Record<string,number>>;

export interface CronogramaEmailConfirmation {
  empenhoId: string;
  fornecedor: string;
  remetente: string;
  destinatarioOriginal: string;
  destinatario: string;
  fonteOriginal: 'local' | 'global' | null;
  assunto: string;
  notaEmpenhoFilename: string;
  podeSalvarContato: boolean;
}
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
  institutionalProfile?: WorkspaceInstitutionalProfile | null;
  workspaceContext: ResolvedWorkspaceContext;
}

/** Ações e geração de PDF dos cronogramas de entrega. */
export function useCronogramaActions(context:CronogramaActionsContext){
  const { user, empenhos, cronogramas, setCronogramas, selectedCronogramaEmpenhoId, setSelectedCronogramaEmpenhoId, cronogramaColunas, setCronogramaColunas, cronogramaDistribuicao, setCronogramaDistribuicao, cronogramaLocalEntrega, setCronogramaLocalEntrega, cronogramaHorarioEntrega, setCronogramaHorarioEntrega, cronogramaObservacoes, setCronogramaObservacoes, cronogramaResponsavelNome, setCronogramaResponsavelNome, cronogramaResponsavelCargo, setCronogramaResponsavelCargo, setIsSavingCronograma, showToast, formatDateOnly, institutionalProfile, workspaceContext }=context;
  const institutionalIdentity = resolveInstitutionalDocumentIdentity(institutionalProfile);
  const { organizationName, sectionName, documentHeaderLines, defaultDeliveryLocation, defaultResponsibleRole } = institutionalIdentity;
  const [isSendingCronogramaEmail, setIsSendingCronogramaEmail] = useState(false);
  const [isPreparingCronogramaEmail, setIsPreparingCronogramaEmail] = useState(false);
  const [cronogramaEmailConfirmation, setCronogramaEmailConfirmation] = useState<CronogramaEmailConfirmation | null>(null);
  const [saveEmailInSupplierRecord, setSaveEmailInSupplierRecord] = useState(false);

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
      setCronogramaLocalEntrega(saved.localEntrega || defaultDeliveryLocation);
      setCronogramaHorarioEntrega(saved.horarioEntrega || 'Segunda a Quinta: 08:00 às 11:30 e 13:30 às 16:30 | Sexta: 08:00 às 11:30');
      setCronogramaObservacoes(
        saved.observacoes ||
        '1. As entregas deverão ser efetuadas nas datas previstas acompanhadas das respectivas Notas Fiscais.\n2. Os produtos perecíveis deverão atender rigorosamente aos padrões de qualidade e temperatura estabelecidos no Edital.\n3. Qualquer impossibilidade de entrega deverá ser comunicada formalmente com antecedência mínima de 48 horas.'
      );
      setCronogramaResponsavelNome(saved.responsavelNome || (user?.displayName || ''));
      setCronogramaResponsavelCargo(saved.responsavelCargo || defaultResponsibleRole);
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
      setCronogramaLocalEntrega(defaultDeliveryLocation);
      setCronogramaHorarioEntrega('Segunda a Quinta: 08:00 às 11:30 e 13:30 às 16:30 | Sexta: 08:00 às 11:30');
      setCronogramaObservacoes(
        '1. As entregas deverão ser efetuadas nas datas previstas acompanhadas das respectivas Notas Fiscais.\n2. Os produtos perecíveis deverão atender rigorosamente aos padrões de qualidade e temperatura estabelecidos no Edital.\n3. Qualquer impossibilidade de entrega deverá ser comunicada formalmente com antecedência mínima de 48 horas.'
      );
      setCronogramaResponsavelNome(user?.displayName || '');
      setCronogramaResponsavelCargo(defaultResponsibleRole);
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

  const buildCronogramaObject = (
    emp: Empenho,
    previous?: CronogramaEmpenho | null
  ): CronogramaEmpenho => ({
    id: `crono_${emp.id}`,
    empenhoId: emp.id,
    dataCriacao: previous?.dataCriacao || new Date().toISOString(),
    localEntrega: cronogramaLocalEntrega,
    horarioEntrega: cronogramaHorarioEntrega,
    observacoes: cronogramaObservacoes,
    responsavelNome: cronogramaResponsavelNome,
    responsavelCargo: cronogramaResponsavelCargo,
    colunasEntregas: cronogramaColunas,
    distribuicao: cronogramaDistribuicao,
    ...(previous?.ultimoEnvioEmail ? { ultimoEnvioEmail: previous.ultimoEnvioEmail } : {}),
    ...(previous?.historicoEnviosEmail ? { historicoEnviosEmail: previous.historicoEnviosEmail } : {}),
  });

  const handleSaveCronograma = async () => {
    if (!selectedCronogramaEmpenhoId) return;
    const emp = empenhos.find(e => e.id === selectedCronogramaEmpenhoId);
    if (!emp) return;
     setIsSavingCronograma(true);
    try {
      const previous = cronogramas.find((item) => item.empenhoId === emp.id) || null;
      const cronogramaObj = buildCronogramaObject(emp, previous);
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
  const handleGenerateCronogramaPDF = async (emp: Empenho, action: 'download' | 'print' | 'blob' = 'download') => {
    const { jsPDF, autoTable } = await loadJsPdfWithAutoTable();
    const pdfLayout = getCronogramaPdfLayout(cronogramaColunas.length);
    const doc = new jsPDF({
      orientation: pdfLayout.orientation,
      unit: 'mm',
      format: 'a4',
    });
     const primaryColor: [number, number, number] = [0, 40, 142]; // #00288e
    const margin = pdfLayout.margin;
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 14;
    // Mede e quebra textos antes de imprimir: nenhuma informação avança sobre a próxima coluna.
    const wrapText = (value: string, width: number, size = 7, weight: 'normal' | 'bold' = 'normal'): string[] => {
      doc.setFont('helvetica', weight);
      doc.setFontSize(size);
      return wrapCronogramaPdfLines(value, width, (line, maxWidth) => doc.splitTextToSize(line, maxWidth));
    };
     // 1. OFFICIAL MILITARY / HOSPITAL HEADER
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    documentHeaderLines.forEach((line, index) => {
      doc.setFontSize(index === documentHeaderLines.length - 1 ? 8 : 8.5);
      doc.setTextColor(index === documentHeaderLines.length - 1 ? 60 : 50, index === documentHeaderLines.length - 1 ? 60 : 50, index === documentHeaderLines.length - 1 ? 60 : 50);
      doc.text(line, pageWidth / 2, yPos, { align: 'center' });
      yPos += 4;
    });
    yPos -= 0.5;
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text(sectionName.toLocaleUpperCase('pt-BR'), pageWidth / 2, yPos, { align: 'center' });
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

    // Cabeçalho com campos independentes e altura calculada pelo conteúdo.
    // Rótulos ficam acima dos valores; descrições e fornecedores NÃO ficam na mesma linha de datas.
    const details = [
      [
        { label: 'Nota de Empenho', value: emp.id },
        { label: 'Pregão Eletrônico', value: emp.pregao || 'Não informado' },
        { label: 'Classe / Categoria', value: emp.classification || 'QR' },
      ],
      [
        { label: 'Fornecedor Credor', value: emp.supplier || 'Não informado' },
        { label: 'Data de Emissão NE', value: formatDateOnly(emp.date) },
        { label: 'Data do Cronograma', value: new Date().toLocaleDateString('pt-BR') },
      ],
    ];
    const innerX = margin + 3;
    const innerWidth = pageWidth - margin * 2 - 6;
    const metadataGap = 4;
    const metadataCellWidth = (innerWidth - 2 * metadataGap) / 3;
    const detailRows = details.map((fields) => {
      const cells = fields.map((field) => ({
        labelLines: wrapText(field.label, metadataCellWidth - 1, 6.2, 'bold'),
        valueLines: wrapText(field.value, metadataCellWidth - 1, 7, 'bold'),
      }));
      return {
        cells,
        height: Math.max(...cells.map((cell) => cell.labelLines.length * 3 + cell.valueLines.length * 3.6 + 1)),
      };
    });
    const objectLabelLines = wrapText('OBJETO RESUMIDO', innerWidth, 6.2, 'bold');
    const objectValueLines = wrapText(emp.description || 'Não informado', innerWidth, 7);
    const objectHeight = objectLabelLines.length * 3 + objectValueLines.length * 3.6 + 2;
    const financialMetrics = [
      { label: 'TOTAL EMPENHADO', value: totalCommitted, color: [30, 41, 59] },
      { label: 'JÁ RECEBIDO (NFs)', value: totalReceived, color: [30, 41, 59] },
      { label: 'SALDO ATUAL', value: saldoDisponivelTotal, color: [0, 110, 50] },
      { label: 'TOTAL NO CRONOGRAMA', value: totalProgramadoGeral, color: [0, 40, 142] },
    ];
    const metricGap = 3;
    const metricWidth = (innerWidth - 3 * metricGap) / financialMetrics.length;
    const metricLayouts = financialMetrics.map((metric) => ({
      ...metric,
      labelLines: wrapText(metric.label, metricWidth - 1, 6, 'bold'),
      valueLines: wrapText(metric.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), metricWidth - 1, 7, 'bold'),
    }));
    const financialHeight = 4 + Math.max(...metricLayouts.map((metric) => metric.labelLines.length * 2.8 + metric.valueLines.length * 3.5)) + 2;
    const infoBoxHeight = 9 + detailRows.reduce((sum, row) => sum + row.height + 2, 0) + objectHeight + 2 + financialHeight + 3;
    if (yPos + infoBoxHeight > doc.internal.pageSize.getHeight() - 16) {
      doc.addPage();
      yPos = 14;
    }
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(210, 220, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, infoBoxHeight, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('1. DADOS DA CONTRATAÇÃO E FORNECEDOR', innerX, yPos + 5);
    let detailY = yPos + 9;
    detailRows.forEach((row) => {
      row.cells.forEach((cell, index) => {
        const x = innerX + index * (metadataCellWidth + metadataGap);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.setTextColor(85, 95, 108);
        doc.text(cell.labelLines, x, detailY + 2.5);
        doc.setFontSize(7);
        doc.setTextColor(30, 41, 59);
        doc.text(cell.valueLines, x, detailY + 2.5 + cell.labelLines.length * 3.0);
      });
      detailY += row.height + 2;
    });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(85, 95, 108);
    doc.text(objectLabelLines, innerX, detailY + 2.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text(objectValueLines, innerX, detailY + 2.5 + objectLabelLines.length * 3);
    detailY += objectHeight + 2;
    doc.setFillColor(235, 242, 255);
    doc.roundedRect(margin + 2, detailY, pageWidth - 2 * margin - 4, financialHeight, 1.5, 1.5, 'F');
    metricLayouts.forEach((metric, index) => {
      const x = innerX + index * (metricWidth + metricGap);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(metric.color[0], metric.color[1], metric.color[2]);
      doc.text(metric.labelLines, x, detailY + 3.2);
      doc.setFontSize(7);
      doc.text(metric.valueLines, x, detailY + 3.2 + metric.labelLines.length * 2.8);
    });
    yPos += infoBoxHeight + 6;
     // 3. TABLE OF SCHEDULED DELIVERIES
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('2. DISTRIBUIÇÃO DAS REMESSAS DE ENTREGA', margin, yPos);
    yPos += 3;
     // Remessas muito numerosas são divididas em blocos: não comprimir descrições a letras empilhadas.
    const remessaGroups = splitCronogramaRemessas(cronogramaColunas, pdfLayout.maxRemessasPerTable);
    remessaGroups.forEach((currentRemessas, groupIndex) => {
      if (groupIndex > 0) {
        doc.addPage();
        yPos = 16;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('2. DISTRIBUIÇÃO DAS REMESSAS DE ENTREGA (CONTINUAÇÃO)', margin, yPos);
        yPos += 7;
      }
      // Build headers dynamically
    const headers: string[] = ['Item compra / Descrição', 'Und', 'Emp.', 'Rec.', 'Saldo Disp.'];
    currentRemessas.forEach((col) => {
      headers.push(`${col.titulo}\n${formatDateOnly(col.dataPrevista)}`);
    });
    headers.push('Total Prog.', 'Val. Unit.', 'Total (R$)');
     const tableRows = emp.items.map((it) => {
      const saldoDisponivel = Math.max(0, it.quantity - it.received);
      const totalProg = cronogramaColunas.reduce((sum, col) => sum + (Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0), 0);
      const valorTotalProg = totalProg * it.unitPrice;
       const legacyItemCompraId = /^\d+$/.test(String(it.id || '').trim()) ? String(it.id).trim() : '';
       const rawItemCompraNumber = String(it.itemCompraNumber || legacyItemCompraId).trim();
       const itemCompraNumber = /^\d+$/.test(rawItemCompraNumber) ? rawItemCompraNumber.padStart(5, '0') : rawItemCompraNumber;
       const row: string[] = [
        `${itemCompraNumber ? `Item compra: ${itemCompraNumber}\n` : ''}${it.name}`,
        it.unit,
        String(it.quantity),
        String(it.received),
        String(saldoDisponivel),
      ];
       currentRemessas.forEach(col => {
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
    currentRemessas.forEach(col => {
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
      margin: { left: margin, right: margin, top: 14, bottom: 16 },
      rowPageBreak: 'avoid',
      styles: { overflow: 'linebreak', cellPadding: 1.4 },
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
        0: { cellWidth: pdfLayout.pageContentWidth - 97 - currentRemessas.length * pdfLayout.remessaWidth, fontStyle: 'bold', textColor: [10, 25, 50], halign: 'left' },
        1: { cellWidth: 9, halign: 'center' },
        2: { cellWidth: 10, halign: 'center' },
        3: { cellWidth: 10, halign: 'center' },
        4: { cellWidth: 14, halign: 'center', fontStyle: 'bold', textColor: [0, 100, 50] },
        ...Object.fromEntries(currentRemessas.map((_, index) => [index + 5, { cellWidth: pdfLayout.remessaWidth, halign: 'center' as const }])),
        [5 + currentRemessas.length]: { cellWidth: 14, halign: 'center' },
        [6 + currentRemessas.length]: { cellWidth: 16, halign: 'center' },
        [7 + currentRemessas.length]: { cellWidth: 24, halign: 'right' },
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
    });

    // Condições e assinaturas com altura dinâmica: nenhuma observação invade outro campo.
    const conditions = [
      { label: 'Local de Entrega', value: cronogramaLocalEntrega || defaultDeliveryLocation },
      { label: 'Horário de Recebimento', value: cronogramaHorarioEntrega || 'Segunda a Quinta: 08:00 às 11:30 e 13:30 às 16:30 | Sexta: 08:00 às 11:30' },
      { label: 'Observações e Instruções', value: cronogramaObservacoes || 'As entregas deverão ser efetuadas nas datas programadas acompanhadas das Notas Fiscais.' },
    ];
    const conditionLabelWidth = 40;
    const conditionValueWidth = pageWidth - margin * 2 - 48;
    const conditionLayouts = conditions.map((condition) => {
      const labelLines = wrapText(condition.label, conditionLabelWidth, 6.8, 'bold');
      const valueLines = wrapText(condition.value, conditionValueWidth, 6.8);
      return { labelLines, valueLines, height: 2 + Math.max(labelLines.length, valueLines.length) * 3.5 };
    });
    const instBoxH = 5 + conditionLayouts.reduce((sum, row) => sum + row.height, 0);
    if (yPos + instBoxH + 13 > doc.internal.pageSize.getHeight() - 16) {
      doc.addPage();
      yPos = 16;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('3. DIRETRIZES E CONDIÇÕES DE RECEBIMENTO', margin, yPos);
    yPos += 4;
    doc.setFillColor(252, 253, 255);
    doc.setDrawColor(220, 228, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, instBoxH, 1.5, 1.5, 'FD');
    let conditionY = yPos + 4;
    conditionLayouts.forEach((row) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(50, 50, 50);
      doc.text(row.labelLines, margin + 3, conditionY);
      doc.setFont('helvetica', 'normal');
      doc.text(row.valueLines, margin + 45, conditionY);
      conditionY += row.height;
    });
    yPos += instBoxH + 8;

    // Duas assinaturas em colunas fixas, com cargos/razões sociais quebrados em linhas.
    const boxWidth = (pageWidth - margin * 2 - 10) / 2;
    const sigNameLeft = wrapText(cronogramaResponsavelNome || 'Encarregado do Aprovisionamento', boxWidth - 10, 7.5, 'bold');
    const sigNameRight = wrapText('DE ACORDO / CIÊNCIA DO FORNECEDOR', boxWidth - 10, 7.5, 'bold');
    const sigTitleLeft = wrapText(cronogramaResponsavelCargo || defaultResponsibleRole, boxWidth - 10, 6.8);
    const sigTitleRight = wrapText((emp.supplier || 'Fornecedor') + ' • Assinatura e Carimbo', boxWidth - 10, 6.8);
    const signatureNameHeight = Math.max(sigNameLeft.length, sigNameRight.length) * 3.8;
    const signatureTitleHeight = Math.max(sigTitleLeft.length, sigTitleRight.length) * 3.4;
    if (yPos + 15 + signatureNameHeight + signatureTitleHeight > doc.internal.pageSize.getHeight() - 16) {
      doc.addPage();
      yPos = 16;
    }
    const sigY = yPos + 10;
    const rightBoxX = margin + boxWidth + 10;
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.25);
    doc.line(margin + 5, sigY, margin + boxWidth - 5, sigY);
    doc.line(rightBoxX + 5, sigY, rightBoxX + boxWidth - 5, sigY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(sigNameLeft, margin + boxWidth / 2, sigY + 4, { align: 'center' });
    doc.text(sigNameRight, rightBoxX + boxWidth / 2, sigY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(90, 90, 90);
    doc.text(sigTitleLeft, margin + boxWidth / 2, sigY + 4 + signatureNameHeight, { align: 'center' });
    doc.text(sigTitleRight, rightBoxX + boxWidth / 2, sigY + 4 + signatureNameHeight, { align: 'center' });
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
      doc.text(`${organizationName} • Cronograma de Entrega NE ${emp.id}`, margin, doc.internal.pageSize.getHeight() - 6);
       const pText = `Página ${i} de ${pageCount}`;
      const pWidth = doc.getTextWidth(pText);
      doc.text(pText, pageWidth - margin - pWidth, doc.internal.pageSize.getHeight() - 6);
    }
     const filename = `Cronograma_Entrega_NE_${emp.id.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    if (action === 'blob') {
      return {
        blob: doc.output('blob'),
        filename,
      };
    }
    if (action === 'download') {
      doc.save(filename);
      showToast(`Download do Cronograma PDF concluído: ${filename}`, 'success');
      return null;
    }

    const blobUrl = doc.output('bloburl');
    const win = window.open(blobUrl, '_blank');
    if (win) {
      win.focus();
      showToast('Cronograma em PDF aberto para impressão.', 'success');
    } else {
      doc.save(filename);
      showToast('Pop-up bloqueado pelo navegador. O cronograma foi baixado diretamente.', 'info');
    }
    return null;
  };

  // Primeiro prepara o envio e abre uma confirmação nativa da interface do EMPROVEX.
  const handleSendCronogramaEmail = async (emp: Empenho) => {
    if (isPreparingCronogramaEmail || isSendingCronogramaEmail) return;
    if (!user) {
      showToast('Usuário não autenticado para enviar o cronograma.', 'error');
      return;
    }
    if (!isOperationalSectorContext(workspaceContext)) {
      showToast('Não existe um workspace operacional ativo para este envio.', 'error');
      return;
    }

    if (!emp.notaEmpenhoPdf || emp.notaEmpenhoPdf.storage?.status !== 'active') {
      showToast(
        'A Nota de Empenho em PDF não está anexada ou disponível. Anexe a NE em Empenhos antes de enviar o cronograma.',
        'error'
      );
      return;
    }

    setIsPreparingCronogramaEmail(true);
    try {
      const [supplierEmail, driveSettings] = await Promise.all([
        resolveSupplierEmailForEmpenho(user.uid, emp),
        loadWorkspaceDriveSettings(workspaceContext),
      ]);
      if (!driveSettings?.accountEmail) {
        throw new Error(
          'O Google Drive deste setor ainda não está configurado. Configure a Conta Google antes de enviar cronogramas.'
        );
      }

      setSaveEmailInSupplierRecord(false);
      setCronogramaEmailConfirmation({
        empenhoId: emp.id,
        fornecedor: emp.supplier,
        remetente: driveSettings.accountEmail,
        destinatarioOriginal: supplierEmail?.email || '',
        destinatario: supplierEmail?.email || '',
        fonteOriginal: supplierEmail?.source || null,
        assunto: `Cronograma de Entrega - NE ${emp.id}`,
        notaEmpenhoFilename: `Nota_Empenho_NE_${emp.id.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        podeSalvarContato: isValidSupplierCnpj(normalizeSupplierCnpj(emp.supplierCnpj)),
      });
    } catch (error) {
      console.error('Erro ao preparar envio do cronograma:', error);
      showToast(
        error instanceof Error ? error.message : 'Não foi possível preparar o envio por e-mail.',
        'error'
      );
    } finally {
      setIsPreparingCronogramaEmail(false);
    }
  };

  const updateCronogramaEmailRecipient = (email: string) => {
    if (isSendingCronogramaEmail) return;
    setCronogramaEmailConfirmation((draft) => draft ? { ...draft, destinatario: email } : null);
    // Opt-in nunca é herdado automaticamente após outra edição do endereço.
    setSaveEmailInSupplierRecord(false);
  };

  const cancelCronogramaEmail = () => {
    if (isSendingCronogramaEmail) return;
    setCronogramaEmailConfirmation(null);
    setSaveEmailInSupplierRecord(false);
  };

  // A autorização OAuth começa no clique de confirmação (gesto do usuário).
  const confirmCronogramaEmail = async () => {
    const draft = cronogramaEmailConfirmation;
    if (!draft || isSendingCronogramaEmail || isPreparingCronogramaEmail) return;
    if (!user || !isOperationalSectorContext(workspaceContext)) {
      showToast('Sessão operacional indisponível. Abra o envio novamente.', 'error');
      return;
    }
    const emp = empenhos.find((item) => item.id === draft.empenhoId);
    if (!emp || selectedCronogramaEmpenhoId !== draft.empenhoId) {
      showToast('O empenho selecionado mudou. Abra novamente a confirmação de envio.', 'error');
      cancelCronogramaEmail();
      return;
    }

    if (!emp.notaEmpenhoPdf || emp.notaEmpenhoPdf.storage?.status !== 'active') {
      showToast(
        'A Nota de Empenho não está mais disponível para anexar. Verifique o cadastro antes do envio.',
        'error'
      );
      return;
    }

    const recipient = draft.destinatario.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      showToast('Informe um endereço de e-mail válido para o fornecedor.', 'error');
      return;
    }
    const changedEmail = recipient !== draft.destinatarioOriginal;
    const shouldSaveContact = changedEmail && saveEmailInSupplierRecord;
    if (shouldSaveContact && !draft.podeSalvarContato) {
      showToast('O fornecedor precisa ter um CNPJ válido para atualizar seu cadastro.', 'error');
      return;
    }

    setIsSendingCronogramaEmail(true);
    let gmailSent = false;
    try {
      await authorizeWorkspaceGmail(workspaceContext.workspaceId, draft.remetente);

      // Os dois PDFs precisam estar disponíveis ANTES de chamar a API de envio.
      // Recupera a versão atual da NE do Google Drive autorizado para este workspace.
      let notaEmpenhoPdf: Blob;
      try {
        notaEmpenhoPdf = await fetchEmpenhoPdfBlob(user, emp.id, emp.notaEmpenhoPdf);
      } catch (error) {
        console.error('Falha ao recuperar a Nota de Empenho para o envio:', error);
        throw new Error(
          'Não foi possível recuperar a Nota de Empenho no Google Drive do setor. '
          + 'Confira a conexão com o Drive e o PDF cadastrado. Nenhum e-mail foi enviado.'
        );
      }

      const pdf = await handleGenerateCronogramaPDF(emp, 'blob');
      if (!pdf) throw new Error('Não foi possível gerar o PDF do cronograma para anexar ao e-mail.');

      const previous = cronogramas.find((item) => item.empenhoId === emp.id) || null;
      const cronogramaBeforeSend = buildCronogramaObject(emp, previous);
      await saveCronograma(user.uid, cronogramaBeforeSend);

      const bodyLines = [
        'Prezados,',
        '',
        'Encaminhamos, em anexo, o Cronograma de Entrega e a Nota de Empenho ' + emp.id + '.',
        'Solicitamos a ciência e a observância das datas, quantidades e condições de entrega previstas no documento.',
        '',
        'Fornecedor: ' + emp.supplier,
        'Local de entrega: ' + (cronogramaLocalEntrega || defaultDeliveryLocation),
        '',
        'Atenciosamente,',
        cronogramaResponsavelNome || user.displayName || 'Setor de Aprovisionamento',
        cronogramaResponsavelCargo || defaultResponsibleRole,
        organizationName,
        '',
        'Mensagem enviada pelo EMPROVEX.',
      ];

      const sent = await sendWorkspaceGmailMessage({
        workspaceId: workspaceContext.workspaceId,
        expectedSenderEmail: draft.remetente,
        to: recipient,
        subject: draft.assunto,
        bodyText: bodyLines.join('\n'),
        attachment: pdf.blob,
        attachmentName: pdf.filename,
        additionalAttachments: [
          { blob: notaEmpenhoPdf, name: draft.notaEmpenhoFilename },
        ],
      });
      gmailSent = true;

      // A alteração cadastral só acontece com opt-in e depois de um envio confirmado.
      let contactSaved = false;
      let contactSaveFailed = false;
      if (shouldSaveContact) {
        try {
          await saveSupplierEmailForEmpenho(user.uid, emp, recipient);
          contactSaved = true;
        } catch (contactError) {
          contactSaveFailed = true;
          console.error('E-mail enviado, mas a atualização do fornecedor falhou:', contactError);
        }
      }

      const emailSendRecord: CronogramaEmailEnvio = {
        enviadoEm: new Date().toISOString(),
        remetente: sent.senderEmail,
        destinatario: recipient,
        assunto: draft.assunto,
        messageId: sent.messageId,
        fonteEmailFornecedor: changedEmail
          ? (contactSaved ? 'local' : 'manual')
          : (draft.fonteOriginal || 'manual'),
        fornecedor: emp.supplier,
        remessas: snapshotCronogramaRemessas(emp, cronogramaColunas, cronogramaDistribuicao),
      };

      let auditPersisted = true;
      let history = [...(cronogramaBeforeSend.historicoEnviosEmail || [])];
      try {
        history = await recordCronogramaEmailSend(user.uid, emp.id, emailSendRecord);
      } catch (auditError) {
        auditPersisted = false;
        console.error('Cronograma enviado, mas o registro de auditoria falhou:', auditError);
        if (!history.some((entry) => entry.messageId === emailSendRecord.messageId)) {
          history.push(emailSendRecord);
        }
      }

      const cronogramaAfterSend: CronogramaEmpenho = {
        ...cronogramaBeforeSend,
        ultimoEnvioEmail: emailSendRecord,
        historicoEnviosEmail: history,
      };

      setCronogramas((previousItems) => [
        ...previousItems.filter((item) => item.empenhoId !== emp.id),
        cronogramaAfterSend,
      ]);
      setCronogramaEmailConfirmation(null);
      setSaveEmailInSupplierRecord(false);

      if (!auditPersisted || contactSaveFailed) {
        const warning = [
          `Cronograma e Nota de Empenho enviados para ${recipient}.`,
          !auditPersisted ? 'O histórico do envio não pôde ser gravado.' : '',
          contactSaveFailed ? 'O novo e-mail não pôde ser salvo em Fornecedores.' : '',
          'Confira a pasta Enviados antes de tentar novamente.',
        ].filter(Boolean).join(' ');
        showToast(warning, 'info');
      } else {
        showToast(
          `Cronograma e Nota de Empenho enviados para ${recipient} pela conta ${sent.senderEmail}.`
          + (contactSaved ? ' E-mail atualizado na Central de Fornecedores.' : ''),
          'success'
        );
      }
    } catch (error) {
      console.error('Erro ao enviar cronograma por e-mail:', error);
      showToast(
        gmailSent
          ? 'O Gmail confirmou o envio, mas houve falha ao concluir o processamento. Confira a pasta Enviados antes de reenviar.'
          : error instanceof Error
            ? error.message
            : 'Não foi possível enviar o cronograma por e-mail.',
        'error'
      );
    } finally {
      setIsSendingCronogramaEmail(false);
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
    handleGenerateCronogramaPDF,
    handleSendCronogramaEmail,
    confirmCronogramaEmail,
    cancelCronogramaEmail,
    updateCronogramaEmailRecipient,
    cronogramaEmailConfirmation,
    isPreparingCronogramaEmail,
    saveEmailInSupplierRecord,
    setSaveEmailInSupplierRecord,
    isSendingCronogramaEmail
  };
}
