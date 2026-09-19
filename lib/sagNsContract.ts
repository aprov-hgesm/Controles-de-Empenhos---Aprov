import { normalizeInvoiceNumber, normalizeSupplierCnpj } from './invoiceIdentity';

export const SAG_NS_SCHEMA_VERSION = 'emprovex_sag_ns_v1' as const;
export const SAG_NS_SOURCE = 'SAG' as const;

export interface SagNsRecord {
  ns: string;
  ns_issue_date: string;
  nf_number_raw: string | null;
  nf_issue_date: string | null;
  observation: string;
}

export interface SagNsPayload {
  schema_version: typeof SAG_NS_SCHEMA_VERSION;
  source: typeof SAG_NS_SOURCE;
  supplier_cnpj: string;
  ug: string | null;
  records: SagNsRecord[];
}

export type SagNsValidationSeverity = 'error' | 'warning';

export interface SagNsValidationIssue {
  severity: SagNsValidationSeverity;
  code: string;
  path: string;
  message: string;
}

export interface SagNsValidationStats {
  totalRecords: number;
  recordsWithNf: number;
  recordsWithoutNf: number;
  warnings: number;
  errors: number;
}

export interface SagNsValidationResult {
  ok: boolean;
  data?: SagNsPayload;
  issues: SagNsValidationIssue[];
  stats: SagNsValidationStats;
}

export interface SagNsValidationOptions {
  expectedSupplierCnpj?: string | null;
}

export interface SagNsPromptOptions {
  supplierCnpj: string;
  supplierName?: string | null;
  ug?: string | null;
}

type UnknownObject = Record<string, unknown>;

const ROOT_FIELDS = new Set(['schema_version', 'source', 'supplier_cnpj', 'ug', 'records']);
const RECORD_FIELDS = new Set(['ns', 'ns_issue_date', 'nf_number_raw', 'nf_issue_date', 'observation']);
const FORBIDDEN_LINKAGE_FIELDS = new Set([
  'ne',
  'nota_empenho',
  'nota_de_empenho',
  'empenho',
  'empenho_id',
  'empenhoid',
  'record_key',
  'recordkey',
  'invoice_record_key',
  'nf_record_key',
  'firestore_id',
]);

function isPlainObject(value: unknown): value is UnknownObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function canonicalFieldName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

export function normalizeSagNsNumber(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function isValidSagNsNumber(value: unknown): boolean {
  return /^\d{4}NS\d{6}$/.test(normalizeSagNsNumber(value));
}

export function normalizeSagUg(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const digits = String(value).replace(/\D/g, '');
  return digits.length === 6 ? digits : null;
}

export function normalizeSagIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(candidate);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return candidate;
}

function makeIssue(
  severity: SagNsValidationSeverity,
  code: string,
  path: string,
  message: string
): SagNsValidationIssue {
  return { severity, code, path, message };
}

function addUnexpectedFields(
  value: UnknownObject,
  allowed: Set<string>,
  path: string,
  issues: SagNsValidationIssue[]
) {
  for (const key of Object.keys(value)) {
    const canonical = canonicalFieldName(key);
    if (FORBIDDEN_LINKAGE_FIELDS.has(canonical)) {
      issues.push(
        makeIssue(
          'error',
          'forbidden_linkage_field',
          `${path}.${key}`,
          'O JSON do SAG não pode informar NE, empenho, recordKey ou qualquer vínculo interno do EMPROVEX.'
        )
      );
      continue;
    }

    if (!allowed.has(key)) {
      issues.push(
        makeIssue(
          'warning',
          'unexpected_field',
          `${path}.${key}`,
          'Campo extra ignorado por não fazer parte do contrato emprovex_sag_ns_v1.'
        )
      );
    }
  }
}

