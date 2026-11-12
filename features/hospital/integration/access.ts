'use server';
import {HospitalQAStore} from '@/lib/server/hospital/core/qa-store.mjs';
import {getHospitalW10Store} from '@/lib/server/hospital/firebase/qa-store.mjs';
import {isHospitalQaUiReady} from '@/lib/server/hospital/firebase/qa-ui-gate.mjs';
import {resolveHospitalScope,requireHospitalPermission} from '@/lib/server/hospital/core/auth.mjs';
import type {HospitalRole} from '@/features/hospital/core/contracts';

export type HospitalWorkspaceAccess =
  | {status:200;organizationId:string;roles:HospitalRole[];unitIds:string[]}
  | {status:401|403|503;message:string};

/** Resolve somente o vínculo verificado no servidor; nenhum papel/unidade vem do navegador. */
export async function getHospitalWorkspaceAccess(idToken:string):Promise<HospitalWorkspaceAccess>{
  const organizationId=process.env.HOSPITAL_QA_ORGANIZATION_ID?.trim();
  const filename=process.env.HOSPITAL_QA_SQLITE_PATH?.trim();
  if(!isHospitalQaUiReady(process.env,{workspace:true})||!organizationId)
    return {status:503,message:'Área hospitalar indisponível fora do QA autorizado.'};
  if(typeof idToken!=='string'||idToken.length<20||idToken.length>16000)
    return {status:401,message:'Entre novamente para verificar sua identidade.'};
  let store:HospitalQAStore|ReturnType<typeof getHospitalW10Store>|null=null;
  try{
    store=process.env.HOSPITAL_FIRESTORE_QA_ENABLED==='1'
      ?getHospitalW10Store()
      :new HospitalQAStore({filename:filename!,qa:true});
    const scope=await resolveHospitalScope({authorization:'Bearer '+idToken,organizationId,store});
    const granted=scope.roles.filter((role:HospitalRole)=>{
      if(role==='HOSPITAL_ADMIN'){
        try{requireHospitalPermission(scope,'hospital:manage');return true;}catch{return false;}
      }
      const permission=role==='UNIT'?'map:read':role==='KITCHEN'?'meal:production':'nutrition:read';
      return scope.unitIds.some((unitId:string)=>{
        try{requireHospitalPermission(scope,permission,unitId);return true;}catch{return false;}
      });
    });
    if(!granted.length)return {status:403,message:'Sem perfil e unidade hospitalar autorizados.'};
    return {status:200,organizationId:scope.organizationId,roles:[...granted],unitIds:[...scope.unitIds]};
  }catch(error){
    const code=(error as {code?:string}|null)?.code;
    if(code==='UNAUTHORIZED')return {status:401,message:'Sessão inválida ou revogada.'};
    if(code==='FORBIDDEN')return {status:403,message:'Vínculo hospitalar não autorizado.'};
    return {status:503,message:'Não foi possível verificar o acesso hospitalar.'};
  }finally{store?.close();}
}
