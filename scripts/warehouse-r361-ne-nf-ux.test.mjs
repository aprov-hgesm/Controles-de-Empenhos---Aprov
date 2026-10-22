#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('NE: permite apenas Manual e PDF e impede regressão do importador JSON', () => {
  const view = source('features/empenhos/components/EmpenhosView.tsx');
  const actions = source('features/empenhos/hooks/useEmpenhoActions.ts');
  const state = source('hooks/useOperationalViewState.ts');
  const host = source('features/operational/components/OperationalWorkspace.tsx');
  const pdfGuard = source('scripts/verify-empenho-pdf-direct-import.mjs');
  assert.match(view, /Cadastro Manual/);
  assert.match(view, /Importar PDF da NE/);
  assert.match(view, /empenho-pdf-direct-input/);
  assert.match(view, /newEmpenhoMode === 'pdf'/);
  assert.match(state, /'manual' \| 'pdf'/);
  assert.doesNotMatch(view, /Importar via JSON|newEmpenhoMode === 'json'|setNewEmpenhoMode\('json'\)|handleProcessJson|Processar JSON/);
  assert.doesNotMatch(actions, /const handleProcessJson|PROMPT_EXTRACAO_EMPENHO|handleDownloadPromptTxt/);
  assert.doesNotMatch(host, /handleProcessJson|handleDownloadPromptTxt|jsonInput/);
  assert.match(actions, /reviewEmpenho\.importSource !== 'pdf'/);
  assert.match(pdfGuard, /reviewEmpenho\.importSource !== 'pdf'/);
});

test('NF: cartão é desenhado depois do cenário e não dentro do grupo de palete', () => {
  const landing = source('features/warehouse/components/WarehouseLandingOperational.tsx');
  const css = source('features/warehouse/components/WarehouseLandingOperational.module.css');
  const sceneHint = landing.lastIndexOf('className={styles.sceneHint}');
  const overlay = landing.lastIndexOf('data-visual-role="invoice-tooltip-overlay"');
  const closeSvg = landing.lastIndexOf('</svg>');
  assert.ok(sceneHint >= 0 && overlay > sceneHint && closeSvg > overlay);
  assert.match(landing, /hoveredPendingIndex >= 0/);
  assert.match(landing, /const tooltipY = Math\.max\(20, Math\.min\(SVG_HEIGHT - tooltipHeight - 16/);
  assert.match(css, /\.palletTooltipBackdrop\s*\{[^}]*fill:\s*#040b1b/s);
  assert.equal((landing.match(/<PendingPalletTooltip/g) || []).length, 1);
});

test('NF: click usa chave canônica para navegar aos itens sem modal de lote', () => {
  const landing = source('features/warehouse/components/WarehouseLandingOperational.tsx');
  const queue = source('features/warehouse/components/WarehouseItemRegistrationOperational.tsx');
  assert.match(landing, /const key = row\.invoiceRecordKey\?\.trim\(\)/);
  assert.match(landing, /if \(!key\) continue/);
  assert.match(landing, /onActivate=\{\(pendingGroup\) => \{/);
  assert.match(landing, /encodeURIComponent\(pendingGroup\.key\)/);
  assert.match(landing, /aba=pendentes&nf=/);
  assert.doesNotMatch(landing, /LazyIntakeBulkActionPanel|selectedPendingKey/);
  assert.match(queue, /searchParams\.get\('nf'\)/);
  assert.match(queue, /group\.invoiceRecordKey === focusInvoiceRecordKey/);
  assert.match(queue, /setExpandedInvoices\(\(current\) => new Set/);
  assert.match(queue, /element\.scrollIntoView\(/);
  assert.match(queue, /element\.focus\(/);
});