export function validateSagNsPayload(
  input: unknown,
  options: SagNsValidationOptions = {}
): SagNsValidationResult {
  const issues: SagNsValidationIssue[] = [];
  const normalizedRecords: SagNsRecord[] = [];

  if (!isPlainObject(input)) {
    const issue = makeIssue('error', 'invalid_root', '$', 'O conteúdo deve ser um objeto JSON.');
    return {
      ok: false,
      issues: [issue],
      stats: { totalRecords: 0, recordsWithNf: 0, recordsWithoutNf: 0, warnings: 0, errors: 1 },
    };
  }

  addUnexpectedFields(input, ROOT_FIELDS, '$', issues);

  if (input.schema_version !== SAG_NS_SCHEMA_VERSION) {
    issues.push(
      makeIssue(
        'error',
        'invalid_schema_version',
        '$.schema_version',
        `schema_version deve ser exatamente "${SAG_NS_SCHEMA_VERSION}".`
      )
    );
  }

  const source = typeof input.source === 'string' ? input.source.trim().toUpperCase() : '';
  if (source !== SAG_NS_SOURCE) {
    issues.push(
      makeIssue('error', 'invalid_source', '$.source', 'source deve ser exatamente "SAG".')
    );
  }

  const supplierCnpj = normalizeSupplierCnpj(
    typeof input.supplier_cnpj === 'string' || typeof input.supplier_cnpj === 'number'
      ? String(input.supplier_cnpj)
      : ''
  );
  if (!supplierCnpj) {
    issues.push(
      makeIssue(
        'error',
        'invalid_supplier_cnpj',
        '$.supplier_cnpj',
        'supplier_cnpj deve conter um CNPJ válido no formato normalizado de 14 dígitos.'
      )
    );
  }

  const expectedSupplierCnpj = normalizeSupplierCnpj(options.expectedSupplierCnpj);
  if (expectedSupplierCnpj && supplierCnpj && expectedSupplierCnpj !== supplierCnpj) {
    issues.push(
      makeIssue(
        'error',
        'supplier_cnpj_mismatch',
        '$.supplier_cnpj',
        'O CNPJ do JSON não corresponde ao fornecedor selecionado no EMPROVEX.'
      )
    );
  }

  let ug: string | null = null;
  if (input.ug !== null && input.ug !== undefined && input.ug !== '') {
    ug = normalizeSagUg(input.ug);
    if (!ug) {
      issues.push(
        makeIssue('error', 'invalid_ug', '$.ug', 'UG deve possuir 6 dígitos ou ser null.')
      );
    }
  }

  const records = Array.isArray(input.records) ? input.records : null;
  if (!records) {
    issues.push(
      makeIssue('error', 'invalid_records', '$.records', 'records deve ser um array.')
    );
  } else if (records.length === 0) {
    issues.push(
      makeIssue(
        'warning',
        'empty_records',
        '$.records',
        'O relatório não contém registros de NS para processar.'
      )
    );
  }

  const seenNs = new Map<string, number>();

  for (const [index, rawRecord] of (records || []).entries()) {
    const path = `$.records[${index}]`;

    if (!isPlainObject(rawRecord)) {
      issues.push(makeIssue('error', 'invalid_record', path, 'Cada registro deve ser um objeto JSON.'));
      continue;
    }

    addUnexpectedFields(rawRecord, RECORD_FIELDS, path, issues);

    const ns = normalizeSagNsNumber(rawRecord.ns);
    if (!/^\d{4}NS\d{6}$/.test(ns)) {
      issues.push(
        makeIssue(
          'error',
          'invalid_ns',
          `${path}.ns`,
          'NS deve seguir o padrão AAAANS000000, por exemplo 2026NS000012.'
        )
      );
    } else if (seenNs.has(ns)) {
      issues.push(
        makeIssue(
          'error',
          'duplicate_ns_in_payload',
          `${path}.ns`,
          `A NS ${ns} já apareceu em records[${seenNs.get(ns)}].`
        )
      );
    } else {
      seenNs.set(ns, index);
    }

    const nsIssueDate = normalizeSagIsoDate(rawRecord.ns_issue_date);
    if (!nsIssueDate) {
      issues.push(
        makeIssue(
          'error',
          'invalid_ns_issue_date',
          `${path}.ns_issue_date`,
          'ns_issue_date deve ser uma data ISO válida no formato YYYY-MM-DD.'
        )
      );
    }

    let nfNumberRaw = normalizeOptionalString(rawRecord.nf_number_raw);
    if (
      rawRecord.nf_number_raw !== null &&
      rawRecord.nf_number_raw !== undefined &&
      typeof rawRecord.nf_number_raw !== 'string'
    ) {
      if (nfNumberRaw) {
        issues.push(
          makeIssue(
            'warning',
            'coerced_nf_number',
            `${path}.nf_number_raw`,
            'nf_number_raw deveria ser string; o valor foi convertido sem inferência.'
          )
        );
      } else {
        issues.push(
          makeIssue(
            'error',
            'invalid_nf_number_type',
            `${path}.nf_number_raw`,
            'nf_number_raw deve ser string ou null.'
          )
        );
      }
    }

    if (nfNumberRaw && !normalizeInvoiceNumber(nfNumberRaw)) {
      issues.push(
        makeIssue(
          'error',
          'invalid_nf_number',
          `${path}.nf_number_raw`,
          'nf_number_raw não contém um número de NF utilizável.'
        )
      );
      nfNumberRaw = null;
    }

    let nfIssueDate: string | null = null;
    if (rawRecord.nf_issue_date !== null && rawRecord.nf_issue_date !== undefined && rawRecord.nf_issue_date !== '') {
      nfIssueDate = normalizeSagIsoDate(rawRecord.nf_issue_date);
      if (!nfIssueDate) {
        issues.push(
          makeIssue(
            'error',
            'invalid_nf_issue_date',
            `${path}.nf_issue_date`,
            'nf_issue_date deve ser uma data ISO válida no formato YYYY-MM-DD ou null.'
          )
        );
      }
    }

    const observation = typeof rawRecord.observation === 'string' ? rawRecord.observation.trim() : '';
    if (typeof rawRecord.observation !== 'string') {
      issues.push(
        makeIssue(
          'error',
          'invalid_observation',
          `${path}.observation`,
          'observation deve ser uma string, ainda que vazia.'
        )
      );
    } else if (!observation) {
      issues.push(
        makeIssue(
          'warning',
          'empty_observation',
          `${path}.observation`,
          'A observação está vazia; a NS poderá não ser conciliável automaticamente.'
        )
      );
    }

    if (nfNumberRaw && !nfIssueDate) {
      issues.push(
        makeIssue(
          'warning',
          'nf_date_missing',
          `${path}.nf_issue_date`,
          'Há número de NF sem data explícita. A conciliação deverá tratar isso com cautela.'
        )
      );
    }

    if (!nfNumberRaw && nfIssueDate) {
      issues.push(
        makeIssue(
          'warning',
          'nf_number_missing',
          `${path}.nf_number_raw`,
          'Há data de NF sem número explícito. Nenhum vínculo deve ser inferido apenas pela data.'
        )
      );
    }

    if (ns && nsIssueDate && ns.slice(0, 4) !== nsIssueDate.slice(0, 4)) {
      issues.push(
        makeIssue(
          'warning',
          'ns_year_date_mismatch',
          path,
          'O ano embutido no número da NS diverge do ano da data de emissão.'
        )
      );
    }

    if (nfIssueDate && nsIssueDate && nfIssueDate > nsIssueDate) {
      issues.push(
        makeIssue(
          'warning',
          'nf_date_after_ns_date',
          path,
          'A data da NF é posterior à data da NS. O dado foi preservado e deve ser conferido pelo usuário.'
        )
      );
    }

    if (ns && nsIssueDate) {
      normalizedRecords.push({
        ns,
        ns_issue_date: nsIssueDate,
        nf_number_raw: nfNumberRaw,
        nf_issue_date: nfIssueDate,
        observation,
      });
    }
  }

  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.length - errors;
  const stats: SagNsValidationStats = {
    totalRecords: records?.length || 0,
    recordsWithNf: normalizedRecords.filter((record) => Boolean(record.nf_number_raw)).length,
    recordsWithoutNf: normalizedRecords.filter((record) => !record.nf_number_raw).length,
    warnings,
    errors,
  };

  if (errors > 0 || !supplierCnpj) {
    return { ok: false, issues, stats };
  }

  return {
    ok: true,
    data: {
      schema_version: SAG_NS_SCHEMA_VERSION,
      source: SAG_NS_SOURCE,
      supplier_cnpj: supplierCnpj,
      ug,
      records: normalizedRecords,
    },
    issues,
    stats,
  };
}

