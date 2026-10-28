import type { BulkStockRow } from '../server/warehouseBulkStockWorkbook';
import type { WarehouseLocation, WarehouseStockPosition } from './location';
import { matchBulkStockLocal, matchBulkStockSubposition } from './bulkStockLocationMatcher';
export interface BulkStockPreflightLine extends BulkStockRow {
  position:WarehouseStockPosition|null;errors:string[];matchedLocation:string|null;
}

/**
 * A carga por Entrada Avulsa nunca resolve identidades no catálogo existente.
 * Somente destinos físicos são validados; IDs de materiais novos são derivados
 * pelo servidor no momento da entrada, sem permitir seleção de ID no browser.
 */
export function resolveBulkStockRows(
  rows:BulkStockRow[],depotId:string,locations:WarehouseLocation[],
):BulkStockPreflightLine[] {
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
    return {...item,position,errors,matchedLocation};
  });
}

export function bulkStockOperationId(depotId:string,digest:string,line:number):string {
  if(!/^dep_[a-f0-9]{32}$/.test(depotId)||!/^[a-f0-9]{64}$/.test(digest)
    ||!Number.isInteger(line)||line<2||line>100000)
    throw new Error('STOCK_IMPORT_IDEMPOTENCY_INPUT_INVALID');
  return 'bulk_'+depotId+'_'+digest.slice(0,28)+'_'+line;
}
