import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isolatedCompanyRouteDecision as route } from '../lib/company/isolatedRoutes.mjs';
import { isConfiguredCompanyRuntime, assertAttachedCompanyServiceAccount,
  resetCompanyServiceIdentityForTests } from '../lib/server/companyRuntimeGuards.mjs';

const base = {
  NODE_ENV: 'production', K_SERVICE: 'emprovex-empresas', K_REVISION: 'emprovex-empresas-00001-abc',
  EMPROVEX_COMPANY_ISOLATED_RUNTIME: '1',
  EMPROVEX_COMPANY_RUNTIME_PROJECT_ID: 'emprovex-empresas',
  EMPROVEX_COMPANY_SERVICE_ACCOUNT_EMAIL: 'emprovex-empresas-runtime@emprovex-host.iam.gserviceaccount.com',
};
test('the institutional deployment retains all routes', () => {
  for (const p of ['/admin','/api/admin/provision-company','/central-empenhos','/empresa']) {
    assert.equal(route(p, false), 'pass');
  }
});
test('company Cloud Run blocks military, admin, and other API paths', () => {
  for (const p of ['/admin','/login','/api/admin/provision-company','/api/empenhos','/api/health','/central-depositos','/empresa-maliciosa']) {
    assert.equal(route(p, true), 'block', p);
  }
  for (const p of ['/empresa','/empresa/fornecedores','/entrar-empresa','/empresa-convite',
    '/api/company/session','/api/company/profiles','/_next/static/file.js','/emprovex-logo.png']) {
    assert.equal(route(p, true), 'pass', p);
  }
  assert.equal(route('/', true), 'redirect');
});
test('live runtime requires exact isolated service + dedicated SA', () => {
  assert.equal(isConfiguredCompanyRuntime(base), true);
  for (const overrides of [
    {K_SERVICE:'emprovex'}, {K_SERVICE:''}, {K_REVISION:''},
    {EMPROVEX_COMPANY_RUNTIME_PROJECT_ID:'emprovex'},
    {EMPROVEX_COMPANY_ISOLATED_RUNTIME:'0'}, {VERCEL:'1'},
    {GOOGLE_APPLICATION_CREDENTIALS:'/tmp/military.json'},
    {EMPROVEX_COMPANY_SERVICE_ACCOUNT_EMAIL:'default@emprovex-host.iam.gserviceaccount.com'},
  ]) assert.equal(isConfiguredCompanyRuntime({...base,...overrides}), false);
});
test('runtime checks the actual Cloud Run metadata service account', async () => {
  resetCompanyServiceIdentityForTests();
  const ok = async () => ({ok:true,text:async()=>base.EMPROVEX_COMPANY_SERVICE_ACCOUNT_EMAIL});
  await assertAttachedCompanyServiceAccount({env:base,fetchImpl:ok});
  resetCompanyServiceIdentityForTests();
  await assert.rejects(
    () => assertAttachedCompanyServiceAccount({env:base,fetchImpl:async()=>({ok:true,text:async()=> 'military@emprovex-host.iam.gserviceaccount.com'})}),
    /COMPANY_SERVICE_IDENTITY_MISMATCH/
  );
});
