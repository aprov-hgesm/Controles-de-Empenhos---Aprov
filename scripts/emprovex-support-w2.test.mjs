// Execução: node --experimental-strip-types --test scripts/emprovex-support-w2.test.mjs
// Dados sintéticos; nenhuma conexão com Firebase ou clientes reais.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ACCESS_REQUEST_PAGE_SIZE,
  listAccessRequestPage,
  parseAccessRequestPatch,
  recordRepeatAccessRequest,
  validAccessRequestPageToken,
} from '../lib/server/accessRequestSupport.ts';

const id = 'a'.repeat(64);
const version = '2026-10-31T15:00:00.000Z';
const now = '2026-10-31T20:00:00.000Z';
const base = 'https://firestore.googleapis.com/v1/projects/demo/databases/(default)/documents/platformAccessRequests';

test('W2: status existente, versão e nota curta preservados por CAS', () => {
  const patch = parseAccessRequestPatch({
    id, version, status: 'em_teste', adminNote: 'Retornar após demonstração',
    lastContactAt: '2026-10-30', nextActionAt: '2026-11-03',
  }, now);
  assert.ok(patch);
  assert.equal(patch.fields.status.stringValue, 'em_teste');
  assert.equal(patch.fields.lastContactAt.stringValue, '2026-10-30');
  assert.equal(patch.fields.updatedAt.timestampValue, now);
  assert.deepEqual(patch.fieldPaths, ['status', 'adminNote', 'lastContactAt', 'nextActionAt', 'updatedAt']);
  for (const status of ['novo', 'contatado', 'em_teste', 'concluido', 'descartado']) {
    assert.ok(parseAccessRequestPatch({ id, version, status }, now));
  }
  assert.equal(parseAccessRequestPatch({ id, version, status: 'trial_concedido' }, now), null);
  assert.equal(parseAccessRequestPatch({ id, version, workspaceId: 'other', status: 'novo' }, now), null);
  assert.equal(parseAccessRequestPatch({ id, status: 'novo' }, now), null);
});

test('W2: validação de notas/datas/tamanhos e token opaco', () => {
  for (const adminNote of ['x'.repeat(281), 'token\nsecreto', 42]) {
    assert.equal(parseAccessRequestPatch({ id, version, adminNote }, now), null);
  }
  for (const date of ['2026-02-29', '2026-13-01', '01/11/2026', null]) {
    assert.equal(parseAccessRequestPatch({ id, version, nextActionAt: date }, now), null);
  }
  assert.ok(parseAccessRequestPatch({ id, version, nextActionAt: '' }, now));
  assert.equal(parseAccessRequestPatch({ id, version }, now), null);
  assert.equal(validAccessRequestPageToken('opaque+abc/ghi=='), true);
  assert.equal(validAccessRequestPageToken('%0a'), false);
  assert.equal(validAccessRequestPageToken('x'.repeat(4097)), false);
});

test('W2: paginação acima de 100 sem carregar tudo; autenticação é repassada', async () => {
  const documents = Array.from({ length: 127 }, (_, i) => ({
    name: base + '/' + String(i).padStart(64, '0'),
    updateTime: version,
    fields: {
      nomeCompleto: { stringValue: 'Interessado ' + i },
      createdAt: { timestampValue: new Date(Date.UTC(2026, 9, 31, 10, 0, 0) - i * 60000).toISOString() },
      status: { stringValue: 'novo' },
    },
  }));
  let calls = 0;
  const fetcher = async (url, options) => {
    calls++;
    assert.equal(options.headers.Authorization, 'Bearer synthetic-founder');
    const args = new URL(url).searchParams;
    assert.equal(args.get('pageSize'), String(ACCESS_REQUEST_PAGE_SIZE));
    assert.equal(args.get('orderBy'), 'createdAt desc');
    const offset = Number(args.get('pageToken') || 0);
    const page = documents.slice(offset, offset + ACCESS_REQUEST_PAGE_SIZE);
    const next = offset + ACCESS_REQUEST_PAGE_SIZE;
    return {
      ok: true,
      json: async () => ({ documents: page, ...(next < documents.length ? { nextPageToken: String(next) } : {}) }),
    };
  };
  const collected = [];
  let cursor = null;
  do {
    const page = await listAccessRequestPage(base, 'synthetic-founder', cursor, fetcher);
    assert.ok(page.records.length <= 25);
    collected.push(...page.records);
    cursor = page.nextPageToken;
  } while (cursor);
  assert.equal(collected.length, 127);
  assert.equal(new Set(collected.map(record => record.id)).size, 127);
  assert.equal(collected[0].nomeCompleto, 'Interessado 0');
  assert.equal(collected.at(-1).nomeCompleto, 'Interessado 126');
  assert.equal(calls, 6);
});

