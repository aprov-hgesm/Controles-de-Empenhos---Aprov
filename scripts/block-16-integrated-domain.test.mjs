#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();

function transpile(path) {
  const source = readFileSync(resolve(root, path), 'utf8');
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: path,
  }).outputText;
}

const sandboxProcess = { env: {} };
const context = vm.createContext({
  console,
  Date,
  Math,
  JSON,
  Number,
  String,
  Boolean,
  Object,
  Array,
  Set,
  Map,
  Promise,
  Error,
  TypeError,
  URL,
  URLSearchParams,
  TextEncoder,
  TextDecoder,
  process: sandboxProcess,
  fetch: async () => {
    throw new Error('Acesso externo não mockado no teste do Bloco 16.8.');
  },
});

async function synthetic(identifier, exports) {
  const module = new vm.SyntheticModule(
    Object.keys(exports),
    function init() {
      for (const [key, value] of Object.entries(exports)) {
        this.setExport(key, value);
      }
    },
    { context, identifier }
  );
  await module.link(() => {
    throw new Error(`Módulo sintético ${identifier} não deve importar dependências.`);
  });
  await module.evaluate();
  return module;
}

function compiled(identifier, path) {
  return new vm.SourceTextModule(transpile(path), {
    context,
    identifier,
  });
}

const hgesm = await synthetic('file:///lib/hgesmWorkspace.js', {
  HGESM_SECTOR_EMAIL: ['aprov1hgesm', 'gmail.com'].join('@'),
});

const identity = await synthetic('file:///lib/platformIdentity.js', {
  normalizePlatformEmail: (value) => String(value || '').trim().toLowerCase(),
  normalizeUnitUg: (value) => String(value || '').replace(/\D/g, ''),
  normalizeWorkspaceId: (value) => String(value || '').trim().toLowerCase(),
  isValidUnitUg: (value) => /^\d{6}$/.test(String(value || '')),
  isValidWorkspaceId: (value) => /^[a-z0-9][a-z0-9-]{2,63}$/.test(String(value || '')),
});

const capacityModule = compiled('file:///lib/platformCapacity.js', 'lib/platformCapacity.ts');
await capacityModule.link(async (specifier) => {
  if (specifier === './hgesmWorkspace') return hgesm;
  if (specifier === './platformIdentity') return identity;
  throw new Error(`Import inesperado em platformCapacity: ${specifier}`);
});
await capacityModule.evaluate();
const capacity = capacityModule.namespace;

const usageAlertsModule = compiled('file:///lib/usageAlerts.js', 'lib/usageAlerts.ts');
await usageAlertsModule.link(async (specifier) => {
  if (specifier === './platformCapacity') return capacityModule;
  throw new Error(`Import inesperado em usageAlerts: ${specifier}`);
});
await usageAlertsModule.evaluate();
const usageAlerts = usageAlertsModule.namespace;

const usagePolicyModule = compiled(
  'file:///lib/server/usageAlertPolicy.js',
  'lib/server/usageAlertPolicy.ts'
);
await usagePolicyModule.link(async (specifier) => {
  if (specifier === '../platformIdentity') return identity;
  if (specifier === '../usageAlerts') return usageAlertsModule;
  throw new Error(`Import inesperado em usageAlertPolicy: ${specifier}`);
});
await usagePolicyModule.evaluate();
const usagePolicy = usagePolicyModule.namespace;

class FakeSignJWT {
  setProtectedHeader() { return this; }
  setIssuer() { return this; }
  setSubject() { return this; }
  setAudience() { return this; }
  setIssuedAt() { return this; }
  setExpirationTime() { return this; }
  async sign() { return 'mock-service-account-assertion'; }
}

const jose = await synthetic('jose', {
  importPKCS8: async () => ({ mockKey: true }),
  SignJWT: FakeSignJWT,
});

const firebaseConfig = await synthetic('file:///firebase-applet-config.json', {
  default: {
    projectId: 'gen-lang-client-0982077967',
    firestoreDatabaseId: 'ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1',
  },
});

const monitoringModule = compiled(
  'file:///lib/server/googleCloudMonitoring.js',
  'lib/server/googleCloudMonitoring.ts'
);
await monitoringModule.link(async (specifier) => {
  if (specifier === 'jose') return jose;
  if (specifier === '../../firebase-applet-config.json') return firebaseConfig;
  if (specifier === '../platformCapacity') return capacityModule;
  throw new Error(`Import inesperado em googleCloudMonitoring: ${specifier}`);
});
await monitoringModule.evaluate();
const monitoring = monitoringModule.namespace;

