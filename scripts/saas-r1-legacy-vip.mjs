#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recoveryPolicy = JSON.parse(
  readFileSync(resolve(root, 'ops/firestore-recovery.json'), 'utf8')
);
const policy = JSON.parse(
  readFileSync(resolve(root, 'ops/saas-r1-legacy-vip.json'), 'utf8')
);
const databasePolicy = recoveryPolicy.databases.find(
  (item) => item.role === policy.databaseRole
);

if (!databasePolicy) {
  throw new Error('Banco principal não foi localizado pela role da migração VIP legado.');
}

const command = process.argv[2] || 'plan';
const flags = parseFlags(process.argv.slice(3));
const apiBase =
  `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(recoveryPolicy.projectId)}` +
  `/databases/${encodeURIComponent(databasePolicy.id)}`;
let accessToken = '';

main().catch((error) => {
  console.error(`\nERRO: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  switch (command) {
    case 'plan':
      printPlan();
      return;
    case 'status': {
      ensureGcloud();
      const inventory = await inspectInventory();
      printInventory(inventory);
      return;
    }
    case 'dry-run': {
      ensureGcloud();
      const inventory = await inspectInventory();
      const selected = resolveSelection(inventory, { requireExplicit: false });
      printInventory(inventory);
      printSelection(selected, 'DRY-RUN');
      return;
    }
    case 'apply': {
      ensureGcloud();
      const inventory = await inspectInventory();
      const selected = resolveSelection(inventory, { requireExplicit: true });
      ensureApplyConfirmation(selected);
      await applyMigration(selected, inventory);
      return;
    }
    case 'verify': {
      ensureGcloud();
      const inventory = await inspectInventory();
      const selected = resolveSelection(inventory, { requireExplicit: true });
      const report = await verifyMigration(selected);
      printVerification(report);
      if (!report.every((item) => item.ready)) process.exitCode = 2;
      return;
    }
    default:
      throw new Error('Comando desconhecido. Use plan, status, dry-run, apply ou verify.');
  }
}

function parseFlags(args) {
  return Object.fromEntries(args.map((arg) => {
    const [key, ...value] = arg.replace(/^--/, '').split('=');
    return [key, value.join('=')];
  }));
}

function printPlan() {
  console.log('SAAS-I — Migração VIP legado (nenhuma alteração executada)\n');
  console.log(`Projeto:          ${recoveryPolicy.projectId}`);
  console.log(`Banco:            ${databasePolicy.id}`);
  console.log(`Corte comercial:  ${policy.cutoffDate} (${policy.timezone})`);
  console.log(`Corte técnico:     ${policy.cutoffInstant}`);
  console.log(`Founder excluído:  ${policy.founderWorkspaceId}`);
  console.log('Destino:           billingAccounts.status = exempt');
  console.log('Preço:             R$ 0,00');
  console.log('Fonte:             exemptionSource = legacy_vip');
  console.log('\nGarantias:');
  console.log('  - apply exige allowlist explícita de workspace IDs;');
  console.log('  - workspace com createdAt posterior ao corte é recusado;');
  console.log('  - createdAt ausente/inválido nunca é classificado automaticamente;');
  console.log('  - founder nunca entra na coorte;');
  console.log('  - billingCycles não são lidos, reprecificados ou apagados;');
  console.log('  - Auth, UID, e-mail, UG, lifecycle e dados operacionais não são alterados;');
  console.log('  - cada workspace usa commit atômico billing + auditoria;');
  console.log('  - auditoria usa ID determinístico, permitindo reexecução segura.');
  console.log('\nComandos:');
  console.log('  node scripts/saas-r1-legacy-vip.mjs status');
  console.log('  node scripts/saas-r1-legacy-vip.mjs dry-run --workspaces=id-a,id-b');
  console.log('  node scripts/saas-r1-legacy-vip.mjs apply --workspaces=id-a,id-b --actor=admin@exemplo --confirm=VIP-LEGACY:2026-10-02:2');
  console.log('  node scripts/saas-r1-legacy-vip.mjs verify --workspaces=id-a,id-b');
}

function ensureGcloud() {
  const check = spawnSync('gcloud', ['--version'], { encoding: 'utf8' });
  if (check.error?.code === 'ENOENT') {
    throw new Error('Google Cloud CLI não encontrado. Execute status/apply/verify no Cloud Shell autorizado.');
  }
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

async function firestoreRequest(relativeUrl, options = {}, allow404 = false, retryAuth = true) {
  if (!accessToken) accessToken = getAccessToken();
  const response = await fetch(`${apiBase}${relativeUrl}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (response.status === 401 && retryAuth) {
    accessToken = getAccessToken();
    return firestoreRequest(relativeUrl, options, allow404, false);
  }
  if (allow404 && response.status === 404) return null;
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Firestore REST ${response.status}: ${detail || relativeUrl}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function encodePath(path) {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function documentName(path) {
  return `projects/${recoveryPolicy.projectId}/databases/${databasePolicy.id}/documents/${path}`;
}

async function getDocument(path) {
  return firestoreRequest(`/v1/${documentName(encodePath(path))}`, {}, true);
}

async function listDocuments(collectionPath) {
  const documents = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({ pageSize: '300', showMissing: 'false' });
    if (pageToken) query.set('pageToken', pageToken);
    const payload = await firestoreRequest(
      `/v1/${documentName(encodePath(collectionPath))}?${query.toString()}`
    );
    documents.push(...(payload.documents || []));
    pageToken = payload.nextPageToken || '';
  } while (pageToken);
  return documents;
}

function docId(document) {
  const name = String(document?.name || '');
  const id = name.split('/').pop();
  if (!id) throw new Error(`Documento Firestore sem ID: ${name}`);
  return id;
}

function stringField(document, key) {
  return document?.fields?.[key]?.stringValue || '';
}

function boolField(document, key) {
  return document?.fields?.[key]?.booleanValue === true;
}

function integerField(document, key) {
  const raw = document?.fields?.[key]?.integerValue;
  return raw === undefined ? null : Number(raw);
}

function validDate(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

async function inspectInventory() {
  const [workspaces, accounts] = await Promise.all([
    listDocuments('workspaces'),
    listDocuments('platformAccounts'),
  ]);
  const accountByEmail = new Map(accounts.map((document) => [
    stringField(document, 'email').toLowerCase(),
    document,
  ]));
  const cutoffMs = Date.parse(policy.cutoffInstant);
  const candidates = [];
  const unresolved = [];
  const excluded = [];

  for (const workspace of workspaces) {
    const workspaceId = stringField(workspace, 'id') || docId(workspace);
    if (workspaceId === policy.founderWorkspaceId) {
      excluded.push({ workspaceId, reason: 'founder' });
      continue;
    }

    const authorizedEmail = stringField(workspace, 'authorizedEmail').toLowerCase();
    const account = accountByEmail.get(authorizedEmail);
    const createdAt = stringField(workspace, 'createdAt');
    const createdAtMs = validDate(createdAt);
    const identityValid = Boolean(
      authorizedEmail
      && account
      && stringField(account, 'accountType') === 'sector'
      && stringField(account, 'workspaceId') === workspaceId
    );

    if (!identityValid) {
      unresolved.push({ workspaceId, createdAt, reason: 'identidade externa inconsistente' });
      continue;
    }

    if (createdAtMs === null) {
      unresolved.push({ workspaceId, createdAt, reason: 'createdAt ausente ou inválido' });
      continue;
    }

    if (createdAtMs <= cutoffMs) {
      candidates.push({ workspaceId, createdAt, authorizedEmail });
    } else {
      excluded.push({ workspaceId, createdAt, reason: 'criado após o corte' });
    }
  }

  candidates.sort((a, b) => a.workspaceId.localeCompare(b.workspaceId));
  unresolved.sort((a, b) => a.workspaceId.localeCompare(b.workspaceId));
  excluded.sort((a, b) => a.workspaceId.localeCompare(b.workspaceId));

  return { workspaces, accountByEmail, candidates, unresolved, excluded };
}

function printInventory(inventory) {
  console.log(`\nCandidatos automáticos: ${inventory.candidates.length}`);
  for (const item of inventory.candidates) {
    console.log(`  + ${item.workspaceId} | ${item.createdAt} | ${item.authorizedEmail}`);
  }

  console.log(`\nNão resolvidos automaticamente: ${inventory.unresolved.length}`);
  for (const item of inventory.unresolved) {
    console.log(`  ? ${item.workspaceId} | ${item.createdAt || 'sem createdAt'} | ${item.reason}`);
  }

  console.log(`\nExcluídos: ${inventory.excluded.length}`);
  for (const item of inventory.excluded) {
    console.log(`  - ${item.workspaceId} | ${item.reason}`);
  }

  if (inventory.unresolved.length > 0) {
    console.log('\nA seleção final da coorte deve permanecer explícita; nenhum não resolvido será incluído automaticamente.');
  }
}

function parseWorkspaceIds() {
  return Array.from(new Set(
    String(flags.workspaces || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  )).sort();
}

function resolveSelection(inventory, { requireExplicit }) {
  const explicit = parseWorkspaceIds();

  if (requireExplicit && explicit.length === 0) {
    throw new Error('Esta operação exige --workspaces=id-a,id-b com a coorte congelada explicitamente.');
  }

  const ids = explicit.length > 0
    ? explicit
    : inventory.candidates.map((item) => item.workspaceId);

  if (ids.includes(policy.founderWorkspaceId)) {
    throw new Error('O workspace fundador não pode entrar na migração VIP legado externa.');
  }

  const workspaceById = new Map(inventory.workspaces.map((document) => [
    stringField(document, 'id') || docId(document),
    document,
  ]));
  const selected = [];
  const cutoffMs = Date.parse(policy.cutoffInstant);

  for (const workspaceId of ids) {
    const workspace = workspaceById.get(workspaceId);
    if (!workspace) throw new Error(`Workspace não localizado: ${workspaceId}`);

    const createdAt = stringField(workspace, 'createdAt');
    const createdAtMs = validDate(createdAt);
    if (createdAtMs !== null && createdAtMs > cutoffMs) {
      throw new Error(`Workspace ${workspaceId} possui createdAt posterior ao corte: ${createdAt}`);
    }

    const authorizedEmail = stringField(workspace, 'authorizedEmail').toLowerCase();
    const account = inventory.accountByEmail.get(authorizedEmail);
    if (
      !account
      || stringField(account, 'accountType') !== 'sector'
      || stringField(account, 'workspaceId') !== workspaceId
    ) {
      throw new Error(`Workspace ${workspaceId} não possui platformAccount externo coerente.`);
    }

    const ug = stringField(workspace, 'ug');
    if (!/^\d{6}$/.test(ug)) {
      throw new Error(`Workspace ${workspaceId} não possui UG válida para materializar billing.`);
    }

    selected.push({ workspaceId, workspace, createdAt, authorizedEmail, ug });
  }

  return selected;
}

function printSelection(selected, title) {
  console.log(`\n${title}: ${selected.length} workspace(s)`);
  for (const item of selected) {
    console.log(`  * ${item.workspaceId} | ${item.createdAt || 'seleção explícita sem timestamp confiável'}`);
  }
  console.log('\nNenhuma escrita foi executada.');
}

function ensureApplyConfirmation(selected) {
  const actor = String(flags.actor || '').trim().toLowerCase();
  if (!actor || !actor.includes('@')) {
    throw new Error('Informe --actor=<email administrativo> para a auditoria.');
  }

  const expected = `VIP-LEGACY:${policy.cutoffDate}:${selected.length}`;
  if (flags.confirm !== expected) {
    throw new Error(`Apply bloqueado. Confirmação literal exigida: --confirm=${expected}`);
  }
}

function billingFields(item, existing, actor, now) {
  if (existing) {
    return {
      ...(existing.fields || {}),
      status: { stringValue: policy.billingAccountStatus },
      monthlyPriceCents: { integerValue: String(policy.monthlyPriceCents) },
      paymentRequired: { booleanValue: false },
      exemptionSource: { stringValue: policy.exemptionSource },
      legacyVipCutoff: { stringValue: policy.cutoffDate },
      updatedAt: { stringValue: now },
      updatedBy: { stringValue: actor },
    };
  }

  return {
    version: { stringValue: 'emprovex_billing_v1' },
    workspaceId: { stringValue: item.workspaceId },
    ug: { stringValue: item.ug },
    authorizedEmail: { stringValue: item.authorizedEmail },
    status: { stringValue: policy.billingAccountStatus },
    monthlyPriceCents: { integerValue: String(policy.monthlyPriceCents) },
    currency: { stringValue: 'BRL' },
    trialGranted: { booleanValue: false },
    trialStartedAt: { stringValue: '' },
    trialEndsAt: { stringValue: '' },
    paymentRequired: { booleanValue: false },
    exemptionSource: { stringValue: policy.exemptionSource },
    legacyVipCutoff: { stringValue: policy.cutoffDate },
    createdAt: { stringValue: now },
    updatedAt: { stringValue: now },
    createdBy: { stringValue: actor },
    updatedBy: { stringValue: actor },
  };
}

function auditFields(item, existingBilling, actor, now, eventId) {
  return {
    eventVersion: { stringValue: 'emprovex_audit_v1' },
    eventId: { stringValue: eventId },
    workspaceId: { stringValue: item.workspaceId },
    ug: { stringValue: item.ug },
    operation: { stringValue: 'billing.status_change' },
    source: { stringValue: 'migration' },
    entityType: { stringValue: 'billing_account' },
    entityId: { stringValue: item.workspaceId },
    correlationId: { stringValue: eventId },
    actorUid: { stringValue: 'gcloud-admin-migration' },
    actorEmail: { stringValue: actor },
    before: {
      mapValue: {
        fields: {
          status: { stringValue: stringField(existingBilling, 'status') || 'missing' },
          monthlyPriceCents: {
            integerValue: String(integerField(existingBilling, 'monthlyPriceCents') ?? 0),
          },
          exemptionSource: {
            stringValue: stringField(existingBilling, 'exemptionSource') || '',
          },
        },
      },
    },
    after: {
      mapValue: {
        fields: {
          status: { stringValue: policy.billingAccountStatus },
          monthlyPriceCents: { integerValue: String(policy.monthlyPriceCents) },
          exemptionSource: { stringValue: policy.exemptionSource },
          legacyVipCutoff: { stringValue: policy.cutoffDate },
        },
      },
    },
    metadata: {
      mapValue: {
        fields: {
          migrationId: { stringValue: policy.migrationId },
          cutoffDate: { stringValue: policy.cutoffDate },
          permanentWorkspaceExemption: { booleanValue: true },
        },
      },
    },
    createdAt: { timestampValue: now },
  };
}

function migrationEventId(workspaceId) {
  return `${policy.migrationId}__${workspaceId}`;
}

async function applyMigration(selected) {
  const actor = String(flags.actor).trim().toLowerCase();

  for (const item of selected) {
    const billingPath = `billingAccounts/${item.workspaceId}`;
    const eventId = migrationEventId(item.workspaceId);
    const auditPath = `platformAuditEvents/${eventId}`;
    const [billing, audit] = await Promise.all([
      getDocument(billingPath),
      getDocument(auditPath),
    ]);

    const alreadyReady = Boolean(
      billing
      && stringField(billing, 'status') === policy.billingAccountStatus
      && integerField(billing, 'monthlyPriceCents') === policy.monthlyPriceCents
      && boolField(billing, 'paymentRequired') === false
      && stringField(billing, 'exemptionSource') === policy.exemptionSource
      && stringField(billing, 'legacyVipCutoff') === policy.cutoffDate
    );

    if (alreadyReady && audit) {
      console.log(`SKIP ${item.workspaceId}: migração já aplicada e auditada.`);
      continue;
    }

    const now = new Date().toISOString();
    const writes = [];

    if (!alreadyReady) {
      writes.push({
        update: {
          name: documentName(billingPath),
          fields: billingFields(item, billing, actor, now),
        },
        currentDocument: billing?.updateTime
          ? { updateTime: billing.updateTime }
          : { exists: false },
      });
    }

    if (!audit) {
      writes.push({
        update: {
          name: documentName(auditPath),
          fields: auditFields(item, billing, actor, now, eventId),
        },
        currentDocument: { exists: false },
      });
    }

    if (writes.length === 0) continue;

    await firestoreRequest('/v1/' + `projects/${recoveryPolicy.projectId}/databases/${databasePolicy.id}/documents:commit`, {
      method: 'POST',
      body: JSON.stringify({ writes }),
    });

    console.log(`APPLIED ${item.workspaceId}: exempt / R$ 0,00 / legacy_vip`);
  }
}

async function verifyMigration(selected) {
  const report = [];
  for (const item of selected) {
    const eventId = migrationEventId(item.workspaceId);
    const [billing, audit] = await Promise.all([
      getDocument(`billingAccounts/${item.workspaceId}`),
      getDocument(`platformAuditEvents/${eventId}`),
    ]);
    report.push({
      workspaceId: item.workspaceId,
      ready: Boolean(
        billing
        && audit
        && stringField(billing, 'status') === policy.billingAccountStatus
        && integerField(billing, 'monthlyPriceCents') === policy.monthlyPriceCents
        && boolField(billing, 'paymentRequired') === false
        && stringField(billing, 'exemptionSource') === policy.exemptionSource
        && stringField(billing, 'legacyVipCutoff') === policy.cutoffDate
        && stringField(audit, 'entityId') === item.workspaceId
      ),
    });
  }
  return report;
}

function printVerification(report) {
  console.log('\nVerificação VIP legado');
  for (const item of report) {
    console.log(`  ${item.ready ? 'READY' : 'BLOCKED'} ${item.workspaceId}`);
  }
}
