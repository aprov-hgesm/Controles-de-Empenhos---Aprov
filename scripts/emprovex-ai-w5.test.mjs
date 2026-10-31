#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {interpret}=require('../.w4-dist/index.cjs');
const {cases,sequences}=JSON.parse(readFileSync(new URL('./emprovex-ai-w5-corpus.json',import.meta.url),'utf8'));
const now=new Date('2026-10-31T14:00:00Z'),scope={sessionId:'w5-fixture',workspaceId:'w5-synthetic'};
const material=interpret({message:'Onde está o arroz?',now,scope}).nextContext;
const commitment=interpret({message:'Mostre a NE 2026NE66.',now,scope}).nextContext;
const expired={...material,updatedAt:now.getTime()-600001};
const context={mat:material,ne:commitment,expired,alien:{...material,workspaceId:'another-workspace'}};
test('W5 distinct 120-item annotated corpus: 30 per semantic category',()=>{
 assert.equal(cases.length,120);
 const count=new Map();
 const lexical=new Set();
 for(const c of cases){
  assert.ok(c.id&&c.question&&c.expectedRoute&&c.rationale&&c.expectedEntities&&Array.isArray(c.essentialFilters));
  const category=c.id.split('-')[1];count.set(category,(count.get(category)||0)+1);
  const normalized=c.question.toLowerCase().replace(/\s+/g,' ').trim();
  lexical.add(normalized);
 }
 for(const category of ['CONTEXT','INFORMAL','COMPOUND','ADVERSARIAL'])assert.equal(count.get(category),30);
 assert.ok(lexical.size>=110,'Corpus must not be simple duplicates');
 assert.equal(cases.filter(c=>c.split==='development').length,80);
 assert.equal(cases.filter(c=>c.split==='heldout').length,40);
});
test('W5 heldout + development corpus: fail closed, verify W3 intent for eligible',()=>{
 const results={development:{accepted:0,blocked:0,failures:0},heldout:{accepted:0,blocked:0,failures:0}};
 const errors=[];
 for(let i=0;i<cases.length;i++){
  const c=cases[i],bucket=results[c.split];
  const result=interpret({message:c.question,now,scope,previous:context[c.context]});
  if(c.expectedRoute==='DETERMINISTIC'){
   if(result.route!=='DETERMINISTIC'||result.query?.intent!==c.expectedIntent)
    errors.push(c.id+' expected '+c.expectedIntent+' actual '+result.route+'/'+result.intent+'/'+result.reason);
   else bucket.accepted++;
  }else if(result.query||result.route==='DETERMINISTIC'){
   errors.push(c.id+' unexpected execution '+result.intent+' '+result.reason);bucket.failures++;
  }else bucket.blocked++;
  assert.equal(result.metrics.qwenCalls,0,c.id);
 }
 console.log('W5_CORPUS_METRICS',JSON.stringify({results,total:cases.length,falseCriticalAcceptance:errors.filter(x=>x.includes('unexpected')).length,errors}));
 assert.deepEqual(errors,[]);
});
test('W5 20 multistep contextual conversations: no stale or fabricated reference',()=>{
 assert.equal(sequences.length,20);
 const errors=[];
 for(const seq of sequences){
  let previous;let result;
  for(const utterance of seq.steps.slice(0,-1)){
   result=interpret({message:utterance,now,scope,previous});
   if(result.nextContext)previous=result.nextContext;
  }
  const expectation=seq.steps.at(-1);
  if(expectation.startsWith('D:')){
   const [,intent,entity]=expectation.split(':');
   if(result?.route!=='DETERMINISTIC'||result.query?.intent!==intent||
     (result.query.params.materialQuery||result.query.params.commitmentId)!==entity)
     errors.push(seq.id+' expected '+expectation+' actual '+result?.route+'/'+JSON.stringify(result?.query));
  }else if(result?.query)errors.push(seq.id+' unexpectedly executed');
 }
 console.log('W5_CONVERSATION_METRICS',JSON.stringify({tested:sequences.length,failures:errors.length,errors}));
 assert.deepEqual(errors,[]);
});
