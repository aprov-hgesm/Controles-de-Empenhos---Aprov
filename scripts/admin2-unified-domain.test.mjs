import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

/** TypeScript real: carrega dependências de domínio sem Next, browser ou Firebase. */
const root = process.cwd();
const cached = new Map();
function load(relative) {
  const file = resolve(root, relative);
  if (cached.has(file)) return cached.get(file);
  const source = readFileSync(file, 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  cached.set(file, exports);
  runInNewContext(code, {
    exports, Date, Intl, Set, Map, Array,
    require(specifier) {
      if (!specifier.startsWith('.')) throw Error('Unexpected non-domain dependency ' + specifier);
      const dependency = resolve(dirname(file), specifier + '.ts');
      return load(dependency);
    },
  }, { filename: file });
  return exports;
}

const { createPreviewOnboarding, validateUnifiedOnboarding } =
  load('lib/admin2/customers/unifiedCustomerOnboarding.ts');

const example = () => ({
  sector: {
    workspaceId: 'om-qa-aprov',
    workspaceName: 'Aprovisionamento Teste',
    ug: '123456',
    authorizedEmail: 'qa-sector@example.invalid',
    initialPassword: 'Test-only-password-123',
    organizationName: 'Unidade de QA',
    organizationShortName: 'UQA',
    sectionName: 'Aprovisionamento',
    grantTrial: false, // mesmo assim unificado exige trial
  },
  commercial: {
    displayName: 'Setor de Aprovisionamento QA',
    contactName: 'Responsável QA',
    contactEmail: 'qa-contact@example.invalid',
    contactPhone: '',
    relationshipNotes: 'Somente QA',
    relationshipStatus: 'active',
  },
});

test('onboarding real gera 1 cliente + 1 workspace + 1 assinatura trial/30 dias', () => {
  const input = example();
  assert.equal(validateUnifiedOnboarding(input).length, 0);
  const result = createPreviewOnboarding(input, '2026-10-18T18:00:00.000Z');
  assert.equal(result.workspace.id, 'om-qa-aprov');
  assert.equal(result.workspace.ug, '123456');
  assert.equal(result.commercialCustomer.id, result.workspace.id);
  assert.equal(result.commercialCustomer.workspaceId, result.workspace.id);
  assert.equal(result.billing.workspaceId, result.workspace.id);
  assert.equal(result.billing.status, 'trial');
  assert.equal(result.billing.trialGranted, true);
  assert.equal(result.billing.paymentRequired, false);
  assert.equal(result.billing.monthlyPriceCents, 7000);
  assert.equal(result.billing.trialEndsAt, '2026-11-17T18:00:00.000Z');
  assert.equal(result.workspace.authorizedEmail, 'qa-sector@example.invalid');
  assert.equal('initialPassword' in result.workspace, false);
  assert.equal('initialPassword' in result.commercialCustomer, false);
  assert.equal('initialPassword' in result.billing, false);
});

test('UG e identidade operacional inválidas bloqueiam todas as etapas', () => {
  const badUg = example();
  badUg.sector.ug = '123';
  assert.ok(validateUnifiedOnboarding(badUg).length > 0);
  assert.throws(() => createPreviewOnboarding(badUg), /UG/);
  const badEmail = example();
  badEmail.sector.authorizedEmail = 'invalid';
  assert.throws(() => createPreviewOnboarding(badEmail), /e-mail/);
});

test('não usa trial no workspace fundador isento', () => {
  const input = example();
  input.sector.workspaceId = 'hgesm-aprov';
  assert.throws(() => createPreviewOnboarding(input), /trial obrigatório/);
});
