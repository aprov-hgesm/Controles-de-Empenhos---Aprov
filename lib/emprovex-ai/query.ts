/** Executor deterministico W3; a rota W4.5 entrega apenas AiAccess criado no servidor. */
import { parseAiQuery } from './contracts';
import { prepareAiAccess, authorizeAiIntent, type AiAccess } from './authorize';
import { executeFinancial } from './financial';
import { executeWarehouse } from './warehouse';
import { makeAiResponse, AiExecutionError } from './response';
let inFlight=0;
const MAX_CONCURRENT=8; // Limite por instancia; nao equivale a rate limiting distribuido.

/** Reutiliza a autorizacao de identidade já validada nesta requisicao.
 * Nunca aceitar AiAccess serializado por HTTP nem persistir o googleToken no cliente.
 */
export async function executeAuthorizedAiQuery(access:AiAccess,input:unknown) {
  const start=Date.now();
  const query=parseAiQuery(input);
  authorizeAiIntent(access,query.intent);
  if(inFlight>=MAX_CONCURRENT)throw new AiExecutionError('AI_LOCAL_CONCURRENCY_EXCEEDED',429);
  inFlight++;
  try {
    const result=query.intent.startsWith('warehouse_')
      ? await executeWarehouse(access,query)
      : await executeFinancial(access,query);
    const response=makeAiResponse(query.intent,query.params,result,start);
    console.info('emprovex_ai_query',{contract:response.contract,status:response.status,
      elapsedMs:response.metrics.durationMs,examined:response.metrics.examinedDocuments});
    return response;
  }finally{inFlight--;}
}
/** Endpoint W3 de compatibilidade: identidade sempre resolvida de novo no servidor. */
export async function executeAiQuery(authorization:string|null,input:unknown) {
  const query=parseAiQuery(input);
  const access=await prepareAiAccess(authorization);
  return executeAuthorizedAiQuery(access,query);
}
