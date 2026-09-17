#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recoveryPolicy = JSON.parse(readFileSync(resolve(root, 'ops/firestore-recovery.json'), 'utf8'));
const migrationPolicy = JSON.parse(readFileSync(resolve(root, 'ops/hgesm-workspace-migration.json'), 'utf8'));
const apiBase = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(recoveryPolicy.projectId)}/databases/${encodeURIComponent(recoveryPolicy.databaseId)}`;
const EPSILON = 0.01;
let accessToken = '';

main().catch((error) => {
  console.error(`\nERRO: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  ensureGcloud();
  await assertTargetMetadata();

  console.log('Auditoria profunda de integridade — HGeSM -> workspace');
  console.log(`Projeto:   ${recoveryPolicy.projectId}`);
  console.log(`Banco:     ${recoveryPolicy.databaseId}`);
  console.log(`Workspace: ${migrationPolicy.workspaceId}\n`);

  const source = await loadDataset('legacy');
  const destination = await loadDataset('workspace');
  const issues = [];

  auditPhysicalCopy(source, destination, issues);
  auditSemanticIntegrity(source, issues);

  printDatasetSummary(source, destination);
  printIssues(issues);

  const errors = issues.filter((issue) => issue.severity === 'ERROR');
  const warnings = issues.filter((issue) => issue.severity === 'WARN');

  console.log('\nResumo');
  console.log(`Erros bloqueantes: ${errors.length}`);
  console.log(`Avisos:            ${warnings.length}`);
  console.log(`Hash legado:       ${datasetHash(source)}`);
  console.log(`Hash workspace:    ${datasetHash(destination)}`);
  console.log(`\nINTEGRIDADE SEMÂNTICA: ${errors.length === 0 ? 'READY' : 'BLOQUEADA'}`);

  if (errors.length > 0) process.exitCode = 2;
}

function ensureGcloud() {
  const check = spawnSync('gcloud', ['--version'], { encoding: 'utf8' });
  if (check.error?.code === 'ENOENT') throw new Error('Google Cloud CLI não encontrado. Use o Cloud Shell.');
  if (check.status !== 0) throw new Error('Não foi possível executar o gcloud.');
}