function clearAlertEnvironment() {
  delete sandboxProcess.env.EMPROVEX_GLOBAL_DAILY_USAGE_REFERENCE_JSON;
  delete sandboxProcess.env.EMPROVEX_WORKSPACE_DAILY_USAGE_BUDGETS_JSON;
}

test('capacidade integrada preserva fundador ilimitado, setor externo em 2 e lease/heartbeat em 10/5 minutos', () => {
  assert.equal(
    capacity.getDefaultSimultaneousSessionLimit(['aprov1hgesm', 'gmail.com'].join('@')),
    null
  );
  assert.equal(
    capacity.getDefaultSimultaneousSessionLimit('setor@example.test'),
    2
  );
  assert.equal(capacity.SESSION_LEASE_DURATION_MS, 10 * 60 * 1000);
  assert.equal(capacity.SESSION_HEARTBEAT_INTERVAL_MS, 5 * 60 * 1000);
  assert.deepEqual([...capacity.SESSION_SLOT_IDS], ['slot-1', 'slot-2']);
});

test('limiares de consumo permanecem determinísticos em 70%, 85%, 95%, 100% e acima de 100%', () => {
  assert.equal(capacity.assessUsageBudget(69, 100).level, 'normal');
  assert.equal(capacity.assessUsageBudget(70, 100).level, 'attention');
  assert.equal(capacity.assessUsageBudget(85, 100).level, 'elevated');
  assert.equal(capacity.assessUsageBudget(95, 100).level, 'critical');
  assert.equal(capacity.assessUsageBudget(100, 100).level, 'critical');
  assert.equal(capacity.assessUsageBudget(101, 100).level, 'exceeded');
  assert.equal(capacity.assessUsageBudget(999, null).level, 'unconfigured');
});

test('política sem referências não fabrica alertas, franquia ou cobrança', () => {
  clearAlertEnvironment();
  const policy = usagePolicy.loadUsageAlertPolicy();
  assert.equal(policy.configuredGlobalMetrics, 0);
  assert.equal(policy.configuredWorkspaceUgs, 0);

  const alerts = usageAlerts.buildUsageThresholdAlerts({
    workspaces: [{
      id: 'workspace-a',
      name: 'Workspace A',
      ug: '160416',
      authorizedEmail: 'sector-a@example.test',
    }],
    workspaceUsage: [{
      workspaceId: 'workspace-a',
      ug: '160416',
      dayKey: '2026-09-19',
      estimatedDocumentReads: 100000,
      estimatedDocumentWrites: 100000,
      estimatedDocumentDeletes: 100000,
      realtimeSnapshots: 100,
      peakRealtimeListeners: 10,
      telemetryFlushes: 1,
      lastReportedAt: null,
    }],
    globalUsage: {
      telemetryVersion: capacity.USAGE_TELEMETRY_VERSION,
      source: 'google-cloud-monitoring',
      projectId: 'demo',
      databaseId: 'database',
      windowStartedAt: '2026-09-19T00:00:00.000Z',
      windowEndedAt: '2026-09-19T12:00:00.000Z',
      documentReads: 100000,
      documentWrites: 100000,
      documentDeletes: 100000,
      activeConnections: 10,
      snapshotListeners: 5,
    },
    policy,
  });

  assert.equal(alerts.length, 0);
  assert.equal('billing' in policy, false);
  assert.equal('price' in policy, false);
});

test('política com referências separa métrica global real de estimativa interna por UG', () => {
  clearAlertEnvironment();
  sandboxProcess.env.EMPROVEX_GLOBAL_DAILY_USAGE_REFERENCE_JSON = JSON.stringify({
    documentReads: 100,
    documentWrites: 100,
    documentDeletes: 100,
  });
  sandboxProcess.env.EMPROVEX_WORKSPACE_DAILY_USAGE_BUDGETS_JSON = JSON.stringify({
    '160416': {
      documentReads: 100,
      documentWrites: 100,
      documentDeletes: 100,
    },
  });

  const policy = usagePolicy.loadUsageAlertPolicy();
  assert.equal(policy.configuredGlobalMetrics, 3);
  assert.equal(policy.configuredWorkspaceUgs, 1);

  const alerts = usageAlerts.buildUsageThresholdAlerts({
    workspaces: [{
      id: 'workspace-a',
      name: 'Workspace A',
      ug: '160416',
      authorizedEmail: 'sector-a@example.test',
    }],
    workspaceUsage: [{
      workspaceId: 'workspace-a',
      ug: '160416',
      dayKey: '2026-09-19',
      estimatedDocumentReads: 95,
      estimatedDocumentWrites: 69,
      estimatedDocumentDeletes: 100,
      realtimeSnapshots: 4,
      peakRealtimeListeners: 2,
      telemetryFlushes: 1,
      lastReportedAt: null,
    }],
    globalUsage: {
      telemetryVersion: capacity.USAGE_TELEMETRY_VERSION,
      source: 'google-cloud-monitoring',
      projectId: 'demo',
      databaseId: 'database',
      windowStartedAt: '2026-09-19T00:00:00.000Z',
      windowEndedAt: '2026-09-19T12:00:00.000Z',
      documentReads: 70,
      documentWrites: 85,
      documentDeletes: 101,
      activeConnections: 7,
      snapshotListeners: 3,
    },
    policy,
  });

  assert.deepEqual(
    new Set(alerts.map((item) => item.origin)),
    new Set(['global-real', 'workspace-estimate'])
  );
  assert.ok(alerts.some((item) => item.level === 'attention'));
  assert.ok(alerts.some((item) => item.level === 'elevated'));
  assert.ok(alerts.some((item) => item.level === 'critical'));
  assert.ok(alerts.some((item) => item.level === 'exceeded'));

  for (const alert of alerts) {
    const keys = Object.keys(alert).join(' ').toLowerCase();
    assert.doesNotMatch(keys, /billing|charge|price|cost|fatura|cobran/);
  }
});

