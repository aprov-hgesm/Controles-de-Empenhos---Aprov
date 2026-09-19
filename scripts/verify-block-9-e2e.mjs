#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireText = (source, expected, message) => {
  if (!source.includes(expected)) findings.push(message);
};
const forbidText = (source, forbidden, message) => {
  if (source.includes(forbidden)) findings.push(message);
};

const firebase = read('lib/firebase.ts');
const harness = read('scripts/e2e-browser-emulator.mjs');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
const spec = read('tests/e2e/operator-critical-flow.spec.mjs');
const config = read('playwright.e2e.config.mjs');
const login = read('components/auth/EmprovexLogin.tsx');
const sidebar = read('components/layout/AppSidebar.tsx');
const selector = read('features/relatorios/components/RelatorioEmpenhoSelector.tsx');
const docs = read('docs/BLOCK_9_BROWSER_E2E.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

requireText(firebase, "NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS === '1'", 'Frontend não possui chave opt-in de Emulator.');
requireText(firebase, 'NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID', 'Frontend não isola o projectId E2E.');
requireText(firebase, 'connectAuthEmulator', 'Frontend não conecta Auth Emulator.');
requireText(firebase, 'connectFirestoreEmulator', 'Frontend não conecta Firestore Emulator.');
requireText(firebase, 'firebaseConfig.firestoreDatabaseId', 'Configuração de produção perdeu o banco nomeado.');

requireText(harness, "scripts/firestore-multitenancy-security.test.mjs", 'Harness não prepara o ambiente pela suíte multi-tenant.');
requireText(harness, "NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS: '1'", 'Harness não ativa modo E2E.');
requireText(harness, "NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID: 'demo-emprovex-security'", 'Harness não usa projeto efêmero esperado.');
requireText(harness, "playwright", 'Harness não executa Playwright.');
requireText(harness, "--port', '3100'", 'Harness perdeu porta local determinística.');

requireText(security, 'BROWSER E2E FIXTURE: READY', 'Suíte de segurança não deixa fixture determinística para navegador.');
requireText(security, 'Fornecedor E2E Lifecycle', 'Fixture principal do navegador não existe.');
requireText(security, 'Fornecedor E2E Isolado B', 'Fixture de isolamento do navegador não existe.');
requireText(security, 'nf_11111111000191_1001', 'Fixture de NF sem NS não existe.');

requireText(spec, 'sector-lifecycle@example.test', 'E2E não autentica operador principal.');
requireText(spec, 'sector-b@example.test', 'E2E não autentica segundo workspace.');
requireText(spec, "page.reload()", 'E2E não comprova persistência após reload.');
requireText(spec, 'UG 160416', 'E2E não comprova UG automática.');
requireText(spec, '2026NS009999', 'E2E não cobre gravação real de NS.');
requireText(spec, 'Fornecedor E2E Lifecycle', 'E2E não valida dados do workspace principal.');
requireText(spec, 'Fornecedor E2E Isolado B', 'E2E não valida isolamento do segundo workspace.');
requireText(spec, 'toHaveCount(0)', 'E2E não possui prova negativa de isolamento.');

requireText(config, "workers: 1", 'Playwright E2E deve ser serial para compartilhar fixture determinística.');
requireText(config, "headless: true", 'Playwright E2E precisa rodar headless no CI.');
requireText(login, 'data-testid="sector-login-email"', 'Login perdeu seletor E2E de e-mail.');
requireText(login, 'data-testid="sector-login-password"', 'Login perdeu seletor E2E de senha.');
requireText(login, 'data-testid="sector-login-submit"', 'Login perdeu seletor E2E de submit.');
requireText(sidebar, 'data-testid="nav-relatorios"', 'Sidebar perdeu seletor E2E de Relatórios.');
requireText(sidebar, 'data-testid="logout"', 'Sidebar perdeu seletor E2E de logout.');
requireText(selector, 'data-testid={`report-empenho-${empenho.id}`}', 'Seletor de empenho perdeu ID E2E estável.');

requireText(pkg, '"test:e2e:browser"', 'package.json não registra Browser E2E.');
requireText(pkg, '"verify:block-9-e2e"', 'package.json não registra guard do Bloco 9.');
requireText(workflow, 'Browser E2E with Firebase Emulator', 'CI não possui job Browser E2E.');
requireText(workflow, '@playwright/test@1.55.0', 'CI não fixa versão do Playwright.');
requireText(workflow, 'playwright install --with-deps chromium', 'CI não instala Chromium para E2E.');
requireText(workflow, 'npm run test:e2e:browser', 'CI não executa Browser E2E.');
requireText(docs, 'Next.js local', 'Documentação não descreve aplicação real.');
requireText(docs, 'persistência após reload', 'Documentação não descreve prova de persistência.');
requireText(docs, 'não usa dados de produção', 'Documentação não declara isolamento de produção.');

forbidText(firebase, "connectAuthEmulator(auth, 'http://127.0.0.1:9099'", 'Conexão de Emulator não pode ficar incondicional.');

if (findings.length) {
  console.error('BLOCK 9 BROWSER E2E: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 9 BROWSER E2E: READY');
  console.log('Next.js + Auth Emulator + Firestore Emulator: INTEGRADOS');
  console.log('Jornada login -> NS -> reload: COBERTA');
  console.log('Isolamento entre workspaces no navegador: COBERTO');
  console.log('Produção: ISOLADA POR OPT-IN');
}
