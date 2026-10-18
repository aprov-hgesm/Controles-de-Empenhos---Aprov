import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const root=process.cwd();
const source=readFileSync(join(root,'lib/admin2/customers/commercialCustomerContract.ts'),'utf8');
const repo=readFileSync(join(root,'lib/admin2/customers/commercialCustomerRepository.ts'),'utf8');
const ui=readFileSync(join(root,'components/admin2/customers/AdminCommercialCustomers.tsx'),'utf8');
const directory=readFileSync(join(root,'components/admin2/customers/AdminCustomersDirectory.tsx'),'utf8');
const rules=readFileSync(join(root,'firestore.rules'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exports={};
runInNewContext(compiled,{exports,Set,Array,Date}, {filename:'commercialCustomerContract.js'});
const { normalizeCommercialCustomerInput,validateCommercialCustomerInput,buildCommercialCustomer,ADMIN2_MAX_LINKED_WORKSPACES }=exports;

const demo={displayName:'  Cliente Teste  ',contactName:' Exemplo ',
  contactEmail:' RESPONSAVEL@EXAMPLE.INVALID ',contactPhone:'  ',
  relationshipStatus:'prospect',relationshipNotes:'  Acompanhamento inicial ',
  workspaceIds:['sector-b','sector-a','sector-a']};

test('Cliente comercial é entidade independente e múltiplos vínculos normalizados',()=>{
  const v=normalizeCommercialCustomerInput(demo);
  assert.equal(v.displayName,'Cliente Teste');
  assert.equal(v.contactEmail,'responsavel@example.invalid');
  assert.equal(v.workspaceIds.length,2);
  assert.equal(v.workspaceIds.join(','),'sector-a,sector-b');
  assert.deepEqual(Array.from(validateCommercialCustomerInput(v)),[]);
  const saved=buildCommercialCustomer('test-1',demo,'admin@example.invalid','2026-10-18T00:00:00Z');
  assert.equal(saved.id,'test-1');
  assert.equal(saved.workspaceIds.length,2);
  assert.ok(!('firebaseUid' in saved));
  assert.ok(!('ug' in saved));
});

test('atualização mantém autoria original',()=>{
  const first=buildCommercialCustomer('c1',demo,'admin@example.invalid','2026-10-18T00:00:00Z');
  const edited=buildCommercialCustomer('c1',{...demo,displayName:'Novo nome'},'other@example.invalid','2026-10-19T00:00:00Z',first);
  assert.equal(edited.createdBy,'admin@example.invalid');
  assert.equal(edited.createdAt,first.createdAt);
  assert.equal(edited.updatedBy,'other@example.invalid');
});

test('validação impede dados ruins, vínculo repetido e status inesperado',()=>{
  assert.ok(validateCommercialCustomerInput({...demo,workspaceIds:['sector-a','sector-a']}).length>0);
  assert.ok(validateCommercialCustomerInput({...demo,workspaceIds:Array.from({length:9},(_,i)=>'sector-'+i)}).length>0);
  assert.ok(validateCommercialCustomerInput({...demo,contactEmail:'abc'}).length>0);
  assert.ok(validateCommercialCustomerInput({...demo,relationshipStatus:'superadmin'}).length>0);
  assert.equal(ADMIN2_MAX_LINKED_WORKSPACES,8);
});

test('escrita Firestore somente habilitada em modo dev e Emulator e protegida por Rules',()=>{
  assert.match(repo,/NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS === '1'/);
  assert.match(repo,/process\.env\.NODE_ENV === 'development'/);
  assert.match(repo,/runTransaction/);
  assert.match(repo,/tx\.get\(ref\)/);
  assert.match(repo,/tx\.delete\(ref\)/);
  assert.match(repo,/if \(!currentLinks\[index\]\.exists\(\)\) tx\.set/);
  assert.match(rules,/match \/platformCustomers\/\{customerId\}/);
  assert.match(rules,/match \/platformCustomerWorkspaceLinks\/\{workspaceId\}/);
  assert.match(rules,/allow get, list: if isPlatformAdmin\(\)/);
  assert.match(rules,/allow update: if false/);
  assert.match(rules,/existsAfter\(/);
});

test('prévia fornece formulário de contato e vínculo, sem writes ao Firebase real',()=>{
  assert.match(ui,/data-testid="admin2-commercial-form"/);
  assert.match(ui,/contactName/);
  assert.match(ui,/contactPhone/);
  assert.match(ui,/relationshipNotes/);
  assert.match(ui,/readCustomerWorkspacePage/);
  assert.match(ui,/Modo prévia segura/);
  assert.match(ui,/Rascunho salvo apenas na memória/);
  assert.match(directory,/data-testid="admin2-commercial-tab"/);
  assert.match(directory,/commercialDrafts/);
});
