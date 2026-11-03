#!/usr/bin/env node
/** Eleonor R3.1.6 presentation regressions. Synthetic W3 data only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const src=readFileSync(resolve(root,'features/eleonor/domain/itemPresentation.ts'),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,
  target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function('module','exports',js)(mod,mod.exports);
const {parseItemResult,itemShortLabel}=mod.exports;
const sample={intent:'commitment_item_search',status:'ok',coverage:'complete',
 pagination:{truncated:false},
 data:{materialQuery:'queijo',matchedGroups:3,items:[
  {name:'QUEIJO, ORIGEM DE VACA, VARIEDADE PRATO, APRESENTACAO FATIADO',
   unit:'kg',pendingQuantity:180,operationalBalance:6372,
   associations:[{commitmentId:'2026NE51',itemId:'00082'}]},
  {name:'QUEIJO, ORIGEM DE VACA, VARIEDADE PRATO, APRESENTACAO FATIADO',
   unit:'UN',pendingQuantity:400,operationalBalance:14160,
   associations:[{commitmentId:'2026NE142',itemId:'00082'}]},
  {name:'PAO DE QUEIJO, BASE DE MASSA POLVILHO E QUEIJO',
   unit:'UN',pendingQuantity:100,operationalBalance:1588,
   associations:[{commitmentId:'2026NE193',itemId:'00108'}]}
 ]},limitations:['Saldo de itens de empenhos é operacional, não é estoque físico nem saldo contábil SIAFI.']};
test('compact titles are derived only from recorded descriptions',()=>{
 assert.equal(itemShortLabel(sample.data.items[0].name),'Queijo · Prato · Fatiado');
 assert.equal(itemShortLabel(sample.data.items[2].name),'Pao de queijo');
});
test('preserves units, financial balances and original description separately',()=>{
 const view=parseItemResult(sample);
 assert.equal(view.items.length,3);
 assert.equal(view.distinctCommitments,3);
 assert.equal(view.partial,false);
 assert.equal(view.items[0].pendingQuantity,180);
 assert.equal(view.items[0].operationalBalance,6372);
 assert.equal(view.items[0].unit,'kg');
 assert.equal(view.items[1].unit,'UN');
 assert.equal(view.items[1].pendingQuantity,400);
 assert.match(view.items[0].name,/ORIGEM DE VACA/);
});
test('truncation remains partial; unverified totals are not invented',()=>{
 const raw={...sample,status:'partial',coverage:'incomplete',pagination:{truncated:true},
  data:{...sample.data,matchedGroups:9}};
 const view=parseItemResult(raw);
 assert.equal(view.partial,true);
 assert.equal(view.totalGroups,9);
 assert.equal(view.items.length,3);
});
test('malformed structured result never replaces the text answer',()=>{
 assert.equal(parseItemResult(null),null);
 assert.equal(parseItemResult({...sample,intent:'warehouse_stock_get'}),null);
 assert.equal(parseItemResult({...sample,data:{...sample.data,items:[{
  ...sample.data.items[0],pendingQuantity:'180'}]}}),null);
 assert.equal(parseItemResult({...sample,data:{...sample.data,items:[{
  ...sample.data.items[0],associations:[{commitmentId:'',itemId:'1'}]}]}}),null);
});
test('client keeps generic conversations and history fallback intact',()=>{
 const ui=readFileSync(resolve(root,'features/eleonor/components/EleonorExperience.tsx'),'utf8');
 const cards=readFileSync(resolve(root,'features/eleonor/components/EleonorItemResults.tsx'),'utf8');
 const response=readFileSync(resolve(root,'lib/emprovex-ai/integration/response.ts'),'utf8');
 assert.match(ui,/parseItemResult\(body\.result\)/);
 assert.match(ui,/<EleonorItemResults result=\{item\.structuredResult\}/);
 assert.match(ui,/whitespace-pre-wrap break-words/);
 assert.match(ui,/lastAssistantRef\.current\.offsetTop/);
 assert.match(cards,/Ver descri[cç][aã]o completa/i);
 assert.match(cards,/Fontes da consulta/);
 assert.match(cards,/view\.partial/);
 assert.match(cards,/Mostrar mais/);
 assert.match(response,/Saldo operacional:/);
 assert.match(response,/Valor restante:/);
});
