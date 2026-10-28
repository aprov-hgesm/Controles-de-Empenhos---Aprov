import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bulkMaterialCandidates, bulkMaterialDescriptionKey,
  bulkMaterialGroupKey, bulkMaterialUnitKey,
} from '../lib/warehouse/bulkStockMaterialMatcher';
import type { WarehouseMaterial } from '../lib/warehouse/material';

const make=(id:string,description:string,code:WarehouseMaterial['unit']['code'],
  label:string|null=null,status:WarehouseMaterial['status']='active'):WarehouseMaterial=>({
  schemaVersion:'warehouse_material_v1',id,workspaceId:'ws_demo',ug:'160416',
  description,unit:{code,label},status,aliases:[],conversions:[],
});

test('feijão preto e vermelho são identidades diferentes, ainda que na mesma posição física',()=>{
  const materials=[
    make('mat_preto','Feijão preto','kg'),
    make('mat_vermelho','Feijão vermelho','kg'),
  ];
  assert.deepEqual(bulkMaterialCandidates(materials,'Feijão preto','kg').map(x=>x.id),['mat_preto']);
  assert.deepEqual(bulkMaterialCandidates(materials,'Feijão vermelho','kg').map(x=>x.id),['mat_vermelho']);
  assert.notEqual(bulkMaterialGroupKey('Feijão preto','kg'),bulkMaterialGroupKey('Feijão vermelho','kg'));
});

test('identidades realmente duplicadas exigem escolha explícita, sem escolher ID arbitrário',()=>{
  const materials=[make('mat_a','Feijão preto','kg'),make('mat_b','Feijão preto','kg')];
  assert.deepEqual(bulkMaterialCandidates(materials,'Feijão preto','kg').map(x=>x.id),['mat_a','mat_b']);
});

test('mesmo nome com outra unidade permite criar outro produto, sem bloquear a carga',()=>{
  const materials=[make('mat_kg','Café','kg'),make('mat_cx','Café','box')];
  assert.deepEqual(bulkMaterialCandidates(materials,'Café','litros'),[]);
  assert.deepEqual(bulkMaterialCandidates(materials,'Café','kg').map(x=>x.id),['mat_kg']);
});

test('apresentações diferentes não se confundem pelo código-base',()=>{
  const materials=[
    make('mat_cx12','Suco','box','caixa (12 und)'),
    make('mat_cx24','Suco','box','caixa (24 und)'),
    make('mat_und','Suco','unit'),
  ];
  assert.deepEqual(bulkMaterialCandidates(materials,'Suco','caixa (12 und)').map(x=>x.id),['mat_cx12']);
  assert.deepEqual(bulkMaterialCandidates(materials,'Suco','caixa (24 und)').map(x=>x.id),['mat_cx24']);
  assert.deepEqual(bulkMaterialCandidates(materials,'Suco','unidade').map(x=>x.id),['mat_und']);
  assert.deepEqual(bulkMaterialCandidates(materials,'Suco','caixa').map(x=>x.id),[]);
});

test('acento, espaços e abreviações de unidade equivalentes continuam funcionando',()=>{
  const materials=[make('mat_a','Feijão   PRETO','kg')];
  assert.equal(bulkMaterialDescriptionKey('  Feijao preto  '),'feijao preto');
  assert.equal(bulkMaterialUnitKey('quilograma'),'kg');
  assert.deepEqual(bulkMaterialCandidates(materials,'feijao preto','quilograma').map(x=>x.id),['mat_a']);
});

test('colisão antiga por remover toda pontuação deixa de mesclar materiais distintos',()=>{
  const materials=[make('mat_a','A-B','unit'),make('mat_b','AB','unit')];
  assert.notEqual(bulkMaterialGroupKey('A-B','und'),bulkMaterialGroupKey('AB','und'));
  assert.deepEqual(bulkMaterialCandidates(materials,'A-B','und').map(x=>x.id),['mat_a']);
  assert.deepEqual(bulkMaterialCandidates(materials,'AB','und').map(x=>x.id),['mat_b']);
});

test('materiais inativos não são reutilizados na importação',()=>{
  const materials=[make('mat_inactive','Feijão preto','kg',null,'inactive')];
  assert.deepEqual(bulkMaterialCandidates(materials,'Feijão preto','kg'),[]);
});

test('mesmo material em validades e prateleiras diferentes compartilha identidade',()=>{
  assert.equal(bulkMaterialGroupKey('Vinagre 740 ml','und'),bulkMaterialGroupKey('VINAGRE 740 ML','unidade'));
  assert.notEqual(bulkMaterialGroupKey('Vinagre 740 ml','und'),bulkMaterialGroupKey('Vinagre 2 L','und'));
});