test('W2: reenvio em menos de 24h não grava; mesmo e-mail nunca cria outro doc', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.headers.Authorization, 'Bearer token');
    return { ok: true, json: async () => ({
      name: base + '/' + id,
      updateTime: version,
      fields: { createdAt: { timestampValue: '2026-10-31T18:00:00Z' },
                lastRequestedAt: { timestampValue: '2026-10-31T18:00:00Z' } },
    }) };
  };
  assert.equal(await recordRepeatAccessRequest(base, id, 'token', now, fetcher), 'skipped');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, undefined);
});

test('W2: recontato após 24h grava apenas timestamp com updateTime; conflitos ficam neutros', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (options.method === 'PATCH') {
      const params = new URL(url).searchParams;
      assert.equal(params.get('updateMask.fieldPaths'), 'lastRequestedAt');
      assert.equal(params.get('currentDocument.updateTime'), version);
      const body = JSON.parse(options.body);
      assert.deepEqual(Object.keys(body.fields), ['lastRequestedAt']);
      assert.equal(body.fields.lastRequestedAt.timestampValue, now);
      return { ok: true };
    }
    return { ok: true, json: async () => ({
      name: base + '/' + id,
      updateTime: version,
      fields: { createdAt: { timestampValue: '2026-10-01T10:00:00Z' } },
    }) };
  };
  assert.equal(await recordRepeatAccessRequest(base, id, 'token', now, fetcher), 'updated');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.method, 'PATCH');

  const conflicting = async (url, options) => options.method === 'PATCH'
    ? { ok: false, status: 412 }
    : { ok: true, json: async () => ({
      updateTime: version, fields: { createdAt: { timestampValue: '2026-10-01T10:00:00Z' } },
    }) };
  assert.equal(await recordRepeatAccessRequest(base, id, 'token', now, conflicting), 'skipped');
});

test('W2: guard de fundador, resposta pública neutra e isolamento de escopo mantidos', () => {
  const admin = readFileSync('app/api/admin/access-requests/route.ts', 'utf8');
  const publicRoute = readFileSync('app/api/public/access-requests/route.ts', 'utf8');
  const ui = readFileSync('components/admin/AdminAccessRequestsPanel.tsx', 'utf8');
  assert.match(admin, /verifyFounderFirebaseRequest/);
  assert.match(admin, /await requireFounder\(request\)/);
  assert.match(admin, /currentDocument\.updateTime/);
  assert.match(admin, /response\.status === 412 \? 409/);
  assert.match(publicRoute, /if \(saved\.status === 409\)/);
  assert.match(publicRoute, /recordRepeatAccessRequest/);
  assert.match(publicRoute, /if \(clean\(input\.website, 300\)\)/);
  assert.match(publicRoute, /if \(saved\.ok\) return NextResponse\.json\(\{ ok: true \}/);
  assert.match(ui, /"Em teste"|'Em teste'/);
  assert.doesNotMatch(ui, /grantTrial\(|workspaceId:/);
});
