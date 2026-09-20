#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const q=readFileSync('lib/historicalInvoiceQueries.ts','utf8');
const plan=readFileSync('lib/operationalSubscriptionPlan.ts','utf8');
const report=readFileSync('features/relatorios/components/RelatorioPorEmpenhoView.tsx','utf8');
const supplier=readFileSync('features/relatorios/components/RelatorioPorFornecedorView.tsx','utf8');
const sag=readFileSync('features/relatorios/components/SagImportView.tsx','utf8');
const failures=[];
for (const marker of ["where('empenhoId', '==', normalized)","where('supplierCnpj', '==', normalized)",'limit(HISTORICAL_QUERY_PAGE_SIZE)','startAfter(cursor)']) {
  if (!q.includes(marker)) failures.push('Consulta histórica perdeu marcador: '+marker);
}
const reportBlock=plan.match(/relatorios:\s*\{[\s\S]*?\n\s*\},/)?.[0] || '';
if (!reportBlock.includes('invoices: false')) failures.push('Relatórios voltou a listener global de invoices.');
for (const source of [report,supplier,sag]) if (!source.includes('useHistoricalInvoices')) failures.push('Superfície histórica sem consulta sob demanda.');
if (failures.length){console.error('BLOCK 17.5: FAIL');failures.forEach(x=>console.error('  '+x));process.exit(2);}
console.log('BLOCK 17.5 HISTORICAL SCALABILITY: READY');
