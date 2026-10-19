import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildNeighborhoodResidents, neighborhoodPages, neighborhoodQuota,
} from '../lib/adminNeighborhoodModel.mjs';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const accounts = [
  { email: 'soldado@exemplo.com', firebaseUid: 'uid-1', accountType: 'sector', status: 'active', workspaceId: 'w-1', ug: '123456' },
  { email: 'fundador@exemplo.com', firebaseUid: 'founder', accountType: 'platformAdmin', status: 'active' },
  { email: 'desativado@exemplo.com', accountType: 'sector', status: 'disabled', workspaceId: 'w-2' },
];

test('uma casa por conta única (inclusive fundador), sem criar casas fictícias', () => {
  const result = buildNeighborhoodResidents([...accounts, {...accounts[0]}], [], {now: NOW, sessionsAvailable: true});
  assert.equal(result.length, 3);
  assert.equal(result[0].kind, 'admin');
  assert.equal(result.filter(r => r.presence === 'online').length, 0);
  assert.equal(buildNeighborhoodResidents([], [], {now: NOW, sessionsAvailable: true}).length, 0);
});

test('janela acende somente com lease não expirado de identidade correspondente', () => {
  const sessions = [
    {uid:'uid-1', accountEmail:'soldado@exemplo.com', lastSeenAt:'2026-10-19T11:58:00Z', expiresAt:'2026-10-19T12:30:00Z'},
    {uid:'uid-1', accountEmail:'soldado@exemplo.com', lastSeenAt:'2026-10-19T11:59:00Z', expiresAt:'2026-10-19T12:40:00Z'},
    {uid:'other', accountEmail:'fundador@exemplo.com', lastSeenAt:'2026-10-19T12:00:00Z', expiresAt:'2026-10-19T12:30:00Z'},
    {uid:'old', accountEmail:'desativado@exemplo.com', lastSeenAt:'2026-10-19T11:00:00Z', expiresAt:'2026-10-19T11:30:00Z'},
  ];
  const actual = buildNeighborhoodResidents(accounts, sessions, {now: NOW, sessionsAvailable:true});
  assert.equal(actual.find(r=>r.email==='soldado@exemplo.com').presence, 'online');
  assert.equal(actual.find(r=>r.email==='fundador@exemplo.com').presence, 'offline');
  assert.equal(actual.find(r=>r.email==='desativado@exemplo.com').presence, 'disabled');
  assert.equal(actual.find(r=>r.email==='soldado@exemplo.com').lastSeenAt, '2026-10-19T11:59:00Z');
  assert.equal(buildNeighborhoodResidents(accounts,sessions,{now:NOW+60*60*1000,sessionsAvailable:true}).filter(r=>r.presence==='online').length, 0);
});

test('falha ou carregamento de sessões não faz falso OFFLINE', () => {
  const result=buildNeighborhoodResidents(accounts,[],{now:NOW,sessionsAvailable:false});
  assert.equal(result.length,3);
  assert.ok(result.every(r=>r.presence==='unknown'));
});

test('sessões com email correto mas UID divergente não acendem casas pré-vinculadas', () => {
  const s=[{uid:'unknown',accountEmail:'soldado@exemplo.com',expiresAt:'2026-10-19T12:30:00Z'}];
  const result=buildNeighborhoodResidents(accounts,s,{now:NOW,sessionsAvailable:true});
  assert.equal(result.find(r=>r.email==='soldado@exemplo.com').presence,'offline');
});

test('quarteirões paginam todas as casas, sem omitir contas excedentes',()=>{
  const list=Array.from({length:20},(_,i)=>({id:'r'+i}));
  const result=neighborhoodPages(list,2);
  assert.equal(result.pageCount,3);
  assert.equal(result.displayed.length,2);
  assert.equal(result.displayed[0].id,'r18');
  assert.equal(neighborhoodPages(list,999).page,2);
  assert.equal(neighborhoodPages([],0).displayed.length,0);
});

test('nível da água representa referência sem truncar porcentagem informada',()=>{
  assert.deepEqual(neighborhoodQuota(null),{known:false,percentage:null,waterLevel:0,exceeded:false});
  assert.equal(neighborhoodQuota({billableReadUnits:50000,billingReference:{readUnitsDailyLimit:100000}}).waterLevel,.5);
  const beyond=neighborhoodQuota({billableReadUnits:155000,billingReference:{readUnitsDailyLimit:100000}});
  assert.equal(beyond.percentage,155);
  assert.equal(beyond.waterLevel,1);
  assert.equal(beyond.exceeded,true);
});

test('Início ADM é apenas apresentação; não acrescenta Firestore reads/writes/Rules',()=>{
  const view=readFileSync('components/admin/PlatformAdminView.tsx','utf8');
  const page=readFileSync('app/admin/page.tsx','utf8');
  const panel=readFileSync('components/admin/AdminWorldHomePanel.tsx','utf8');
  const scene=readFileSync('components/admin/AdminWorldScene.tsx','utf8');
  const architecture=readFileSync('components/admin/AdminWorldArchitecture.tsx','utf8');
  assert.match(view,/id: 'inicio'/);
  assert.match(view,/activeTab === 'inicio'/);
  assert.match(view,/<AdminWorldHomePanel/);
  assert.match(page,/accounts=\{adminDirectory\.directory\.accounts\}/);
  assert.match(panel,/buildNeighborhoodResidents\(accounts, sessions/);
  assert.match(panel,/<AdminWorldScene/);
  assert.match(architecture,/data-testid="admin-world-water-tower"/);
  assert.match(architecture,/data-presence=\{resident\?\.presence\}/);
  assert.match(architecture,/tabIndex=\{isPerson\?0:undefined\}/);
  assert.match(scene,/USER_PLOT_INDICES/);
  assert.match(scene,/central: CityPlot/);
  assert.match(scene,/CityWaterTower/);
  assert.match(architecture,/CityBuilding/);
  assert.match(architecture,/CityTree/);
  assert.match(architecture,/CityMailbox/);
  for(const component of [panel,scene,architecture]){
    assert.doesNotMatch(component,/\b(onSnapshot|getDoc|getDocs|setDoc|updateDoc|addDoc|runTransaction|fetch)\s*\(/);
  }
});
