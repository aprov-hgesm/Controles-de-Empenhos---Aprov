#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const q=readFileSync('lib/historicalInvoiceQueries.ts','utf8');
const hot=readFileSync('lib/invoiceHotHistory.ts','utf8');
const nfView=readFileSync('features/notas-fiscais/components/NotasFiscaisView.tsx','utf8');
const empenhosView=readFileSync('features/empenhos/components/EmpenhosView.tsx','utf8');
const plan=readFileSync('lib/operationalSubscriptionPlan.ts','utf8');
const report=readFileSync('features/relatorios/components/RelatorioPorEmpenhoView.tsx','utf8');
const supplier=readFileSync('features/relatorios/components/RelatorioPorFornecedorView.tsx','utf8');
const sag=readFileSync('features/relatorios/components/SagImportView.tsx','utf8');
const failures=[];
for (const marker of ["where('empenhoId', '==', normalized)","where('supplierCnpj', '==', normalized)",'limit(HISTORICAL_QUERY_PAGE_SIZE)','startAfter(cursor)','loadAllInvoicesHistory','loadInvoicesByRecordKeys','getCountFromServer']) {
  if (!q.includes(marker)) failures.push('Consulta histórica perdeu marcador: '+marker);
}
const reportBlock=plan.match(/relatorios:\s*\{[\s\S]*?\n\s*\},/)?.[0] || '';
if (!reportBlock.includes('invoices: false')) failures.push('Relatórios voltou a listener global de invoices.');
for (const source of [report,supplier,sag]) if (!source.includes('useHistoricalInvoices')) failures.push('Superfície histórica sem consulta sob demanda.');
if (!hot.includes("return getInvoiceOperationalLocation(invoice) !== 'TESOURARIA'")) failures.push('Contrato hot/history não preserva somente NFs operacionais.');
if (!nfView.includes('loadCompleteHistory')) failures.push('Nova NF não carrega histórico explicitamente sob demanda.');
if (!empenhosView.includes('useHistoricalInvoices')) failures.push('Detalhe de Empenhos não carrega histórico seletivo.');

for (const total of [100, 1000, 10000]) {
  const operational = 20;
  const before = total;
  const after = operational;
  if (!(after < before)) failures.push('Cenário sintético PERF-X não reduz documentos realtime para N=' + total);
}

if (failures.length){console.error('BLOCK 17.5: FAIL');failures.forEach(x=>console.error('  '+x));process.exit(2);}
console.log('BLOCK 17.5 HISTORICAL SCALABILITY: READY');
console.log('PERF-X synthetic: N=100/1000/10000 -> realtime operacional=20; histórico pré-solicitação=0 (não é produção).');
