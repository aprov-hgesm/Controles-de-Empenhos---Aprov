#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const before=JSON.parse(readFileSync('ops/firestore-consumption-baseline.json','utf8'));
const after=JSON.parse(readFileSync('ops/firestore-consumption-after-block-17.json','utf8'));
const e2e=readFileSync('tests/e2e/operator-critical-flow.spec.mjs','utf8');
const integrated=readFileSync('tests/e2e/block-16-integrated.spec.mjs','utf8');
const failures=[];
if (before.block !== '17.0') failures.push('Baseline 17.0 foi alterado/invalidado.');
if (after.sessionLease.explicitReadsPerSessionHour !== 0 || after.sessionLease.explicitWritesPerSessionHour !== 4) failures.push('Modelo pós-17 do heartbeat está incorreto.');
if (after.fixedInfrastructure.globalBrandingRealtimeListener !== 0 || after.fixedInfrastructure.driveSettingsRealtimeListener !== 0) failures.push('Listener fixo removido reapareceu no modelo.');
if (after.reports.unboundedInvoicesRealtime !== false) failures.push('Relatórios voltaram a depender de invoices realtime ilimitadas.');
for (const marker of [
  'duas sessões por setor, múltiplas abas compartilham vaga e terceira sessão é barrada',
  'coordenação multiaba mantém um único líder e promove a seguidora sem trocar a sessão lógica',
  "expectRealtimeProfile(page, 2)"
]) if(!e2e.includes(marker)) failures.push('E2E operacional perdeu cenário: '+marker);
for (const marker of ['heartbeat eficiente renova lease de 30 minutos','aba líder propaga revogação administrativa']) {
 if(!integrated.includes(marker)) failures.push('E2E integrado perdeu cenário: '+marker);
}
if(failures.length){console.error('BLOCK 17.8: FAIL');failures.forEach(x=>console.error('  '+x));process.exit(2);}
console.log('BLOCK 17.8 CONSUMPTION/REGRESSION: READY');
