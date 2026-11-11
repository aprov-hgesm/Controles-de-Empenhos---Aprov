import {NextRequest, NextResponse} from 'next/server';
import {HospitalQAStore} from '@/lib/server/hospital/core/qa-store.mjs';
import {resolveHospitalScope} from '@/lib/server/hospital/core/auth.mjs';
import {ProductionService} from '@/lib/server/hospital/production/service.mjs';
import {ProductionService as FirestoreProductionService} from '@/lib/server/hospital/production/firestore-service.mjs';
import {getHospitalW10Store} from '@/lib/server/hospital/firebase/qa-store.mjs';
import {HospitalError} from '@/features/hospital/core/domain.mjs';
import type {KitchenQuery} from '@/features/hospital/production/contracts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const errorResponse = (error:unknown) => {
  const known = error instanceof HospitalError;
  const code = known ? error.code : 'UNAVAILABLE';
  const status = code === 'UNAUTHORIZED' ? 401 : code === 'FORBIDDEN' ? 403 : code === 'NOT_FOUND' ? 404 : code === 'CONFLICT' ? 409 : code === 'PRECONDITION' ? 412 : code === 'INVALID' ? 400 : 503;
  return NextResponse.json({ok:false,error:{code,message:known ? error.message : 'Serviço da cozinha indisponível'}},{status,headers:{'Cache-Control':'no-store'}});
};
function openQA() {
  // Nunca abrir SQLite QA no Cloud Run produtivo. O adapter hospitalar definitivo é uma entrega de integração futura.
  if(process.env.NODE_ENV === 'production' || !process.env.HOSPITAL_QA_DB_PATH) throw new HospitalError('UNAVAILABLE','Somente ambiente QA hospitalar habilitado');
  return new HospitalQAStore({filename:process.env.HOSPITAL_QA_DB_PATH,qa:true});
}
function organization(req:NextRequest) {return req.headers.get('x-hospital-organization-id') ?? '';}
async function withService<T>(req:NextRequest,run:(service:ProductionService|FirestoreProductionService,scope:Awaited<ReturnType<typeof resolveHospitalScope>>)=>T|Promise<T>) {
  const useFirestore=process.env.HOSPITAL_FIRESTORE_QA_ENABLED==='1';
  const store=useFirestore?getHospitalW10Store():openQA();
  try {
    const scope=await resolveHospitalScope({authorization:req.headers.get('authorization')??'',organizationId:organization(req),store});
    const data=await run(useFirestore?new FirestoreProductionService(store as never):new ProductionService(store as HospitalQAStore),scope);
    return NextResponse.json({ok:true,data},{headers:{'Cache-Control':'no-store'}});
  }finally{store.close();}
}
export async function GET(req:NextRequest) {
  try {
    return await withService(req,(service,scope) => {
      const q=req.nextUrl.searchParams;
      const query:KitchenQuery={unitIds:q.getAll('unitId'),localDate:q.get('localDate')??'',cycleId:(q.get('cycleId')??'') as KitchenQuery['cycleId'],
        statuses:q.getAll('status') as KitchenQuery['statuses'],dietCode:q.get('dietCode')??'',restriction:q.get('restriction')??'',lateOnly:q.get('lateOnly')==='true',includeSuspended:q.get('includeSuspended')!=='false'};
      return service.snapshot(scope,query);
    });
  } catch(error) {return errorResponse(error);}
}
export async function POST(req:NextRequest) {
  try {
    const body:unknown=await req.json();
    if(!body || typeof body!=='object' || Array.isArray(body)) throw new HospitalError('INVALID','Comando inválido');
    const {action,args} = body as {action?:string;args?:unknown};
    if(!args || typeof args!=='object' || Array.isArray(args)) throw new HospitalError('INVALID','Argumentos inválidos');
    return await withService(req,(service,scope) => {
      // Somente comandos de produção: jamais aceitar marcar expedição/entrega nesta rota.
      const commands:{[key:string]:(a:never)=>unknown}={
        create: a=>service.createBatch(scope,a),start:a=>service.startBatch(scope,a),complete:a=>service.completeBatch(scope,a),
        acknowledge:a=>service.acknowledgeBatch(scope,a),reconcile:a=>service.reconcileBatch(scope,a),cancel:a=>service.cancelBatch(scope,a),flagAffected:a=>service.flagAffected(scope,a),
      };
      const command=commands[action??''];
      if(!command) throw new HospitalError('INVALID','Ação de cozinha desconhecida');
      return command(args as never);
    });
  } catch(error) {return errorResponse(error);}
}
