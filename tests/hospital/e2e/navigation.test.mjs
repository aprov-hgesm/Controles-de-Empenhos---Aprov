import test from 'node:test';
import assert from 'node:assert/strict';
import {menuForRoles,canOpenPage,firstPage} from '../../../features/hospital/integration/navigation.mjs';

test('menus segregados por papel hospitalar; nenhum perfil herda menus de outro',()=>{
 const unit=menuForRoles(['UNIT']);
 assert.deepEqual(unit.map(x=>x.id),['inicio','pacientes','dietas','mapas','acompanhamento']);
 assert.equal(canOpenPage(['UNIT'],'distribuicao'),false);
 assert.equal(canOpenPage(['KITCHEN'],'mapas'),false);
 assert.equal(canOpenPage(['NUTRITION'],'administracao'),false);
 assert.equal(canOpenPage(['HOSPITAL_ADMIN'],'pacientes'),false);
 assert.deepEqual(menuForRoles(['KITCHEN']).map(x=>x.id),['painel','producao','distribuicao','ocorrencias','relatorios']);
 assert.equal(firstPage(['HOSPITAL_ADMIN']),'administracao');
 assert.equal(firstPage(['NUTRITION']),'nutricao');
});
test('sem perfil ou papel inesperado, a navegação não expõe páginas',()=>{
 for(const value of [null,undefined,{},'',[],['PLATFORM_ADMIN'],['COMMERCIAL'],['SUPPORT']]){
  assert.deepEqual(menuForRoles(value),[]);
  assert.equal(canOpenPage(value,'pacientes'),false);
  assert.equal(firstPage(value),null);
 }
});
test('vínculo multipapel produz apenas a união de menus explícitos',()=>{
 const items=menuForRoles(['NUTRITION','UNIT','UNIT']);
 assert.equal(new Set(items.map(x=>x.id)).size,items.length);
 assert.equal(canOpenPage(['NUTRITION','UNIT'],'nutricao'),true);
 assert.equal(canOpenPage(['NUTRITION','UNIT'],'distribuicao'),false);
});
