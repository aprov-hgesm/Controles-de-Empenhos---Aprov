'use client';
import { auth } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import { normalizeWorkspaceId } from '../platformIdentity';
import type { WarehouseInvoiceIntakeQueueContext } from './intakeStateRepository';

/** Fast operational queue: the browser never queries Firestore for its rows. */
export async function loadWarehouseInvoiceQueueFromServer(
  workspaceId:string
):Promise<WarehouseInvoiceIntakeQueueContext> {
  const user=auth.currentUser;
  if(!user)throw new Error('WAREHOUSE_READ_AUTH_REQUIRED');
  const scope=getCurrentOperationalScope(user.uid);
  if(scope.workspaceId!==normalizeWorkspaceId(workspaceId) || !scope.ug)
    throw new Error('WAREHOUSE_READ_SCOPE_MISMATCH');
  const token=await user.getIdToken();
  const response=await fetch('/api/central-depositos/queue',{
    method:'GET',
    headers:{authorization:'Bearer '+token},
    cache:'no-store',
  }).catch(()=>{throw new Error('WAREHOUSE_READ_UNAVAILABLE');});
  const json=await response.json().catch(()=>null) as
    {ok?:boolean;result?:WarehouseInvoiceIntakeQueueContext;error?:string}|null;
  if(!response.ok || !json?.ok || !json.result)
    throw new Error(json?.error || 'WAREHOUSE_READ_UNAVAILABLE');
  return json.result;
}
