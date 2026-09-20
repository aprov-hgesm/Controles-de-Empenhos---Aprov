#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireText = (source, expected, message) => {
  if (!source.includes(expected)) findings.push(message);
};
const forbidText = (source, forbidden, message) => {
  if (source.includes(forbidden)) findings.push(message);
};

const page = read('app/page.tsx');
const view = read('features/inicio/components/InicioView.tsx');
const constellation = read('features/inicio/components/InicioConstellation.tsx');
const constellationCss = read('features/inicio/components/InicioConstellation.module.css');
const plan = read('lib/operationalSubscriptionPlan.ts');
const docs = read('docs/block-19-home-experience.md');

requireText(view, "import { InicioConstellation }", 'Início não importa a constelação dedicada.');
requireText(view, '<InicioConstellation', 'Início não renderiza a constelação operacional.');
requireText(page, 'onSelectEmpenho={(empenhoId)', 'Página principal não recebe seleção direta da constelação.');
requireText(page, 'setSelectedEmpenhoDetailId(empenhoId)', 'Clique na estrela não seleciona o empenho específico.');
requireText(page, "setActiveTab('empenhos')", 'Clique na estrela não abre o módulo de Empenhos.');
requireText(constellation, 'ACTIVE_STAR_BUDGET = 60', 'Constelação não reserva orçamento para ativos.');
requireText(constellation, 'CLOSED_STAR_BUDGET', 'Constelação não reserva camada histórica.');
requireText(constellation, 'normalizeSupplierKey', 'Constelação não normaliza relações por fornecedor.');
requireText(constellation, 'supplierHashX', 'Posicionamento não cria proximidade por fornecedor.');
requireText(constellation, 'relatedNodes', 'Constelação não calcula relações contextuais.');
requireText(constellation, '<line', 'Constelação não desenha conexões entre empenhos relacionados.');
requireText(constellation, 'getSize(totals.total, maxValue)', 'Tamanho da estrela não representa valor de forma sutil.');
requireText(constellation, "data-stage={node.stage}", 'Estrelas não expõem estágio operacional.');
requireText(constellation, 'receivedPct', 'Tooltip não inclui execução do empenho.');
requireText(constellation, 'formatCurrency(node.balance)', 'Tooltip não inclui saldo do empenho.');
requireText(constellationCss, ".star[data-stage='closed']", 'Histórico encerrado não possui tratamento visual.');
requireText(constellationCss, ".star[data-related='true']", 'Relacionamentos por fornecedor não possuem tratamento visual.');
requireText(constellationCss, '.relationships line', 'Linhas de fornecedor não possuem tratamento visual.');
requireText(constellationCss, '@media (prefers-reduced-motion: reduce)', 'Constelação não respeita reduced motion.');
requireText(plan, 'inicio:', 'Perfil realtime do Início ausente.');
requireText(plan, 'invoices: false', 'Constelação não preserva proteção de invoices realtime.');
requireText(docs, 'Bloco 19.5', 'Documentação não registra a constelação completa.');
forbidText(constellation, 'onSnapshot', 'Constelação abriu listener Firestore direto.');
forbidText(constellation, 'firebase', 'Constelação acoplou Firebase diretamente.');
forbidText(constellation, 'three.js', 'Constelação introduziu Three.js.');
forbidText(constellation, '<canvas', 'Constelação introduziu canvas.');

if (findings.length) {
  console.error('BLOCK 19.5 OPERATIONAL CONSTELLATION: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 19.5 OPERATIONAL CONSTELLATION: READY');
  console.log('Empenho → estrela: ATIVO');
  console.log('Relações por fornecedor: ATIVAS');
  console.log('Abertura direta do empenho: ATIVA');
  console.log('Camada histórica: ATIVA');
  console.log('Realtime adicional: ZERO');
}
