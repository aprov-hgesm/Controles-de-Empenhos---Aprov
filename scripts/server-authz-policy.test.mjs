#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const read = (name) => readFileSync(resolve(process.cwd(),name),'utf8');
const output = ts.transpileModule(read('lib/server/authorizationPolicy.ts'),{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
}).outputText;
const {evaluateServerAuthorization,WAREHOUSE_ALLOWED_OPERATIONS} =
  await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));

const sector={uid:'sector-firebase-uid',email:'sector@example.test',
  role:'sector',workspaceId:'workspace-a',ug:'160500'};
const founder={uid:'founder-firebase-uid',email:'founder@example.test',
  role:'founder',workspaceId:'hgesm-aprov',ug:'160416'};
const evaluate=(actor,capability,workspaceId,operation,ug) =>
  evaluateServerAuthorization(actor,{capability,workspaceId,operation,ug});
const allowed=(result) => assert.deepEqual(result,{allowed:true});
const denied=(result,reason) => assert.deepEqual(result,{allowed:false,reason});

test('usuário de setor autenticado pode ler somente seu escopo',()=>{
  allowed(evaluate(sector,'warehouse.read','workspace-a',undefined,'160500'));
  denied(evaluate(sector,'warehouse.read','workspace-b'),'SCOPE_MISMATCH');
  denied(evaluate(sector,'warehouse.read','workspace-a',undefined,'160501'),'SCOPE_MISMATCH');
});

test('comandos exigem workspace explícito e permitido',()=>{
  for(const op of ['TRANSFER','ALLOCATE','INVENTORY_ADJUST','SISCOFIS_CONFIRM','STOCK_RETURN'])
    allowed(evaluate(sector,'warehouse.command','workspace-a',op));
  denied(evaluate(sector,'warehouse.command',undefined,'TRANSFER'),'INVALID_SCOPE');
  denied(evaluate(sector,'warehouse.command','workspace-b','TRANSFER'),'SCOPE_MISMATCH');
  denied(evaluate(sector,'warehouse.command','workspace-a','ANYTHING'),'OPERATION_DENIED');
  denied(evaluate(sector,'warehouse.command','workspace-a',undefined),'OPERATION_DENIED');
});

test('saldo genérico, privilégios implícitos e operações arbitrárias proibidos',()=>{
  for(const op of ['LEDGER_MOVEMENT','DELETE_ALL','ADMIN_OVERRIDE','*',''])
    denied(evaluate(sector,'warehouse.command','workspace-a',op),'OPERATION_DENIED');
  denied(evaluate(sector,'warehouse.command','workspace-a',{}),'OPERATION_DENIED');
  denied(evaluate(sector,'warehouse.read','workspace-a','TRANSFER'),'OPERATION_DENIED');
});

test('processamento de NE também exige identidade operacional ativa',()=>{
  allowed(evaluate(sector,'core.parse','workspace-a'));
  denied(evaluate(sector,'core.parse','workspace-b'),'SCOPE_MISMATCH');
  denied(evaluate({...sector,ug:''},'core.parse'),'INVALID_PRINCIPAL');
  denied(evaluate(sector,'core.parse',undefined,'DELETE_ALL'),'OPERATION_DENIED');
});

