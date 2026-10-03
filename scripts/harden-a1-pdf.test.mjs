#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('jsPDF 4 gera ArrayBuffer e Blob PDF válidos', () => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.text('EMPROVEX HARDEN-A1', 20, 20);

  const bytes = new Uint8Array(doc.output('arraybuffer'));
  assert.ok(bytes.length > 500);
  assert.equal(new TextDecoder().decode(bytes.subarray(0, 5)), '%PDF-');

  const blob = doc.output('blob');
  assert.equal(blob.type, 'application/pdf');
  assert.ok(blob.size > 500);
});

test('AutoTable 5 funciona pela API nomeada sem extensão implícita de prototype', () => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  autoTable(doc, {
    head: [['Item', 'Descrição', 'Qtd']],
    body: Array.from({ length: 80 }, (_, index) => [
      String(index + 1),
      'Material EMPROVEX ' + String(index + 1),
      String(index + 2),
    ]),
  });

  assert.ok(doc.getNumberOfPages() > 1, 'A tabela longa deve paginar.');
  const bytes = new Uint8Array(doc.output('arraybuffer'));
  assert.equal(new TextDecoder().decode(bytes.subarray(0, 5)), '%PDF-');
  assert.ok(bytes.length > 2000);
});

test('toolkit e consumidores preservam carregamento sob demanda', () => {
  const toolkit = read('lib/pdfToolkit.ts');
  const cronogramas = read('features/cronogramas/hooks/useCronogramaActions.ts');
  const relatorios = read('features/relatorios/hooks/useDocumentActions.ts');
  const allocation = read('features/warehouse/pdf/WarehouseAllocationSheet.ts');
  const outbound = read('features/warehouse/pdf/WarehouseOutboundDocuments.ts');

  assert.match(toolkit, /await import\('jspdf'\)/);
  assert.match(toolkit, /import\('jspdf-autotable'\)/);
  assert.match(toolkit, /\{ jsPDF \}/);
  assert.match(toolkit, /\{ autoTable \}/);
  assert.match(cronogramas, /loadJsPdfWithAutoTable/);
  assert.match(relatorios, /loadJsPdfWithAutoTable/);
  assert.match(allocation, /await import\('jspdf'\)/);
  assert.match(outbound, /await import\('jspdf'\)/);
});
