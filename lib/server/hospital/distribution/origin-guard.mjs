/**
 * Strict CSRF origin guard with a single local preview exception.
 * Preview runs on loopback: Next can normalize the incoming request URL to
 * localhost even when the browser uses 127.0.0.1. Never relax this for
 * non-local requests or any production/GCP QA runtime.
 */
const LOOPBACK=new Set(['localhost','127.0.0.1','[::1]']);

export function distributionOriginAllowed(origin,requestUrl,{nodeEnv,firestoreQaEnabled,authEmulatorEnabled}={}){
 if(!origin)return true; // Non-browser callers still need the server-verified bearer.
 try{
  const source=new URL(origin),target=new URL(requestUrl);
  if(source.origin===target.origin)return true;
  const localPreview=nodeEnv==='development'&&firestoreQaEnabled==='1'&&authEmulatorEnabled==='1';
  return localPreview&&source.protocol==='http:'&&target.protocol==='http:'&&
    LOOPBACK.has(source.hostname)&&LOOPBACK.has(target.hostname)&&
    source.port==='3100'&&(!target.port||['3000','3100'].includes(target.port));
 }catch{return false;}
}
