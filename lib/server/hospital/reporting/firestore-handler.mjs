import {resolveHospitalScope} from '../core/auth.mjs';
import {HospitalError} from '../../../../features/hospital/core/domain.mjs';
import {HospitalReportingService} from './firestore-service.mjs';
import {exportHospitalReport} from './export.mjs';

const STATUS={UNAUTHORIZED:401,FORBIDDEN:403,INVALID:400,CONFLICT:409,NOT_FOUND:404,PRECONDITION:412,UNAVAILABLE:503};
const MAX_EXPORT_ROWS=5000;
/** Only a verified server identity + active hospital membership may read reports.
 * The caller passes a QA store; there is no fallback to logistical/production data.
 */
export function createHospitalFirestoreReportingHandler({store,verifyToken}){
  const service=new HospitalReportingService(store);
  return async function handle({authorization,organizationId,view='maps',filters={},page=1,pageSize=50,format=null}){
    try{
      const scope=await resolveHospitalScope({authorization,organizationId,store,verifyToken});
      if(format){
        if(format!=='csv'&&format!=='pdf')throw new HospitalError('INVALID','Formato não permitido');
        const report=await service.query(scope,{view,filters,page:1,pageSize:MAX_EXPORT_ROWS,exportAll:true});
        if(report.partial||report.total>MAX_EXPORT_ROWS)throw new HospitalError('PRECONDITION','Relatório muito extenso ou parcial: restrinja os filtros');
        const file=await exportHospitalReport(report,format);
        return {status:200,headers:{'Content-Type':file.mime,'Content-Disposition':'attachment; filename="'+file.filename+'"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},bytes:file.bytes};
      }
      const result=await service.query(scope,{view,filters,page,pageSize});
      return {status:200,headers:{'Cache-Control':'no-store'},body:{ok:true,data:result}};
    }catch(e){
      const code=e instanceof HospitalError?e.code:'UNAVAILABLE';
      return {status:STATUS[code]||503,headers:{'Cache-Control':'no-store'},body:{ok:false,error:{code,message:e instanceof HospitalError?e.message:'Relatórios hospitalares indisponíveis'}}};
    }
  };
}
