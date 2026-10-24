'use client';

import { warehouseDb } from '../firebase';
import { getDoc, getDocs, doc, collection, query, limit } from './mobileReadSdkBridge';
import { warehouseDocumentPath, warehouseDomainPath } from './namespace';
import { validateWarehouseMaterial, type WarehouseMaterial } from './material';
import { warehouseCanonicalMaterialReadInput } from './readCompatibility';

function checked(workspaceId:string,id:string,data:Record<string,unknown>):WarehouseMaterial {
  const result=validateWarehouseMaterial(warehouseCanonicalMaterialReadInput(id,data),
    {expectedWorkspaceId:workspaceId});
  if(!result.ok)throw new Error('WAREHOUSE_MOBILE_MATERIAL_INVALID');
  return result.data;
}
export async function getWarehouseMaterial(workspaceId:string,materialId:string):Promise<WarehouseMaterial|null> {
  const snap=await getDoc(doc(warehouseDb,warehouseDocumentPath(workspaceId,'materials',materialId)));
  return snap.exists()?checked(workspaceId,snap.id,snap.data() as Record<string,unknown>):null;
}
export async function listWarehouseMaterials(workspaceId:string,maxResults=250):Promise<WarehouseMaterial[]> {
  const snap=await getDocs(query(collection(warehouseDb,warehouseDomainPath(workspaceId,'materials')),
    limit(Math.max(1,Math.min(maxResults,500)))));
  return snap.docs.map(d=>checked(workspaceId,d.id,d.data() as Record<string,unknown>));
}
