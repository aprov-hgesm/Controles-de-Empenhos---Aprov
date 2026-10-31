/** Executor W3. Sem interpretacao linguistica, mutacoes ou acesso a colecoes arbitrarias. */
import { parseAiQuery } from './contracts';
import { authorizeAi } from './authorize';
import { executeFinancial } from './financial';
import { executeWarehouse } from './warehouse';
import { makeAiResponse, AiExecutionError } from './response';
let inFlight=0;
const MAX_CONCURRENT=8; // limite por instancia, nao substitui rate limiting distribuido.
export async function executeAiQuery(authorization:string|null,input:unknown) {
  const start=Date.now();
  const query=parseAiQuery(input);
  if(inFlight>=MAX_CONCURRENT)throw new AiExecutionError('AI_LOCAL_CONCURRENCY_EXCEEDED',429);
  inFlight++;
  try{
    const access=await authorizeAi(authorization,query.intent);
    const result=query.intent.startsWith('warehouse_')
      ? await executeWarehouse(access,query)
      : await executeFinancial(access,query);
    const response=makeAiResponse(query.intent,query.params,result,start);
    console.info('emprovex_ai_query',{contract:response.contract,status:response.status,
      elapsedMs:response.metrics.durationMs,examined:response.metrics.examinedDocuments});
    return response;
  }finally{inFlight--;}
}
