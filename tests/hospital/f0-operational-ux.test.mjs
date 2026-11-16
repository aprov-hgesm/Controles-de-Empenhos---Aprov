import test from 'node:test';
import assert from 'node:assert/strict';
import {menuForRoles,canOpenPage,firstPage} from '../../features/hospital/integration/navigation.mjs';
import {currentWorkCycle} from '../../features/hospital/integration/meal-period.mjs';
import {getOrderProgress} from '../../features/hospital/integration/order-progress.mjs';

test('unidade entra diretamente em Solicitar dietas e acompanha sem menu redundante',()=>{
 const menu=menuForRoles(['UNIT']);
 assert.deepEqual(menu.map(x=>x.id),['mapas','acompanhamento','pacientes','dietas']);
 assert.equal(firstPage(['UNIT']),'mapas');
 assert.ok(menu.every(x=>!x.label.includes('Início')));
 assert.equal(canOpenPage(['UNIT'],'producao'),false);
});

test('cozinha usa sequencia de recebimento, preparo e distribuicao',()=>{
 assert.deepEqual(menuForRoles(['KITCHEN']).map(x=>x.id),
  ['painel','producao','distribuicao','ocorrencias','relatorios']);
 assert.equal(canOpenPage(['KITCHEN'],'pacientes'),false);
});

test('admin tem configuracao do catalogo sem acessar dados clinicos por padrao',()=>{
 assert.deepEqual(menuForRoles(['HOSPITAL_ADMIN']).map(x=>x.id),
  ['administracao','catalogo']);
 assert.equal(canOpenPage(['HOSPITAL_ADMIN'],'mapas'),false);
 assert.equal(firstPage(['NUTRITION']),'nutricao');
});

test('horario inicial segue turnos de Santa Maria, nao timezone do navegador',()=>{
 assert.equal(currentWorkCycle(new Date('2026-11-16T10:30:00Z')),'06'); // 07:30 BRT
 assert.equal(currentWorkCycle(new Date('2026-11-16T15:00:00Z')),'10'); // 12:00 BRT
 assert.equal(currentWorkCycle(new Date('2026-11-16T21:30:00Z')),'16'); // 18:30 BRT
});

test('linha do pedido nunca inventa recebimento nem entrega',()=>{
 const map={status:'SUBMITTED',submittedAt:'2026-11-16T13:00:00Z',receivedAt:null};
 const meal={status:'REQUESTED',mealType:'PRIMARY'};
 assert.equal(getOrderProgress(map,[meal]).stage,0);
 assert.equal(getOrderProgress({...map,receivedAt:'2026-11-16T13:02:00Z'},[meal]).stage,1);
 assert.equal(getOrderProgress(map,[{...meal,status:'PREPARING'}]).stage,2);
 assert.equal(getOrderProgress(map,[{...meal,status:'DISPATCHED'}]).stage,3);
 assert.equal(getOrderProgress(map,[{...meal,status:'SAFETY_BLOCKED'}]).completed,false);
});

test('refeicao principal e secundaria nao compartilham conclusao ficticia',()=>{
 const map={status:'SUBMITTED',submittedAt:'2026-11-16T13:00:00Z',receivedAt:'2026-11-16T13:02:00Z'};
 const principal=getOrderProgress(map,[{mealType:'PRIMARY',status:'DELIVERED'}]);
 const secundaria=getOrderProgress(map,[{mealType:'SECONDARY',status:'REQUESTED'}]);
 assert.equal(principal.completed,true);
 assert.equal(secundaria.completed,false);
 assert.equal(secundaria.stage,1);
});
