#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const config = JSON.parse(read('vercel.json'));

test('Vercel de contingência permanece sem deploy automático em todas as branches', () => {
  assert.equal(config.git?.deploymentEnabled, false,
    'Deployments automáticos GitHub → Vercel devem permanecer desativados (D-127).');
  assert.equal(config.$schema, 'https://openapi.vercel.sh/vercel.json');
});

test('Definição cron legada é preservada sem duplicar Cloud Scheduler', () => {
  assert.deepEqual(config.crons, [
    { path: '/api/cron/usage-snapshot', schedule: '15 9 * * *' },
  ]);
});

test('GitHub Actions continua funcionando em PR, main e execução manual', () => {
  const workflow = read('.github/workflows/application-ci.yml');
  assert.match(workflow, /(?:^|\n)on:\s*\n\s*pull_request:/);
  assert.match(workflow, /(?:^|\n)\s*push:\s*\n\s*branches:\s*\n\s*-\s*main/);
  assert.match(workflow, /(?:^|\n)\s*workflow_dispatch:/);
  assert.match(workflow, /name: Vercel contingency protection \(Git auto-deploy disabled\)/);
  assert.match(workflow, /npm run test:vercel-manual-deploy/);
});

test('Proteção por origem Git não recorre a ignored build step que consumiria cota', () => {
  assert.equal(config.ignoreCommand, undefined);
  assert.equal(config.buildCommand, undefined);
  assert.equal(config.git?.deploymentEnabled, false);
});
