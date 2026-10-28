#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const config = JSON.parse(read('vercel.json'));

test('Vercel publica apenas main, sem autorizar outras branches', () => {
  assert.deepEqual(config.git?.deploymentEnabled, {main:true,'*':false},
    'Somente main pode disparar deployment Git para produção.');
  assert.equal(config.$schema, 'https://openapi.vercel.sh/vercel.json');
});

test('Cron preexistente continua programado sem modificação', () => {
  assert.deepEqual(config.crons, [
    { path: '/api/cron/usage-snapshot', schedule: '15 9 * * *' },
  ]);
});

test('GitHub Actions continua funcionando em PR, main e execução manual', () => {
  const workflow = read('.github/workflows/application-ci.yml');
  assert.match(workflow, /(?:^|\n)on:\s*\n\s*pull_request:/);
  assert.match(workflow, /(?:^|\n)\s*push:\s*\n\s*branches:\s*\n\s*-\s*main/);
  assert.match(workflow, /(?:^|\n)\s*workflow_dispatch:/);
  assert.match(workflow, /name: Vercel manual deployment policy/);
  assert.match(workflow, /npm run test:vercel-manual-deploy/);
});

test('Proteção por origem Git não recorre a ignored build step que consumiria cota', () => {
  assert.equal(config.ignoreCommand, undefined);
  assert.equal(config.buildCommand, undefined);
  assert.deepEqual(config.git?.deploymentEnabled, {main:true,'*':false});
});
