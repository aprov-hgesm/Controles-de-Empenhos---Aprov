import { FiscalUiError } from './flow.mjs';
const routes = Object.freeze({
  profiles:'/api/company/profiles',
  connection:'/api/company/fiscal/connections',
  nfe:'/api/company/fiscal/nfe',
});
export function createFiscalBrowserApi({getIdToken,fetchImpl=fetch}) {
  if (typeof getIdToken !== 'function' || typeof fetchImpl !== 'function')
    throw new FiscalUiError('API_INVALID');
  async function call(key, {method='GET',body,signal,idempotencyKey}={}) {
    if (!Object.prototype.hasOwnProperty.call(routes,key))
      throw new FiscalUiError('ROUTE_FORBIDDEN');
    const token=await getIdToken();
    if (signal?.aborted) throw new FiscalUiError('ABORTED');
    const headers={Authorization:'Bearer '+token,Accept:'application/json'};
    if (body !== undefined) headers['Content-Type']='application/json';
    if (idempotencyKey) headers['Idempotency-Key']=idempotencyKey;
    let response;
    try {
      response=await fetchImpl(routes[key],{
        method,headers,cache:'no-store',credentials:'same-origin',signal,
        ...(body === undefined ? {} : {body:JSON.stringify(body)}),
      });
    } catch(e) {
      if (signal?.aborted) throw new FiscalUiError('ABORTED');
      throw new FiscalUiError(method==='POST'?'UNKNOWN_OUTCOME':'NETWORK_UNAVAILABLE',
        method==='POST'?'Resultado do envio desconhecido. Não reenviar; consulte o status.':'Serviço temporariamente indisponível.');
    }
    const malformed = () => method === 'POST'
      ? new FiscalUiError('UNKNOWN_OUTCOME',
          'Resposta inválida após envio. Não reenviar; consulte o status fiscal.')
      : new FiscalUiError('INVALID_RESPONSE');
    let payload;
    try {payload=await response.json();} catch {throw malformed();}
    if (!payload || typeof payload !== 'object') throw malformed();
    if (!response.ok || payload.ok !== true) {
      const code=typeof payload.code==='string' ? payload.code : 'SERVER_UNAVAILABLE';
      const status=response.status;
      // Once a POST leaves the browser, a server 5xx may hide a successful side effect.
      // Never invite a second emission attempt without reconciliation.
      if (method === 'POST' && status >= 500 && code !== 'NFE_INTEGRATION_PENDING') {
        throw new FiscalUiError('UNKNOWN_OUTCOME',
          'Resultado do envio incerto. Não reenviar; consulte o status fiscal.');
      }
      throw new FiscalUiError(code,
        status===401||status===403?'Acesso fiscal não autorizado ou revogado.':
        status===503?'Serviço fiscal em preparação. Nenhuma NF-e foi emitida.':
        status===409?'Conflito de revisão. Consulte o documento antes de continuar.':
        'Não foi possível concluir a solicitação fiscal.');
    }
    return payload;
  }
  return Object.freeze({
    profiles:signal=>call('profiles',{signal}),
    connection:signal=>call('connection',{signal}),
    nfe:signal=>call('nfe',{signal}),
    /** Must only be called after explicit review + server capability, never on page load/switch. */
    submit:(body,idempotencyKey,signal)=>call('nfe',{method:'POST',body,idempotencyKey,signal}),
  });
}