test('cadastro de fornecedor exige identidade ativa e decisão no servidor',()=>{
  allowed(evaluate(sector,'core.suppliers.read','workspace-a'));
  allowed(evaluate(sector,'core.suppliers.write','workspace-a'));
  denied(evaluate(sector,'core.suppliers.write','workspace-b'),'SCOPE_MISMATCH');
  denied(evaluate({...sector,uid:''},'core.suppliers.write'),'INVALID_PRINCIPAL');
  const route=read('app/api/core/suppliers/route.ts');
  const store=read('lib/server/serverSupplierContacts.ts');
  const client=read('lib/firebaseSync.ts');
  assert.match(route,/verifyPlatformPrincipal/);
  assert.match(route,/evaluateServerAuthorization/);
  assert.match(store,/getGoogleAccessToken/);
  assert.match(store,/currentDocument:/);
  assert.match(store,/isValidSupplierCnpj/);
  assert.match(client,/fetch\('\/api\/core\/suppliers'/);
});

test('setor não recebe privilégios administrativos',()=>{
  denied(evaluate(sector,'platform.admin'),'FORBIDDEN');
  allowed(evaluate(founder,'platform.admin'));
  denied(evaluate({...founder,role:'sector'},'platform.admin'),'FORBIDDEN');
});

test('identidade malformada e escopo inválido falham fechados',()=>{
  denied(evaluate({...sector,uid:''},'warehouse.read'),'INVALID_PRINCIPAL');
  denied(evaluate({...sector,ug:'ABCDEF'},'warehouse.read'),'INVALID_PRINCIPAL');
  denied(evaluate({...sector,workspaceId:'../other'},'warehouse.read'),'INVALID_PRINCIPAL');
  denied(evaluate({...sector,role:'admin'},'warehouse.read'),'INVALID_PRINCIPAL');
  denied(evaluate(sector,'warehouse.command',123,'TRANSFER'),'SCOPE_MISMATCH');
  denied(evaluate(sector,'other','workspace-a'),'FORBIDDEN');
});

test('nenhuma operação executável do dispatcher fica fora da lista positiva',()=>{
  const route=read('app/api/central-depositos/operations/route.ts');
  const cases=[...route.matchAll(/case '([A-Z_]+)':/g)].map(m=>m[1]);
  assert.ok(cases.length>=30,'dispatcher inesperadamente pequeno');
  for(const op of cases)if(op!=='LEDGER_MOVEMENT')
    assert.ok(WAREHOUSE_ALLOWED_OPERATIONS.includes(op),'ação não protegida: '+op);
  assert.ok(!WAREHOUSE_ALLOWED_OPERATIONS.includes('LEDGER_MOVEMENT'));
  assert.match(route,/assertWarehouseAuthorization\(access,/);
});

test('API de análise de NE autentica setor/workspace pelo servidor',()=>{
  const parser=read('app/api/empenhos/parse-ne/route.ts');
  assert.match(parser,/verifyPlatformPrincipal/);
  assert.match(parser,/capability: 'core.parse'/);
  assert.doesNotMatch(parser,/await verifyFirebaseRequest/);
});

test('todas as rotas operacionais utilizam a política central',()=>{
  for(const path of [
    'app/api/central-depositos/operations/route.ts',
    'app/api/central-depositos/manual-entry/route.ts',
    'app/api/central-depositos/intake-action/route.ts',
    'app/api/central-depositos/queue/route.ts',
    'app/api/central-depositos/status/route.ts',
    'app/api/central-depositos/bulk-stock/route.ts'
  ])assert.match(read(path),/assertWarehouseAuthorization\(/,'gate ausente '+path);
});

test('verificadores de administrador integram política central',()=>{
  for(const p of ['lib/server/sectorProvisioningAdmin.ts','lib/server/firebaseFounderAuth.ts']){
    assert.match(read(p),/evaluateServerAuthorization/);
    assert.match(read(p),/capability: 'platform.admin'/);
  }
});

test('endpoint de contexto usa identidade autoritativa, sem aceitar escopo declarado',()=>{
  const context=read('app/api/authz/context/route.ts');
  assert.match(context,/verifyPlatformPrincipal/);
  assert.match(context,/principal.workspaceId/);
  assert.match(context,/principal.ug/);
  assert.match(context,/no-store/);
  assert.doesNotMatch(context,/request\.json\(/);
});

test('consulta do diretório usa IAM e NÃO o token Firebase do cliente',()=>{
  const access=read('lib/server/warehouseAccess.ts');
  const platform=read('lib/server/platformAuthorization.ts');
  const store=read('lib/server/coreIdentityStore.ts');
  assert.match(access,/verifyPlatformPrincipal/);
  assert.match(platform,/readCoreIdentityDocument/);
  assert.match(platform,/value\(account, 'firebaseUid'\) !== verified.uid/);
  assert.match(platform,/value\(workspace, 'status'\) !== 'active'/);
  assert.doesNotMatch(platform,/verified\.idToken/);
  assert.match(store,/getGoogleAccessToken/);
  assert.match(store,/sections\.length === 2/);
  assert.match(store,/EMPROVEX_E2E_SERVER_AUTH/);
  assert.match(store,/NODE_ENV === 'production'/);
});