test('Cloud Monitoring não configurado falha de forma segura sem chamada externa', async () => {
  delete sandboxProcess.env.EMPROVEX_GCP_MONITORING_CLIENT_EMAIL;
  delete sandboxProcess.env.EMPROVEX_GCP_MONITORING_PRIVATE_KEY;

  let calls = 0;
  context.fetch = async () => {
    calls += 1;
    throw new Error('fetch não deveria ser chamado');
  };

  assert.equal(monitoring.isGoogleCloudMonitoringConfigured(), false);
  await assert.rejects(
    () => monitoring.loadFirebaseGlobalUsageObservation(
      new Date('2026-09-19T12:00:00.000Z')
    ),
    /ainda não possui credencial server-side configurada/
  );
  assert.equal(calls, 0);
});

test('Cloud Monitoring configurado usa respostas mockadas e mantém fonte global real separada', async () => {
  sandboxProcess.env.EMPROVEX_GCP_MONITORING_CLIENT_EMAIL = 'monitoring@example.test';
  sandboxProcess.env.EMPROVEX_GCP_MONITORING_PRIVATE_KEY =
    '-----BEGIN PRIVATE KEY-----\\nmock\\n-----END PRIVATE KEY-----';

  const metricValues = new Map([
    ['firestore.googleapis.com/document/read_ops_count', 70],
    ['firestore.googleapis.com/document/write_ops_count', 85],
    ['firestore.googleapis.com/document/delete_ops_count', 101],
    ['firestore.googleapis.com/network/active_connections', 7],
    ['firestore.googleapis.com/network/snapshot_listeners', 3],
  ]);
  const calls = [];

  context.fetch = async (input) => {
    const url = String(input);
    calls.push(url);

    if (url === 'https://oauth2.googleapis.com/token') {
      return {
        ok: true,
        status: 200,
        async json() {
          return { access_token: 'mock-access-token', expires_in: 3600 };
        },
      };
    }

    const parsed = new URL(url);
    if (parsed.origin !== 'https://monitoring.googleapis.com') {
      throw new Error(`Destino externo inesperado: ${url}`);
    }

    const filter = parsed.searchParams.get('filter') || '';
    const metric = [...metricValues.keys()].find((candidate) => filter.includes(candidate));
    assert.ok(metric, `Métrica não identificada no filtro: ${filter}`);
    assert.match(
      filter,
      /database_id = "ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1"/
    );

    return {
      ok: true,
      status: 200,
      async json() {
        return {
          timeSeries: [{
            points: [{
              interval: { endTime: '2026-09-19T11:59:00.000Z' },
              value: { int64Value: String(metricValues.get(metric)) },
            }],
          }],
        };
      },
    };
  };

  assert.equal(monitoring.isGoogleCloudMonitoringConfigured(), true);
  const observation = await monitoring.loadFirebaseGlobalUsageObservation(
    new Date('2026-09-19T12:00:00.000Z')
  );

  assert.equal(observation.snapshot.source, 'google-cloud-monitoring');
  assert.equal(observation.snapshot.documentReads, 70);
  assert.equal(observation.snapshot.documentWrites, 85);
  assert.equal(observation.snapshot.documentDeletes, 101);
  assert.equal(observation.snapshot.activeConnections, 7);
  assert.equal(observation.snapshot.snapshotListeners, 3);
  assert.equal(
    observation.snapshot.databaseId,
    'ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1'
  );
  assert.equal(calls.length, 6);
});
