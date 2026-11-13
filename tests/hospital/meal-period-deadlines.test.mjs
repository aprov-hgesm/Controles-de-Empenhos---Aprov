import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyMealTiming,CYCLES} from '../../features/hospital/core/domain.mjs';
import {mealName,mealTitle,timeSituation,timingLabel,mapLateLabel} from '../../features/hospital/integration/meal-period.mjs';
const date='2026-11-12';
const when=(hour,minute)=>new Date('2026-11-12T'+hour+':'+minute+':00-03:00');

test('three maps pair main/secondary without sharing delivery identity',()=>{
 assert.deepEqual(Object.keys(CYCLES).sort(),['06','10','16']);
 assert.equal(mealName('06','PRIMARY'),'Café da manhã');
 assert.equal(mealName('06','SECONDARY'),'Lanche da manhã');
 assert.equal(mealName('10','PRIMARY'),'Almoço');
 assert.equal(mealName('10','SECONDARY'),'Lanche da tarde');
 assert.equal(mealName('16','PRIMARY'),'Jantar');
 assert.equal(mealName('16','SECONDARY'),'Ceia');
 assert.notEqual(mealTitle('10','PRIMARY'),mealTitle('10','SECONDARY'));
});
for(const h of ['06','10','16']){
 for(const type of ['PRIMARY','SECONDARY']){
  test('deadline boundaries '+h+'h '+type,()=>{
   assert.equal(classifyMealTiming({cycleId:h,localDate:date,at:when(h,'00'),mealType:type}).stage,'ON_TIME');
   assert.equal(classifyMealTiming({cycleId:h,localDate:date,at:when(h,'01'),mealType:type}).stage,'LATE_BEFORE_TOLERANCE');
   assert.equal(classifyMealTiming({cycleId:h,localDate:date,at:when(h,'30'),mealType:type}).stage,'LATE_BEFORE_TOLERANCE');
   assert.equal(classifyMealTiming({cycleId:h,localDate:date,at:when(h,'31'),mealType:type}).stage,'AFTER_TOLERANCE');
   assert.equal(timeSituation(h,date,when(h,'31'),type).severity,'urgent');
   assert.equal(timeSituation(h,date,when(h,'01'),type).severity,'warning');
   assert.equal(timeSituation(h,date,when(h,'00'),type).severity,'normal');
   assert.match(timingLabel('AFTER_TOLERANCE',type),/Extra após tolerância/);
  });
 }
}
test('only map late submission flags the whole map; late adendo highlights an individual meal',()=>{
 assert.equal(mapLateLabel({submissionTimingStage:'ON_TIME',hasLateAmendment:true,latestExtraTimingStage:'AFTER_TOLERANCE'}),'Contém dieta extra após a tolerância');
 assert.equal(mapLateLabel({submissionTimingStage:'LATE_BEFORE_TOLERANCE'}),'Mapa inteiro enviado após o prazo');
 assert.equal(mapLateLabel({submissionTimingStage:'AFTER_TOLERANCE'}),'Mapa inteiro enviado após a tolerância');
 assert.equal(mapLateLabel({submissionTimingStage:'ON_TIME',late:false,hasLateAmendment:false}),'');
});
