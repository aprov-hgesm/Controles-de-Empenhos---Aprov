import { auth } from './firebase';
import {
  EmpenhoConcurrencyError,
} from './empenhoConcurrency';
import { handleFirestoreError, OperationType } from './firebase';
import {
  getCurrentOperationalScope,
  getOperationalDocumentPath,
} from './operationalPaths';
import type { Empenho } from './types';
import { recordWorkspaceUsage } from './workspaceUsageTelemetry';

async function writeEmpenhoServer(
  userId:string,mode:'create'|'update',empenho:Empenho
):Promise<Empenho>{
  const scope=getCurrentOperationalScope(userId);
  const path=getOperationalDocumentPath(scope,'empenhos',empenho.id);
  try{
    const user=auth.currentUser;
    if(!user||user.uid!==userId)throw new Error('Sessão operacional inválida.');
    const response=await fetch('/api/core/empenhos/transact',{
      method:'POST',
      headers:{authorization:'Bearer '+await user.getIdToken(),
        'content-type':'application/json'},
      body:JSON.stringify({mode,empenho}),cache:'no-store',
    });
    const body=await response.json() as {ok:boolean,result?:Empenho,
      error?:string,message?:string};
    if(!response.ok){
      const errors=['stale_revision','create_conflict','missing_empenho','invalid_revision'];
      if(body.error&&errors.includes(body.error))throw new EmpenhoConcurrencyError(
        body.error as 'stale_revision'|'create_conflict'|'missing_empenho'|'invalid_revision',
        body.message||'Conflito ao salvar empenho. Atualize a tela.');
      throw new Error(body.error||'EMPENHO_SERVER_UNAVAILABLE');
    }
    if(!body.ok||!body.result)throw new Error('Resposta de empenho inválida.');
    // Estimativa do comando: 1 NE + 1 lock. Identidade do setor é verificada separadamente.
    recordWorkspaceUsage(scope,{documentReads:2,documentWrites:1},'empenhos');
    return body.result;
  }catch(error){
    if(error instanceof EmpenhoConcurrencyError)throw error;
    handleFirestoreError(error,OperationType.WRITE,path);
    throw error;
  }
}
export function commitEmpenhoCreate(userId:string,empenho:Empenho):Promise<Empenho>{
  return writeEmpenhoServer(userId,'create',empenho);
}
export function commitEmpenhoUpdate(userId:string,empenho:Empenho):Promise<Empenho>{
  return writeEmpenhoServer(userId,'update',empenho);
}
