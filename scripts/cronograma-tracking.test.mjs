#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(resolve(process.cwd(), 'features/cronogramas/domain/cronogramaDeliveryTracking.ts'), 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
runInNewContext(transpiled, {
  module: mod,
  exports: mod.exports,
  Date,
  Set,
  Map,
});
const { snapshotCronogramaRemessas, remessaWeekRange, matchInvoicesForRemessaWeek, dateOnly, listSentCronogramas } = mod.exports;

const emp = {
  id: '2026NE123',
  supplier: 'Fornecedor Teste',
  items: [
    { id: 'itemA', name: 'Arroz', unit: 'KG', quantity: 100, received: 0 },
    { id: 'itemB', name: 'Feijão', unit: 'KG', quantity: 100, received: 0 },
  ],
};
const baseInvoice = (id, empenhoId, issueDate, itemId = 'itemA') => ({
  id, empenhoId, issueDate, supplier: 'Fornecedor Teste',
  items: [{ itemId, quantity: 5, unitPrice: 2, subtotal: 10 }],
  totalValue: 10,
});

test('semana civil usa segunda-domingo e cruza mês e ano sem fuso horário', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(remessaWeekRange('2027-01-01'))), {
    start: '2026-12-28', end: '2027-01-03',
  });
  assert.deepEqual(JSON.parse(JSON.stringify(remessaWeekRange('2026-10-18'))), {
    start: '2026-10-12', end: '2026-10-18',
  });
  assert.equal(remessaWeekRange('2026-02-30'), null);
  assert.equal(dateOnly('2026-10-14T23:00:00Z'), '2026-10-14');
  assert.equal(dateOnly('14/10/2026'), null);
});

test('somente NFs do mesmo empenho e data de emissão da NF na semana', () => {
  const invoices = [
    baseInvoice('a', '2026NE123', '2026-10-12'),
    baseInvoice('b', '2026NE123', '2026-10-18'),
    baseInvoice('c', '2026NE123', '2026-10-19'),
    baseInvoice('d', 'OUTRA-NE', '2026-10-14'),
    baseInvoice('e', '2026NE123', '2026-10-11'),
    baseInvoice('f', '2026NE123', 'data-inválida'),
  ];
  const result = matchInvoicesForRemessaWeek('2026NE123', '2026-10-14', invoices);
  assert.deepEqual(Array.from(result, (invoice) => invoice.id), ['a', 'b']);
  assert.equal(matchInvoicesForRemessaWeek('2026NE123', '', invoices).length, 0);
  assert.equal(invoices.length, 6);
});

test('cada envio captura materiais e quantidades sem depender de saldo atualizado', () => {
  const columns = [
    { id: 'r1', titulo: 'Primeira', dataPrevista: '2026-10-14' },
    { id: 'r2', titulo: 'Segunda', dataPrevista: '2026-11-03' },
  ];
  const distrib = { itemA: { r1: 12, r2: 7 }, itemB: { r1: 0, r2: 3 } };
  const stored = snapshotCronogramaRemessas(emp, columns, distrib);
  assert.equal(stored.length, 2);
  assert.deepEqual(Array.from(stored[0].materiais, (item) => item.nome), ['Arroz']);
  assert.deepEqual(Array.from(stored[1].materiais, (item) => item.quantidade), [7, 3]);
  distrib.itemA.r1 = 55;
  emp.items[0].name = 'Material alterado';
  assert.equal(stored[0].materiais[0].quantidade, 12);
  assert.equal(stored[0].materiais[0].nome, 'Arroz');
});

test('histórico lista todas mensagens, sem duplicar último envio e sem reconstruir legado', () => {
  const envioAntigo = {
    messageId: 'gmail-antigo', enviadoEm: '2026-10-10T11:00:00Z',
    remetente: 'origem@exemplo.org', destinatario: 'destino@exemplo.org', assunto: 'Teste', fonteEmailFornecedor: 'local',
  };
  const envioNovo = { ...envioAntigo, messageId: 'gmail-novo', enviadoEm: '2026-10-14T15:30:00Z', remessas: [] };
  const registros = listSentCronogramas([
    { id: 'crono_2026NE123', empenhoId: '2026NE123', historicoEnviosEmail: [envioAntigo, envioNovo], ultimoEnvioEmail: envioNovo },
    { id: 'crono_2026NE789', empenhoId: '2026NE789', ultimoEnvioEmail: { ...envioAntigo, messageId: 'outra' } },
  ]);
  assert.equal(registros.length, 3);
  assert.deepEqual(Array.from(registros, (item) => item.envio.messageId), ['gmail-novo', 'gmail-antigo', 'outra']);
  assert.equal(registros[1].envio.remessas, undefined);
});
