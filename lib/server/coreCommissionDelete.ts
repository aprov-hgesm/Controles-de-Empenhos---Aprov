/** Atomic commissions deletion. Bounded server IAM operation; no client-controlled path. */
import firebaseConfig from '../../firebase-applet-config.json';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import type { VerifiedPlatformPrincipal } from './platformAuthorization';

export class CommissionDeleteError extends Error {
  constructor(public readonly code:string,public readonly status:number){super(code);this.name='CommissionDeleteError';}
}
const idPattern=/^[A-Za-z0-9_-]{1,160}$/;
export function validateCommissionDeleteIds(ids:unknown):string[]{
  if(!Array.isArray(ids)||ids.length<1||ids.length>450
    ||ids.some(id=>typeof id!=='string'||!idPattern.test(id))
    ||new Set(ids).size!==ids.length)
    throw new CommissionDeleteError('COMMISSION_INVALID_IDS',400);
  return ids as string[];
}
export async function deleteCommissionsServer(actor:VerifiedPlatformPrincipal,ids:unknown):Promise<number>{
  const checked=validateCommissionDeleteIds(ids);
  let project=firebaseConfig.projectId;
  let db=firebaseConfig.firestoreDatabaseId;
  let endpoint='https://firestore.googleapis.com/v1';
  let token:string;
  if(process.env.EMPROVEX_E2E_SERVER_AUTH==='1'){
    const host=process.env.FIRESTORE_EMULATOR_HOST?.trim()||'';
    const testProject=process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID?.trim()||'';
    if(process.env.NODE_ENV==='production'
      ||!/^(?:localhost|127\.0\.0\.1):\d{2,5}$/.test(host)
      ||!testProject.startsWith('demo-'))
      throw new CommissionDeleteError('COMMISSION_EMULATOR_INVALID',503);
    project=testProject;db='(default)';endpoint='http://'+host+'/v1';
    token='owner';
  }else token=await getGoogleAccessToken();
  const root='projects/'+project+'/databases/'+db+'/documents';
  const commits=checked.map(id=>({delete:root+'/workspaces/'+actor.workspaceId+'/comissoes/'+id}));
  let response:Response;
  try{
    response=await fetch(endpoint+'/'+root+':commit',{
      method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
      body:JSON.stringify({writes:commits}),cache:'no-store',
    });
  }catch{throw new CommissionDeleteError('COMMISSION_UNAVAILABLE',503);}
  if(!response.ok)throw new CommissionDeleteError('COMMISSION_UNAVAILABLE',503);
  return checked.length;
}
