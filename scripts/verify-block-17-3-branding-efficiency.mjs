#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const branding=readFileSync('hooks/usePlatformBranding.ts','utf8');
const rules=readFileSync('firestore.rules','utf8');
const failures=[];
if (branding.includes('onSnapshot(')) failures.push('Branding voltou a manter listener realtime.');
for (const marker of ["getDoc(doc(db, 'settings', 'global'))","NEXT_PUBLIC_EMPROVEX_LOGO_URL","emprovex:branding-logo:v1"]) {
  if (!branding.includes(marker)) failures.push('Branding eficiente perdeu marcador: '+marker);
}
if (!rules.includes('match /settings/global') || !rules.includes('allow write: if false;')) failures.push('Marca global perdeu imutabilidade nas Rules.');
if (failures.length){console.error('BLOCK 17.3: FAIL');failures.forEach(x=>console.error('  '+x));process.exit(2);}
console.log('BLOCK 17.3 BRANDING EFFICIENCY: READY');