function stripMarkdownFence(value: string): string {
  const trimmed = value.trim().replace(/^\uFEFF/, '');
  const match = /^\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`$/i.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

export function parseSagNsJson(
  jsonText: string,
  options: SagNsValidationOptions = {}
): SagNsValidationResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stripMarkdownFence(jsonText));
  } catch {
    const issue = makeIssue(
      'error',
      'invalid_json',
      '$',
      'O conteúdo colado não é um JSON válido.'
    );
    return {
      ok: false,
      issues: [issue],
      stats: { totalRecords: 0, recordsWithNf: 0, recordsWithoutNf: 0, warnings: 0, errors: 1 },
    };
  }

  return validateSagNsPayload(parsed, options);
}

export function buildSagNsExtractionPrompt(options: SagNsPromptOptions): string {
  const supplierCnpj = normalizeSupplierCnpj(options.supplierCnpj);
  if (!supplierCnpj) {
    throw new Error('CNPJ do fornecedor inválido para geração do prompt SAG.');
  }

  let ug: string | null = null;
  if (options.ug) {
    ug = normalizeSagUg(options.ug);
    if (!ug) throw new Error('UG inválida para geração do prompt SAG.');
  }

  const supplierName = options.supplierName?.trim() || '';
  const example: SagNsPayload = {
    schema_version: SAG_NS_SCHEMA_VERSION,
    source: SAG_NS_SOURCE,
    supplier_cnpj: supplierCnpj,
    ug,
    records: [
      {
        ns: '2026NS000012',
        ns_issue_date: '2026-01-12',
        nf_number_raw: '2073',
        nf_issue_date: '2025-12-12',
        observation: 'APROPRIAÇÃO DE DESPESAS... NF 2073/12DEZ25...',
      },
      {
        ns: '2026NS000068',
        ns_issue_date: '2026-01-21',
        nf_number_raw: null,
        nf_issue_date: null,
        observation: 'DOCUMENTO EMITIDO PELO SIAFI-WEB...',
      },
    ],
  };

  const supplierLine = supplierName
    ? `Fornecedor selecionado no EMPROVEX: ${supplierName} — CNPJ ${supplierCnpj}.`
    : `CNPJ selecionado no EMPROVEX: ${supplierCnpj}.`;

  return [
    'EMPROVEX — EXTRAÇÃO DE NOTAS DE LANÇAMENTO DE SISTEMA (NS) DO SAG',
    '',
    'Tarefa: leia o relatório do Sistema de Acompanhamento da Gestão (SAG) anexado nesta conversa e transforme somente as informações explicitamente presentes nele no JSON definido abaixo.',
    supplierLine,
    ug ? `UG esperada: ${ug}.` : 'Se a UG estiver explicitamente disponível no relatório, retorne-a com 6 dígitos; caso contrário, use null.',
    '',
    'REGRAS OBRIGATÓRIAS',
    `1. Retorne schema_version exatamente como "${SAG_NS_SCHEMA_VERSION}" e source exatamente como "SAG".`,
    `2. supplier_cnpj deve ser exatamente "${supplierCnpj}". Não troque o CNPJ por outro favorecido encontrado incidentalmente no documento.`,
    '3. Extraia uma entrada por NS. O campo ns deve seguir o padrão AAAANS000000, sem espaços ou pontuação.',
    '4. Converta a data de emissão da NS para YYYY-MM-DD.',
    '5. Procure número e data da NF somente quando estiverem explicitamente associados à NS, normalmente no campo de observações.',
    '6. Preserve em nf_number_raw o número da NF como texto. Não remova zeros à esquerda e não tente corrigir numeração.',
    '7. Converta datas explícitas de NF para YYYY-MM-DD. Abreviações portuguesas de mês podem aparecer como JAN, FEV, MAR, ABR, MAI, JUN, JUL, AGO, SET, OUT, NOV e DEZ.',
    '8. Se a observação não informar uma NF, use nf_number_raw: null e nf_issue_date: null. Mesmo assim, mantenha a NS no array records.',
    '9. Se houver número de NF, mas a data não estiver explícita, use nf_issue_date: null. Nunca invente uma data.',
    '10. Preserve o texto relevante da observação em observation. Não "corrija" datas estranhas, divergências ou aparentes erros do documento.',
    '11. NUNCA identifique, deduza, invente ou retorne número de Nota de Empenho (NE), empenhoId, recordKey, ID do Firestore ou qualquer vínculo interno do EMPROVEX.',
    '12. NUNCA associe a NS a uma NE. A ligação CNPJ → NF → NE será feita exclusivamente pelo EMPROVEX após validação humana.',
    '13. Não faça fuzzy matching, não escolha a NF "mais parecida" e não preencha campos ausentes por contexto provável.',
    '14. Não omita NS apenas porque não há NF na observação.',
    '15. Não duplique uma mesma NS.',
    '',
    'FORMATO DE SAÍDA',
    'Retorne SOMENTE JSON válido, sem explicações, sem Markdown, sem comentários e sem texto antes ou depois do objeto.',
    'Use exatamente estes campos:',
    '- schema_version',
    '- source',
    '- supplier_cnpj',
    '- ug',
    '- records[]: ns, ns_issue_date, nf_number_raw, nf_issue_date, observation',
    '',
    'EXEMPLO ESTRUTURAL',
    JSON.stringify(example, null, 2),
  ].join('\n');
}
