import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import { warehouseAdminTransaction, WarehouseStoreError } from './warehouseFirestoreTransaction';
import type {
  WarehouseLandingVisualSettings, WarehouseLandingVisualOverrides,
} from '../warehouse/landingVisualLayoutRepository';

// Configuração visual: sem deltas de estoque, porém restrita ao workspace/UG.
// Validar no servidor; jamais aceitar os metadados de autoria do cliente.
const VERSION='warehouse_landing_visual_layout_v1' as const;
const ID='landing-visual-layout';
const VALID_DEPOT=/^dep_[a-f0-9]{32}$/;
const invalid=():never=>{throw new WarehouseStoreError('WAREHOUSE_LANDING_VISUAL_INVALID',400);};

function normalize(raw:unknown):WarehouseLandingVisualOverrides {
  if(!raw||typeof raw!=='object'||Array.isArray(raw)) return invalid();
  const pairs=Object.entries(raw as Record<string,unknown>);
  if(pairs.length>60) return invalid();
  const overrides:WarehouseLandingVisualOverrides={};
  for(const [id,value] of pairs) {
    if(!VALID_DEPOT.test(id)||!value||typeof value!=='object'||Array.isArray(value)) return invalid();
    const obj=value as Record<string,unknown>;
    if(Object.keys(obj).some(k=>k!=='offsetX'&&k!=='offsetY')) return invalid();
    if(typeof obj.offsetX!=='number'||!Number.isFinite(obj.offsetX)||Math.abs(obj.offsetX)>500
      ||typeof obj.offsetY!=='number'||!Number.isFinite(obj.offsetY)||Math.abs(obj.offsetY)>380) {
      return invalid();
    }
    overrides[id]={offsetX:obj.offsetX,offsetY:obj.offsetY};
  }
  return overrides;
}

export async function saveWarehouseLandingVisualServer(
  access:VerifiedWarehouseRequest,
  input:unknown
):Promise<WarehouseLandingVisualSettings> {
  const overrides=normalize(input);
  const arrangementJson=JSON.stringify(overrides);
  const path=`warehouse/${access.workspaceId}/settings/${ID}`;
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?'emulator':await getGoogleAccessToken();
  const now=new Date().toISOString();
  return warehouseAdminTransaction(token,[path],rows=>{
    const prior=rows.get(path);
    if(prior && (prior.data.workspaceId!==access.workspaceId || prior.data.ug!==access.ug)) {
      throw new WarehouseStoreError('WAREHOUSE_LANDING_VISUAL_SCOPE_MISMATCH',403);
    }
    const unchanged=prior?.data.schemaVersion===VERSION
      && prior.data.arrangementJson===arrangementJson;
    const result:WarehouseLandingVisualSettings={
      schemaVersion:VERSION,workspaceId:access.workspaceId,ug:access.ug,overrides,
      updatedBy:unchanged && typeof prior.data.updatedBy==='string'
        ?prior.data.updatedBy:access.uid,
      updatedAt:unchanged && typeof prior.data.updatedAt==='string'
        ?prior.data.updatedAt:now,
    };
    return {
      result,
      writes:unchanged?[]:[{path,data:{
        schemaVersion:VERSION,workspaceId:access.workspaceId,ug:access.ug,
        arrangementJson,updatedBy:access.uid,updatedAt:now,
      }}],
    };
  });
}
