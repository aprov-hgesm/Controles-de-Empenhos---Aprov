import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const configSource = readFileSync(resolve(repoRoot, 'next.config.ts'), 'utf8');
const compiled = ts.transpileModule(configSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.deepEqual(compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) ?? [], []);
const commonjs = { exports: {} };
runInNewContext(compiled.outputText, {
  module: commonjs, exports: commonjs.exports, process: { env: {} },
});
const config = commonjs.exports.default;

test('root serves public portal while old operational shell stays in source', async () => {
  const rewrites = await config.rewrites();
  assert.deepEqual(
    JSON.parse(JSON.stringify(rewrites.beforeFiles)),
    [{ source: '/', destination: '/portal' }]
  );
});

test('all legacy routes redirect to canonical entry without chains', async () => {
  const redirects = await config.redirects();
  const bySource = Object.fromEntries(redirects.map(({ source, destination }) => [source, destination]));
  assert.equal(bySource['/login'], '/aprovisionamento');
  assert.equal(bySource['/central-empenhos'], '/aprovisionamento');
  assert.equal(bySource['/institucional'], '/info');
  assert.equal(bySource['/hospitalar'], '/cozinha-dietetica');
  assert.equal(bySource['/adm-deposito'], '/central-depositos');
  assert.equal(bySource['/adm-deposito/:path*'], '/central-depositos/:path*');
  assert.equal(bySource['/central-mobile'], '/operador-movel');
  assert.equal(bySource['/central-mobile/:path*'], '/operador-movel/:path*');
  assert.equal(bySource['/aprovisionamento'], undefined);
  assert.equal(bySource['/info'], undefined);
  assert.equal(bySource['/cozinha-dietetica'], undefined);
});

test('new protected pages, warehouse and admin retain no-store policies', async () => {
  const headers = await config.headers();
  const byRoute = new Map(headers.map(({ source, headers }) => [source, headers]));
  for (const route of [
    '/aprovisionamento', '/cozinha-dietetica', '/central-empenhos',
    '/central-depositos', '/central-depositos/:path*', '/admin', '/admin/:path*',
  ]) {
    assert.ok(byRoute.get(route)?.some(({ key, value }) =>
      key === 'Cache-Control' && value.includes('no-store')), route);
  }
});

test('no redirect bypasses existing /api or warehouse guard', async () => {
  const redirects = await config.redirects();
  assert.equal(redirects.some(({ source }) => source.startsWith('/api')), false);
  assert.equal(redirects.some(({ source }) => source === '/central-depositos'), false);
});
