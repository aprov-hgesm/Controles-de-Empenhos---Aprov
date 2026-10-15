#!/usr/bin/env node
/**
 * EMPROVEX — saneamento pontual do saldo legado de TESTES (Suco, 5 unidades).
 * Dry-run por padrão. --apply: commit atômico de 3 documentos, SOMENTE após
 * precondições reais e backup local. Não remove NFs, produtos nem históricos.
 * Execução pelo PowerShell do fundador, com gcloud autenticado.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT = 'gen-lang-client-0982077967';
const DATABASE = 'emprovex-warehouse';
const WORKSPACE = 'hgesm-aprov';
const MATERIAL = 'mat_272f2d996ee65ed3530ad2d7e27b66d7';
const QUANTITY = 5;
const EPS = 0.000001;
const REPAIR_KEY = 'WAREHOUSE-SUCO-LEGACY-UNASSIGNED-CLOSE-2026-10-15-01';
const HASH = createHash('sha256').update(WORKSPACE + '\n' + REPAIR_KEY).digest('hex');
const MOVEMENT = 'mov_' + HASH;
const BASE = 'warehouse/' + WORKSPACE;
const ROOT = 'https://firestore.googleapis.com/v1/projects/' + PROJECT +
  '/databases/' + DATABASE + '/documents';
const flags = process.argv.slice(2);
if (flags.some((flag) => flag !== '--apply') || flags.length > 1) {
  console.error('Uso: node scripts/warehouse-suco-legacy-cleanup.mjs [--apply]');
  process.exit(2);
}
const APPLY = flags.includes('--apply');
const S = (v) => ({ stringValue: String(v) });
const I = (v) => ({ integerValue: String(v) });
const N = { nullValue: null };
const eq = (a, b) => Number.isFinite(a) && Math.abs(a - b) <= EPS;

function gcloudRun(command, args) {
  if (process.platform === 'win32') {
    const quoted = [command, ...args].map((x) => '"' + String(x).replace(/"/g, '""') + '"');
    return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', quoted.join(' ')], { encoding: 'utf8' });
  }
  return spawnSync(command, args, { encoding: 'utf8' });
}

function authToken() {
  const given = process.env.WAREHOUSE_AUDIT_ACCESS_TOKEN?.trim();
  if (given) return given;
  const local = process.env.LOCALAPPDATA;
  const candidates = [
    process.env.GCLOUD_CMD,
    local && join(local, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd'),
    process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud',
    'gcloud',
  ].filter(Boolean);
  for (const candidate of new Set(candidates)) {
    const result = gcloudRun(candidate, ['auth', 'print-access-token']);
    if (!result.error && result.status === 0 && result.stdout.trim()) {
      return result.stdout.trim();
    }
  }
  throw new Error('Sem autenticação administrativa. Autentique o gcloud; nenhum dado foi alterado.');
}

function unpack(v) {
  if (!v || typeof v !== 'object') return null;
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return Boolean(v.booleanValue);
  if ('mapValue' in v) return Object.fromEntries(
    Object.entries(v.mapValue?.fields || {}).map(([k, x]) => [k, unpack(x)])
  );
  return null;
}
const f = (doc, field) => unpack(doc?.fields?.[field]);

async function main() {
  const token = authToken();
  async function request(suffix, method = 'GET', body, allow404 = false) {
    const resp = await fetch(ROOT + suffix, {
      method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (allow404 && resp.status === 404) return null;
    const raw = await resp.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error('Resposta Firestore inválida.'); }
    if (!resp.ok) {
      throw new Error('Firestore HTTP ' + resp.status + ': ' + (data.error?.message || 'falha'));
    }
    return data;
  }
  const get = (collection, id) => request('/' + BASE + '/' + collection + '/' + id, 'GET', undefined, true);
  async function byMaterial(collection) {
    const response = await request('/' + BASE + ':runQuery', 'POST', {
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: { fieldFilter: { field: { fieldPath: 'materialId' },
          op: 'EQUAL', value: S(MATERIAL) } },
        limit: 1000,
      },
    });
    if (!Array.isArray(response)) throw new Error('Consulta inesperada: ' + collection);
    const docs = response.filter((item) => item.document).map((item) => item.document);
    if (docs.length >= 1000) throw new Error('Limite de consulta atingido: ' + collection);
    return docs;
  }

  const [material, balance, positions, lots, movements, previousRepair] = await Promise.all([
    get('materials', MATERIAL), get('balances', MATERIAL),
    byMaterial('locationBalances'), byMaterial('lots'), byMaterial('movements'),
    get('movements', MOVEMENT),
  ]);
  if (!material || !balance) throw new Error('Material/saldo não encontrado. STOP.');
  if (!String(f(material, 'description') || '').toUpperCase().includes('SUCO')) {
    throw new Error('Identidade do material diverge de Suco. STOP.');
  }
  const ug = f(material, 'ug');
  if (!/^\d{6}$/.test(String(ug)) || f(material, 'workspaceId') !== WORKSPACE ||
      f(balance, 'workspaceId') !== WORKSPACE || f(balance, 'ug') !== ug) {
    throw new Error('Escopo do workspace/UG não confere. STOP.');
  }
  const positiveUnassigned = positions.filter((d) =>
    f(d, 'position')?.kind === 'UNASSIGNED' && f(d, 'quantity') > EPS);
  const positivePhysical = positions.filter((d) =>
    f(d, 'position')?.kind !== 'UNASSIGNED' && f(d, 'quantity') > EPS);
  const positiveLots = lots.filter((d) => f(d, 'status') === 'active' && f(d, 'quantity') > EPS);
  const total = f(balance, 'quantity');
  const ledger = movements.reduce((sum, d) => sum + Number(f(d, 'quantityDelta') || 0), 0);

  console.log('\nEMPROVEX — CONFERÊNCIA DO SALDO DE TESTE');
  console.log('Projeto/banco/workspace: ' + PROJECT + ' / ' + DATABASE + ' / ' + WORKSPACE);
  console.log('Material: ' + f(material, 'description') + ' (' + MATERIAL + ')');
  console.log('Saldo agregado: ' + total + ' | Ledger: ' + ledger);
  console.log('Posições físicas positivas: ' + positivePhysical.length);
  console.log('UNASSIGNED positivos: ' + positiveUnassigned.map((d) => f(d, 'quantity')).join(', '));
  console.log('Lotes ativos com quantidade positiva: ' + positiveLots.length);

  if (previousRepair) {
    if (eq(total, 0) && eq(ledger, 0) && positiveUnassigned.length === 0) {
      console.log('JÁ REGULARIZADO — nada a fazer.');
      return;
    }
    throw new Error('Já existe movimento de reparo, mas dados divergentes. STOP.');
  }
  if (!eq(total, QUANTITY) || !eq(ledger, QUANTITY) ||
      positiveUnassigned.length !== 1 || !eq(f(positiveUnassigned[0], 'quantity'), QUANTITY) ||
      positivePhysical.length !== 0 || positiveLots.length !== 0) {
    throw new Error('PRECONDIÇÕES NÃO ATENDIDAS. Nenhum dado alterado; exige análise antes de prosseguir.');
  }
  const legacy = positiveUnassigned[0];
  if (!balance.updateTime || !legacy.updateTime ||
      !Number.isSafeInteger(f(balance, 'revision')) ||
      !Number.isSafeInteger(f(legacy, 'revision'))) {
    throw new Error('Revisões ou precondições ausentes. STOP.');
  }

  const backup = join(homedir(), 'EMPROVEX-suco-backup-' +
    new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  writeFileSync(backup, JSON.stringify({
    target: { PROJECT, DATABASE, WORKSPACE, MATERIAL, MOVEMENT },
    material, balance, positions, lots, movements,
  }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log('Backup local dos registros: ' + backup);
  if (!APPLY) {
    console.log('DRY-RUN PASS — somente leitura; nada foi alterado.');
    return;
  }

  const update = (doc, fields) => ({
    update: { name: doc.name, fields },
    updateMask: { fieldPaths: Object.keys(fields) },
    currentDocument: { updateTime: doc.updateTime },
  });
  const movement = {
    name: ROOT.replace('https://firestore.googleapis.com/v1/', '') + '/' + BASE + '/movements/' + MOVEMENT,
    fields: {
      schemaVersion: S('warehouse_movement_v1'),
      workspaceId: S(WORKSPACE), ug: S(ug), materialId: S(MATERIAL),
      type: S('INVENTORY_ADJUSTMENT'), quantityDelta: I(-QUANTITY),
      idempotencyKeyHash: S(HASH), reversesMovementId: N,
      note: S('Regularização do saldo legado de testes sem localização: 5 unidades de Suco, autorizada pelo fundador em 2026-10-15, sem saída física.'),
      source: N,
      createdAt: { timestampValue: new Date().toISOString() },
    },
  };
  const writes = [
    update(balance, { quantity: I(0), revision: I(f(balance, 'revision') + 1),
      lastMovementId: S(MOVEMENT) }),
    update(legacy, { quantity: I(0), revision: I(f(legacy, 'revision') + 1),
      lastMovementId: S(MOVEMENT) }),
    { update: movement, currentDocument: { exists: false } },
  ];
  console.log('APLICANDO: somente saldo geral + UNASSIGNED + 1 movimento de ajuste...');
  await request(':commit', 'POST', { writes });
  const [newBalance, newLegacy, newMovement] = await Promise.all([
    get('balances', MATERIAL), get('locationBalances', legacy.name.split('/').at(-1)),
    get('movements', MOVEMENT),
  ]);
  if (!newMovement || !eq(f(newBalance, 'quantity'), 0) ||
      !eq(f(newLegacy, 'quantity'), 0) || f(newBalance, 'lastMovementId') !== MOVEMENT) {
    throw new Error('Commit respondeu, mas verificação falhou; NÃO repita antes de investigar.');
  }
  console.log('PASS — Suco zerado; histórico preservado. Movimento: ' + MOVEMENT);
}

main().catch((error) => {
  console.error('STOP: ' + error.message);
  process.exitCode = 1;
});
