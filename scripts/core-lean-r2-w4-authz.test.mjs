#!/usr/bin/env node
/** W4 independently samples authorization decision under PR #370 without imports on main. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const src=readFileSync('lib/server/authorizationPolicy.ts','utf8');
const js=ts.transpileModule(src,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,
}}).outputText;
const policy=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const actor={uid:'uid-a',email:'a@example.test',role:'sector',workspaceId:'ws-a',ug:'160500'};
const check=(principal,request)=>policy.evaluateServerAuthorization(principal,request);
test('W4 AuthZ: valid sector only allowed within exact tenant+UG',()=>{
  assert.deepEqual(check(actor,{capability:'warehouse.command',workspaceId:'ws-a',
    ug:'160500',operation:'TRANSFER'}),{allowed:true});
  for(const [workspaceId,ug] of [['ws-b','160500'],['ws-a','160501'],['../ws-a','160500']]){
    assert.deepEqual(check(actor,{capability:'warehouse.command',workspaceId,ug,
      operation:'TRANSFER'}),{allowed:false,reason:'SCOPE_MISMATCH'});
  }
});
test('W4 AuthZ: unrecognized capability, path, generic ledger, escalated role denied',()=>{
  for(const op of ['LEDGER_MOVEMENT','DELETE_ALL','ADMIN_OVERRIDE','__proto__','','../../']){
    assert.deepEqual(check(actor,{capability:'warehouse.command',workspaceId:'ws-a',
      operation:op}),{allowed:false,reason:'OPERATION_DENIED'});
  }
  assert.deepEqual(check(actor,{capability:'core.superuser',workspaceId:'ws-a'}),
    {allowed:false,reason:'FORBIDDEN'});
  assert.deepEqual(check(actor,{capability:'platform.admin'}),{allowed:false,reason:'FORBIDDEN'});
});
test('W4 AuthZ: invalid actor UID, UG, role or tenant never authorize',()=>{
  for(const broken of [
    {...actor,uid:''},{...actor,email:''},{...actor,workspaceId:'../other'},
    {...actor,ug:'wrong'},{...actor,role:'administrator'},
  ]){
    assert.deepEqual(check(broken,{capability:'warehouse.read'}),
      {allowed:false,reason:'INVALID_PRINCIPAL'});
  }
});
test('W4 AuthZ: cross-capability command cannot use a read-only grant',()=>{
  assert.deepEqual(check(actor,{capability:'warehouse.read',workspaceId:'ws-a',
    operation:'TRANSFER'}),{allowed:false,reason:'OPERATION_DENIED'});
  assert.deepEqual(check(actor,{capability:'warehouse.command',
    operation:'TRANSFER'}),{allowed:false,reason:'INVALID_SCOPE'});
});
