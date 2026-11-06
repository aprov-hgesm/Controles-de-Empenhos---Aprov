import {RoutingError} from './core.mjs';
/** Testable optional transport. Per-instance quota is defense in depth, not distributed billing control. */
export function createProviderTransport({fetchImpl=fetch,clock=()=>Date.now(),limit=10,timeoutMs=4500}={}){
 const breakers=new Map();
 return{async request(name,url,init={}){
  const now=clock(),prev=breakers.get(name)||{failures:0,until:0,window:now,count:0};
  if(now<prev.until)throw new RoutingError('PROVIDER_CIRCUIT_OPEN',503);
  if(now-prev.window>=60000){prev.window=now;prev.count=0;}
  if(++prev.count>limit)throw new RoutingError('PROVIDER_QUOTA_REACHED',429);
  breakers.set(name,prev);
  try{
   const res=await fetchImpl(url.toString(),{...init,cache:'no-store',redirect:'error',
    signal:AbortSignal.timeout(timeoutMs),headers:{'content-type':'application/json',accept:'application/json'}});
   if(!res.ok)throw new Error('PROVIDER_HTTP');
   const body=await res.text();
   if(body.length>256000)throw new Error('PROVIDER_RESPONSE_TOO_LARGE');
   const parsed=JSON.parse(body);
   prev.failures=0;prev.until=0;
   return parsed;
  }catch{
   prev.failures++;
   if(prev.failures>=3)prev.until=clock()+60000;
   throw new RoutingError('ROUTING_PROVIDER_UNAVAILABLE',503);
  }
 }};
}