function getAccessToken() {
  const result = spawnSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Não foi possível obter token do gcloud: ${result.stderr.trim() || result.stdout.trim()}`);
  }
  const token = result.stdout.trim();
  if (!token) throw new Error('gcloud retornou token vazio.');
  return token;
}

async function firestoreRequest(relativeUrl, allow404 = false, retryAuth = true) {
  if (!accessToken) accessToken = getAccessToken();
  const response = await fetch(`${apiBase}${relativeUrl}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (response.status === 401 && retryAuth) {
    accessToken = getAccessToken();
    return firestoreRequest(relativeUrl, allow404, false);
  }
  if (allow404 && response.status === 404) return null;
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Firestore REST ${response.status}: ${detail || relativeUrl}`);
  }
  return response.json();
}

function encodeFirestorePath(path) {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

async function getDocument(path) {
  return firestoreRequest(`/documents/${encodeFirestorePath(path)}`, true);
}

async function listDocuments(collectionPath) {
  const documents = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({ pageSize: '300', showMissing: 'false' });
    if (pageToken) query.set('pageToken', pageToken);
    const payload = await firestoreRequest(`/documents/${encodeFirestorePath(collectionPath)}?${query.toString()}`);
    documents.push(...(payload.documents || []));
    pageToken = payload.nextPageToken || '';
  } while (pageToken);
  return documents;
}

function documentId(document) {
  const name = String(document?.name || '');
  const id = name.split('/').pop();
  if (!id) throw new Error(`Documento Firestore sem ID válido: ${name}`);
  return id;
}

function fieldString(document, key) {
  return document?.fields?.[key]?.stringValue || '';
}

async function assertTargetMetadata() {
  const workspace = await getDocument(`workspaces/${migrationPolicy.workspaceId}`);
  if (!workspace) throw new Error(`Workspace ${migrationPolicy.workspaceId} não existe.`);
  if (
    fieldString(workspace, 'id') !== migrationPolicy.workspaceId ||
    fieldString(workspace, 'authorizedEmail') !== migrationPolicy.authorizedEmail ||
    fieldString(workspace, 'status') !== 'active'
  ) {
    throw new Error('Metadados do workspace HGeSM não correspondem ao alvo esperado.');
  }

  const account = await getDocument(`platformAccounts/${migrationPolicy.authorizedEmail}`);
  if (!account) throw new Error(`Conta ${migrationPolicy.authorizedEmail} não existe em platformAccounts.`);
  if (
    fieldString(account, 'email') !== migrationPolicy.authorizedEmail ||
    fieldString(account, 'workspaceId') !== migrationPolicy.workspaceId ||
    fieldString(account, 'accountType') !== 'sector' ||
    fieldString(account, 'status') !== 'active'
  ) {
    throw new Error('Metadados da conta operacional HGeSM não correspondem ao alvo esperado.');
  }
}

function collectionPath(mode, name) {
  return mode === 'legacy' ? name : `workspaces/${migrationPolicy.workspaceId}/${name}`;
}

function settingsPath(mode, id) {
  return mode === 'legacy'
    ? `settings/${id}`
    : `workspaces/${migrationPolicy.workspaceId}/settings/${id}`;
}

async function loadDataset(mode) {
  const rawCollections = {};
  for (const name of migrationPolicy.collections) {
    const documents = await listDocuments(collectionPath(mode, name));
    rawCollections[name] = documents.sort((a, b) => documentId(a).localeCompare(documentId(b)));
  }

  const rawSettings = {};
  for (const id of migrationPolicy.settingsDocuments) {
    rawSettings[id] = await getDocument(settingsPath(mode, id));
  }

  return {
    mode,
    rawCollections,
    rawSettings,
    collections: Object.fromEntries(
      Object.entries(rawCollections).map(([name, documents]) => [
        name,
        documents.map((document) => ({
          _documentId: documentId(document),
          ...decodeFields(document.fields || {}),
        })),
      ]),
    ),
    settings: Object.fromEntries(
      Object.entries(rawSettings).map(([id, document]) => [
        id,
        document ? { _documentId: id, ...decodeFields(document.fields || {}) } : null,
      ]),
    ),
  };
}

function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decodeValue(value)]));
}

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if (Object.hasOwn(value, 'nullValue')) return null;
  if (Object.hasOwn(value, 'booleanValue')) return Boolean(value.booleanValue);
  if (Object.hasOwn(value, 'integerValue')) return Number(value.integerValue);
  if (Object.hasOwn(value, 'doubleValue')) return Number(value.doubleValue);
  if (Object.hasOwn(value, 'timestampValue')) return value.timestampValue;
  if (Object.hasOwn(value, 'stringValue')) return value.stringValue;
  if (Object.hasOwn(value, 'bytesValue')) return value.bytesValue;
  if (Object.hasOwn(value, 'referenceValue')) return value.referenceValue;
  if (Object.hasOwn(value, 'geoPointValue')) return value.geoPointValue;
  if (Object.hasOwn(value, 'arrayValue')) return (value.arrayValue?.values || []).map(decodeValue);
  if (Object.hasOwn(value, 'mapValue')) return decodeFields(value.mapValue?.fields || {});
  return value;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(canonical(value));
}

function rawDatasetView(dataset) {
  const collections = Object.fromEntries(
    Object.entries(dataset.rawCollections).map(([name, docs]) => [
      name,
      docs.map((doc) => ({ id: documentId(doc), fields: doc.fields || {} })),
    ]),
  );
  const settings = Object.fromEntries(
    Object.entries(dataset.rawSettings).map(([id, doc]) => [id, doc ? doc.fields || {} : null]),
  );
  return { collections, settings };
}

function datasetHash(dataset) {
  return createHash('sha256').update(stableJson(rawDatasetView(dataset))).digest('hex');
}

function sameRawFields(left, right) {
  return stableJson(left?.fields || {}) === stableJson(right?.fields || {});
}

function addIssue(issues, severity, code, entity, message) {
  issues.push({ severity, code, entity, message });
}

function auditPhysicalCopy(source, destination, issues) {
  for (const name of migrationPolicy.collections) {
    const left = new Map(source.rawCollections[name].map((doc) => [documentId(doc), doc]));
    const right = new Map(destination.rawCollections[name].map((doc) => [documentId(doc), doc]));
    const missing = [...left.keys()].filter((id) => !right.has(id));
    const extra = [...right.keys()].filter((id) => !left.has(id));
    const different = [...left.keys()].filter((id) => right.has(id) && !sameRawFields(left.get(id), right.get(id)));
    if (missing.length || extra.length || different.length) {
      addIssue(
        issues,
        'ERROR',
        'MIGRATION_COPY_MISMATCH',
        name,
        `faltando=${missing.length}, extras=${extra.length}, diferentes=${different.length}; exemplos=${[...missing, ...extra, ...different].slice(0, 5).join(', ')}`,
      );
    }
  }

  for (const id of migrationPolicy.settingsDocuments) {
    const left = source.rawSettings[id];
    const right = destination.rawSettings[id];
    if ((!left && right) || (left && !right) || (left && right && !sameRawFields(left, right))) {
      addIssue(issues, 'ERROR', 'MIGRATION_SETTING_MISMATCH', `settings/${id}`, 'Documento de configuração diverge entre legado e workspace.');
    }
  }

  if (datasetHash(source) !== datasetHash(destination)) {
    addIssue(issues, 'ERROR', 'MIGRATION_HASH_MISMATCH', 'dataset', 'Hash lógico do workspace diverge do legado.');
  }
}

function auditSemanticIntegrity(dataset, issues) {
  const empenhos = dataset.collections.empenhos || [];
  const invoices = dataset.collections.invoices || [];
  const cronogramas = dataset.collections.cronogramas || [];
  const comissoes = dataset.collections.comissoes || [];
  const alerts = dataset.collections.alerts || [];

  const empenhoById = new Map(empenhos.map((item) => [item._documentId, item]));
  const itemMaps = new Map();
  const receivedFromInvoices = new Map();

  auditEmpenhos(empenhos, itemMaps, issues);
  auditInvoices(invoices, empenhoById, itemMaps, receivedFromInvoices, issues);
  auditReceivedAggregates(empenhos, receivedFromInvoices, issues);
  auditCronogramas(cronogramas, empenhoById, itemMaps, issues);
  auditComissoes(comissoes, issues);
  auditAlerts(alerts, issues);
  auditTermoCounter(invoices, dataset.settings.termoRecebimentoCounter, issues);
}

function auditEmpenhos(empenhos, itemMaps, issues) {
  const validStatuses = new Set(['Ativo', 'Encerrado', 'Sem Movimentação', 'Urgente']);
  const validClassifications = new Set(['QR', 'CALI', 'PASA']);

  for (const empenho of empenhos) {
    const entity = `empenho/${empenho._documentId}`;
    if (!nonEmptyString(empenho.id) || empenho.id !== empenho._documentId) {
      addIssue(issues, 'ERROR', 'DOCUMENT_ID_MISMATCH', entity, `Campo id=${String(empenho.id)} não corresponde ao ID do documento.`);
    }
    if (!nonEmptyString(empenho.supplier)) addIssue(issues, 'ERROR', 'MISSING_SUPPLIER', entity, 'Fornecedor ausente.');
    if (!nonEmptyString(empenho.description)) addIssue(issues, 'WARN', 'MISSING_DESCRIPTION', entity, 'Descrição vazia.');
    if (!validStatuses.has(empenho.status)) addIssue(issues, 'ERROR', 'INVALID_STATUS', entity, `Status inválido: ${String(empenho.status)}.`);
    if (empenho.classification != null && !validClassifications.has(empenho.classification)) {
      addIssue(issues, 'WARN', 'INVALID_CLASSIFICATION', entity, `Classificação incomum: ${String(empenho.classification)}.`);
    }
    if (!Array.isArray(empenho.items)) {
      addIssue(issues, 'ERROR', 'INVALID_ITEMS', entity, 'items não é um array.');
      itemMaps.set(empenho._documentId, new Map());
      continue;
    }

    const items = new Map();
    for (const [index, item] of empenho.items.entries()) {
      const itemEntity = `${entity}/item[${index}]`;
      if (!nonEmptyString(item?.id)) {
        addIssue(issues, 'ERROR', 'MISSING_ITEM_ID', itemEntity, 'Item sem id.');
        continue;
      }
      if (items.has(item.id)) addIssue(issues, 'ERROR', 'DUPLICATE_ITEM_ID', entity, `Item duplicado: ${item.id}.`);
      items.set(item.id, item);
      for (const field of ['quantity', 'unitPrice', 'received']) {
        if (!finiteNonNegative(item?.[field])) {
          addIssue(issues, 'ERROR', 'INVALID_ITEM_NUMBER', `${entity}/item/${item.id}`, `${field} inválido: ${String(item?.[field])}.`);
        }
      }
      if (finiteNumber(item?.received) && finiteNumber(item?.quantity) && item.received > item.quantity + EPSILON) {
        addIssue(issues, 'WARN', 'RECEIVED_EXCEEDS_COMMITTED', `${entity}/item/${item.id}`, `Recebido ${item.received} > empenhado ${item.quantity}.`);
      }
    }
    itemMaps.set(empenho._documentId, items);
  }
}

function auditInvoices(invoices, empenhoById, itemMaps, receivedFromInvoices, issues) {
  const termoOwners = new Map();

  for (const invoice of invoices) {
    const entity = `invoice/${invoice._documentId}`;
    if (!nonEmptyString(invoice.id) || invoice.id !== invoice._documentId) {
      addIssue(issues, 'ERROR', 'DOCUMENT_ID_MISMATCH', entity, `Campo id=${String(invoice.id)} não corresponde ao ID do documento.`);
    }
    if (!nonEmptyString(invoice.empenhoId) || !empenhoById.has(invoice.empenhoId)) {
      addIssue(issues, 'ERROR', 'ORPHAN_INVOICE', entity, `Empenho referenciado não existe: ${String(invoice.empenhoId)}.`);
      continue;
    }

    const empenho = empenhoById.get(invoice.empenhoId);
    const items = itemMaps.get(invoice.empenhoId) || new Map();
    if (nonEmptyString(invoice.supplier) && nonEmptyString(empenho.supplier) && invoice.supplier.trim() !== empenho.supplier.trim()) {
      addIssue(issues, 'WARN', 'SUPPLIER_MISMATCH', entity, `Fornecedor da NF difere do empenho ${invoice.empenhoId}.`);
    }

    if (!Array.isArray(invoice.items)) {
      addIssue(issues, 'ERROR', 'INVALID_INVOICE_ITEMS', entity, 'items não é um array.');
    } else {
      let subtotalSum = 0;
      for (const [index, item] of invoice.items.entries()) {
        const itemEntity = `${entity}/item[${index}]`;
        if (!nonEmptyString(item?.itemId) || !items.has(item.itemId)) {
          addIssue(issues, 'ERROR', 'ORPHAN_INVOICE_ITEM', itemEntity, `Item ${String(item?.itemId)} não existe no empenho ${invoice.empenhoId}.`);
          continue;
        }
        for (const field of ['quantity', 'unitPrice', 'subtotal']) {
          if (!finiteNonNegative(item?.[field])) {
            addIssue(issues, 'ERROR', 'INVALID_INVOICE_NUMBER', itemEntity, `${field} inválido: ${String(item?.[field])}.`);
          }
        }
        if (finiteNumber(item.quantity) && finiteNumber(item.unitPrice) && finiteNumber(item.subtotal)) {
          const expectedSubtotal = item.quantity * item.unitPrice;
          if (!approxEqual(expectedSubtotal, item.subtotal)) {
            addIssue(issues, 'WARN', 'INVOICE_SUBTOTAL_MISMATCH', itemEntity, `subtotal=${item.subtotal}; quantidade×preço=${round2(expectedSubtotal)}.`);
          }
          subtotalSum += item.subtotal;
          const key = `${invoice.empenhoId}\u0000${item.itemId}`;
          receivedFromInvoices.set(key, (receivedFromInvoices.get(key) || 0) + item.quantity);
        }
      }
      if (finiteNumber(invoice.totalValue) && !approxEqual(invoice.totalValue, subtotalSum)) {
        addIssue(issues, 'WARN', 'INVOICE_TOTAL_MISMATCH', entity, `totalValue=${invoice.totalValue}; soma dos itens=${round2(subtotalSum)}.`);
      }
    }

    if (invoice.termoNumero != null) {
      if (!Number.isInteger(invoice.termoNumero) || invoice.termoNumero <= 0) {
        addIssue(issues, 'ERROR', 'INVALID_TERMO_NUMBER', entity, `termoNumero inválido: ${String(invoice.termoNumero)}.`);
      } else if (termoOwners.has(invoice.termoNumero)) {
        addIssue(issues, 'ERROR', 'DUPLICATE_TERMO_NUMBER', entity, `Termo ${invoice.termoNumero} também pertence à NF ${termoOwners.get(invoice.termoNumero)}.`);
      } else {
        termoOwners.set(invoice.termoNumero, invoice._documentId);
      }
      if (!nonEmptyString(invoice.termoEmissaoDate)) {
        addIssue(issues, 'WARN', 'TERMO_WITHOUT_DATE', entity, `Termo ${invoice.termoNumero} sem termoEmissaoDate.`);
      }
    }

    auditInvoicePdf(invoice.notaFiscalPdf, invoice, entity, 'notaFiscalPdf', issues);
    if (Array.isArray(invoice.notaFiscalPdfVersions)) {
      invoice.notaFiscalPdfVersions.forEach((pdf, index) => auditInvoicePdf(pdf, invoice, entity, `notaFiscalPdfVersions[${index}]`, issues));
    }
  }
}

function auditInvoicePdf(pdf, invoice, entity, field, issues) {
  if (!pdf || typeof pdf !== 'object') return;
  if (pdf.empenhoId !== invoice.empenhoId || pdf.invoiceId !== invoice.id) {
    addIssue(issues, 'ERROR', 'PDF_PARENT_MISMATCH', entity, `${field} aponta para empenhoId=${String(pdf.empenhoId)} / invoiceId=${String(pdf.invoiceId)}.`);
  }
}

function auditReceivedAggregates(empenhos, receivedFromInvoices, issues) {
  for (const empenho of empenhos) {
    if (!Array.isArray(empenho.items)) continue;
    for (const item of empenho.items) {
      if (!nonEmptyString(item?.id) || !finiteNumber(item.received)) continue;
      const key = `${empenho._documentId}\u0000${item.id}`;
      const invoiceQuantity = receivedFromInvoices.get(key) || 0;
      if (!approxEqual(item.received, invoiceQuantity)) {
        addIssue(
          issues,
          'WARN',
          'RECEIVED_AGGREGATE_MISMATCH',
          `empenho/${empenho._documentId}/item/${item.id}`,
          `received=${item.received}; soma das NFs=${round2(invoiceQuantity)}.`,
        );
      }
    }
  }
}

function auditCronogramas(cronogramas, empenhoById, itemMaps, issues) {
  for (const cronograma of cronogramas) {
    const entity = `cronograma/${cronograma._documentId}`;
    if (!nonEmptyString(cronograma.id) || cronograma.id !== cronograma._documentId) {
      addIssue(issues, 'ERROR', 'DOCUMENT_ID_MISMATCH', entity, `Campo id=${String(cronograma.id)} não corresponde ao ID do documento.`);
    }
    if (!nonEmptyString(cronograma.empenhoId) || !empenhoById.has(cronograma.empenhoId)) {
      addIssue(issues, 'ERROR', 'ORPHAN_SCHEDULE', entity, `Empenho referenciado não existe: ${String(cronograma.empenhoId)}.`);
      continue;
    }

    const columns = Array.isArray(cronograma.colunasEntregas) ? cronograma.colunasEntregas : [];
    if (!Array.isArray(cronograma.colunasEntregas)) addIssue(issues, 'ERROR', 'INVALID_SCHEDULE_COLUMNS', entity, 'colunasEntregas não é um array.');
    const columnIds = new Set();
    for (const column of columns) {
      if (!nonEmptyString(column?.id)) {
        addIssue(issues, 'ERROR', 'MISSING_SCHEDULE_COLUMN_ID', entity, 'Coluna de entrega sem id.');
        continue;
      }
      if (columnIds.has(column.id)) addIssue(issues, 'ERROR', 'DUPLICATE_SCHEDULE_COLUMN', entity, `Coluna duplicada: ${column.id}.`);
      columnIds.add(column.id);
      if (!validDateString(column.dataPrevista)) addIssue(issues, 'WARN', 'INVALID_SCHEDULE_DATE', entity, `Data prevista incomum na coluna ${column.id}: ${String(column.dataPrevista)}.`);
    }

    const items = itemMaps.get(cronograma.empenhoId) || new Map();
    const distribution = cronograma.distribuicao && typeof cronograma.distribuicao === 'object' ? cronograma.distribuicao : {};
    if (!cronograma.distribuicao || typeof cronograma.distribuicao !== 'object') addIssue(issues, 'ERROR', 'INVALID_SCHEDULE_DISTRIBUTION', entity, 'distribuicao inválida.');

    for (const [itemId, perColumn] of Object.entries(distribution)) {
      if (!items.has(itemId)) {
        addIssue(issues, 'ERROR', 'ORPHAN_SCHEDULE_ITEM', entity, `Distribuição referencia item inexistente ${itemId} no empenho ${cronograma.empenhoId}.`);
        continue;
      }
      let scheduled = 0;
      for (const [columnId, quantity] of Object.entries(perColumn || {})) {
        if (!columnIds.has(columnId)) addIssue(issues, 'ERROR', 'ORPHAN_SCHEDULE_COLUMN', entity, `Distribuição do item ${itemId} referencia coluna inexistente ${columnId}.`);
        if (!finiteNonNegative(quantity)) addIssue(issues, 'ERROR', 'INVALID_SCHEDULE_QUANTITY', entity, `Quantidade inválida para ${itemId}/${columnId}: ${String(quantity)}.`);
        else scheduled += quantity;
      }
      const committed = items.get(itemId)?.quantity;
      if (finiteNumber(committed) && scheduled > committed + EPSILON) {
        addIssue(issues, 'WARN', 'SCHEDULE_EXCEEDS_COMMITTED', entity, `Item ${itemId}: programado=${round2(scheduled)} > empenhado=${committed}.`);
      }
    }
  }
}

function auditComissoes(comissoes, issues) {
  const byMonth = new Map();
  for (const comissao of comissoes) {
    const entity = `comissao/${comissao._documentId}`;
    if (!nonEmptyString(comissao.id) || comissao.id !== comissao._documentId) {
      addIssue(issues, 'ERROR', 'DOCUMENT_ID_MISMATCH', entity, `Campo id=${String(comissao.id)} não corresponde ao ID do documento.`);
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(comissao.mesReferencia || ''))) {
      addIssue(issues, 'ERROR', 'INVALID_COMMISSION_MONTH', entity, `mesReferencia inválido: ${String(comissao.mesReferencia)}.`);
    } else if (byMonth.has(comissao.mesReferencia)) {
      addIssue(issues, 'ERROR', 'DUPLICATE_COMMISSION_MONTH', entity, `Já existe comissão para ${comissao.mesReferencia}: ${byMonth.get(comissao.mesReferencia)}.`);
    } else {
      byMonth.set(comissao.mesReferencia, comissao._documentId);
    }
    if (!comissao.presidente || !nonEmptyString(comissao.presidente.nomeCompleto)) addIssue(issues, 'WARN', 'INVALID_COMMISSION_PRESIDENT', entity, 'Presidente ausente/incompleto.');
    if (!Array.isArray(comissao.auxiliares) || comissao.auxiliares.length !== 3) {
      addIssue(issues, 'WARN', 'UNUSUAL_COMMISSION_AUXILIARIES', entity, `Quantidade de auxiliares=${Array.isArray(comissao.auxiliares) ? comissao.auxiliares.length : 'inválida'}; esperado=3.`);
    }
  }
}

function auditAlerts(alerts, issues) {
  const validTypes = new Set(['CRÍTICO', 'ATENÇÃO', 'ESTOQUE ZERADO']);
  for (const alert of alerts) {
    const entity = `alert/${alert._documentId}`;
    if (!nonEmptyString(alert.id) || alert.id !== alert._documentId) {
      addIssue(issues, 'ERROR', 'DOCUMENT_ID_MISMATCH', entity, `Campo id=${String(alert.id)} não corresponde ao ID do documento.`);
    }
    if (!validTypes.has(alert.type)) addIssue(issues, 'ERROR', 'INVALID_ALERT_TYPE', entity, `Tipo inválido: ${String(alert.type)}.`);
  }
}

function auditTermoCounter(invoices, counter, issues) {
  const numbers = invoices.map((invoice) => invoice.termoNumero).filter((value) => Number.isInteger(value) && value > 0);
  const maxNumber = numbers.length ? Math.max(...numbers) : 0;
  if (!counter) {
    if (maxNumber > 0) addIssue(issues, 'ERROR', 'MISSING_TERMO_COUNTER', 'settings/termoRecebimentoCounter', `Contador ausente, mas existem termos até ${maxNumber}.`);
    return;
  }
  const current = counter.currentNumber;
  if (!Number.isInteger(current) || current < 0) {
    addIssue(issues, 'ERROR', 'INVALID_TERMO_COUNTER', 'settings/termoRecebimentoCounter', `currentNumber inválido: ${String(current)}.`);
    return;
  }
  if (current < maxNumber) {
    addIssue(issues, 'ERROR', 'TERMO_COUNTER_BEHIND', 'settings/termoRecebimentoCounter', `currentNumber=${current} < maior termo atribuído=${maxNumber}.`);
  }
}

function printDatasetSummary(source, destination) {
  console.log('Cópia física');
  for (const name of migrationPolicy.collections) {
    console.log(`  ${name.padEnd(12)} legado=${String(source.rawCollections[name].length).padStart(3)} | workspace=${String(destination.rawCollections[name].length).padStart(3)}`);
  }
  for (const id of migrationPolicy.settingsDocuments) {
    console.log(`  settings/${id}: legado=${source.rawSettings[id] ? 1 : 0} | workspace=${destination.rawSettings[id] ? 1 : 0}`);
  }
}

function printIssues(issues) {
  if (issues.length === 0) {
    console.log('\nNenhuma inconsistência estrutural ou semântica encontrada.');
    return;
  }
  console.log('\nAchados');
  for (const issue of issues) {
    console.log(`  [${issue.severity}] ${issue.code} | ${issue.entity} | ${issue.message}`);
  }
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function finiteNonNegative(value) {
  return finiteNumber(value) && value >= 0;
}

function approxEqual(left, right) {
  return Math.abs(left - right) <= EPSILON;
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function validDateString(value) {
  if (!nonEmptyString(value)) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}
