#!/usr/bin/env node
/** Real W4 authorization test only after PR #370 policy is composed. */
import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
export const AUTH_POLICY='lib/server/authorizationPolicy.ts';
export const AUTH_TEST='scripts/core-lean-r2-w4-authz.test.mjs';
export function inspectAuthz(root=process.cwd()) {
  const source=existsSync(join(root,AUTH_POLICY));
  const suite=existsSync(join(root,AUTH_TEST));
  if(!suite)throw new Error('CI_W4_AUTHZ_SUITE_MISSING');
  if(!source){
    if(process.env.CI_LEAN_REQUIRE_AUTHZ==='1'||process.env.CI_LEAN_REQUIRE_COMPOSED==='1')
      throw new Error('CI_W4_AUTHZ_REQUIRED_MISSING');
    return {status:'not_composed'};
  }
  return {status:'ready'};
}
export function runAuthz(root=process.cwd(),spawn=spawnSync) {
  const state=inspectAuthz(root);
  if(state.status==='not_composed'){
    console.warn('[CI W4 AUTHZ] NOT_COMPOSED — server policy #370 is not certified here');
    return state;
  }
  const res=spawn(process.execPath,['--test',AUTH_TEST],{cwd:root,stdio:'inherit',timeout:180000});
  if(res.error||res.status!==0)throw new Error('CI_W4_AUTHZ_FAILED: '+(res.error?.message||res.signal||res.status));
  return {status:'pass'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{runAuthz();}catch(error){console.error('[CI W4 AUTHZ] FAIL:',error.message);process.exitCode=1;}
}
