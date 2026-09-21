#!/usr/bin/env node

import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const exercise = read('features/empenhos/domain/empenhoExercise.ts');
const dashboard = read('features/dashboard/components/DashboardView.tsx');
const empenhos = read('features/empenhos/components/EmpenhosView.tsx');
const operationalData = read('hooks/useOperationalData.ts');
const docs = read('docs/RPNP_VISUAL_PRIORITY.md');

assert(exercise.includes("if (exerciseYear === currentYear - 1) return 'rpnp';"), 'RPNP deve representar o exercício imediatamente anterior na v1.');
assert(exercise.includes("return getEmpenhoExerciseKind(empenho, referenceDate) === 'rpnp';"), 'A regra RPNP precisa permanecer centralizada.');
assert(exercise.includes('RPNP'), 'A apresentação precisa produzir o sufixo RPNP.');
assert(!exercise.includes('classification:') || !exercise.includes('classification: RPNP'), 'RPNP não pode virar uma classe persistida.');

assert(dashboard.includes('::RPNP'), 'Dashboard precisa manter segmento RPNP separado da classe-base.');
assert(dashboard.includes('Saldo RPNP prioritário'), 'Dashboard precisa expor o saldo RPNP prioritário.');
assert(dashboard.includes('Restos a Pagar Não Processados'), 'Dashboard precisa identificar semanticamente RPNP.');
assert(dashboard.includes('matchesClassSegment'), 'Cálculos do Dashboard precisam respeitar o segmento RPNP.');
assert(dashboard.includes('Prioridade'), 'Dashboard precisa manter destaque discreto de prioridade.');

assert(empenhos.includes('compareEmpenhosByRpnpPriority'), 'A aba Empenhos precisa ordenar RPNP primeiro.');
assert(empenhos.includes('getEmpenhoDisplayClassification(emp)'), 'Cards precisam exibir classificação derivada.');
assert(empenhos.includes('prioridade de liquidação'), 'Cards RPNP precisam comunicar prioridade de liquidação.');
assert(empenhos.includes('getEmpenhoYearFilterLabel(y)'), 'Filtro de ano precisa identificar o exercício RPNP.');
assert(operationalData.includes('getEmpenhoExerciseYear(emp)'), 'Detecção de exercício deve ser centralizada nos filtros.');

assert(docs.includes('RPNP **não é gravado** em `classification`'), 'Documentação precisa registrar a não persistência de RPNP.');
assert(docs.includes('prioridade implementada é **visual e de ordenação**'), 'Documentação precisa limitar o escopo da prioridade.');

console.log('RPNP visual priority guard: OK');
