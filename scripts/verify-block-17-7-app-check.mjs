#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const firebase=readFileSync('lib/firebase.ts','utf8');
const docs=readFileSync('docs/BLOCK_17_7_APP_CHECK.md','utf8');
const failures=[];
for (const marker of ["from 'firebase/app-check'","ReCaptchaEnterpriseProvider","NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY","!useE2eEmulators","isTokenAutoRefreshEnabled: true"]) {
 if (!firebase.includes(marker)) failures.push('App Check perdeu marcador: '+marker);
}
if (firebase.includes('FIREBASE_APPCHECK_DEBUG_TOKEN')) failures.push('Debug token/mode não deve ser versionado na inicialização de produção.');
for (const marker of ['Publicar sem enforcement','Observar métricas App Check em produção','enforcement progressivo']) {
 if (!docs.includes(marker)) failures.push('Rollout App Check perdeu etapa: '+marker);
}
if (failures.length){console.error('BLOCK 17.7: FAIL');failures.forEach(x=>console.error('  '+x));process.exit(2);}
console.log('BLOCK 17.7 APP CHECK: READY FOR OBSERVATION ROLLOUT');
