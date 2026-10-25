#!/usr/bin/env node
/**
 * W1 suite registration for isolated W2 and composed Core Lean R2.
 * If the W1 component has NOT been composed at all, report NOT_COMPOSED.
 * If any piece arrives without all mandatory v3 contracts and suites, FAIL.
 * In the coordinator composition this runs real source + Auth/Firestore Emulator.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const W1_CORE = Object.freeze([
  'lib/server/warehouseWithdrawalV3Identity.mjs',
  'lib/server/warehouseWithdrawalV3Write.ts',
  'lib/warehouse/withdrawalV3.ts',
]);
export const W1_SUITES = Object.freeze([
  'scripts/warehouse-withdrawal-v3-contract.test.mjs',
  'scripts/warehouse-w1-v3-emulator.ts',
]);

export function inspectW1(root = process.cwd()) {
  const found = [...W1_CORE, ...W1_SUITES].filter(p => existsSync(join(root,p)));
  if (found.length === 0) return {status:'not_composed',found:[]};
  const missing = [...W1_CORE, ...W1_SUITES].filter(p => !found.includes(p));
  if (missing.length) throw new Error('CI_W1_PARTIAL_COMPOSITION: missing ' + missing.join(', '));
  return {status:'ready',found};
}

export function runW1(mode, root=process.cwd(), spawn=spawnSync) {
  if (!['contract','emulator'].includes(mode)) throw new Error('CI_W1_INVALID_MODE');
  const contract=inspectW1(root);
  if(contract.status==='not_composed'){
    console.warn('[CI W1] NOT_COMPOSED — v3 is NOT certified on this isolated branch');
    return {status:'not_composed',code:0};
  }
  const command = mode==='contract'
    ? [process.execPath,['--test','scripts/warehouse-withdrawal-v3-contract.test.mjs']]
    : [process.platform==='win32'?'npx.cmd':'npx',[
        '--yes','firebase-tools','emulators:exec',
        '--config','firebase.warehouse-security-test.json',
        '--project','demo-emprovex-security','--only','auth,firestore',
        'npx --yes tsx scripts/warehouse-w1-v3-emulator.ts'
      ]];
  const result=spawn(command[0],command[1],{
    cwd:root,stdio:'inherit',timeout:480000,
    env:{...process.env,NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID:'demo-emprovex-security'},
  });
  if(result.error||result.status!==0)throw new Error('CI_W1_'+mode.toUpperCase()+'_FAILED: '+
    (result.error?.message||result.signal||result.status));
  return {status:'pass',code:0};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{runW1(process.argv[2]);}catch(error){console.error('[CI W1] FAIL:',error.message);process.exitCode=1;}
}
