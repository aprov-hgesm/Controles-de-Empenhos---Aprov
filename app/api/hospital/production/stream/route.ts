import {NextRequest} from 'next/server';
import {HospitalQAStore} from '@/lib/server/hospital/core/qa-store.mjs';
import {resolveHospitalScope,requireHospitalPermission} from '@/lib/server/hospital/core/auth.mjs';
import {HospitalError} from '@/features/hospital/core/domain.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest) {
  if(process.env.NODE_ENV==='production' || !process.env.HOSPITAL_QA_DB_PATH) return Response.json({ok:false,error:{code:'UNAVAILABLE',message:'QA apenas'}},{status:503});
  let store:HospitalQAStore;
  try {store=new HospitalQAStore({filename:process.env.HOSPITAL_QA_DB_PATH,qa:true});}
  catch{return Response.json({ok:false,error:{code:'UNAVAILABLE',message:'Armazenamento QA indisponível'}},{status:503});}
  try {
    const scope=await resolveHospitalScope({authorization:req.headers.get('authorization')??'',organizationId:req.headers.get('x-hospital-organization-id')??'',store});
    const unitIds=req.nextUrl.searchParams.getAll('unitId');
    if(!unitIds.length || unitIds.length>40) throw new HospitalError('INVALID','Unidades inválidas');
    for(const id of unitIds) requireHospitalPermission(scope,'meal:production',id);
    const encoder=new TextEncoder();
    let timer:ReturnType<typeof setInterval>|undefined;
    let expiration:ReturnType<typeof setTimeout>|undefined;
    let closed=false;
    const body=new ReadableStream<Uint8Array>({
      start(controller){
        const started=Date.now();
        const send=()=>{
          if(closed) return;
          if(req.signal.aborted || Date.now()-started > 115000){close();return;}
          try {
            // Sem payload clínico: cursor baseado em versões de registros permitidos, não no journal global.
            const cursor=unitIds.map(unit=>{
              const maps=store.list<{id:string;revision:number}>(scope.organizationId,'map',unit);
              const meals=store.list<{id:string;revision:number}>(scope.organizationId,'meal',unit);
              const batches=store.list<{id:string;revision:number}>(scope.organizationId,'production_batch',unit);
              return [maps,meals,batches].flat().reduce((hash,r)=>((hash*33 + [...r.id].reduce((n,c)=>n+c.charCodeAt(0),0)+r.revision)>>>0),5381);
            }).join('-');
            controller.enqueue(encoder.encode(`event: revision\ndata: ${JSON.stringify({cursor})}\n\n`));
          } catch {close();}
        };
        const close=()=>{if(closed)return;closed=true;if(timer)clearInterval(timer);if(expiration)clearTimeout(expiration);try{store.close();}catch{}try{controller.close();}catch{}};
        req.signal.addEventListener('abort',close,{once:true});
        send();timer=setInterval(send,10000);expiration=setTimeout(close,118000);
      },
      cancel(){closed=true;if(timer)clearInterval(timer);if(expiration)clearTimeout(expiration);try{store.close();}catch{}},
    });
    return new Response(body,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no','Connection':'keep-alive'}});
  } catch(error) {
    store.close();
    const code=error instanceof HospitalError ? error.code:'UNAVAILABLE';
    const status=code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:code==='INVALID'?400:503;
    return Response.json({ok:false,error:{code,message:error instanceof HospitalError?error.message:'Serviço indisponível'}},{status,headers:{'Cache-Control':'no-store'}});
  }
}
