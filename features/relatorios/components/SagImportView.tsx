'use client';

import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  ClipboardPaste,
  ExternalLink,
  FileJson,
  Eye,
  Landmark,
  ListFilter,
  MinusCircle,
  PencilLine,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import type { Empenho, Invoice } from '../../../lib/types';
import { formatSupplierCnpj } from '../../../lib/invoiceIdentity';
import { buildSupplierReports } from '../../../lib/supplierReporting';
import {
  buildSagNsExtractionPrompt,
  normalizeSagUg,
  parseSagNsJson,
  type SagNsPayload,
  type SagNsValidationResult,
} from '../../../lib/sagNsContract';
import {
  reconcileSagNsPayload,
  type SagNsReconciliationStatus,
} from '../../../lib/sagNsReconciliation';
import {
  buildSagNsApplicationFingerprint,
  buildSagNsApplicationPreview,
  type SagNsApplicationDecision,
} from '../../../lib/sagNsApplicationPreview';
import type { SagNsImportCommitResult } from '../../../lib/sagNsPersistence';

interface SagImportViewProps {
  empenhos: Empenho[];
  invoices: Invoice[];
  onApplySagNsImport: (
    payload: SagNsPayload,
    supplierCnpj: string,
    expectedFingerprint: string
  ) => Promise<SagNsImportCommitResult>;
}

type CopyState = 'idle' | 'copied' | 'error';
type PreviewFilter = 'all' | SagNsApplicationDecision;

const APPLICATION_DECISION_META: Record<
  SagNsApplicationDecision,
  { label: string; className: string; icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }> }
> = {
  change: {
    label: 'ALTERAR',
    className: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    icon: PencilLine,
  },
  unchanged: {
    label: 'SEM ALTERAÇÃO',
    className: 'border-blue-100 bg-blue-50 text-blue-700',
    icon: CheckCircle2,
  },
  ignored: {
    label: 'IGNORAR',
    className: 'border-gray-200 bg-gray-50 text-gray-600',
    icon: MinusCircle,
  },
  blocked: {
    label: 'BLOQUEAR',
    className: 'border-rose-100 bg-rose-50 text-rose-700',
    icon: Ban,
  },
};

const RECONCILIATION_STATUS_META: Record<
  SagNsReconciliationStatus,
  { label: string; className: string }
