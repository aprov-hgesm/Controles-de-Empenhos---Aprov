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
const detail=readFileSync(join(root,'components/admin2/customers/AdminCustomerDetailV2.tsx'),'utf8');
const rules=readFileSync(join(root,'firestore.rules'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exports={};
runInNewContext(compiled,{exports,Set,Array,Date}, {filename:'commercialCustomerContract.js'});
const { normalizeCommercialCustomerInput,validateCommercialCustomerInput,buildCommercialCustomer }=exports;

const demo={workspaceId:'sector-a',displayName:'  Cliente Teste  ',contactName:' Exemplo ',
  contactEmail:' RESPONSAVEL@EXAMPLE.INVALID ',contactPhone:'  ',
  relationshipStatus:'prospect',relationshipNotes:'  Acompanhamento inicial '};

test('Cliente comercial independente segue 1 workspace = 1 cadastro',()=>{
  const v=normalizeCommercialCustomerInput(demo);
  assert.equal(v.workspaceId,'sector-a');
  assert.equal(v.displayName,'Cliente Teste');
  assert.equal(v.contactEmail,'responsavel@example.invalid');
  assert.deepEqual(Array.from(validateCommercialCustomerInput(v)),[]);
  const saved=buildCommercialCustomer('sector-a',demo,'admin@example.invalid','2026-10-18T00:00:00Z');
  assert.equal(saved.id,saved.workspaceId);
  assert.equal(saved.version,'emprovex_commercial_customer_v2');
  assert.ok(!('workspaceIds' in saved));
  assert.ok(!('firebaseUid' in saved));
  assert.ok(!('ug' in saved));
});

test('atualização mantém autoria e workspace imutáveis',()=>{
  const first=buildCommercialCustomer('sector-a',demo,'admin@example.invalid','2026-10-18T00:00:00Z');
  const edited=buildCommercialCustomer('sector-a',{...demo,displayName:'Novo nome'},'other@example.invalid','2026-10-19T00:00:00Z',first);
  assert.equal(edited.createdBy,'admin@example.invalid');
  assert.equal(edited.createdAt,first.createdAt);
  assert.equal(edited.updatedBy,'other@example.invalid');
  assert.throws(()=>buildCommercialCustomer('sector-b',demo,'admin@example.invalid','2026-10-19T00:00:00Z'),/identificador comercial/);
  assert.throws(()=>buildCommercialCustomer('sector-a',{...demo,workspaceId:'sector-b'},'admin@example.invalid','2026-10-19T00:00:00Z',first),/identificador comercial/);
});

test('validação impede falta de workspace e status inesperado',()=>{
  assert.ok(validateCommercialCustomerInput({...demo,workspaceId:''}).length>0);
  assert.ok(validateCommercialCustomerInput({...demo,workspaceId:'sector-a,sector-b'}).length>0);
  assert.ok(validateCommercialCustomerInput({...demo,contactEmail:'abc'}).length>0);
  assert.ok(validateCommercialCustomerInput({...demo,relationshipStatus:'superadmin'}).length>0);
});

test('persistência é determinística, Emulator-only e Rules exigem o workspace real',()=>{
  assert.match(repo,/NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS === '1'/);
  assert.match(repo,/process\.env\.NODE_ENV === 'development'/);
  assert.match(repo,/runTransaction/);
  assert.match(repo,/doc\(db, CUSTOMERS, workspaceId\)/);
  assert.match(repo,/tx\.get\(workspaceRef\)/);
  assert.match(repo,/if \(current\.exists\(\)\)/);
  assert.doesNotMatch(repo,/platformCustomerWorkspaceLinks/);
  assert.match(rules,/match \/platformCustomers\/\{workspaceId\}/);
  assert.match(rules,/data\.id == workspaceId/);
  assert.match(rules,/data\.workspaceId == workspaceId/);
  assert.match(rules,/exists\(\/databases\/\$\(database\)\/documents\/workspaces\/\$\(workspaceId\)\)/);
  assert.doesNotMatch(rules,/platformCustomerWorkspaceLinks/);
  assert.match(rules,/allow delete: if false/);
});

test('prévia fornece formulário de contato e vínculo, sem writes ao Firebase real',()=>{
  assert.match(ui,/data-testid="admin2-commercial-form"/);
  assert.match(ui,/contactName/);
  assert.match(ui,/contactPhone/);
  assert.match(ui,/relationshipNotes/);
  assert.match(ui,/readCustomerWorkspacePage/);
  assert.match(ui,/Workspace do cliente \(obrigatório e único\)/);
  assert.doesNotMatch(ui,/workspaceIds|oito workspaces/);
  assert.match(ui,/Modo prévia segura/);
  assert.match(ui,/Rascunho salvo apenas na memória/);
  assert.match(directory,/data-testid="admin2-commercial-tab"/);
  assert.match(directory,/commercialDrafts/);
  assert.match(directory,/commercialCustomer={commercialDrafts\.find/);
  assert.match(detail,/matchedCommercial\?\.contactName/);
  assert.match(detail,/readCommercialCustomerForWorkspace/);
});
