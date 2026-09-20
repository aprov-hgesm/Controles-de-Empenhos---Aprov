#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const model=JSON.parse(readFileSync('ops/firestore-telemetry-fidelity.json','utf8'));
const panel=readFileSync('components/admin/AdminConsolidatedUsagePanel.tsx','utf8');
const telemetry=readFileSync('lib/workspaceUsageTelemetry.ts','utf8');
const failures=[];
if (model.billingRule !== 'No workspace estimate is represented as official billing.') failures.push('Regra de billing/estimativa ausente.');
for (const marker of ['Fonte real · google-cloud-monitoring','Fonte estimada · emprovex-workspace-estimate','nunca são tratadas como equivalentes']) {
 if (!panel.includes(marker)) failures.push('Painel perdeu separação de fontes: '+marker);
}
if (!telemetry.includes("WORKSPACE_USAGE_SOURCE = 'emprovex-workspace-estimate'")) failures.push('Fonte estimada perdeu identidade.');
if (failures.length){console.error('BLOCK 17.6: FAIL');failures.forEach(x=>console.error('  '+x));process.exit(2);}
console.log('BLOCK 17.6 TELEMETRY FIDELITY: READY');
