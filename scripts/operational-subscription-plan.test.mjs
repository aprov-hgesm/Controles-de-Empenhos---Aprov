#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../lib/operationalSubscriptionPlan.ts', import.meta.url),
  'utf8'
);

const expected = {
  inicio: [],
  painel: ['empenhos'],
  empenhos: ['empenhos', 'alerts', 'invoices'],
  itens: ['empenhos'],
  nova_nf: ['empenhos', 'alerts', 'invoices', 'comissoes'],
  relatorios: ['empenhos', 'invoices', 'comissoes'],
  itens_empenho: ['empenhos'],
  cronogramas: ['empenhos', 'cronogramas'],
};

for (const [tab, collections] of Object.entries(expected)) {
  const pattern = new RegExp(
    tab + String.raw`:\s*\{([\s\S]*?)\n\s*\},`
  );
  const match = source.match(pattern);
  assert.ok(match, `Plano ausente para ${tab}`);

  for (const name of ['empenhos', 'alerts', 'invoices', 'comissoes', 'cronogramas']) {
    const shouldBeActive = collections.includes(name);
    assert.match(
      match[1],
      new RegExp(`${name}: ${shouldBeActive}`),
      `${tab} deveria configurar ${name}=${shouldBeActive}`
    );
  }
}

assert.match(
  source,
  /inicio:\s*\{[\s\S]*?empenhos: false,[\s\S]*?alerts: false,/,
  'Início não pode reabrir coleções operacionais brutas.'
);
console.log('OPERATIONAL SUBSCRIPTION PLAN: PASS');
console.log('Início: 0 coleções operacionais brutas + 1 snapshot documental');
console.log('Painel: 1 coleção operacional realtime');
console.log('Empenhos: 3 coleções operacionais realtime');
console.log('Notas Fiscais: 4 coleções operacionais realtime');
console.log('Relatórios: 3 coleções operacionais realtime');
console.log('Cronogramas: 2 coleções operacionais realtime');
