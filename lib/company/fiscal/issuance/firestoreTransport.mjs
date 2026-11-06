/**
 * W10-III trusted Firestore REST transport. Production requires a server-side
 * service identity token provider; QA requires demo-* and local Auth/Firestore.
 * Must never be invoked from a browser or given arbitrary hosts by callers.
 */
export class FiscalTransportError extends Error {
  constructor(code,status=503){super(code);this.code=code;this.status=status;}
}
function safe(path){
  if(typeof path!=='string'||path.split('/').some(x=>!x||x==='.'||x==='..'||x.length>256||/[?#]/.test(x)))
    throw new FiscalTransportError('FISCAL_INVALID_PATH',403);
  return path.split('/').map(encodeURIComponent).join('/');
}
function encode(v){
  if(v===null)return{nullValue:'NULL_VALUE'};
  if(typeof v==='string')return{stringValue:v};
  if(typeof v==='boolean')return{booleanValue:v};
  if(typeof v==='number'&&Number.isSafeInteger(v))return{integerValue:String(v)};
  if(typeof v==='number'&&Number.isFinite(v))return{doubleValue:v};
  if(Array.isArray(v))return{arrayValue:{values:v.map(encode)}};
  if(v&&typeof v==='object')return{mapValue:{fields:fields(v)}};
  throw new FiscalTransportError('FISCAL_INVALID_VALUE',422);
}
function fields(record){return Object.fromEntries(Object.entries(record).filter(([,v])=>v!==undefined).map(([k,v])=>[k,encode(v)]));}
function decode(v){
  if('stringValue'in v)return v.stringValue;
  if('booleanValue'in v)return v.booleanValue;
  if('integerValue'in v)return Number(v.integerValue);
  if('doubleValue'in v)return v.doubleValue;
  if('nullValue'in v)return null;
  if('arrayValue'in v)return(v.arrayValue.values||[]).map(decode);
  return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decode(x)]));
}
export function createFiscalTransport({projectId,databaseId='(default)',tokenProvider,fetchImpl=fetch,emulatorHost=null}={}) {
  if(typeof projectId!=='string'||!/^[a-z0-9-]{4,80}$/.test(projectId)
    || typeof tokenProvider!=='function'||typeof fetchImpl!=='function')
    throw new FiscalTransportError('FISCAL_TRANSPORT_DISABLED');
  const demo=emulatorHost!==null;
  if(demo && (!(projectId.startsWith('demo-')) || databaseId!=='(default)'
    || !['127.0.0.1:8080','localhost:8080'].includes(emulatorHost)
    || !['127.0.0.1:9099','localhost:9099'].includes(process.env.FIREBASE_AUTH_EMULATOR_HOST)
    || process.env.EMPROVEX_E2E_SERVER_AUTH!=='1'
    || process.env.NODE_ENV==='production'||process.env.K_SERVICE||process.env.VERCEL))
    throw new FiscalTransportError('FISCAL_EMULATOR_GUARD');
  if(!demo && process.env.EMPROVEX_COMPANY_FISCAL_STORE_ENABLED!=='1')
    throw new FiscalTransportError('FISCAL_STORE_DISABLED');
  const prefix='projects/'+projectId+'/databases/'+databaseId+'/documents';
  const url=(demo?'http://'+emulatorHost:'https://firestore.googleapis.com')+'/v1/'+prefix;
  async function call(path,options={}){
    let res;
    try{
      const token=await tokenProvider();
      if(typeof token!=='string'||!token)throw Error('TOKEN_UNAVAILABLE');
      res=await fetchImpl(url+path,{...options,
        headers:{authorization:'Bearer '+token,...(options.body?{'content-type':'application/json'}:{})},
        cache:'no-store',signal:AbortSignal.timeout(8000)});
    }catch{throw new FiscalTransportError('FISCAL_STORE_UNAVAILABLE');}
    return res;
  }
  return {
    async read(path){
      const res=await call('/'+safe(path));
      if(res.status===404)return null;
      if(!res.ok)throw new FiscalTransportError('FISCAL_STORE_UNAVAILABLE');
      const json=await res.json();
      if(!json.updateTime)throw new FiscalTransportError('FISCAL_STORE_INTEGRITY');
      return{value:Object.fromEntries(Object.entries(json.fields||{}).map(([k,v])=>[k,decode(v)])),
        updateTime:json.updateTime};
    },
    async commit(writes){
      if(!Array.isArray(writes)||writes.length<1||writes.length>20)
        throw new FiscalTransportError('FISCAL_INVALID_BATCH',422);
      const mapped=writes.map(w=>({
        update:{name:prefix+'/'+safe(w.path),fields:fields(w.value)},
        currentDocument:w.precondition,
      }));
      const res=await call(':commit',{method:'POST',body:JSON.stringify({writes:mapped})});
      if(res.ok)return;
      if(res.status===409||res.status===412)throw new FiscalTransportError('CONFLICT',409);
      const error=await res.text();
      if(/ALREADY_EXISTS|FAILED_PRECONDITION|ABORTED/i.test(error))
        throw new FiscalTransportError('CONFLICT',409);
      throw new FiscalTransportError('FISCAL_STORE_UNAVAILABLE');
    },
  };
}