> = {
  matched: {
    label: 'Correspondência segura',
    className: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  },
  already_registered: {
    label: 'Já cadastrada',
    className: 'border-blue-100 bg-blue-50 text-blue-700',
  },
  conflict_existing_ns: {
    label: 'Conflito de NS',
    className: 'border-rose-100 bg-rose-50 text-rose-700',
  },
  conflict_ns_reused: {
    label: 'NS já utilizada',
    className: 'border-rose-100 bg-rose-50 text-rose-700',
  },
  ambiguous_invoice: {
    label: 'NF ambígua',
    className: 'border-amber-100 bg-amber-50 text-amber-700',
  },
  not_found: {
    label: 'NF não encontrada',
    className: 'border-gray-200 bg-gray-50 text-gray-600',
  },
  missing_nf_reference: {
    label: 'Sem NF no SAG',
    className: 'border-amber-100 bg-amber-50 text-amber-700',
  },
  data_conflict: {
    label: 'Conflito de dados',
    className: 'border-rose-100 bg-rose-50 text-rose-700',
  },
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function copyTextFallback(value: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}

export function SagImportView({ empenhos, invoices, onApplySagNsImport }: SagImportViewProps) {
  const supplierReports = React.useMemo(
    () => buildSupplierReports(empenhos, invoices),
    [empenhos, invoices]
  );
  const [supplierSearch, setSupplierSearch] = React.useState('');
  const [selectedCnpj, setSelectedCnpj] = React.useState('');
  const [ug, setUg] = React.useState('');
  const [jsonText, setJsonText] = React.useState('');
  const [validation, setValidation] = React.useState<SagNsValidationResult | null>(null);
  const [copyState, setCopyState] = React.useState<CopyState>('idle');
  const [showApplyConfirmation, setShowApplyConfirmation] = React.useState(false);
  const [applyConfirmed, setApplyConfirmed] = React.useState(false);
  const [isApplying, setIsApplying] = React.useState(false);
  const [applyError, setApplyError] = React.useState('');
  const [confirmationFingerprint, setConfirmationFingerprint] = React.useState('');
  const [lastImportResult, setLastImportResult] = React.useState<SagNsImportCommitResult | null>(null);
  const [supplierPickerOpen, setSupplierPickerOpen] = React.useState(true);
  const [showTechnicalReconciliation, setShowTechnicalReconciliation] = React.useState(false);
  const [previewFilter, setPreviewFilter] = React.useState<PreviewFilter>('all');

  const selectedSupplier = React.useMemo(
    () => supplierReports.find((supplier) => supplier.cnpj === selectedCnpj) || null,
    [supplierReports, selectedCnpj]
  );

  const normalizedSearch = supplierSearch.trim().toLocaleLowerCase('pt-BR');
  const searchDigits = supplierSearch.replace(/\D/g, '');
  const filteredSuppliers = React.useMemo(() => {
    if (!normalizedSearch && !searchDigits) return supplierReports;

    return supplierReports.filter((supplier) => {
      const nameMatch = supplier.supplierName.toLocaleLowerCase('pt-BR').includes(normalizedSearch);
      const cnpjMatch = searchDigits.length > 0 && supplier.cnpj.includes(searchDigits);
      return nameMatch || cnpjMatch;
    });
  }, [normalizedSearch, searchDigits, supplierReports]);

  const normalizedUg = normalizeSagUg(ug);
  const ugInvalid = Boolean(ug.trim()) && !normalizedUg;

  const prompt = React.useMemo(() => {
    if (!selectedSupplier || ugInvalid) return '';

    return buildSagNsExtractionPrompt({
      supplierCnpj: selectedSupplier.cnpj,
      supplierName: selectedSupplier.supplierName,
      ug: normalizedUg,
    });
  }, [normalizedUg, selectedSupplier, ugInvalid]);

  const errorIssues = validation?.issues.filter((issue) => issue.severity === 'error') || [];
  const warningIssues = validation?.issues.filter((issue) => issue.severity === 'warning') || [];

  const reconciliation = React.useMemo(() => {
    if (!selectedSupplier || !validation?.ok || !validation.data) return null;

    return reconcileSagNsPayload(
      validation.data,
      selectedSupplier.cnpj,
      empenhos,
      invoices
    );
  }, [empenhos, invoices, selectedSupplier, validation]);

  const applicationPreview = React.useMemo(
    () => (reconciliation ? buildSagNsApplicationPreview(reconciliation) : null),
    [reconciliation]
  );
  const applicationFingerprint = React.useMemo(
    () => (applicationPreview ? buildSagNsApplicationFingerprint(applicationPreview) : ''),
    [applicationPreview]
  );
  const filteredPreviewItems = React.useMemo(() => {
    if (!applicationPreview) return [];
    if (previewFilter === 'all') return applicationPreview.items;
    return applicationPreview.items.filter((item) => item.decision === previewFilter);
  }, [applicationPreview, previewFilter]);
  const activeFlowStep = !selectedSupplier
    ? 1
    : !jsonText.trim()
      ? 2
      : !validation?.ok
        ? 3
        : 4;

  const handleSelectSupplier = (cnpj: string) => {
    setSelectedCnpj(cnpj);
    setJsonText('');
    setValidation(null);
    setCopyState('idle');
    setShowApplyConfirmation(false);
    setApplyConfirmed(false);
    setApplyError('');
    setConfirmationFingerprint('');
    setLastImportResult(null);
    setSupplierPickerOpen(false);
    setShowTechnicalReconciliation(false);
    setPreviewFilter('all');
  };

  const handleCopyPrompt = async () => {
    if (!prompt) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompt);
      } else if (!copyTextFallback(prompt)) {
        throw new Error('Clipboard indisponível.');
      }

      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 2400);
    } catch {
      const copied = copyTextFallback(prompt);
      setCopyState(copied ? 'copied' : 'error');
      window.setTimeout(() => setCopyState('idle'), 2400);
    }
  };

  const handleValidateJson = () => {
    if (!selectedSupplier) return;
    setValidation(
      parseSagNsJson(jsonText, {
        expectedSupplierCnpj: selectedSupplier.cnpj,
      })
    );
  };

  const resetJson = () => {
    setJsonText('');
    setValidation(null);
    setShowApplyConfirmation(false);
    setApplyConfirmed(false);
    setApplyError('');
    setConfirmationFingerprint('');
    setLastImportResult(null);
    setShowTechnicalReconciliation(false);
    setPreviewFilter('all');
  };

  const handleOpenApplyConfirmation = () => {
    if (!applicationPreview?.canAdvanceToPersistenceReview || !applicationFingerprint) return;
    setConfirmationFingerprint(applicationFingerprint);
    setApplyConfirmed(false);
    setApplyError('');
    setShowApplyConfirmation(true);
  };

  const handleCloseApplyConfirmation = () => {
    if (isApplying) return;
    setShowApplyConfirmation(false);
    setApplyConfirmed(false);
    setApplyError('');
    setConfirmationFingerprint('');
  };

  const handleConfirmSagImport = async () => {
    if (
      !validation?.ok ||
      !validation.data ||
      !selectedSupplier ||
      !applyConfirmed ||
      !confirmationFingerprint ||
      isApplying
    ) {
      return;
    }

    setIsApplying(true);
    setApplyError('');
    try {
      const result = await onApplySagNsImport(
        validation.data,
        selectedSupplier.cnpj,
        confirmationFingerprint
      );
      setLastImportResult(result);
      setShowApplyConfirmation(false);
      setApplyConfirmed(false);
      setConfirmationFingerprint('');
    } catch (error) {
      setApplyError(
        error instanceof Error
          ? error.message
          : 'Não foi possível concluir a importação das NS. Nenhuma alteração foi confirmada.'
      );
    } finally {
      setIsApplying(false);
    }
  };

  const previewChanges = applicationPreview?.items.filter((item) => item.decision === 'change') || [];

  const handleStartAnotherImport = () => {
    resetJson();
    setSupplierPickerOpen(false);
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-[#00288e]">
          <Landmark className="h-5 w-5" aria-hidden="true" />
          <span className="font-mono text-[10px] font-extrabold uppercase tracking-[0.18em]">
            Assistente de integração manual
          </span>
        </div>
        <h3 className="mt-1 text-xl font-bold tracking-tight text-[#00288e]">Importar NS — SAG</h3>
        <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-gray-500">
          Um fluxo guiado para extrair, validar, conciliar e gravar NS com confirmação humana e
          revalidação transacional antes do commit.
        </p>
      </header>

      <nav
        className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm"
        aria-label="Progresso da importação SAG"
      >
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            ['Fornecedor', 'Definir o CNPJ'],
            ['SAG + prompt', 'Obter e estruturar'],
            ['Validar JSON', 'Conferir o lote'],
            ['Revisar e gravar', 'Confirmar alterações'],
          ].map(([title, text], index) => {
            const step = index + 1;
            const complete = Boolean(lastImportResult) || step < activeFlowStep;
            const active = !lastImportResult && step === activeFlowStep;

            return (
              <div
                key={title}
                aria-current={active ? 'step' : undefined}
                className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition ${
                  active
                    ? 'border-blue-200 bg-blue-50/80'
                    : complete
                      ? 'border-emerald-100 bg-emerald-50/50'
                      : 'border-transparent bg-gray-50/70'
                }`}
              >
                <span
                  className={`grid h-8 w-8 flex-none place-items-center rounded-lg text-[10px] font-black ${
                    complete
                      ? 'bg-emerald-600 text-white'
                      : active
                        ? 'bg-[#00288e] text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {complete ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : step}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[11px] font-extrabold ${
                    active ? 'text-[#00288e]' : complete ? 'text-emerald-800' : 'text-gray-500'
                  }`}>
                    {title}
                  </span>
                  <span className="mt-0.5 block text-[9px] font-semibold text-gray-400">{text}</span>
                </span>
              </div>
            );
          })}
        </div>
      </nav>
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="font-mono text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#00288e]">
              Etapa 1
            </p>
            <h4 className="mt-1 text-base font-black text-[#0b1c30]">Fornecedor / favorecido</h4>
            <p className="mt-1 text-xs font-medium text-gray-500">
              O CNPJ escolhido define o universo seguro da conciliação.
            </p>
          </div>
          {selectedSupplier ? (
            <button
              type="button"
              onClick={() => setSupplierPickerOpen((current) => !current)}
              aria-expanded={supplierPickerOpen}
              className="inline-flex h-9 w-fit items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 text-[10px] font-extrabold text-[#00288e] transition hover:bg-blue-100"
            >
              {supplierPickerOpen ? 'Ocultar fornecedores' : 'Trocar fornecedor'}
              {supplierPickerOpen ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          ) : (
            <span className="w-fit rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-extrabold text-[#00288e]">
              {supplierReports.length} fornecedor(es) disponíveis
            </span>
          )}
        </div>

        {selectedSupplier && !supplierPickerOpen ? (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#00288e] text-white">
                <Building2 className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-[#0b1c30]">{selectedSupplier.supplierName}</p>
                <p className="mt-0.5 font-mono text-[10px] font-bold text-blue-700">
                  {formatSupplierCnpj(selectedSupplier.cnpj)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[9px] font-extrabold">
              <span className="rounded-md bg-white px-2 py-1 text-gray-500">
                {selectedSupplier.empenhos.length} NE(s)
              </span>
              <span className="rounded-md bg-white px-2 py-1 text-gray-500">
                {selectedSupplier.invoiceCount} NF(s)
              </span>
              <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-700">
                {selectedSupplier.invoicesWithoutNs} sem NS
              </span>
            </div>
          </div>
        ) : null}

        {supplierPickerOpen || !selectedSupplier ? (
          <>
            <label className="relative mt-4 block">
              <span className="sr-only">Buscar fornecedor por razão social ou CNPJ</span>
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={supplierSearch}
                onChange={(event) => setSupplierSearch(event.target.value)}
                placeholder="Razão social ou CNPJ..."
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50/60 pl-10 pr-3 text-xs font-semibold text-gray-700 outline-none transition focus:border-[#00288e] focus:bg-white focus:ring-1 focus:ring-[#00288e]"
              />
            </label>

            {filteredSuppliers.length > 0 ? (
              <div className="mt-4 grid max-h-80 grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
                {filteredSuppliers.map((supplier) => {
                  const selected = selectedCnpj === supplier.cnpj;
                  return (
                    <button
                      key={supplier.cnpj}
                      type="button"
                      onClick={() => handleSelectSupplier(supplier.cnpj)}
                      aria-pressed={selected}
                      className={`rounded-2xl border p-4 text-left transition-all ${
                        selected
                          ? 'border-[#00288e] bg-blue-50/70 shadow-md ring-1 ring-[#00288e]/10'
                          : 'border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`grid h-9 w-9 flex-none place-items-center rounded-xl ${
                            selected ? 'bg-[#00288e] text-white' : 'bg-blue-50 text-[#00288e]'
                          }`}
                        >
                          <Building2 className="h-4 w-4" aria-hidden="true" />
                        </span>
                        {selected ? (
                          <CheckCircle2 className="h-4 w-4 flex-none text-[#00288e]" aria-hidden="true" />
                        ) : null}
                      </div>
                      <p className="mt-3 line-clamp-2 text-xs font-extrabold leading-relaxed text-[#0b1c30]">
                        {supplier.supplierName}
                      </p>
                      <p className="mt-1 font-mono text-[10px] font-bold text-gray-500">
                        {formatSupplierCnpj(supplier.cnpj)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] font-extrabold">
                        <span className="rounded-md bg-gray-50 px-2 py-1 text-gray-500">
                          {supplier.empenhos.length} NE(s)
                        </span>
                        <span className="rounded-md bg-gray-50 px-2 py-1 text-gray-500">
                          {supplier.invoiceCount} NF(s)
                        </span>
                        <span
                          className={`rounded-md px-2 py-1 ${
                            supplier.invoicesWithoutNs > 0
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {supplier.invoicesWithoutNs} sem NS
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-8 text-center">
                <p className="text-sm font-extrabold text-gray-500">Nenhum fornecedor encontrado</p>
                <p className="mt-1 text-xs font-medium text-gray-400">
                  Ajuste a busca ou cadastre o CNPJ dos empenhos pendentes.
                </p>
              </div>
            )}
          </>
        ) : null}
      </section>

      {!selectedSupplier ? (
        <div className="rounded-2xl border border-dashed border-blue-100 bg-blue-50/30 px-6 py-10 text-center">
          <Building2 className="mx-auto h-7 w-7 text-blue-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-extrabold text-[#00288e]">Selecione um fornecedor para continuar</p>
          <p className="mx-auto mt-1 max-w-xl text-xs font-medium leading-relaxed text-gray-500">
            O CNPJ selecionado será fixado no prompt e também conferido novamente quando o JSON for validado.
          </p>
        </div>
      ) : (
        <>
          <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
            <div className="bg-[#00288e] p-5 text-white">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <p className="font-mono text-[9px] font-extrabold uppercase tracking-[0.18em] text-blue-200">
                    Favorecido selecionado
                  </p>
                  <h4 className="mt-1 text-lg font-black">{selectedSupplier.supplierName}</h4>
                  <p className="mt-1 font-mono text-xs font-bold text-blue-100">
                    {formatSupplierCnpj(selectedSupplier.cnpj)}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ['NEs', selectedSupplier.empenhos.length],
                    ['NFs', selectedSupplier.invoiceCount],
                    ['Sem NS', selectedSupplier.invoicesWithoutNs],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2">
                      <span className="block text-base font-black">{value}</span>
                      <span className="text-[8px] font-extrabold uppercase tracking-wider text-blue-100">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-px bg-gray-100 lg:grid-cols-2">
              <div className="bg-white p-5">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-[#00288e]" aria-hidden="true" />
                  <div>
                    <p className="font-mono text-[9px] font-extrabold uppercase tracking-wider text-[#00288e]">
                      Etapa 2
                    </p>
                    <p className="text-sm font-black text-[#0b1c30]">Obter relatório no SAG</p>
                  </div>
                </div>
                <p className="mt-3 text-xs font-medium leading-relaxed text-gray-500">
                  No SAG, gere o relatório de NS do favorecido acima. Use o CNPJ selecionado como referência e
                  preserve as observações do relatório, pois é nelas que a NF costuma aparecer explicitamente.
                </p>
                <a
                  href="https://sag.eb.mil.br/"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 text-xs font-extrabold text-[#00288e] transition hover:bg-blue-100"
                >
                  Abrir SAG
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>

              <div className="bg-white p-5">
                <div className="flex items-center gap-2">
                  <ClipboardCopy className="h-4 w-4 text-[#00288e]" aria-hidden="true" />
                  <div>
                    <p className="font-mono text-[9px] font-extrabold uppercase tracking-wider text-[#00288e]">
                      Etapa 3
                    </p>
                    <p className="text-sm font-black text-[#0b1c30]">Prompt oficial do EMPROVEX</p>
                  </div>
                </div>

                <label className="mt-3 block">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-gray-400">
                    UG opcional
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={ug}
                    onChange={(event) => {
                      setUg(event.target.value.replace(/\D/g, '').slice(0, 6));
                      setCopyState('idle');
                    }}
                    placeholder="Ex.: 160416"
                    className={`mt-1.5 h-10 w-full rounded-xl border bg-gray-50/60 px-3 font-mono text-xs font-bold outline-none transition ${
                      ugInvalid
                        ? 'border-amber-300 text-amber-800 focus:ring-1 focus:ring-amber-300'
                        : 'border-gray-200 text-gray-700 focus:border-[#00288e] focus:bg-white focus:ring-1 focus:ring-[#00288e]'
                    }`}
                  />
                </label>
                {ugInvalid ? (
                  <p className="mt-1.5 text-[10px] font-semibold text-amber-700">
                    Informe os 6 dígitos da UG ou deixe o campo vazio.
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  disabled={!prompt}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#001f70] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {copyState === 'copied' ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Prompt copiado
                    </>
                  ) : copyState === 'error' ? (
                    <>
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                      Não foi possível copiar
                    </>
                  ) : (
                    <>
                      <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
                      Copiar Prompt
                    </>
                  )}
                </button>
                <p className="mt-2 text-[10px] font-medium leading-relaxed text-gray-400">
                  Cole o prompt em uma IA externa, anexe o relatório obtido no SAG e copie somente o JSON retornado.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-blue-50 text-[#00288e]">
                  <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-mono text-[9px] font-extrabold uppercase tracking-wider text-[#00288e]">
                    Etapa 4
                  </p>
                  <h4 className="text-base font-black text-[#0b1c30]">Colar e validar JSON</h4>
                  <p className="mt-1 text-xs font-medium text-gray-500">
                    A validação não grava dados. Ela apenas confere o contrato do Bloco 7 e o CNPJ selecionado.
                  </p>
                </div>
              </div>
              {jsonText ? (
                <button
                  type="button"
                  onClick={resetJson}
                  className="h-9 rounded-xl border border-gray-200 px-3 text-[10px] font-extrabold text-gray-500 transition hover:bg-gray-50"
                >
                  Limpar JSON
                </button>
              ) : null}
            </div>

            <textarea
              value={jsonText}
              onChange={(event) => {
                setJsonText(event.target.value);
                setValidation(null);
                setShowApplyConfirmation(false);
                setApplyConfirmed(false);
                setApplyError('');
                setConfirmationFingerprint('');
                setLastImportResult(null);
              }}
              spellCheck={false}
              placeholder={'Cole aqui o JSON retornado pela IA...\n\n{\n  "schema_version": "emprovex_sag_ns_v1",\n  ...\n}'}
              className="mt-4 min-h-64 w-full resize-y rounded-2xl border border-gray-200 bg-[#07111f] p-4 font-mono text-xs leading-relaxed text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />

            <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-[10px] font-medium text-gray-400">
                O sistema aceita JSON puro e também remove uma única cerca externa ```json ... ```, se existir.
              </p>
              <button
                type="button"
                onClick={handleValidateJson}
                disabled={!jsonText.trim()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#00288e] px-5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#001f70] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FileJson className="h-4 w-4" aria-hidden="true" />
                Validar JSON
              </button>
            </div>
          </section>

          {validation ? (
            <section
              className={`overflow-hidden rounded-2xl border shadow-sm ${
                validation.ok ? 'border-emerald-200 bg-white' : 'border-rose-200 bg-white'
              }`}
              aria-live="polite"
            >
              <div
                className={`flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center ${
                  validation.ok ? 'bg-emerald-50/70' : 'bg-rose-50/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`grid h-10 w-10 place-items-center rounded-xl ${
                      validation.ok
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {validation.ok ? (
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-5 w-5" aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <p
                      className={`text-sm font-black ${
                        validation.ok ? 'text-emerald-800' : 'text-rose-800'
                      }`}
                    >
                      {validation.ok ? 'JSON válido para prévia' : 'JSON bloqueado pela validação'}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-gray-500">
                      {validation.stats.errors} erro(s) · {validation.stats.warnings} alerta(s)
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-[9px] font-extrabold">
                  <span className="rounded-lg bg-white px-2.5 py-1.5 text-gray-600">
                    {validation.stats.totalRecords} NS no lote
                  </span>
                  <span className="rounded-lg bg-white px-2.5 py-1.5 text-gray-600">
                    {validation.stats.recordsWithNf} com NF
                  </span>
                  <span className="rounded-lg bg-white px-2.5 py-1.5 text-gray-600">
                    {validation.stats.recordsWithoutNf} sem NF
                  </span>
                </div>
              </div>

              {(errorIssues.length > 0 || warningIssues.length > 0) ? (
                <div className="grid grid-cols-1 gap-3 border-t border-gray-100 p-5 lg:grid-cols-2">
                  {errorIssues.length > 0 ? (
                    <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
                      <div className="flex items-center gap-2 text-rose-700">
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                        <p className="text-xs font-black">Erros que impedem o avanço</p>
                      </div>
                      <div className="mt-3 space-y-2">
                        {errorIssues.map((issue, index) => (
                          <div key={`${issue.code}-${issue.path}-${index}`}>
                            <p className="font-mono text-[9px] font-bold text-rose-500">{issue.path}</p>
                            <p className="text-[10px] font-semibold leading-relaxed text-rose-800">
                              {issue.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {warningIssues.length > 0 ? (
                    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                      <div className="flex items-center gap-2 text-amber-700">
                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                        <p className="text-xs font-black">Alertas para conferência humana</p>
                      </div>
                      <div className="mt-3 space-y-2">
                        {warningIssues.map((issue, index) => (
                          <div key={`${issue.code}-${issue.path}-${index}`}>
                            <p className="font-mono text-[9px] font-bold text-amber-500">{issue.path}</p>
                            <p className="text-[10px] font-semibold leading-relaxed text-amber-800">
                              {issue.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {validation.ok && validation.data ? (
                <div className="border-t border-gray-100 p-5">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm font-black text-[#0b1c30]">Prévia estrutural do relatório</p>
                      <p className="mt-1 text-[10px] font-semibold text-gray-500">
                        CNPJ validado: {formatSupplierCnpj(validation.data.supplier_cnpj)}
                        {validation.data.ug ? ` · UG ${validation.data.ug}` : ''}
                      </p>
                    </div>
                    <span className="w-fit rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-700">
                      emprovex_sag_ns_v1
                    </span>
                  </div>

                  {validation.data.records.length > 0 ? (
                    <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
                      <table className="w-full min-w-[860px] text-left text-xs">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50 text-[9px] uppercase tracking-wider text-gray-500">
                            <th className="px-3 py-2.5 font-extrabold">NS</th>
                            <th className="px-3 py-2.5 font-extrabold">Emissão NS</th>
                            <th className="px-3 py-2.5 font-extrabold">NF extraída</th>
                            <th className="px-3 py-2.5 font-extrabold">Emissão NF</th>
                            <th className="px-3 py-2.5 font-extrabold">Observação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {validation.data.records.map((record, index) => (
                            <tr key={`${record.ns}-${index}`} className="align-top hover:bg-gray-50/60">
                              <td className="px-3 py-3 font-mono text-[10px] font-black text-indigo-700">
                                {record.ns}
                              </td>
                              <td className="px-3 py-3 font-semibold text-gray-600">
                                {formatDate(record.ns_issue_date)}
                              </td>
                              <td className="px-3 py-3">
                                {record.nf_number_raw ? (
                                  <span className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-black text-[#00288e]">
                                    NF {record.nf_number_raw}
                                  </span>
                                ) : (
                                  <span className="rounded-md border border-amber-100 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                                    Sem NF explícita
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 font-semibold text-gray-600">
                                {formatDate(record.nf_issue_date)}
                              </td>
                              <td className="max-w-md px-3 py-3 text-[10px] font-medium leading-relaxed text-gray-500">
                                {record.observation || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-5 py-7 text-center">
                      <p className="text-xs font-extrabold text-gray-500">JSON válido, mas sem registros de NS</p>
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          ) : null}

          {reconciliation ? (
            <section className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
              <div className="border-b border-indigo-100 bg-indigo-50/50 p-5">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div>
                    <p className="font-mono text-[9px] font-extrabold uppercase tracking-[0.18em] text-indigo-600">
                      Diagnóstico técnico
                    </p>
                    <h4 className="mt-1 text-base font-black text-[#0b1c30]">Conciliação CNPJ → NF → NE</h4>
                    <p className="mt-1 max-w-3xl text-xs font-medium leading-relaxed text-gray-500">
                      O resumo abaixo mostra o resultado do motor determinístico. Abra o diagnóstico detalhado
                      somente quando precisar investigar uma divergência.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTechnicalReconciliation((current) => !current)}
                    aria-expanded={showTechnicalReconciliation}
                    className="inline-flex h-9 w-fit items-center gap-2 rounded-xl border border-indigo-100 bg-white px-3 text-[10px] font-extrabold text-indigo-700 transition hover:bg-indigo-50"
                  >
                    {showTechnicalReconciliation ? 'Ocultar diagnóstico' : 'Ver diagnóstico técnico'}
                    {showTechnicalReconciliation ? (
                      <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                  {[
                    ['Prontas', reconciliation.stats.readyToApply, 'text-emerald-700'],
                    ['Já cadastradas', reconciliation.stats.alreadyRegistered, 'text-blue-700'],
                    ['Conflitos', reconciliation.stats.conflicts, 'text-rose-700'],
                    ['Ambíguas', reconciliation.stats.ambiguous, 'text-amber-700'],
                    ['Não encontradas', reconciliation.stats.notFound, 'text-gray-700'],
                    ['Sem NF no SAG', reconciliation.stats.missingReference, 'text-amber-700'],
                  ].map(([label, value, valueClass]) => (
                    <div key={String(label)} className="rounded-xl border border-white bg-white px-3 py-3 shadow-sm">
                      <p className="text-[8px] font-extrabold uppercase tracking-wider text-gray-400">{label}</p>
                      <p className={`mt-1 text-lg font-black ${valueClass}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {showTechnicalReconciliation ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1050px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 text-[9px] uppercase tracking-wider text-gray-500">
                          <th className="px-4 py-3 font-extrabold">NS SAG</th>
                          <th className="px-4 py-3 font-extrabold">NF SAG</th>
                          <th className="px-4 py-3 font-extrabold">Resultado</th>
                          <th className="px-4 py-3 font-extrabold">NF EMPROVEX</th>
                          <th className="px-4 py-3 font-extrabold">NE vinculada</th>
                          <th className="px-4 py-3 font-extrabold">NS atual</th>
                          <th className="px-4 py-3 font-extrabold">Conferência</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {reconciliation.items.map((item, index) => {
                          const meta = RECONCILIATION_STATUS_META[item.status];
                          return (
                            <tr key={`${item.record.ns}-${index}`} className="align-top hover:bg-gray-50/60">
                              <td className="px-4 py-3 font-mono text-[10px] font-black text-indigo-700">
                                {item.record.ns}
                              </td>
                              <td className="px-4 py-3 font-black text-[#00288e]">
                                {item.record.nf_number_raw ? `NF ${item.record.nf_number_raw}` : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex rounded-md border px-2 py-1 text-[9px] font-extrabold ${meta.className}`}>
                                  {meta.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-semibold text-gray-700">
                                {item.invoice ? `NF ${item.invoice.invoiceId}` : (
                                  item.candidates.length > 0
                                    ? `${item.candidates.length} candidata(s)`
                                    : '—'
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono text-[10px] font-bold text-gray-600">
                                {item.invoice?.empenhoId || '—'}
                              </td>
                              <td className="px-4 py-3">
                                {item.invoice?.currentNs ? (
                                  <span className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 font-mono text-[9px] font-bold text-indigo-700">
                                    {item.invoice.currentNs}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold text-gray-400">Sem NS</span>
                                )}
                              </td>
                              <td className="max-w-sm px-4 py-3">
                                {item.issues.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {item.issues.map((reconciliationIssue, issueIndex) => (
                                      <p
                                        key={`${reconciliationIssue.code}-${issueIndex}`}
                                        className={`text-[10px] font-semibold leading-relaxed ${
                                          reconciliationIssue.severity === 'blocker'
                                            ? 'text-rose-700'
                                            : 'text-amber-700'
                                        }`}
                                      >
                                        {reconciliationIssue.message}
                                      </p>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                    Número da NF único no CNPJ
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-indigo-100 bg-indigo-50/30 px-5 py-4">
                    <p className="text-[10px] font-semibold leading-relaxed text-indigo-800">
                      O diagnóstico técnico é somente leitura. A decisão de escrita continua sendo determinada pela
                      prévia de aplicação e pela confirmação humana.
                    </p>
                  </div>
                </>
              ) : null}
            </section>
          ) : null}

          {applicationPreview ? (
            <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
              <div className="border-b border-sky-100 bg-sky-50/50 p-5">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-sky-100 text-sky-700">
                      <Eye className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-mono text-[9px] font-extrabold uppercase tracking-[0.18em] text-sky-700">
                        Bloco 10 · prévia de aplicação
                      </p>
                      <h4 className="mt-1 text-base font-black text-[#0b1c30]">O que aconteceria com este lote</h4>
                      <p className="mt-1 max-w-3xl text-xs font-medium leading-relaxed text-gray-500">
                        Esta visão transforma a conciliação em um plano legível antes de qualquer escrita:
                        alterações propostas, registros já corretos, itens ignorados e bloqueios.
                      </p>
                    </div>
                  </div>
                  <span className="w-fit rounded-full border border-sky-100 bg-white px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-wider text-sky-700">
                    Prévia — nada será gravado
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {[
                    ['Alterar', applicationPreview.stats.changes, 'text-emerald-700'],
                    ['Sem alteração', applicationPreview.stats.unchanged, 'text-blue-700'],
                    ['Ignorar', applicationPreview.stats.ignored, 'text-gray-700'],
                    ['Bloqueados', applicationPreview.stats.blocked, 'text-rose-700'],
                    ['Com alertas', applicationPreview.stats.warningItems, 'text-amber-700'],
                  ].map(([label, value, valueClass]) => (
                    <div key={String(label)} className="rounded-xl border border-white bg-white px-3 py-3 shadow-sm">
                      <p className="text-[8px] font-extrabold uppercase tracking-wider text-gray-400">{label}</p>
                      <p className={`mt-1 text-lg font-black ${valueClass}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-[9px] uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-3 font-extrabold">Decisão</th>
                      <th className="px-4 py-3 font-extrabold">NF</th>
                      <th className="px-4 py-3 font-extrabold">NE</th>
                      <th className="px-4 py-3 font-extrabold">NS atual</th>
                      <th className="px-4 py-3 font-extrabold">NS proposta</th>
                      <th className="px-4 py-3 font-extrabold">Efeito</th>
                      <th className="px-4 py-3 font-extrabold">Alertas / bloqueios</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {applicationPreview.items.map((item, index) => {
                      const meta = APPLICATION_DECISION_META[item.decision];
                      const DecisionIcon = meta.icon;

                      return (
                        <tr key={`${item.ns}-${index}`} className="align-top hover:bg-gray-50/60">
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[9px] font-extrabold ${meta.className}`}>
                              <DecisionIcon className="h-3.5 w-3.5" aria-hidden={true} />
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-black text-[#00288e]">
                            {item.invoiceId
                              ? `NF ${item.invoiceId}`
                              : item.nfNumberRaw
                                ? `NF ${item.nfNumberRaw}`
                                : '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-[10px] font-bold text-gray-600">
                            {item.empenhoId || '—'}
                          </td>
                          <td className="px-4 py-3">
                            {item.currentNs ? (
                              <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-[9px] font-bold text-gray-700">
                                {item.currentNs}
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-gray-400">Sem NS</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {item.proposedNs ? (
                              <span className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 font-mono text-[9px] font-black text-emerald-700">
                                {item.proposedNs}
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-gray-400">Nenhuma</span>
                            )}
                          </td>
                          <td className="max-w-sm px-4 py-3 text-[10px] font-semibold leading-relaxed text-gray-600">
                            {item.summary}
                          </td>
                          <td className="max-w-sm px-4 py-3">
                            {item.blockers.length > 0 ? (
                              <div className="space-y-1.5">
                                {item.blockers.map((message, blockerIndex) => (
                                  <p key={blockerIndex} className="text-[10px] font-semibold leading-relaxed text-rose-700">
                                    {message}
                                  </p>
                                ))}
                              </div>
                            ) : item.warnings.length > 0 ? (
                              <div className="space-y-1.5">
                                {item.warnings.map((message, warningIndex) => (
                                  <p key={warningIndex} className="text-[10px] font-semibold leading-relaxed text-amber-700">
                                    {message}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                Sem ressalvas adicionais
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className={`border-t px-5 py-4 ${
                applicationPreview.stats.blocked > 0
                  ? 'border-rose-100 bg-rose-50/50'
                  : applicationPreview.canAdvanceToPersistenceReview
                    ? 'border-emerald-100 bg-emerald-50/50'
                    : 'border-gray-100 bg-gray-50/70'
              }`}>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className={`text-xs font-black ${
                      applicationPreview.stats.blocked > 0
                        ? 'text-rose-800'
                        : applicationPreview.canAdvanceToPersistenceReview
                          ? 'text-emerald-800'
                          : 'text-gray-700'
                    }`}>
                      {applicationPreview.stats.blocked > 0
                        ? 'Lote com bloqueios: não pode avançar para persistência.'
                        : applicationPreview.canAdvanceToPersistenceReview
                          ? 'Lote sem bloqueios e com alterações propostas.'
                          : 'Lote sem alterações pendentes para gravar.'}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold leading-relaxed text-gray-500">
                      Antes da escrita, o EMPROVEX refaz a conciliação e a transação relê NF, NE, CNPJ e NS diretamente do Firestore.
                    </p>
                  </div>
                  {applicationPreview.canAdvanceToPersistenceReview ? (
                    <button
                      type="button"
                      onClick={handleOpenApplyConfirmation}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#00288e] px-4 text-[10px] font-extrabold text-white shadow-sm transition hover:bg-[#001f70]"
                    >
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      Revisar gravação de {applicationPreview.stats.changes} NS
                    </button>
                  ) : (
                    <span className="w-fit rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-wider text-gray-600">
                      Gravação indisponível
                    </span>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          {lastImportResult ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5" aria-live="polite">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-emerald-700" aria-hidden="true" />
                <div>
                  <p className="text-sm font-black text-emerald-800">Importação SAG concluída</p>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-emerald-800/80">
                    {lastImportResult.appliedCount} NS gravada(s) nesta transação
                    {lastImportResult.alreadyAppliedCount > 0
                      ? ` · ${lastImportResult.alreadyAppliedCount} já estava(m) aplicada(s) e foi(ram) mantida(s) sem nova escrita`
                      : ''}.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
            <div className="flex items-start gap-3 text-emerald-800">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
              <div>
                <p className="text-sm font-extrabold">Validação sem persistência</p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-emerald-800/80">
                  Nenhuma NS será gravada automaticamente. A escrita só ocorre após revisão do lote, confirmação humana explícita
                  e revalidação transacional das NFs e dos empenhos imediatamente antes do commit.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {showApplyConfirmation && applicationPreview && validation?.data && selectedSupplier ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) handleCloseApplyConfirmation();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="sag-import-confirmation-title"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-blue-100 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
              <div>
                <p className="font-mono text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#00288e]">
                  Bloco 11 · confirmação humana
                </p>
                <h4 id="sag-import-confirmation-title" className="mt-1 text-lg font-black text-[#0b1c30]">
                  Confirmar importação das NS
                </h4>
                <p className="mt-1 text-xs font-medium leading-relaxed text-gray-500">
                  Confira as alterações abaixo. Ao confirmar, o EMPROVEX revalidará o lote e executará uma única transação atômica.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseApplyConfirmation}
                disabled={isApplying}
                aria-label="Fechar confirmação"
                className="grid h-9 w-9 flex-none place-items-center rounded-xl border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:opacity-40"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5">
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                <p className="text-xs font-black text-[#00288e]">{selectedSupplier.supplierName}</p>
                <p className="mt-1 font-mono text-[10px] font-bold text-blue-700">
                  {formatSupplierCnpj(selectedSupplier.cnpj)}
                </p>
                <p className="mt-2 text-[10px] font-semibold leading-relaxed text-blue-800/80">
                  {previewChanges.length} alteração(ões) serão submetidas à revalidação. Itens ignorados ou já cadastrados não geram escrita.
                </p>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
                <div className="divide-y divide-gray-100">
                  {previewChanges.map((item) => (
                    <div key={`${item.invoiceRecordKey}-${item.ns}`} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div>
                        <p className="text-xs font-black text-[#0b1c30]">
                          NF {item.invoiceId} · <span className="font-mono text-[10px] text-gray-500">{item.empenhoId}</span>
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                          <span className="rounded-md bg-gray-50 px-2 py-1 text-gray-500">Sem NS</span>
                          <ArrowRight className="h-3.5 w-3.5 text-gray-300" aria-hidden="true" />
                          <span className="rounded-md bg-emerald-50 px-2 py-1 font-mono text-emerald-700">
                            {item.proposedNs}
                          </span>
                        </div>
                      </div>
                      {item.warnings.length > 0 ? (
                        <span className="w-fit rounded-md border border-amber-100 bg-amber-50 px-2 py-1 text-[9px] font-extrabold text-amber-700">
                          {item.warnings.length} alerta(s)
                        </span>
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-700" aria-hidden="true" />
                  <p className="text-[10px] font-semibold leading-relaxed text-amber-800">
                    Se qualquer NF, NE, CNPJ ou NS tiver mudado desde esta prévia, a transação será cancelada integralmente. Nenhuma parte do lote será gravada.
                  </p>
                </div>
              </div>

              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                <input
                  type="checkbox"
                  checked={applyConfirmed}
                  onChange={(event) => setApplyConfirmed(event.target.checked)}
                  disabled={isApplying}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#00288e] focus:ring-[#00288e]"
                />
                <span className="text-xs font-semibold leading-relaxed text-gray-700">
                  Conferi as NFs, as NEs e as NS propostas acima e autorizo a gravação somente dessas correspondências seguras.
                </span>
              </label>

              {applyError ? (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4" role="alert">
                  <p className="text-xs font-black text-rose-800">Importação não realizada</p>
                  <p className="mt-1 text-[10px] font-semibold leading-relaxed text-rose-700">{applyError}</p>
                  <p className="mt-1 text-[9px] font-medium text-rose-600">
                    Revise a prévia atualizada antes de tentar novamente.
                  </p>
                </div>
              ) : null}

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCloseApplyConfirmation}
                  disabled={isApplying}
                  className="h-10 rounded-xl border border-gray-200 px-4 text-xs font-extrabold text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSagImport}
                  disabled={!applyConfirmed || isApplying || previewChanges.length === 0}
                  aria-busy={isApplying}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#00288e] px-5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#001f70] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  {isApplying
                    ? 'Revalidando e gravando…'
                    : `Confirmar e gravar ${previewChanges.length} NS`}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
