import {createHash,randomUUID} from 'node:crypto';
import {requireHospitalPermission} from '../core/auth.mjs';
import {assertHospital,assertIdentifier,assertMealReleaseSafe,classifyMealTiming,nextMealStatus} from '../../../../features/hospital/core/domain.mjs';

/** W5, server-only: shares W0's QA SQLite transaction and immutable journal, never client state. */
const kinds=new Set(['assembly.start','assembly.complete','assembly.check','batch.dispatch','batch.receive','meal.deliver','meal.return','meal.cancel','meal.suspend','assembly.reopen','route.flag','meal.deliver.paper']);
const text=(value,name,max=250)=>{assertHospital(typeof value==='string'&&value.trim().length>0&&value.trim().length<=max,'INVALID',name+' obrigatório');return value.trim()};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const recordId=mealId=>'dist_'+createHash('sha256').update(mealId).digest('hex').slice(0,26);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uniq=xs=>Array.isArray(xs)&&xs.length>0&&xs.length<=100&&xs.every(x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_:-]{0,127}$/.test(x))&&new Set(xs).size===xs.length;
const transitionEvent={DISPATCHED:'meal.dispatched',RECEIVED_BY_UNIT:'meal.received',DELIVERED:'meal.delivered',SUSPENDED:'meal.suspended',CANCELLED:'meal.suspended'};

