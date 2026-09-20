#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
const audit=JSON.parse(readFileSync('ops/block-17-final-audit.json','utf8'));
const required=[
 'scripts/verify-block-17-2-multitab-coordination.mjs',
 'scripts/verify-block-17-3-branding-efficiency.mjs',
 'scripts/verify-block-17-4-operational-listeners.mjs',
 'scripts/verify-block-17-5-historical-scalability.mjs',
 'scripts/verify-block-17-6-telemetry-fidelity.mjs',
 'scripts/verify-block-17-7-app-check.mjs',
 'scripts/verify-block-17-8-consumption-regression.mjs'
];
const failures=[];
for(const file of required) if(!existsSync(file)) failures.push('Guard ausente: '+file);
const ux=audit.operatorExperienceContract || {};
if(ux.newRequiredFields!==0 || ux.newRequiredConfirmations!==0 || ux.manualRefreshRequired!==false || ux.captchaRequired!==false) failures.push('Contrato de experiência do operador regrediu.');
if(audit.productionDeploy!==false) failures.push('Bloco 17 não deve afirmar deploy de produção.');
for(const invariant of ['multi-tenant workspace/UG isolation','two simultaneous external sessions per workspace','Google Drive workspace isolation']) {
 if(!audit.invariants.includes(invariant)) failures.push('Invariante ausente: '+invariant);
}
if(failures.length){console.error('BLOCK 17.9 FINAL CLOSURE: FAIL');failures.forEach(x=>console.error('  '+x));process.exit(2);}
console.log('BLOCK 17.9 FINAL CLOSURE: READY');
console.log('OPERATOR EXPERIENCE: NO NEW BUREAUCRACY');
