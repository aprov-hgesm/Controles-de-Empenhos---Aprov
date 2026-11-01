/** Google managed identity for the explicitly enabled EMPROVEX AI production pilot.
 * Independent of legacy JSON-key provisioning. Never runs outside the
 * exact production-pilot Cloud Run service or without its feature gate.
 */
import {aiProductionPilotEnabled} from './environment';
import {AiExecutionError} from '../response';

const EXPECTED_RUNTIME='emprovex-run-runtime@gen-lang-client-0982077967.iam.gserviceaccount.com';
const METADATA='http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/';
const METADATA_TIMEOUT_MS=1800;

async function metadata(path:string):Promise<string> {
 const response=await fetch(METADATA+path,{
  headers:{'Metadata-Flavor':'Google'},cache:'no-store',
  signal:AbortSignal.timeout(METADATA_TIMEOUT_MS)
 });
 if(!response.ok)throw new AiExecutionError('AI_PILOT_IDENTITY_UNAVAILABLE',503);
 return (await response.text()).trim();
}
export async function getAiProductionGoogleAccessToken():Promise<string> {
 if(!aiProductionPilotEnabled())throw new AiExecutionError('AI_PILOT_DISABLED',503);
 const email=await metadata('email');
 if(email!==EXPECTED_RUNTIME)throw new AiExecutionError('AI_PILOT_RUNTIME_IDENTITY_FORBIDDEN',503);
 const raw=await metadata('token');
 let payload:unknown;
 try{payload=JSON.parse(raw);}catch{throw new AiExecutionError('AI_PILOT_IDENTITY_UNAVAILABLE',503);}
 const token=payload&&typeof payload==='object'&&!Array.isArray(payload)
  ?(payload as Record<string,unknown>).access_token:null;
 if(typeof token!=='string'||token.length<10||token.length>16384||
    !/^[A-Za-z0-9._~+/-]+$/.test(token))
   throw new AiExecutionError('AI_PILOT_IDENTITY_UNAVAILABLE',503);
 return token;
}
