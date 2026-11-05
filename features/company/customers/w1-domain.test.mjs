import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source=readFileSync(new URL('../../../lib/company/customers/model.ts',import.meta.url),'utf8');
const transpiled=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,strict:true,
},reportDiagnostics:true});
assert.equal(transpiled.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length || 0,0);
const exports={};
runInNewContext(transpiled.outputText,{exports,require(id){
  if(id==='node:crypto')return {randomUUID:()=> 'test-id'};
  if(id==='../contracts')return {COMPANY_CONTRACT_VERSION:'company-r1-v1'};
  throw new Error('Dependência não permitida: '+id);
}});
const m=exports;
const q=(value,unit='UN')=>({value,unit});
const price={amountCents:1299,currency:'BRL'};
const customer=()=>m.parseCustomer({name:'OM QA',kind:'military_organization',ug:'160416',
  addresses:[{label:'Sede',street:'Rua QA',city:'Santa Maria',state:'RS'}],
  contacts:[{name:'Contato',email:'qa@example.org'}]});
const commitment=()=>({
  ...m.owned('company-A','uid-A',{publicCustomerId:'customer-1',neNumber:'2026NE00001',
    fiscalYear:2026,extractionSource:'manual',
    lines:[{id:'item-1',description:'Produto X',quantity:q('500'),
      orderedQuantity:q('0'),salePrice:price}],reviewedByUid:'uid-A',reviewedAt:new Date().toISOString()}),
  id:'ne-1',
});
const order=(value)=>m.parseOrder({publicCustomerId:'customer-1',commitmentId:'ne-1',
  reference:'Pedido QA',lines:[{id:'line-1',commitmentLineId:'item-1',quantity:q(value)}]});

test('W1: somente quantidades canônicas em milésimos e sem ponto flutuante',()=>{
  assert.equal(String(m.millis('1.125')), '1125');
  assert.equal(m.asDecimal(1125n),'1.125');
  assert.equal(m.asDecimal(1000n),'1');
  assert.throws(()=>m.millis('1.0001'),/INVALID_INPUT/);
  assert.throws(()=>m.quantity(q('0')),/INVALID_INPUT/);
});
test('W1: preço de venda estritamente em centavos BRL, sem custo presumido',()=>{
  assert.deepEqual({...m.money(price)},{amountCents:1299,currency:'BRL'});
  assert.throws(()=>m.money({amountCents:12.25,currency:'BRL'}),/INVALID_INPUT/);
  const data=m.parseCommitment({publicCustomerId:'customer-1',neNumber:'2026NE001',
    fiscalYear:2026,extractionSource:'manual',lines:[{id:'item-1',description:'X',
      quantity:q('10'),salePrice:price}]});
  assert.equal('cost' in data.lines[0],false);
});
test('W1: UG/UASG são atributos de cliente, sem conta institucional',()=>{
  const c=customer();
  assert.equal(c.ug,'160416');assert.equal('accountType' in c,false);
  assert.throws(()=>m.parseCustomer({...c,ug:'empresa-A'}),/INVALID_INPUT/);
});
test('W1: propriedade estrita do workspace A rejeita documento B',()=>{
  const a=m.owned('company-A','uid-A',customer());
  m.ensureOwned(a,'company-A');
  assert.throws(()=>m.ensureOwned(a,'company-B'),/TENANT_INTEGRITY_ERROR/);
});
test('W1: mesma NE permite pedidos múltiplos e remanescente coerente',()=>{
  const c=commitment();
  const first=m.allocate(c,order('100'));
  assert.equal(first.commitmentLines[0].orderedQuantity.value,'100');
  const second=m.allocate({...c,lines:first.commitmentLines},order('300'));
  assert.equal(second.commitmentLines[0].orderedQuantity.value,'400');
  assert.throws(()=>m.allocate({...c,lines:second.commitmentLines},order('101')),/CONFLICT/);
});
test('W1: revisão de pedido libera quantidade anterior antes de substituir',()=>{
  const c=commitment();
  const previous=m.allocate(c,order('100'));
  const released=m.allocate({...c,lines:previous.commitmentLines},order('250'),previous.orderLines);
  assert.equal(released.commitmentLines[0].orderedQuantity.value,'250');
});
test('W1: preço e unidade vêm da NE verificada, não do pedido',()=>{
  const c=commitment();
  const result=m.allocate(c,order('1'));
  assert.equal(result.orderLines[0].salePrice.amountCents,1299);
  assert.throws(()=>m.allocate(c,m.parseOrder({publicCustomerId:'customer-1',commitmentId:'ne-1',
    reference:'P',lines:[{id:'line-1',commitmentLineId:'item-1',quantity:q('1','KG')}]})),/CONFLICT/);
});
