import {HospitalQAStore} from '../../../../lib/server/hospital/core/qa-store.mjs';
import {createHospitalReportingHandler} from '../../../../lib/server/hospital/reporting/handler.mjs';
import {createHospitalFirestoreReportingHandler} from '../../../../lib/server/hospital/reporting/firestore-handler.mjs';
import {getHospitalW10Store} from '../../../../lib/server/hospital/firebase/qa-store.mjs';
import {isHospitalGcpQaRuntime} from '../../../../lib/server/hospital/firebase/gcp-qa-runtime.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const allowed=['from','to','localDate','unitId','cycleId','mealType','dietCode','status','bedId','consistency','route','restriction','eventType','incidentType'];
const noCache={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};

export async function GET(request:Request):Promise<Response>{
  // The W0 SQLite adapter is intentionally QA-only. Production stays CLOSED until W9
  // supplies the audited, isolated clinical adapter and institution authorizes access.
  const path=process.env.HOSPITAL_QA_SQLITE_PATH;
  if((process.env.NODE_ENV==='production'&&!isHospitalGcpQaRuntime())||(process.env.HOSPITAL_FIRESTORE_QA_ENABLED!=='1'&&(process.env.HOSPITAL_QA_REPORTING_ENABLED!=='true'||!path))){
    return Response.json({ok:false,error:{code:'UNAVAILABLE',message:'Relatórios hospitalares ainda não habilitados'}},{status:503,headers:noCache});
  }
  let store:HospitalQAStore|null=null;
  try {
    const url=new URL(request.url);
    const filters:Record<string,unknown>={};
    for(const key of allowed){
      const value=url.searchParams.get(key);
      if(value!==null)filters[key]=value;
    }
    if(url.searchParams.has('late')){
      const value=url.searchParams.get('late');
      filters.late=value==='true'?true:value==='false'?false:value;
    }
    const parseNum=(key:string,defaultValue:number)=>{
      const input=url.searchParams.get(key);
      if(input===null)return defaultValue;
      if(!/^[0-9]+$/.test(input))return NaN;
      return Number(input);
    };
    const useFirestore=process.env.HOSPITAL_FIRESTORE_QA_ENABLED==='1';
    if(!useFirestore)store=new HospitalQAStore({filename:path!,qa:true});
    const handler=useFirestore
      ?createHospitalFirestoreReportingHandler({store:getHospitalW10Store()})
      :createHospitalReportingHandler({store:store!});
    const answer=await handler({
      authorization:request.headers.get('authorization')||'',
      organizationId:request.headers.get('x-hospital-organization-id')||'',
      view:url.searchParams.get('view')||'maps',
      filters,
      page:parseNum('page',1),
      pageSize:parseNum('pageSize',50),
      format:(url.searchParams.get('format')||null) as 'csv'|'pdf'|null,
    });
    if(answer.bytes){
      return new Response(Buffer.from(answer.bytes),{status:answer.status,headers:{...noCache,...answer.headers}});
    }
    return Response.json(answer.body??{ok:false,error:{code:'UNAVAILABLE',message:'Relatório indisponível'}},{status:answer.status,headers:{...noCache,...answer.headers}});
  }catch{
    return Response.json({ok:false,error:{code:'UNAVAILABLE',message:'Relatórios hospitalares indisponíveis'}},{status:503,headers:noCache});
  }finally{
    store?.close();
  }
}
