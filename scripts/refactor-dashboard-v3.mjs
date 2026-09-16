import fs from 'node:fs';

const PAGE_PATH = 'app/page.tsx';
const DASHBOARD_PATH = 'features/dashboard/components/DashboardView.tsx';

let source = fs.readFileSync(PAGE_PATH, 'utf8');

const startNeedle = "{activeTab === 'painel' && (() => {";
const nextMarker = '{/* TAB 2: LISTA DE EMPENHOS / NOTAS DE EMPENHO */}';

const start = source.indexOf(startNeedle);
if (start < 0) throw new Error('Bloco do Dashboard não encontrado.');
const markerIndex = source.indexOf(nextMarker, start);
if (markerIndex < 0) throw new Error('Marcador da próxima aba não encontrado.');

const blockEnd = source.lastIndexOf('\n', markerIndex);
const block = source.slice(start, blockEnd).trimEnd();
if (!block.endsWith('})()}')) {
  throw new Error(`Final inesperado do Dashboard: ${block.slice(-40)}`);
}

const andIndex = block.indexOf('&&');
let expression = block.slice(andIndex + 2).trim();
expression = expression.slice(0, -1).trim(); // remove a chave externa do JSX expression

const dashboardFile = `'use client';\n\nimport type { Dispatch, SetStateAction } from 'react';\nimport { CheckCircle2, Coins, Filter, Layers, Search, X } from 'lucide-react';\nimport type { Empenho } from '../../../lib/types';\n\ntype DashboardClassFilter = 'TODAS' | 'QR' | 'CALI' | 'PASA';\ntype ActiveTab = 'painel' | 'empenhos' | 'itens' | 'nova_nf' | 'relatorios' | 'itens_empenho' | 'cronogramas';\ntype NfSubTab = 'acompanhar' | 'cadastrar' | 'comissao';\n\ninterface DashboardViewProps {\n  dashboardClassFilter: DashboardClassFilter;\n  dashboardPregaoFilter: string;\n  dashboardSearch: string;\n  empenhos: Empenho[];\n  getBalanceByClass: (classification: 'QR' | 'CALI' | 'PASA') => number;\n  setActiveTab: Dispatch<SetStateAction<ActiveTab>>;\n  setDashboardClassFilter: Dispatch<SetStateAction<DashboardClassFilter>>;\n  setDashboardPregaoFilter: Dispatch<SetStateAction<string>>;\n  setDashboardSearch: Dispatch<SetStateAction<string>>;\n  setEditingEmpenhoId: Dispatch<SetStateAction<string>>;\n  setNfSubTab: Dispatch<SetStateAction<NfSubTab>>;\n  setSelectedNFCommitmentId: Dispatch<SetStateAction<string>>;\n  uniquePregaos: string[];\n}\n\n/**\n * Dashboard operacional extraído do page.tsx sem alterar regras, cálculos ou interações.\n * Este componente recebe somente o estado e os callbacks necessários para a tela.\n */\nexport function DashboardView({\n  dashboardClassFilter,\n  dashboardPregaoFilter,\n  dashboardSearch,\n  empenhos,\n  getBalanceByClass,\n  setActiveTab,\n  setDashboardClassFilter,\n  setDashboardPregaoFilter,\n  setDashboardSearch,\n  setEditingEmpenhoId,\n  setNfSubTab,\n  setSelectedNFCommitmentId,\n  uniquePregaos,\n}: DashboardViewProps) {\n  return ${expression};\n}\n`;

fs.mkdirSync('features/dashboard/components', { recursive: true });
fs.writeFileSync(DASHBOARD_PATH, dashboardFile);

const replacement = `{activeTab === 'painel' && (\n            <DashboardView\n              dashboardClassFilter={dashboardClassFilter}\n              dashboardPregaoFilter={dashboardPregaoFilter}\n              dashboardSearch={dashboardSearch}\n              empenhos={empenhos}\n              getBalanceByClass={getBalanceByClass}\n              setActiveTab={setActiveTab}\n              setDashboardClassFilter={setDashboardClassFilter}\n              setDashboardPregaoFilter={setDashboardPregaoFilter}\n              setDashboardSearch={setDashboardSearch}\n              setEditingEmpenhoId={setEditingEmpenhoId}\n              setNfSubTab={setNfSubTab}\n              setSelectedNFCommitmentId={setSelectedNFCommitmentId}\n              uniquePregaos={uniquePregaos}\n            />\n          )}`;

// Primeiro substitui o bloco usando os índices calculados sobre o arquivo original.
source = source.slice(0, start) + replacement + source.slice(blockEnd);

// Depois adiciona o import, evitando deslocar os índices da substituição.
const dashboardImport = "import { DashboardView } from '../features/dashboard/components/DashboardView';\n";
const importAnchor = "import { ToastNotification } from '../components/layout/ToastNotification';\n";
if (!source.includes(dashboardImport)) {
  if (!source.includes(importAnchor)) throw new Error('Âncora de import do Dashboard não encontrada.');
  source = source.replace(importAnchor, importAnchor + dashboardImport);
}

fs.writeFileSync(PAGE_PATH, source);

const lineCount = source.split('\n').length;
if (lineCount < 1000) throw new Error(`Proteção de integridade acionada: page.tsx ficou com apenas ${lineCount} linhas.`);

console.log('Dashboard extraído para componente próprio com props tipadas.');
console.log(`page.tsx agora possui ${lineCount} linhas.`);
console.log(`Novo componente: ${DASHBOARD_PATH}`);