export class DistributionService {
  constructor(store){assertHospital(store&&typeof store.transaction==='function','UNAVAILABLE','Hospital QA storage indisponível');this.store=store}
  async _meal(scope,mealId,unitId,permission='meal:distribution'){assertIdentifier(mealId);requireHospitalPermission(scope,permission,unitId);const meal=await this.store.get(scope.organizationId,'meal',mealId);assertHospital(meal?.unitId===unitId,'NOT_FOUND','Pedido fora da unidade');return meal}
  async _job(scope,meal){const job=await this.store.get(scope.organizationId,'label',recordId(meal.id));assertHospital(job&&job.mealId===meal.id&&job.unitId===meal.unitId,'PRECONDITION','Montagem não iniciada');return job}
  async _clinical(scope,meal,{requireReady=false}={}){
    const db=this.store,org=scope.organizationId;
    const admission=await db.get(org,'admission',meal.admissionId);
    assertHospital(admission&&admission.status==='ACTIVE','PRECONDITION','Internação não ativa');
    assertHospital(admission.unitId===meal.unitId,'PRECONDITION','Transferência confirmada: reconciliar destino antes de entregar');
    const medical=await db.get(org,'medical_reference',meal.medicalReferenceId);
    assertHospital(medical&&medical.unitId===admission.unitId&&medical.admissionId===admission.id&&admission.medicalReferenceId===medical.id&&medical.catalogItemId===meal.dietCode,'PRECONDITION','Dieta/prescrição vigente divergente');
    const catalog=await db.get(org,'catalog_diet',meal.dietCode);
    assertHospital(catalog&&catalog.active===true,'PRECONDITION','Dieta removida do catálogo');
    assertHospital(meal.catalogRevision===undefined||catalog.revision===meal.catalogRevision,'PRECONDITION','Catálogo mudou; reconferência obrigatória');
    assertMealReleaseSafe({fasting:admission.fasting,allergyCodes:admission.allergyCodes,dietRestrictionCodes:[...new Set([...(meal.dietRestrictionCodes||[]),...(catalog.restrictionCodes||[])])]});
    if(requireReady)assertHospital(meal.status==='READY','PRECONDITION','Produção não está concluída (READY)');
    return {admission,medical,catalog};
  }
  async _record(scope,meal,job,next,event,detail={}){
    const db=this.store;
    const updated=await db.put(scope.organizationId,'label',meal.unitId,{...job,state:next,updatedAt:db.now(),updatedBy:scope.uid},job.revision);
    await db.appendEvent(scope.organizationId,'meal',meal.id,event,scope.uid,{distributionState:next,unitId:meal.unitId,...detail});
    return updated;
  }
  async _transition(scope,meal,next,job,distributionState,detail={}){
    nextMealStatus(meal.status,next);
    const db=this.store;
    const updated=await db.put(scope.organizationId,'meal',meal.unitId,{...meal,status:next,...(next==='DELIVERED'?{deliveredAt:detail.effectiveAt||db.now(),deliveryRecordedAt:db.now()}: {})},meal.revision);
    await db.appendEvent(scope.organizationId,'meal',meal.id,transitionEvent[next],scope.uid,{from:meal.status,to:next,distribution:true,...detail});
    // W0 DeliveryEvent permits only physical distribution milestones, not cancellations.
    const deliveryEvent=['DISPATCHED','RECEIVED_BY_UNIT','DELIVERED'].includes(next)?await db.put(scope.organizationId,'delivery_event',meal.unitId,{
      id:'delivery_'+randomUUID(),organizationId:scope.organizationId,unitId:meal.unitId,
      mealId:meal.id,type:next,actorUid:scope.uid,occurredAt:db.now(),effectiveAt:next==='DELIVERED'?detail.effectiveAt??null:null,
      destinationUnitId:job.destinationUnitId
    }):null;
    const saved=await db.put(scope.organizationId,'label',meal.unitId,{...job,state:distributionState,updatedAt:db.now(),updatedBy:scope.uid,lastDeliveryEventId:deliveryEvent?.id||job.lastDeliveryEventId||null},job.revision);
    return {meal:updated,job:saved,event:deliveryEvent};
  }
  async _validateSnapshot(scope,meal,job){
    const clinical=await this._clinical(scope,meal);
    assertHospital(job.medicalReferenceId===meal.medicalReferenceId&&job.dietCode===meal.dietCode,'PRECONDITION','Pedido alterado após montagem: reconferir');
    if(meal.status==='READY')assertHospital(job.orderRevision===meal.revision,'PRECONDITION','Versão do pedido alterada: reconferência necessária');
    assertHospital(job.destinationUnitId===clinical.admission.unitId&&job.destinationBedId===(clinical.admission.bedId||null),'PRECONDITION','Localização alterada: reconciliar rota');
    assertHospital(!clinical.admission.allergyCodes.some(code=>job.ingredientCodes.includes(code)),'PRECONDITION','Ingrediente incompatível com alergia');
    assertHospital(job.preparedDietCode===meal.dietCode,'PRECONDITION','Preparação não corresponde à dieta vigente');
    return clinical;
  }
  async _checkBatch(scope,payload){
    assertHospital(uniq(payload.mealIds),'INVALID','Lote deve conter IDs distintos');
    assertHospital(payload.mealIds.length<=50,'INVALID','Lote excede o limite de 50 refeições');
    if(payload.batchId){
      assertIdentifier(payload.batchId,'batchId');
      const batch=await this.store.get(scope.organizationId,'production_batch',payload.batchId);
      assertHospital(batch&&batch.organizationId===scope.organizationId&&batch.status==='COMPLETE'&&payload.mealIds.every(id=>batch.mealIds?.includes(id)),'PRECONDITION','Lote de produção não concluído ou sem correspondência');
    }
  }
  async command(scope,operation,payload={}){
    assertHospital(kinds.has(operation),'INVALID','Comando de distribuição inválido');
    assertHospital(payload&&typeof payload==='object'&&!Array.isArray(payload),'INVALID','Payload inválido');
    const {idempotencyKey,...p}=payload;
    assertIdentifier(idempotencyKey,'idempotencyKey');
    assertIdentifier(p.unitId,'unitId');
    const permission=operation==='batch.receive'&&scope?.roles?.includes('UNIT')?'meal:write':'meal:distribution';
    requireHospitalPermission(scope,permission,p.unitId);
    const org=scope.organizationId;
    return this.store.transaction(async db=>db.idempotent(org,'w5.'+operation,idempotencyKey,hash({uid:scope.uid,p}),async()=>{
      if(operation==='batch.dispatch'||operation==='batch.receive'){
        await this._checkBatch(scope,p);
        const checked=[];
        for(const id of p.mealIds){const meal=await this._meal(scope,id,p.unitId,permission),job=await this._job(scope,meal);
          assertHospital(operation==='batch.dispatch'?(job.state==='CHECKED'&&meal.status==='READY'):(job.state==='DISPATCHED'&&meal.status==='DISPATCHED'),'PRECONDITION','Estado do lote incompatível');
          await this._validateSnapshot(scope,meal,job);
          checked.push({meal,job});
        }
        const changed=[];
        for(const {meal,job} of checked)changed.push(await this._transition(scope,meal,operation==='batch.dispatch'?'DISPATCHED':'RECEIVED_BY_UNIT',job,operation==='batch.dispatch'?'DISPATCHED':'RECEIVED',p.batchId?{batchId:p.batchId}:{}));
        return changed;
      }
      const meal=await this._meal(scope,p.mealId,p.unitId);
      if(operation==='assembly.start'){
        await this._clinical(scope,meal,{requireReady:true});
        const map=await this.store.get(org,'map',meal.mapId);
        assertHospital(map&&map.status!=='DRAFT','PRECONDITION','Mapa não foi enviado');
        assertHospital(!await this.store.get(org,'label',recordId(meal.id)),'CONFLICT','Montagem já iniciada');
        const admission=await this.store.get(org,'admission',meal.admissionId);
        const patient=await this.store.get(org,'patient',admission.patientId);
        assertHospital(patient&&patient.organizationId===org&&patient.referenceCode,'PRECONDITION','Identificador de paciente indisponível');
        const job=await db.put(org,'label',meal.unitId,{
          id:recordId(meal.id),organizationId:org,unitId:meal.unitId,mealId:meal.id,
          state:'ASSEMBLING',destinationUnitId:admission.unitId,destinationBedId:admission.bedId||null,
          dietCode:meal.dietCode,medicalReferenceId:meal.medicalReferenceId,orderRevision:meal.revision,
          labelCode:'meal_'+randomUUID(),createdAt:db.now(),createdBy:scope.uid,updatedAt:db.now(),
          ingredientCodes:[],preparedDietCode:null,checkedAt:null,checkedBy:null
        });
        await db.appendEvent(org,'meal',meal.id,'meal.assembly.started',scope.uid,{unitId:meal.unitId});
        return job;
      }
      const job=await this._job(scope,meal);
      if(operation==='assembly.reopen'){
        assertHospital(['ASSEMBLED','CHECKED'].includes(job.state)&&meal.status==='READY','PRECONDITION','Reconferência exige pedido pronto ainda não expedido');
        const reason=text(p.reason,'Motivo da reconferência',500);
        const {admission}=await this._clinical(scope,meal,{requireReady:true});
        return await this._record(scope,meal,{...job,orderRevision:meal.revision,destinationUnitId:admission.unitId,destinationBedId:admission.bedId||null,preparedDietCode:null,ingredientCodes:[],checkedAt:null,checkedBy:null},'ASSEMBLING','meal.assembly.reopened',{reason});
      }
      if(operation==='assembly.complete'){
        assertHospital(job.state==='ASSEMBLING'&&meal.status==='READY','PRECONDITION','Montagem não iniciada ou refeição sem preparo');
        const {admission}=await this._clinical(scope,meal,{requireReady:true});
        text(p.preparedDietCode,'Dieta preparada');
        assertHospital(p.preparedDietCode===meal.dietCode,'PRECONDITION','Dieta preparada incompatível');
        assertHospital(uniq(p.ingredientCodes),'INVALID','Ingredientes/restrições da preparação devem ser informados');
        assertHospital(!admission.allergyCodes.some(code=>p.ingredientCodes.includes(code)),'PRECONDITION','Preparação contém alérgeno registrado');
        return await this._record(scope,meal,{...job,preparedDietCode:p.preparedDietCode,ingredientCodes:p.ingredientCodes},'ASSEMBLED','meal.assembly.completed');
      }
      if(operation==='assembly.check'){
        assertHospital(job.state==='ASSEMBLED'&&meal.status==='READY','PRECONDITION','Montagem/preparo ainda não concluídos');
        await this._validateSnapshot(scope,meal,job);
        return await this._record(scope,meal,{...job,checkedAt:db.now(),checkedBy:scope.uid},'CHECKED','meal.assembly.checked');
      }
      if(operation==='meal.deliver.paper'){
        // Physical delivery is attested from a signed paper route sheet, not inferred from printing or dispatch.
        assertHospital(p.paperConfirmed===true&&p.identityChecked===true,'PRECONDITION','Confirme a entrega real e a conferência de dois identificadores na ficha em papel');
        assertHospital(typeof p.deliveryTime==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(p.deliveryTime),'INVALID','Hora real de entrega deve estar no formato HH:mm');
        assertHospital(['DISPATCHED','RECEIVED'].includes(job.state)&&['DISPATCHED','RECEIVED_BY_UNIT'].includes(meal.status),'PRECONDITION','A refeição precisa ter sido expedida antes de confirmar a entrega');
        const {admission}=await this._validateSnapshot(scope,meal,job);
        const patient=await db.get(org,'patient',admission.patientId);
        assertHospital(patient?.displayName&&patient?.birthDate&&admission.bedId,'PRECONDITION','Para confirmar pela ficha em papel, o paciente deve ter nome, nascimento e leito atual registrados');
        const when=new Date(meal.localDate+'T'+p.deliveryTime+':00-03:00');
        const now=Date.parse(db.now());
        assertHospital(Number.isFinite(when.getTime())&&new Date(when.getTime()-3*60*60_000).toISOString().slice(0,10)===meal.localDate,'INVALID','Hora da entrega inválida');
        assertHospital(when.getTime()<=now+60_000&&now-when.getTime()<=48*60*60_000,'INVALID','Hora fora do período permitido. Informe o horário real que consta no papel');
        const context={paperConfirmed:true,identityMethod:'MANUAL',identifiersChecked:2,effectiveAt:when.toISOString(),source:'PAPER_ROUTE_SHEET'};
        let currentMeal=meal,currentJob=job;
        if(job.state==='DISPATCHED'){
          const receipt=await this._transition(scope,currentMeal,'RECEIVED_BY_UNIT',currentJob,'RECEIVED',{source:'PAPER_ROUTE_SHEET',paperReturn:true});
          currentMeal=receipt.meal;currentJob=receipt.job;
        }
        return await this._transition(scope,currentMeal,'DELIVERED',currentJob,'DELIVERED',context);
      }
      if(operation==='meal.deliver'){
        assertHospital(job.state==='RECEIVED'&&meal.status==='RECEIVED_BY_UNIT','PRECONDITION','Refeição não recebida pela unidade');
        const {admission}=await this._validateSnapshot(scope,meal,job);
        const patient=await db.get(org,'patient',admission.patientId);
        assertHospital(patient&&patient.referenceCode&&patient.displayName,'PRECONDITION','Dois identificadores institucionais indisponíveis');
        // For paper-based workflows: full name + date of birth; for legacy records: original code + full name.
        const nameVerified=text(p.patientDisplayName,'Nome completo',200).toLocaleLowerCase('pt-BR')===patient.displayName.trim().toLocaleLowerCase('pt-BR');
        const secondVerified=patient.birthDate?
          p.patientBirthDate===patient.birthDate:
          text(p.patientReferenceCode,'Identificador institucional de registro antigo',150)===patient.referenceCode;
        assertHospital(nameVerified&&secondVerified,'PRECONDITION','Confira o nome completo e a data de nascimento no papel antes de entregar');
        assertHospital(p.identityMethod==='MANUAL'||p.identityMethod==='SCANNER','INVALID','Método de identificação inválido');
        return await this._transition(scope,meal,'DELIVERED',job,'DELIVERED',{identityMethod:p.identityMethod,identifiersChecked:2});
      }
      if(operation==='meal.suspend'){
        const reason=text(p.reason,'Motivo da suspensão',500);
        assertHospital(['READY','DISPATCHED','RECEIVED_BY_UNIT'].includes(meal.status),'PRECONDITION','Apenas refeição pronta ou em rota pode ser suspensa');
        return await this._transition(scope,meal,'SUSPENDED',job,'SUSPENDED',{reason});
      }
      if(operation==='meal.return'||operation==='meal.cancel'){
        const reason=text(p.reason,'Motivo',500);
        assertHospital(job.state!=='DELIVERED'&&!['DELIVERED','CANCELLED'].includes(meal.status),'PRECONDITION','Entrega concluída não pode ser estornada automaticamente');
        const isReturn=operation==='meal.return';
        assertHospital(isReturn?['DISPATCHED','RECEIVED'].includes(job.state):['ASSEMBLING','ASSEMBLED','CHECKED'].includes(job.state),'PRECONDITION','Operação incompatível com estado');
        const next=isReturn?'SUSPENDED':'CANCELLED';
        return await this._transition(scope,meal,next,job,isReturn?'RETURNED':'CANCELLED',{reason});
      }
      if(operation==='route.flag'){
        const admission=await db.get(org,'admission',meal.admissionId);
        assertHospital(admission&&admission.unitId!==meal.unitId,'PRECONDITION','Não há transferência confirmada');
        text(p.reason,'Motivo da reconciliação',500);
        return await this._record(scope,meal,{...job,routeToUnitId:admission.unitId,routeToBedId:admission.bedId||null},'ROUTE_RECONCILIATION_REQUIRED','meal.route.reconciliation_required',{reason:p.reason});
      }
      throw Error('unreachable');
    }));
  }
  async status(scope,{unitId,mealId}){
    const meal=await this._meal(scope,mealId,unitId);
    const job=await this.store.get(scope.organizationId,'label',recordId(meal.id));
    const admission=await this.store.get(scope.organizationId,'admission',meal.admissionId);
    const routeMismatch=!!admission&&admission.unitId!==meal.unitId;
    const timing=classifyMealTiming({cycleId:meal.cycleId,localDate:meal.localDate,at:this.store.now(),mealType:meal.mealType});
    const patient=admission?await this.store.get(scope.organizationId,'patient',admission.patientId):null;
    const bed=admission?.bedId?await this.store.get(scope.organizationId,'bed',admission.bedId):null;
    const diet=await this.store.get(scope.organizationId,'catalog_diet',meal.dietCode);
    return {mealId:meal.id,mealStatus:meal.status,distributionState:job?.state||'NOT_STARTED',jobRevision:job?.revision||null,
      patientName:patient?.displayName??null,needsBirthDate:!!patient?.birthDate,dietCode:meal.dietCode,dietLabel:diet?.label??'Dieta',observation:meal.observation??'',deliveredAt:meal.deliveredAt??null,
      destinationBedNumber:routeMismatch?null:(bed?.label??null),
      destinationUnitId:routeMismatch?null:(job?.destinationUnitId||meal.unitId),
      routeReconciliationRequired:routeMismatch||job?.state==='ROUTE_RECONCILIATION_REQUIRED',
      mainMealAlert:meal.mealType==='PRIMARY'&&meal.status!=='DELIVERED'&&timing.principalDeliveryTolerancePassed?
        'Principal além da tolerância: alertar assistência e avaliar secundária/conduta excepcional':null};
  }
  /** No URL identifiers or public QR. This HTML is private and must be delivered POST-only, no-store. */
  async printLabel(scope,{unitId,mealId,format='80mm'}){
    const meal=await this._meal(scope,mealId,unitId),job=await this._job(scope,meal);
    assertHospital(['ASSEMBLED','CHECKED','DISPATCHED','RECEIVED'].includes(job.state),'PRECONDITION','Etiqueta não pode ser emitida nesse estado');
    const {admission}=await this._validateSnapshot(scope,meal,job);
    assertHospital(['80mm','A6','A4'].includes(format),'INVALID','Formato de etiqueta inválido');
    const patient=await this.store.get(scope.organizationId,'patient',admission.patientId);
    assertHospital(patient&&patient.referenceCode,'PRECONDITION','Identificador de paciente ausente');
    const code=esc(job.labelCode),name=esc(patient.displayName||'Identificação adicional na unidade');
    const tags=esc([...new Set([...(meal.dietRestrictionCodes||[]),...(admission.allergyCodes||[]),...(job.ingredientCodes||[])])].join(', ')||'Conferir prontuário');
    const size=format==='80mm'?'80mm':format==='A6'?'105mm':'210mm';
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;"><title>Etiqueta hospitalar</title><style>@page{size:auto;margin:4mm}body{font:14px Arial,sans-serif;max-width:'+size+';padding:4mm}p{margin:6px 0}strong{font-weight:700}.critical{border:2px solid #000;padding:6px}</style></head><body><h2>Refeição hospitalar</h2><p><strong>Identificação:</strong> '+name+' — '+esc(patient.referenceCode)+'</p><p><strong>Unidade/leito:</strong> '+esc(job.destinationUnitId)+' / '+esc(job.destinationBedId||'a confirmar')+'</p><p><strong>Dieta:</strong> '+esc(meal.dietCode)+' — '+esc(meal.mealType)+' / '+esc(meal.cycleId)+'</p><p class="critical"><strong>Alergias/restrições relevantes:</strong> '+tags+'</p><p><strong>Pedido:</strong> '+esc(meal.id)+' v'+esc(job.orderRevision)+'</p><p><strong>Código opaco:</strong> '+code+'</p><small>Confirmar dois identificadores antes de entregar. Não usar somente o leito. Código não é URL/QR público.</small></body></html>';
  }
}
