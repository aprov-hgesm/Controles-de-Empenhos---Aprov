import {CYCLES,classifyMealTiming} from '../core/domain.mjs';

/** Meal-specific display and deadline tiers. These are labels, not permission checks. */
export const MEAL_TYPES=Object.freeze(['PRIMARY','SECONDARY']);
export function mealName(cycleId,mealType){
 const cycle=CYCLES[cycleId];
 if(!cycle)throw Error('Mapa desconhecido');
 return mealType==='PRIMARY'?cycle.primaryName:mealType==='SECONDARY'?cycle.secondaryName:'Refeição desconhecida';
}
export function mealTitle(cycleId,mealType){
 return (mealType==='PRIMARY'?'Principal':'Secundária')+' · '+mealName(cycleId,mealType);
}
export function timeSituation(cycleId,localDate,at=new Date(),mealType='PRIMARY'){
 const cycle=CYCLES[cycleId];
 if(!cycle)throw Error('Mapa desconhecido');
 const timing=classifyMealTiming({cycleId,localDate,at,mealType});
 const warning=timing.stage==='LATE_BEFORE_TOLERANCE';
 const after=timing.stage==='AFTER_TOLERANCE';
 return {...timing,
  due:cycle.mapDue,tolerance:cycle.primaryTolerance,
  label:timing.stage==='ON_TIME'?'Dentro do prazo do mapa':warning?'Extra: após o horário do mapa':'Extra urgente: após os 30 minutos',
  message:timing.stage==='ON_TIME'?
   'Mapa regular até '+cycle.mapDue+'. A tolerância até '+cycle.primaryTolerance+' é somente da entrega principal.':
   warning?'O prazo do mapa ('+cycle.mapDue+') passou. Informe a justificativa; a cozinha receberá um alerta prioritário para este pedido.':
   'O horário '+cycle.primaryTolerance+' já passou. Informe a justificativa. A cozinha receberá um alerta prioritário; o atraso, por si só, não suspende a refeição.',
  severity:after?'urgent':warning?'warning':'normal'
 };
}
export function timingLabel(stage,mealType='PRIMARY'){
 if(stage==='AFTER_TOLERANCE')return 'Extra urgente após tolerância · prioridade cozinha';
 if(stage==='LATE_BEFORE_TOLERANCE')return 'Extra até +30 min · prioridade cozinha';
 return 'Solicitada no prazo';
}
export function mapLateLabel(map){
 if(map?.submissionTimingStage==='AFTER_TOLERANCE')return 'Mapa inteiro enviado após a tolerância';
 if(map?.submissionTimingStage==='LATE_BEFORE_TOLERANCE')return 'Mapa inteiro enviado após o prazo';
 if(map?.hasLateAmendment)return map.latestExtraTimingStage==='AFTER_TOLERANCE'?
  'Contém dieta extra após a tolerância':'Contém dieta extra após o prazo';
 if(map?.late)return 'Mapa enviado fora do horário';
 return '';
}
