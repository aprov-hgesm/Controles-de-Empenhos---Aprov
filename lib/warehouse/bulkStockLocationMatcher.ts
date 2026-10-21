import type { WarehouseLocation } from './location';

/**
 * Reconcilia referências físicas digitadas no Excel com cadastros existentes.
 * "Estante 9" = "Estante 09" = "EST-09"; "1" = "Prateleira 01".
 * Nunca cria locais nem aproxima números de posições diferentes.
 */
export type StockLocationRef = Pick<WarehouseLocation,
  'id' | 'kind' | 'depotId' | 'parentLocationId' | 'status' | 'code' | 'name'>;

type Family = 'ESTANTE' | 'FREEZER' | 'GELADEIRA' | 'PALETE' | 'PRATELEIRA';
const FAMILIES:Record<string,Family>={
  estante:'ESTANTE', est:'ESTANTE',
  freezer:'FREEZER', frz:'FREEZER',
  geladeira:'GELADEIRA', gel:'GELADEIRA',
  palete:'PALETE', pallet:'PALETE', pal:'PALETE',
  prateleira:'PRATELEIRA', prt:'PRATELEIRA', prat:'PRATELEIRA',
  subposicao:'PRATELEIRA', sub:'PRATELEIRA', subpos:'PRATELEIRA',
};
function compact(raw:string):string {
  return raw.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]/g,'');
}
function labelKey(raw:string):string|null {
  const match=compact(raw).match(/^([a-z]+)0*(\d{1,4})$/);
  if(!match)return null;
  const family=FAMILIES[match[1]];
  if(!family)return null;
  const number=Number(match[2]);
  return number>0?family+':'+number:null;
}
function numericSubposition(raw:string):number|null {
  const value=compact(raw);
  const match=value.match(/^0*(\d{1,4})$/);
  if(match)return Number(match[1])||null;
  const alias=labelKey(raw);
  if(!alias?.startsWith('PRATELEIRA:'))return null;
  return Number(alias.split(':')[1])||null;
}
export function matchBulkStockLocal(
  locals:readonly StockLocationRef[],depotId:string,kind:string,number:string
):StockLocationRef[] {
  const required=labelKey(kind+' '+number);
  const literal=compact(kind+' '+number);
  // Compatibilidade: locais personalizados continuam reconhecidos por código/nome exato.
  return locals.filter(local=>local.status==='active'&&local.kind==='LOCAL'
    &&local.depotId===depotId
    &&((required&&!required.startsWith('PRATELEIRA:')&&
      (labelKey(local.name)===required||labelKey(local.code)===required))
      ||compact(local.name)===literal||compact(local.code)===literal));
}
export function matchBulkStockSubposition(
  locations:readonly StockLocationRef[],depotId:string,parentId:string,value:string
):StockLocationRef[] {
  const required=numericSubposition(value);
  const literal=compact(value);
  // Mantém os códigos livres antigos ("A1" etc.) se informados literalmente.
  return locations.filter(sub=>sub.status==='active'&&sub.kind==='SUBPOSITION'
    &&sub.depotId===depotId&&sub.parentLocationId===parentId
    &&((required!==null&&
      (labelKey(sub.name)==='PRATELEIRA:'+required||
       labelKey(sub.code)==='PRATELEIRA:'+required))
      ||compact(sub.name)===literal||compact(sub.code)===literal));
}
