import fs from 'node:fs';
import ts from 'typescript';

const PAGE_PATH = 'app/page.tsx';
const HOOK_PATH = 'hooks/useOperationalViewState.ts';

let source = fs.readFileSync(PAGE_PATH, 'utf8');
const originalLineCount = source.split('\n').length;

const startMarker = '  // --- VIEW 1: PAINEL / DASHBOARD STATES ---';
const endMarker = '  // Reset NF inputs when changing target empenho';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0 || end <= start) {
  throw new Error('Bloco contíguo de estados das views não encontrado.');
}

const stateBlock = source.slice(start, end).trimEnd();
const stateRegex = /const\s+\[\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\]\s*=\s*useState/g;
const stateNames = [];
for (const match of stateBlock.matchAll(stateRegex)) {
  stateNames.push(match[1], match[2]);
}

if (stateNames.length < 70) {
  throw new Error(`Guardrail: poucos bindings de estado detectados (${stateNames.length}).`);
}
if (new Set(stateNames).size !== stateNames.length) {
  throw new Error('Guardrail: bindings de estado duplicados detectados.');
}

const chunk = (items, size) => {
  const rows = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
};

const returnRows = chunk(stateNames, 6).map(row => `    ${row.join(', ')},`).join('\n');
const destructureRows = chunk(stateNames, 6).map(row => `    ${row.join(', ')},`).join('\n');

const hookSource = `'use client';\n\nimport { useState } from 'react';\nimport type { CronogramaEntregaColuna, Invoice } from '../lib/types';\n\n/**\n * Centraliza apenas estado efêmero de interface das telas operacionais.\n * Não contém persistência, regras de negócio, Firebase ou efeitos externos.\n */\nexport function useOperationalViewState() {\n${stateBlock}\n\n  return {\n${returnRows}\n  };\n}\n`;

const hookAst = ts.createSourceFile(HOOK_PATH, hookSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
if (hookAst.parseDiagnostics.length) {
  throw new Error(`Hook gerado inválido: ${hookAst.parseDiagnostics.map(d => d.messageText).join('; ')}`);
}

fs.mkdirSync('hooks', { recursive: true });
fs.writeFileSync(HOOK_PATH, hookSource);

const importLine = "import { useOperationalViewState } from '../hooks/useOperationalViewState';\n";
const importAnchor = "import { usePlatformBranding } from '../hooks/usePlatformBranding';\n";
if (!source.includes(importLine)) {
  if (!source.includes(importAnchor)) throw new Error('Âncora usePlatformBranding não encontrada.');
  source = source.replace(importAnchor, importAnchor + importLine);
}

const replacement = `  const {\n${destructureRows}\n  } = useOperationalViewState();\n\n`;
source = source.slice(0, start) + replacement + source.slice(end);

const pageAst = ts.createSourceFile(PAGE_PATH, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
if (pageAst.parseDiagnostics.length) {
  throw new Error(`page.tsx inválido após extração: ${pageAst.parseDiagnostics.map(d => d.messageText).join('; ')}`);
}

if (!source.includes(endMarker)) throw new Error('Guardrail: efeito de reset de NF desapareceu.');
if (!source.includes('<DashboardView')) throw new Error('Guardrail: DashboardView desapareceu.');
if (!source.includes('<CronogramasView')) throw new Error('Guardrail: CronogramasView desapareceu.');
if (!source.includes('<MobileNavigation')) throw new Error('Guardrail: MobileNavigation desapareceu.');
if (source.includes(startMarker)) throw new Error('Guardrail: bloco antigo de estados ainda existe no page.tsx.');

fs.writeFileSync(PAGE_PATH, source);
const newLineCount = source.split('\n').length;
console.log(`Extraídos ${stateNames.length / 2} pares useState para ${HOOK_PATH}.`);
console.log(`page.tsx: ${originalLineCount} -> ${newLineCount} linhas.`);
