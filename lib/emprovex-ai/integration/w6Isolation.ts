/** W6-only managed identity and isolated Firebase target.
 * The production provisioner, Firebase verifier and warehouse transport remain unchanged.
 * A hosted W6 service must fail closed before any operational read unless all
 * independent project and identity requirements are met.
 */
import {createRemoteJWKSet,jwtVerify} from 'jose';
import firebaseConfig from '../../../firebase-applet-config.json';
import {normalizePlatformEmail} from '../../platformIdentity';
import {FounderAuthError,type VerifiedFirebaseRequest} from '../../server/firebaseFounderAuth';
import {AiExecutionError} from '../response';
import {aiLfm3Enabled} from './environment';

const SERVICE='emprovex-ai-w6-homologation';
const EXPECTED_RUNTIME='emprovex-ai-w6-runtime@gen-lang-client-0982077967.iam.gserviceaccount.com';
const METADATA='http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/';
const JWKS=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const PROJECT_PATTERN=/^[a-z][a-z0-9-]{5,29}$/;
const DATABASE_PATTERN=/^(?:\(default\)|[a-z][a-z0-9-]{3,62})$/;
const METADATA_TIMEOUT_MS=1800;

export interface W6DataTarget {projectId:string;coreDatabaseId:string;warehouseDatabaseId:string}
function candidate(env:NodeJS.ProcessEnv):boolean {
 return env.K_SERVICE===SERVICE||env.K_CONFIGURATION===SERVICE||
   (env.K_REVISION||'').startsWith(SERVICE+'-');
}
/** null outside W6; throws on ANY inconsistent candidate configuration. */
export function w6DataTarget(env:NodeJS.ProcessEnv=process.env):W6DataTarget|null {
 if(!candidate(env))return null;
 const projectId=env.EMPROVEX_AI_W6_FIREBASE_PROJECT_ID?.trim()||'';
 const coreDatabaseId=env.EMPROVEX_AI_W6_CORE_DATABASE_ID?.trim()||'';
 const warehouseDatabaseId=env.EMPROVEX_AI_W6_WAREHOUSE_DATABASE_ID?.trim()||'';
 if(!aiLfm3Enabled(env) || !PROJECT_PATTERN.test(projectId) ||
    projectId===firebaseConfig.projectId || projectId.startsWith('demo-') ||
    !DATABASE_PATTERN.test(coreDatabaseId) || !DATABASE_PATTERN.test(warehouseDatabaseId) ||
    env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON?.trim() || env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
    env.FIRESTORE_EMULATOR_HOST?.trim() || env.FIREBASE_AUTH_EMULATOR_HOST?.trim() ||
    env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1' || env.EMPROVEX_E2E_SERVER_AUTH==='1')
   throw new AiExecutionError('AI_W6_ISOLATION_NOT_CONFIGURED',503);
 return {projectId,coreDatabaseId,warehouseDatabaseId};
}
async function metadata(path:string):Promise<string> {
 const response=await fetch(METADATA+path,{headers:{'Metadata-Flavor':'Google'},
   cache:'no-store',signal:AbortSignal.timeout(METADATA_TIMEOUT_MS)});
 if(!response.ok)throw new AiExecutionError('AI_W6_IDENTITY_UNAVAILABLE',503);
 return (await response.text()).trim();
}
/** Never call the production getGoogleAccessToken() or use JSON keys. */
export async function getW6GoogleAccessToken():Promise<string> {
 if(!w6DataTarget())throw new AiExecutionError('AI_W6_SERVICE_FORBIDDEN',503);
 const email=await metadata('email');
 if(email!==EXPECTED_RUNTIME)throw new AiExecutionError('AI_W6_RUNTIME_IDENTITY_FORBIDDEN',503);
 const raw=await metadata('token');
 let result:unknown;
 try{result=JSON.parse(raw);}catch{throw new AiExecutionError('AI_W6_IDENTITY_UNAVAILABLE',503);}
 const token=(result && typeof result==='object' && !Array.isArray(result))
   ?(result as Record<string,unknown>).access_token:null;
 if(typeof token!=='string'||token.length<10||token.length>16384||
   !/^[A-Za-z0-9._~+/-]+$/.test(token))
   throw new AiExecutionError('AI_W6_IDENTITY_UNAVAILABLE',503);
 return token;
}
/** Firebase Auth verification for a separate real test project (hosted: RS256 only).
 * No fake tokens, emulator decoding or production issuer accepted by W6.
 */
export async function verifyW6FirebaseRequest(authorization:string|null):Promise<VerifiedFirebaseRequest> {
 const target=w6DataTarget();
 if(!target)throw new AiExecutionError('AI_W6_SERVICE_FORBIDDEN',503);
 const match=/^Bearer ([^\s]+)$/.exec(authorization||'');
 if(!match)throw new FounderAuthError('Token de autenticação inválido.',401);
 let payload;
 try{
  ({payload}=await jwtVerify(match[1],JWKS,{
    issuer:'https://securetoken.google.com/'+target.projectId,
    audience:target.projectId,algorithms:['RS256']
  }));
 }catch{throw new FounderAuthError('Sessão Firebase inválida ou expirada.',401);}
 const email=typeof payload.email==='string'?normalizePlatformEmail(payload.email):'';
 const provider=payload.firebase && typeof payload.firebase==='object' && !Array.isArray(payload.firebase)
   ?(payload.firebase as Record<string,unknown>).sign_in_provider:'';
 if(!payload.sub || !email || payload.email_verified!==true || typeof provider!=='string' || !provider)
   throw new FounderAuthError('Identidade Firebase de homologação inválida.',403);
 return {uid:payload.sub,email,signInProvider:provider,idToken:match[1],claims:payload};
}
