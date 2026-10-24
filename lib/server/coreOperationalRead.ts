/**
 * Read-only operational Firestore API through server IAM.
 * Every collection is explicitly whitelisted and tenant scope is taken
 * exclusively from the verified principal, never from URL/body.
 */
import firebaseConfig from '../../firebase-applet-config.json';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import type { VerifiedPlatformPrincipal } from './platformAuthorization';

export const CORE_READ_COLLECTIONS = [
  'empenhos','invoices','alerts','comissoes','cronogramas',
] as const;
export type CoreReadCollection = (typeof CORE_READ_COLLECTIONS)[number];
export class CoreReadFailure extends Error {
  constructor(public readonly code:string,public readonly status:number) {
    super(code); this.name='CoreReadFailure';
  }
}
function endpoint() {
  if (process.env.EMPROVEX_E2E_SERVER_AUTH === '1') {
    const host=process.env.FIRESTORE_EMULATOR_HOST?.trim()||'';
    const project=process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID?.trim()||'';
    if (process.env.NODE_ENV === 'production'
        || !/^(localhost|127\.0\.0\.1):\d{2,5}$/.test(host)
        || !project.startsWith('demo-'))
      throw new CoreReadFailure('CORE_READ_CONFIGURATION',503);
    return { root:'http://'+host+'/v1/projects/'+encodeURIComponent(project)
       +'/databases/(default)/documents', token:'owner' };
  }
  return {root:'https://firestore.googleapis.com/v1/projects/'
     +encodeURIComponent(firebaseConfig.projectId)+'/databases/'
     +encodeURIComponent(firebaseConfig.firestoreDatabaseId)+'/documents',token:null};
}
type FirestoreField = Record<string,unknown>;
function decode(value:FirestoreField):unknown {
  if('stringValue' in value)return value.stringValue;
  if('integerValue' in value)return Number(value.integerValue);
  if('doubleValue' in value)return Number(value.doubleValue);
  if('booleanValue' in value)return value.booleanValue;
  if('timestampValue' in value)return value.timestampValue;
  if('nullValue' in value)return null;
  if('bytesValue' in value)return value.bytesValue;
  if('referenceValue' in value)return value.referenceValue;
  if('geoPointValue' in value)return value.geoPointValue;
  if('arrayValue' in value){
    const v=value.arrayValue as {values?:FirestoreField[]};
    return (v.values||[]).map(decode);
  }
  if('mapValue' in value){
    const v=value.mapValue as {fields?:Record<string,FirestoreField>};
    return decodeFields(v.fields||{});
  }
  throw new CoreReadFailure('CORE_READ_INVALID_FIELD',503);
}
function decodeFields(fields:Record<string,FirestoreField>) {
  return Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,decode(value)]));
}
export async function listOperationalServer(
  principal:VerifiedPlatformPrincipal,resource:CoreReadCollection,
):Promise<Record<string,unknown>[]> {
  if(!CORE_READ_COLLECTIONS.includes(resource))
    throw new CoreReadFailure('CORE_READ_FORBIDDEN',403);
  const cfg=endpoint();
  const token=cfg.token||await getGoogleAccessToken();
  const path=cfg.root+'/workspaces/'+encodeURIComponent(principal.workspaceId)
    +'/'+encodeURIComponent(resource);
  let pageToken='';
  const rows:Record<string,unknown>[]=[];
  for(let page=0;page<30;page++){
    const url=path+'?pageSize=250'+(pageToken?'&pageToken='+encodeURIComponent(pageToken):'');
    let response:Response;
    try{
      response=await fetch(url,{headers:{authorization:'Bearer '+token},cache:'no-store'});
    }catch{throw new CoreReadFailure('CORE_READ_UNAVAILABLE',503);}
    if(!response.ok)throw new CoreReadFailure('CORE_READ_UNAVAILABLE',503);
    const body=await response.json() as {documents?:Array<{
      name?:string,fields?:Record<string,FirestoreField>
    }>,nextPageToken?:string};
    for(const record of body.documents||[]){
      const id=record.name?.split('/').pop();
      if(!id || id==='.' || id==='..')throw new CoreReadFailure('CORE_READ_MALFORMED',503);
      const data=decodeFields(record.fields||{});
      // Match SDK behaviour: invoice id remains the display number;
      // only invoices have a separate internal Firestore document key.
      if(resource==='invoices')rows.push({...data,recordKey:data.recordKey||id});
      else if(resource==='empenhos'||resource==='comissoes')
        rows.push({...data,id:data.id||id});
      else rows.push(data);
    }
    if(rows.length>7500)throw new CoreReadFailure('CORE_READ_RESULT_TOO_LARGE',503);
    pageToken=body.nextPageToken||'';
    if(!pageToken)return rows;
  }
  throw new CoreReadFailure('CORE_READ_PAGINATION_LIMIT',503);
}
