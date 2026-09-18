'use client';

import { useState } from 'react';
import type { CronogramaEntregaColuna, Invoice } from '../lib/types';

/**
 * Centraliza apenas estado efêmero de interface das telas operacionais.
 * Não contém persistência, regras de negócio, Firebase ou efeitos externos.
 */
export function useOperationalViewState() {
  // --- VIEW 1: PAINEL / DASHBOARD STATES ---
  const [expandedEmpenhoId, setExpandedEmpenhoId] = useState<string | null>('2025NE124');
  const [dashboardPregaoFilter, setDashboardPregaoFilter] = useState('Todos');
  const [dashboardClassFilter, setDashboardClassFilter] = useState<string>('TODAS');
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [dashboardExpandedClass, setDashboardExpandedClass] = useState<string | null>(null);

  // --- VIEW 2: EMPENHOS STATES ---
  const [selectedEmpenhoDetailId, setSelectedEmpenhoDetailId] = useState<string | null>(null);
  const [showAddItemFormInDetail, setShowAddItemFormInDetail] = useState(false);
  const [empenhosSearch, setEmpenhosSearch] = useState('');
  const [empenhosFilter, setEmpenhosFilter] = useState<'Todos' | 'Com Saldo' | 'Ativos' | 'Encerrados'>('Todos');
  const [empenhosPregaoFilter, setEmpenhosPregaoFilter] = useState('Todos');
  const [empenhosYearFilter, setEmpenhosYearFilter] = useState('Todos');
  const [empenhosClassFilter, setEmpenhosClassFilter] = useState('Todos');
  const [showNewEmpenhoModal, setShowNewEmpenhoModal] = useState(false);
  const [newEmpenhoMode, setNewEmpenhoMode] = useState<'manual' | 'json'>('manual');
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [reviewEmpenho, setReviewEmpenho] = useState<any | null>(null);
  const [showConfirmSaveModal, setShowConfirmSaveModal] = useState(false);
  const [empenhoToDelete, setEmpenhoToDelete] = useState<string | null>(null);
  const [isDeletingEmpenho, setIsDeletingEmpenho] = useState(false);
  const [newEmpenhoForm, setNewEmpenhoForm] = useState<{
    id: string;
    supplier: string;
    supplierCnpj: string;
    description: string;
    pregao: string;
    date: string;
    classification: string;
  }>({
    id: '',
    supplier: '',
    supplierCnpj: '',
    description: '',
    pregao: '',
    date: new Date().toISOString().split('T')[0],
    classification: 'QR',
  });

  // --- CONSULTA CONSOLIDADA DE ITENS STATES ---
  const [itensSearch, setItensSearch] = useState('');
  const [itensSaldoFilter, setItensSaldoFilter] = useState<'Todos' | 'Com saldo' | 'Sem saldo'>('Todos');
  const [expandedConsultaItem, setExpandedConsultaItem] = useState<string | null>(null);

  // --- VIEW 3: NOVA NF STATES ---
  const [selectedNFCommitmentId, setSelectedNFCommitmentId] = useState<string>('2024NE0015');
  const [nfNumber, setNfNumber] = useState('');
  const [nfDate, setNfDate] = useState(new Date().toISOString().split('T')[0]);
  const [nfQuantities, setNfQuantities] = useState<{ [itemId: string]: number }>({});
  const [nfSearch, setNfSearch] = useState('');
  const [nfSubTab, setNfSubTab] = useState<'acompanhar' | 'cadastrar' | 'comissao'>('acompanhar');
  const [nfMonthFilter, setNfMonthFilter] = useState('Todos');
  const [nfEmpenhoFilter, setNfEmpenhoFilter] = useState('Todos');
  const [nfTramitacaoFilter, setNfTramitacaoFilter] = useState<'Todos' | 'FaltaComissao' | 'FaltaTesouraria' | 'Concluidas'>('Todos');
  const [nfSortOrder, setNfSortOrder] = useState<'recentes' | 'antigas'>('recentes');
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
  const [selectedReportInvoice, setSelectedReportInvoice] = useState<Invoice | null>(null);
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

  // --- VIEW 6: CRONOGRAMAS STATES ---
  const [selectedCronogramaEmpenhoId, setSelectedCronogramaEmpenhoId] = useState<string | null>(null);
  const [cronogramasSearch, setCronogramasSearch] = useState('');
  const [cronogramasPregaoFilter, setCronogramasPregaoFilter] = useState('Todos');
  const [cronogramasYearFilter, setCronogramasYearFilter] = useState('Todos');
  const [cronogramasClassFilter, setCronogramasClassFilter] = useState('Todos');
  const [cronogramasStatusFilter, setCronogramasStatusFilter] = useState<'Todos' | 'Com Saldo' | 'Ativos' | 'Encerrados'>('Todos');

  // Active Cronograma Draft states
  const [cronogramaColunas, setCronogramaColunas] = useState<CronogramaEntregaColuna[]>([]);
  const [cronogramaDistribuicao, setCronogramaDistribuicao] = useState<{ [itemId: string]: { [colunaId: string]: number } }>({});
  const [cronogramaLocalEntrega, setCronogramaLocalEntrega] = useState('Almoxarifado Geral / Seção de Aprovisionamento - HGeSM');
  const [cronogramaHorarioEntrega, setCronogramaHorarioEntrega] = useState('Segunda a Quinta: 08:00 às 11:30 e 13:30 às 16:30 | Sexta: 08:00 às 11:30');
  const [cronogramaObservacoes, setCronogramaObservacoes] = useState(
    '1. As entregas deverão ser efetuadas nas datas previstas acompanhadas das respectivas Notas Fiscais.\n2. Os produtos perecíveis deverão atender rigorosamente aos padrões de qualidade e temperatura estabelecidos no Edital.\n3. Qualquer impossibilidade de entrega deverá ser comunicada formalmente com antecedência mínima de 48 horas.'
  );
  const [cronogramaResponsavelNome, setCronogramaResponsavelNome] = useState('');
  const [cronogramaResponsavelCargo, setCronogramaResponsavelCargo] = useState('Fiscal de Contrato / Seção de Aprovisionamento - HGeSM');
  const [showCronogramaPreviewModal, setShowCronogramaPreviewModal] = useState(false);
  const [isSavingCronograma, setIsSavingCronograma] = useState(false);

  return {
    expandedEmpenhoId, setExpandedEmpenhoId, dashboardPregaoFilter, setDashboardPregaoFilter, dashboardClassFilter, setDashboardClassFilter,
    dashboardSearch, setDashboardSearch, dashboardExpandedClass, setDashboardExpandedClass, selectedEmpenhoDetailId, setSelectedEmpenhoDetailId,
    showAddItemFormInDetail, setShowAddItemFormInDetail, empenhosSearch, setEmpenhosSearch, empenhosFilter, setEmpenhosFilter,
    empenhosPregaoFilter, setEmpenhosPregaoFilter, empenhosYearFilter, setEmpenhosYearFilter, empenhosClassFilter, setEmpenhosClassFilter,
    showNewEmpenhoModal, setShowNewEmpenhoModal, newEmpenhoMode, setNewEmpenhoMode, jsonInput, setJsonInput,
    jsonError, setJsonError, copiedPrompt, setCopiedPrompt, reviewEmpenho, setReviewEmpenho,
    showConfirmSaveModal, setShowConfirmSaveModal, empenhoToDelete, setEmpenhoToDelete, isDeletingEmpenho, setIsDeletingEmpenho,
    newEmpenhoForm, setNewEmpenhoForm, itensSearch, setItensSearch, itensSaldoFilter, setItensSaldoFilter,
    expandedConsultaItem, setExpandedConsultaItem, selectedNFCommitmentId, setSelectedNFCommitmentId, nfNumber, setNfNumber,
    nfDate, setNfDate, nfQuantities, setNfQuantities, nfSearch, setNfSearch,
    nfSubTab, setNfSubTab, nfMonthFilter, setNfMonthFilter, nfEmpenhoFilter, setNfEmpenhoFilter,
    nfTramitacaoFilter, setNfTramitacaoFilter, nfSortOrder, setNfSortOrder, editingInvoice, setEditingInvoice,
    comissaoMes, setComissaoMes, comissaoBoletimNum, setComissaoBoletimNum, comissaoBoletimDate, setComissaoBoletimDate,
    comissaoPresPosto, setComissaoPresPosto, comissaoPresNome, setComissaoPresNome, comissaoAux1Posto, setComissaoAux1Posto,
    comissaoAux1Nome, setComissaoAux1Nome, comissaoAux2Posto, setComissaoAux2Posto, comissaoAux2Nome, setComissaoAux2Nome,
    comissaoAux3Posto, setComissaoAux3Posto, comissaoAux3Nome, setComissaoAux3Nome, reportSearch, setReportSearch,
    reportStartDate, setReportStartDate, reportEndDate, setReportEndDate, showPdfModal, setShowPdfModal,
    selectedReportInvoice, setSelectedReportInvoice, relatoriosPregaoFilter, setRelatoriosPregaoFilter, editingEmpenhoId, setEditingEmpenhoId,
    newItemForm, setNewItemForm, selectedCronogramaEmpenhoId, setSelectedCronogramaEmpenhoId, cronogramasSearch, setCronogramasSearch,
    cronogramasPregaoFilter, setCronogramasPregaoFilter, cronogramasYearFilter, setCronogramasYearFilter, cronogramasClassFilter, setCronogramasClassFilter,
    cronogramasStatusFilter, setCronogramasStatusFilter, cronogramaColunas, setCronogramaColunas, cronogramaDistribuicao, setCronogramaDistribuicao,
    cronogramaLocalEntrega, setCronogramaLocalEntrega, cronogramaHorarioEntrega, setCronogramaHorarioEntrega, cronogramaObservacoes, setCronogramaObservacoes,
    cronogramaResponsavelNome, setCronogramaResponsavelNome, cronogramaResponsavelCargo, setCronogramaResponsavelCargo, showCronogramaPreviewModal, setShowCronogramaPreviewModal,
    isSavingCronograma, setIsSavingCronograma,
  };
}
