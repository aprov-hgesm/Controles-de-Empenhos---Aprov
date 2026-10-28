/**
 * Baixa técnica estável sem FEFO e sem escolha de lotes na interface.
 * Divide em linhas independentes na unidade-base e falha fechado se
 * a atribuição de lotes for inconsistente ou houver estoque vencido
 * sem quantidade livre comprovada. O modo includeExpired é reservado a
 * solicitações/documentos sem baixa física, nunca ao motor de saída.
 *
 * @param {{quantity:number,physicalQuantity:number,lots:Array<{
 * id:string,code:string,quantity:number,status:string,expiresOn:string|null
 * }>,today?:Date,includeExpired?:boolean}} input
 * @returns {Array<{lotId:string|null,quantity:number}>}
 */
export function planMobileOutboundAutomaticLots(input) {
  const round=(n)=>Math.round((n+Number.EPSILON)*1e6)/1e6;
  const {quantity,physicalQuantity,lots}=input;
  if(!Number.isFinite(quantity)||quantity<=0||Math.abs(round(quantity)-quantity)>1e-6
    ||!Number.isFinite(physicalQuantity)||quantity>physicalQuantity+1e-6
    ||!Array.isArray(lots)||lots.length>120)throw Error('WAREHOUSE_MOBILE_OUTBOUND_INVALID_QUANTITY');
  let attributed=0;
  for(const lot of lots) {
    if(typeof lot.id!=='string'||typeof lot.code!=='string'
      ||!Number.isFinite(lot.quantity)||lot.quantity<0)
      throw Error('WAREHOUSE_MOBILE_OUTBOUND_LOT_INVALID');
    // Inativos também ocupam atribuição: não podem virar saldo livre implicitamente.
    attributed=round(attributed+lot.quantity);
  }
  if(attributed>physicalQuantity+1e-6)
    throw Error('WAREHOUSE_MOBILE_OUTBOUND_LOT_OVERATTRIBUTED');
  const day=(input.today||new Date()).toISOString().slice(0,10);
  const eligible=lots.filter(x=>x.status==='active'&&x.quantity>0
      &&(input.includeExpired===true||!x.expiresOn||x.expiresOn>=day))
    // Ordem técnica estável, jamais priorização por validade (sem ordenacao FEFO).
    .sort((a,b)=>a.id.localeCompare(b.id));
  const plan=[];
  let pending=quantity;
  for(const lot of eligible) {
    if(pending<=1e-6)break;
    const n=round(Math.min(pending,lot.quantity));
    if(n<=0)continue;
    plan.push({lotId:lot.id,quantity:n});
    pending=round(pending-n);
  }
  if(pending>1e-6) {
    const untracked=round(physicalQuantity-attributed);
    if(pending>untracked+1e-6)throw Error('WAREHOUSE_MOBILE_OUTBOUND_LOTS_NOT_ELIGIBLE');
    plan.push({lotId:null,quantity:pending});
  }
  if(plan.length>40)throw Error('WAREHOUSE_MOBILE_OUTBOUND_TOO_MANY_LINES');
  if(Math.abs(round(plan.reduce((s,x)=>s+x.quantity,0))-quantity)>1e-6)
    throw Error('WAREHOUSE_MOBILE_OUTBOUND_PLAN_MISMATCH');
  return plan;
}
