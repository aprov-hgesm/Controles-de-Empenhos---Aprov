import type { BulkStockRow } from '../server/warehouseBulkStockWorkbook';
import type { WarehouseMaterial } from './material';
import type { WarehouseLocation, WarehouseStockPosition } from './location';
import { matchBulkStockLocal, matchBulkStockSubposition } from './bulkStockLocationMatcher';
import { indexBulkStockMaterials, bulkMaterialGroupKey } from './bulkStockMaterialMatcher';

export interface BulkStockCandidate {
  id:string;description:string;unit:WarehouseMaterial['unit'];
}
export interface BulkStockPreflightLine extends BulkStockRow {
  position:WarehouseStockPosition|null;materialId:string|null;group:string;
  candidates:BulkStockCandidate[];errors:string[];matchedLocation:string|null;
}

/** Deterministic domain resolution, independent of Firestore Rules / client SDK. */
export function resolveBulkStockRows(
  rows:BulkStockRow[],depotId:string,materials:WarehouseMaterial[],locations:WarehouseLocation[],
):BulkStockPreflightLine[] {
  const materialIndex=indexBulkStockMaterials(materials);
  const locals=locations.filter(l=>l.kind==='LOCAL'&&l.depotId===depotId);
  const subs=locations.filter(l=>l.kind==='SUBPOSITION'&&l.depotId===depotId);
  return rows.map(item=>{
    const errors:string[]=[];
    const matches=matchBulkStockLocal(locals,depotId,item.localType,item.localNumber);
    if(matches.length!==1)errors.push(matches.length?'Localização ambígua':'Local não cadastrado');
    const local=matches.length===1?matches[0]:null;
    let matchedLocation=local?.name||null;
    let position:WarehouseStockPosition|null=null;
    if(local) {
      if(!item.subposition)
        position={kind:'LOCATION',depotId,locationId:local.id,subpositionId:null};
      else {
        const found=matchBulkStockSubposition(subs,depotId,local.id,item.subposition);
        if(found.length!==1)
          errors.push(found.length?'Subposição ambígua':'Subposição não cadastrada');
        else {
          position={kind:'SUBPOSITION',depotId,locationId:local.id,subpositionId:found[0].id};
          matchedLocation=local.name+' / '+found[0].name;
        }
      }
    }
    const group=bulkMaterialGroupKey(item.material,item.unit);
    const candidates=(materialIndex.get(group)||[])
      .map(m=>({id:m.id,description:m.description,unit:m.unit}));
    const materialId=candidates.length===1?candidates[0].id:null;
    if(candidates.length>1)errors.push('Selecione o cadastro do material na prévia');
    return {...item,position,materialId,group,candidates,errors,matchedLocation};
  });
}

export function bulkStockOperationId(depotId:string,digest:string,line:number):string {
  if(!/^dep_[a-f0-9]{32}$/.test(depotId)||!/^[a-f0-9]{64}$/.test(digest)
    ||!Number.isInteger(line)||line<2||line>100000)
    throw new Error('STOCK_IMPORT_IDEMPOTENCY_INPUT_INVALID');
  return 'bulk_'+depotId+'_'+digest.slice(0,28)+'_'+line;
}
