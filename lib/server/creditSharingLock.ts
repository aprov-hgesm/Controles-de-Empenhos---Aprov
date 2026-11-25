import {randomUUID} from 'node:crypto';
import {CreditAccessError,type CreditMember} from './creditControlAuth';
import {creditTransaction} from './creditControlFirestore';
type Lock={owner:string;operation:string;startedAt:string};
const lockPath=(m:CreditMember)=>'creditUnits/'+m.ug+'/settings/driveSharingLock';
/** Cross-instance, per-UG lock. No timeout takeover: an interrupted Drive write
 * may still be in flight. Only explicit technical reconciliation can clear a
 * crashed lock. Normal failures release it; reserved ACLs remain recoverable. */
export async function withCreditSharingLock<T>(m:CreditMember,operation:string,work:()=>Promise<T>):Promise<T>{
  if(m.role!=='gestor'||!/^\d{6}$/.test(m.ug))throw new CreditAccessError(403,'Operação reservada ao gestor.');
  const owner=randomUUID(),path=lockPath(m);
  await creditTransaction(async tx=>{
    const old=await tx.get<Lock>(path);
    if(old?.data.owner)throw new CreditAccessError(409,'Outra operação documental está em andamento. Tente novamente. Se persistir, solicite conciliação técnica.');
    tx.set(path,{owner,operation,startedAt:new Date().toISOString()});
  });
  try{return await work();}
  finally{await creditTransaction(async tx=>{
    const current=await tx.get<Lock>(path);
    if(current?.data.owner!==owner)throw new CreditAccessError(503,'Trava documental divergente. Solicite conciliação técnica.');
    tx.set(path,{owner:'',operation:'',startedAt:''});
  });}
}
