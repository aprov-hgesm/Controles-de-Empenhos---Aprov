import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('operational loading keeps readiness semantics and existing status copy', () => {
  const view = source('components/layout/OperationalSurfaceLoading.tsx');
  const shell = source('app/page.tsx');
  assert.match(view, /data-testid="operational-section-loading"/);
  assert.match(view, /role="status"/);
  assert.match(view, /aria-live="polite"/);
  assert.match(view, /Sincronizando dados desta seção/);
  assert.match(view, /O EMPROVEX mantém em tempo real somente as coleções necessárias à tela atual/);
  assert.match(view, /EmprovexOrbVisual/);
  assert.match(view, /surface="light"/);
  assert.match(view, /renderer=\{EmprovexThinkingOrbRenderer\}/);
  assert.match(shell, /!activeOperationalDataReady && <OperationalSurfaceLoading\s*\/>/);
  assert.match(shell, /fallback=\{activeOperationalDataReady \? <OperationalSurfaceLoading\s*\/> : null\}/);
  assert.doesNotMatch(view, /setTimeout|setInterval|async |await /);
});

test('authentication keeps real session/workspace rail and never colors the indicator', () => {
  const view = source('components/auth/EmprovexAuthLoading.tsx');
  const shell = source('app/page.tsx');
  assert.match(view, /hasAuthenticatedIdentity: boolean/);
  assert.match(view, /hasAuthenticatedIdentity \? 'workspace' : 'session'/);
  assert.match(view, /<LoginStatusRail phase=\{phase\}/);
  assert.match(view, /<LoginAtmosphere state="authenticating"/);
  assert.match(view, /surface="dark"/);
  assert.match(view, /renderer=\{EmprovexThinkingOrbRenderer\}/);
  assert.match(shell, /if \(loadingAuth\)/);
  assert.match(shell, /<EmprovexAuthLoading hasAuthenticatedIdentity=\{Boolean\(user\)\}/);
  assert.doesNotMatch(view, /setTimeout|setInterval/);
});

test('W2 renderer forces monochrome while R2 central Home stays colored', () => {
  const renderer = source('components/visual/EmprovexThinkingOrbRenderer.tsx');
  const home = source('features/inicio/components/InicioCore.tsx');
  assert.match(renderer, /palette="monochrome"/);
  assert.match(renderer, /surface=\{surface\}/);
  assert.match(home, /palette="colored"/);
  assert.match(home, /refinement="r2"/);
  assert.match(home, /className=\{styles\.tooltip\}/);
});
