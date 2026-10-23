#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require = createRequire(import.meta.url);
const ts=require('typescript');
const root=process.cwd();
const text=file=>readFileSync(resolve(root,file),'utf8');
const collisionSource=text('lib/warehouse/layoutCollision.ts');
const compiled=ts.transpileModule(collisionSource,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText;
const collisionExports={};
runInNewContext(compiled,{exports:collisionExports,require:()=>{throw new Error('Unexpected import');}});
const {
  warehouseIsPhysicalLocal,warehouseFloorRectsOverlap,warehouseLocalHasCollision,
  warehouseFindFreePosition,warehouseFindOverlappingLocals,
}=collisionExports;
const fixture=(id,x,y,width=120,height=60,kind='SHELF',linked=true)=>({
  id:'obj_'+String(id).padStart(32,'0'),
  x,y,width,height,kind,
  warehouseLocationId:linked?'loc_'+String(id).padStart(32,'0'):null,
});
test('locais fisicos bloqueiam somente intersecoes com area positiva',()=>{
  const a=fixture(1,100,100),b=fixture(2,180,120),edge=fixture(3,220,100);
  assert.equal(warehouseFloorRectsOverlap(a,b),true);
  assert.equal(warehouseFloorRectsOverlap(a,edge),false);
  assert.equal(warehouseLocalHasCollision(b,[a]),true);
  assert.equal(warehouseLocalHasCollision(edge,[a]),false);
  assert.equal(warehouseFindOverlappingLocals([a,b]).length,1);
});
test('corredores portas zonas e desenhos podem sobrepor estruturas livremente',()=>{
  const a=fixture(1,20,20);
  const nonphysical=['WALL','CORRIDOR','AREA','ZONE','OTHER'];
  for(const kind of nonphysical){
    const decor=fixture(2,20,20,120,60,kind,false);
    assert.equal(warehouseIsPhysicalLocal(decor),false,kind);
    assert.equal(warehouseLocalHasCollision(decor,[a]),false,kind);
    assert.equal(warehouseFindOverlappingLocals([a,decor]).length,0,kind);
  }
  const newGeneric={...fixture(4,20,20,120,60,'OTHER',false),
    visualVariant:'solid'};
  assert.equal(warehouseIsPhysicalLocal(newGeneric),true);
  assert.equal(warehouseLocalHasCollision(newGeneric,[a]),true);
  const legacyLocation=fixture(3,20,20,120,60,'OTHER',true);
  assert.equal(warehouseIsPhysicalLocal(legacyLocation),true);
  assert.equal(warehouseFindOverlappingLocals([a,legacyLocation]).length,1);
});
test('duplicar busca vaga real sem permitir que a copia nasca sobre a origem',()=>{
  const source=fixture(1,20,20),copied=fixture(2,40,40);
  const position=warehouseFindFreePosition(copied,[source],380,200,{x:40,y:40});
  assert.ok(position);
  assert.equal(warehouseLocalHasCollision({...copied,...position},[source]),false);
  assert.deepEqual(
    warehouseFindFreePosition(fixture(2,0,0),[fixture(1,0,0,120,60)],120,60),
    null
  );
});
test('mudar largura, mover e girar sao rejeitados quando invadem outro local',()=>{
  const a=fixture(1,20,20,80,40),b=fixture(2,100,20,80,40);
  assert.equal(warehouseLocalHasCollision({...a,width:90},[b]),true);
  assert.equal(warehouseLocalHasCollision({...a,x:110},[b]),true);
  assert.equal(warehouseLocalHasCollision({...a,width:40,height:80,x:95},[b]),true);
  assert.equal(warehouseLocalHasCollision({...a,x:20,y:100},[b]),false);
});
test('salvamento no servidor e operacoes do editor reaproveitam a mesma regra pura',()=>{
  const server=text('lib/server/warehouseStructureLayoutApply.ts');
  const oldRoute=text('lib/server/warehouseRemainingWrites.ts');
  const editor=text('features/warehouse/components/WarehouseDepotLayoutEditor.tsx');
  const central=text('features/warehouse/components/WarehouseCroquisR1Operational.tsx');
  const demo=text('features/warehouse/components/WarehouseDepot20x6Demo.tsx');
  assert.match(server,/warehouseFindOverlappingLocals\(candidate\.data\.objects\)/);
  assert.match(server,/WAREHOUSE_CROQUI_LOCATION_OVERLAP/);
  assert.match(oldRoute,/warehouseFindOverlappingLocals\(r\.data\.objects\)/);
  assert.match(editor,/warehouseLocalHasCollision\(changed, next\)/);
  assert.match(editor,/warehouseFindFreePosition\(copy, objects/);
  assert.match(central,/warehouseFindOverlappingLocals\(draftObjects\)/);
  assert.match(central,/warehouseLocalHasCollision\(candidate,draftObjects\)/);
  assert.match(central,/preventLocalOverlap/);
  assert.match(demo,/preventLocalOverlap/);
  assert.match(demo,/Prévia 3D oficial/);
  assert.match(editor,/Perspectiva rápida \(2,5D\)/);
  assert.doesNotMatch(collisionSource,/\b(?:fetch|onSnapshot|getDocs|setDoc|updateDoc)\s*\(/);
});
