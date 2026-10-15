#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

const home = read('features/warehouse/mobile/WarehouseMobileHome.tsx');
const shell = read('features/warehouse/mobile/WarehouseMobileShell.tsx');
const layout = read('features/warehouse/mobile/WarehouseMobileProtectedLayout.tsx');
const namespace = read('lib/warehouse/namespace.ts');

test('Operador Móvel apresenta dois grupos e oito destinos canônicos sem omissões', () => {
  const expected = [
    '/operador-movel/alocar',
    '/operador-movel/avulso',
    '/operador-movel/transferir',
    '/operador-movel/saida',
    '/operador-movel/consultar-localizacao',
    '/operador-movel/consultar-item',
    '/operador-movel/inventario',
    '/operador-movel/conferir',
  ];

  assert.match(home, /const MOVEMENT_ACTIONS:/);
  assert.match(home, /const CONTROL_ACTIONS:/);
  assert.match(home, /title="Movimentações"/);
  assert.match(home, /title="Consulta e conferência"/);
  assert.equal((home.match(/number: '0[1-8]'/g) || []).length, 8);
  assert.equal((home.match(/<OperatorActionGroup/g) || []).length, 2);
  for (const href of expected) {
    assert.equal(home.includes("href: '" + href + "'"), true, 'Destino ausente: ' + href);
  }
  assert.doesNotMatch(home, /href:\s*null/);
  assert.doesNotMatch(home, /\/central-mobile\//);
});

test('Cards possuem área de toque, destino, foco, estado pressionado e sem animação obrigatória', () => {
  assert.match(home, /min-h-\[172px\]/);
  assert.match(home, /aria-label=\{'Abrir operação: ' \+ action\.label\}/);
  assert.match(home, /focus-visible:outline/);
  assert.match(home, /active:scale/);
  assert.match(home, /motion-reduce:transform-none/);
  assert.match(home, /motion-reduce:transition-none/);
  assert.match(home, /aria-labelledby=\{id\}/);
  assert.match(home, /data-testid=\{'operator-mobile-action-' \+ action\.number\}/);
});

test('Painel compacto distingue capacidade de leitura do acesso autorizado', () => {
  assert.match(home, /Operações no ponto físico/);
  assert.match(home, /Acesso autorizado/);
  assert.match(home, /Leitor sob demanda/);
  assert.match(home, /Leitura por etiqueta/);
  assert.doesNotMatch(home, /Scanner pronto|Câmera autorizada|Onda 3|Jornada R1/);
  assert.doesNotMatch(home, /getDocs\s*\(|getDoc\s*\(|onSnapshot\s*\(|firebase\/firestore/);
  assert.match(layout, /WarehouseAccessBoundary/);
  assert.match(layout, /HGESM_SECTOR_EMAIL/);
});

test('Cabeçalho institucional exibe UG real e rodapé permanece contextual', () => {
  assert.match(shell, /EMPROVEX · Central de Depósitos/);
  assert.match(shell, /Operador Móvel/);
  assert.match(shell, /workspaceContext\.ug/);
  assert.match(shell, /isOperatorHome/);
  assert.match(shell, /!isOperatorHome &&/);
  assert.match(shell, /Voltar às operações/);
  assert.doesNotMatch(shell, /warehouse-mobile-nav-desktop/);
  assert.match(read('next.config.ts'), /source: '\/central-mobile', destination: '\/operador-movel', permanent: true/);
  assert.match(namespace, /WAREHOUSE_NAMESPACE_ROOT = 'warehouse'/);
});
