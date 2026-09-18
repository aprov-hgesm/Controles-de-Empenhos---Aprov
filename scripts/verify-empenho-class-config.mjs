import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const classes = read('lib/empenhoClasses.ts');
const hook = read('hooks/useEmpenhoClasses.ts');
const empenhosView = read('features/empenhos/components/EmpenhosView.tsx');
const dashboard = read('features/dashboard/components/DashboardView.tsx');
const cronogramas = read('features/cronogramas/components/CronogramasView.tsx');
const sidebar = read('components/layout/AppSidebar.tsx');
const mobile = read('components/layout/MobileNavigation.tsx');
const relatorios = read('features/relatorios/components/RelatoriosView.tsx');
const actions = read('features/empenhos/hooks/useEmpenhoActions.ts');

requireText(classes, "code: 'FUNADOM'", 'Classe FUNADOM não está definida entre os padrões.');
requireText(classes, 'normalizeEmpenhoClassCode', 'Classes novas não possuem normalização de código.');
requireText(hook, "SETTINGS_DOCUMENT_ID = 'empenhoClasses'", 'Configuração não está persistida em settings/empenhoClasses.');
requireText(hook, 'operationalScopeFromContext', 'Configuração de classes não está isolada pelo workspace.');
requireText(empenhosView, 'Configuração das Classes de Empenho', 'Tela não possui gerenciador de classes.');
requireText(empenhosView, 'Salvar descritivo', 'Descritivo da classe não pode ser editado.');
requireText(empenhosView, 'Adicionar classe', 'Nova classe não pode ser adicionada.');
requireText(empenhosView, 'handleUpdateEmpenhoClassification', 'Classe de empenho existente não pode ser alterada.');
requireText(actions, 'handleUpdateEmpenhoClassification', 'Ação persistente de troca de classe não existe.');
requireText(empenhosView, 'pt-20 sm:pt-24', 'Modal de novo empenho não possui posicionamento visível no viewport.');
requireText(empenhosView, 'max-h-[calc(100vh-7rem)]', 'Modal de novo empenho não limita altura ao viewport.');
requireText(dashboard, 'activeClassCodes', 'Dashboard não identifica classes ativas.');
requireText(dashboard, '.filter((definition) => activeClassCodes.has(definition.code))', 'Dashboard não oculta classes sem empenhos.');
requireText(cronogramas, 'empenhoClasses.map', 'Cronogramas ainda usa lista fixa de classes.');
requireText(sidebar, '<span>Empenhos</span>', 'Sidebar não renomeou Cadastro de Empenhos para Empenhos.');
requireText(sidebar, '<span>Relatórios</span>', 'Sidebar não renomeou a aba antiga Empenhos para Relatórios.');
requireText(mobile, '>Empenhos</span>', 'Navegação mobile não usa Empenhos.');
requireText(mobile, '>Relatórios</span>', 'Navegação mobile não usa Relatórios.');
requireText(relatorios, '>Relatórios</h2>', 'Título da tela de relatórios não foi atualizado.');

if (findings.length > 0) {
  console.error('EMPENHO CLASS CONFIG GUARD: FAIL');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  process.exitCode = 2;
} else {
  console.log('EMPENHO CLASS CONFIG GUARD: READY');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}
