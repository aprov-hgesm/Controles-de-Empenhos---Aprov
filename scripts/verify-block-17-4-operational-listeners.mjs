#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const plan=readFileSync('lib/operationalSubscriptionPlan.ts','utf8');
const classes=readFileSync('hooks/useEmpenhoClasses.ts','utf8');
const drive=readFileSync('lib/workspaceDriveSettings.ts','utf8');
const driveHook=readFileSync('hooks/useWorkspaceDriveStorage.ts','utf8');
const failures=[];
if (!plan.includes("inicio: {\n    empenhos: false")) failures.push('Home voltou a abrir coleções brutas.');
if (!classes.includes('enabled = true') || !classes.includes('if (!enabled)')) failures.push('Listener de classes não está condicionado à superfície.');
if (drive.includes('onSnapshot(') || drive.includes('subscribeWorkspaceDriveSettings')) failures.push('Drive settings voltou a listener permanente.');
if (!drive.includes('loadWorkspaceDriveSettings') || !driveHook.includes('loadWorkspaceDriveSettings')) failures.push('Leitura one-shot do Drive ausente.');
if (failures.length){console.error('BLOCK 17.4: FAIL');failures.forEach(x=>console.error('  '+x));process.exit(2);}
console.log('BLOCK 17.4 OPERATIONAL LISTENERS: READY');
