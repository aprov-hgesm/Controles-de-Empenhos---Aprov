#!/usr/bin/env node
/**
 * Seed MÍNIMO para o Preview local: cria somente o workspace e a conta
 * fundadora no CORE Firestore Emulator. Não cria nem presume aceite legal.
 *
 * Uso:
 *   node scripts/warehouse-local-preview-seed.mjs
 *
 * Segurança: endereço e projectId FIXOS, localhost somente.
 * Nunca contém credenciais de produção, nem envia dados para Google Cloud.
 */
const PROJECT_ID = 'demo-emprovex-security';
const WORKSPACE_ID = 'hgesm-aprov';
const UG = '160416';
const EMAIL = 'aprov1hgesm@gmail.com';
const BASE =
  'http://127.0.0.1:8080/v1/projects/'
  + PROJECT_ID + '/databases/(default)/documents';

if (process.env.NODE_ENV === 'production') {
  throw new Error('SEED_LOCAL: bloqueado em ambiente de produção');
}

function encodeValue(value) {
  if (value === null) return { nullValue: 'NULL_VALUE' };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value)
    ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'object' && value) {
    return { mapValue: { fields: Object.fromEntries(
      Object.entries(value).map(([name, child]) => [name, encodeValue(child)])
    ) } };
  }
  throw new Error('SEED_LOCAL: tipo não suportado');
}

function fields(data) {
  return Object.fromEntries(Object.entries(data)
    .map(([name, value]) => [name, encodeValue(value)]));
}

async function seed(path, data) {
  // Uso explícito da API administrativa apenas do emulador localhost.
  const result = await fetch(BASE + '/' + path, {
    method: 'PATCH',
    headers: {
      authorization: 'Bearer owner',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ fields: fields(data) }),
  });
  if (!result.ok) {
    throw new Error('SEED_LOCAL: Falha no emulador em ' + path
      + ' (HTTP ' + result.status + ')');
  }
}

async function main() {
  await seed('workspaces/' + WORKSPACE_ID, {
    id: WORKSPACE_ID,
    name: 'EMPROVEX — Workspace local de teste',
    status: 'active',
    ug: UG,
    authorizedEmail: EMAIL,
    institutionalProfile: {
      organizationName: 'Organização de teste',
      organizationShortName: 'TESTE',
      sectionName: 'Aprovisionamento',
    },
    createdAt: '2026-10-20T12:00:00.000Z',
    updatedAt: '2026-10-20T12:00:00.000Z',
    createdBy: EMAIL,
  });
  await seed('platformAccounts/' + EMAIL, {
    email: EMAIL,
    authProvider: 'google.com',
    accountType: 'sector',
    workspaceId: WORKSPACE_ID,
    ug: UG,
    status: 'active',
    createdAt: '2026-10-20T12:00:00.000Z',
    updatedAt: '2026-10-20T12:00:00.000Z',
    createdBy: EMAIL,
  });
  console.log('PREVIEW_CORE_EMULATOR_SEED=PASS');
  console.log('PROJECT=' + PROJECT_ID);
  console.log('CORE_DATABASE=(default):8080');
  console.log('WORKSPACE=' + WORKSPACE_ID + ' UG=' + UG);
  console.log('LEGAL_ACCEPTANCE=NAO_CRIADO (exigir aceite humano na interface)');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
