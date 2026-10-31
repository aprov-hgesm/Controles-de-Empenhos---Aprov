import type {W3Intent,W3Query} from './types';
import {W3_VERSION,W3_CONTRACTS} from './adapterConstants';
/** Closed, independent W3 schema mirror while PR #425 remains isolated.
 * Must be contract-tested against W3 parseAiQuery before integration.
 */
const NE=/^\d{4}NE\d{1,10}$/i;
const TEXT=/^[^\u0000-\u001f\u007f<>]{2,120}$/u;
const CNPJ=/^\d{14}$/;
const MATERIAL=/^mat_[a-f0-9]{32}$/;
const DEPOT=/^dep_[a-f0-9]{32}$/;
const PERIODS=['today','yesterday','day_before_yesterday','tomorrow','this_week','last_week',
  'two_weeks_ago','this_month','last_month','last_7_days','last_30_days','this_exercise','previous_exercise'];
const keys=(o:Record<string,unknown>,allowed:string[])=>Object.keys(o).every(k=>allowed.includes(k));
const goodText=(x:unknown)=>typeof x==='string'&&TEXT.test(x.trim())&&x.length<=120;
const goodCnpj=(x:unknown)=>{
  if(typeof x!=='string'||!CNPJ.test(x)||/^(\d)\1{13}$/.test(x))return false;
  let sum=0;for(let i=0;i<12;i++)sum+=+x[i]*(i<4?5-i:13-i);
  const a=(11-sum%11)%11;if(+x[12] !== (a>=10?0:a))return false;
  sum=0;for(let i=0;i<13;i++)sum+=+x[i]*(i<5?6-i:14-i);
  const b=(11-sum%11)%11;return +x[13] === (b>=10?0:b);
};
const validPeriod=(x:unknown):boolean=>{
 if(!x||typeof x!=='object'||Array.isArray(x))return false;
 const p=x as Record<string,unknown>;
 if(p.kind!==undefined)return keys(p,['kind','value'])&&p.kind==='relative'&&PERIODS.includes(String(p.value));
 if(!keys(p,['start','endExclusive'])||typeof p.start!=='string'||typeof p.endExclusive!=='string')return false;
 const good=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))
   &&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
 return good(p.start)&&good(p.endExclusive)&&p.start<p.endExclusive&&Date.parse(p.endExclusive)-Date.parse(p.start)<=366*86400000;
};
export function makeW3Query(intent:W3Intent,p:Record<string,unknown>):W3Query|null {
 if(!Object.prototype.hasOwnProperty.call(W3_CONTRACTS,intent)||!p||Array.isArray(p))return null;
 let valid=false;
 switch(intent){
 case 'supplier_contact_find':
   valid=keys(p,['cnpj','nameQuery','channel'])&&(goodText(p.nameQuery)||goodCnpj(p.cnpj))&&
   (p.nameQuery===undefined||goodText(p.nameQuery))&&(p.cnpj===undefined||goodCnpj(p.cnpj))&&
   (p.channel===undefined||['all','email','phone','whatsapp'].includes(String(p.channel)));break;
 case 'commitment_get':valid=keys(p,['commitmentId','includeItems'])&&typeof p.commitmentId==='string'&&NE.test(p.commitmentId)
   &&(p.includeItems===undefined||typeof p.includeItems==='boolean');break;
 case 'commitment_total_balance':valid=keys(p,['commitmentId','itemId'])&&typeof p.commitmentId==='string'&&NE.test(p.commitmentId)
   &&(p.itemId===undefined||(typeof p.itemId==='string'&&/^[a-z0-9_-]{1,130}$/i.test(p.itemId)));break;
 case 'commitment_previous_open_list':valid=keys(p,['exerciseYear','includeHistorical','pageSize','cursor'])&&
   (p.exerciseYear===undefined||(Number.isInteger(p.exerciseYear)&&Number(p.exerciseYear)>=2000&&Number(p.exerciseYear)<=2100))&&
   (p.includeHistorical===undefined||typeof p.includeHistorical==='boolean')&&
   (p.pageSize===undefined||(Number.isInteger(p.pageSize)&&Number(p.pageSize)>=1&&Number(p.pageSize)<=50))&&p.cursor===undefined;break;
 case 'schedule_sent_history_list':valid=keys(p,['commitmentId','sentPeriod','supplierCnpj','pageSize'])&&
   (p.commitmentId!==undefined||p.sentPeriod!==undefined||p.supplierCnpj!==undefined)&&
   (p.commitmentId===undefined||(typeof p.commitmentId==='string'&&NE.test(p.commitmentId)))&&
   (p.sentPeriod===undefined||validPeriod(p.sentPeriod))&&
   (p.supplierCnpj===undefined||goodCnpj(p.supplierCnpj))&&p.pageSize===undefined;break;
 case 'invoice_registration_period_list':valid=keys(p,['interval','dateMeaning','supplierCnpj','commitmentId','pageSize','cursor'])&&
   validPeriod(p.interval)&&p.dateMeaning==='registered'&&
   (p.supplierCnpj===undefined||goodCnpj(p.supplierCnpj))&&
   (p.commitmentId===undefined||(typeof p.commitmentId==='string'&&NE.test(p.commitmentId)))&&p.pageSize===undefined&&p.cursor===undefined;break;
 case 'warehouse_stock_get':
 case 'warehouse_material_locations_list':
   valid=keys(p,intent==='warehouse_stock_get'?['materialId','materialQuery','barcode']:
     ['materialId','materialQuery','barcode','depotId','pageSize'])&&
   (p.materialId!==undefined||p.materialQuery!==undefined||p.barcode!==undefined)&&
   (p.materialId===undefined||(typeof p.materialId==='string'&&MATERIAL.test(p.materialId)))&&
   (p.materialQuery===undefined||goodText(p.materialQuery))&&
   (p.barcode===undefined||(typeof p.barcode==='string'&&p.barcode.length>0&&p.barcode.length<=128))&&
   (p.depotId===undefined||(typeof p.depotId==='string'&&DEPOT.test(p.depotId)))&&p.pageSize===undefined;break;
 }
 return valid?{version:W3_VERSION,intent,params:{...p}}:null;
}
