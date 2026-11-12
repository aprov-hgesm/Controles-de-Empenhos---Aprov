// Pure projection of persisted map + meal events. No fabricated acceptance/delivery.
export const ORDER_STEPS=Object.freeze([
 {id:'sent',label:'Enviado à cozinha'},
 {id:'received',label:'Recebido pela cozinha'},
 {id:'preparing',label:'Em preparo'},
 {id:'distribution',label:'Em distribuição'},
 {id:'delivered',label:'Entregue nos leitos'},
]);
const excluded=new Set(['CANCELLED']);
export function getOrderProgress(map,meals=[]){
 const rows=(Array.isArray(meals)?meals:[]).filter(x=>!excluded.has(x.status));
 const count=rows.length;
 const delivered=rows.filter(x=>x.status==='DELIVERED').length;
 const moving=rows.some(x=>['DISPATCHED','RECEIVED_BY_UNIT'].includes(x.status));
 const preparing=rows.some(x=>['PREPARING','READY'].includes(x.status));
 const problems=rows.filter(x=>['SAFETY_BLOCKED','SUSPENDED'].includes(x.status)).length;
 const draft=map?.status==='DRAFT'||!map?.submittedAt;
 let stage=draft?-1:0;
 if(!draft){
  if(map?.receivedAt)stage=1;
  if(preparing||moving||delivered>0)stage=Math.max(stage,2);
  if(moving||delivered>0)stage=Math.max(stage,3);
  if(count>0&&delivered===count)stage=4;
 }
 const partial=delivered>0&&delivered<count;
 let headline,description;
 if(draft){headline='Mapa em preparação';description='Confira os pedidos e toque em Enviar mapa. A cozinha ainda não recebeu este mapa.';}
 else if(stage===0){headline='Mapa enviado. Aguardando confirmação da cozinha';description='O envio foi registrado. A cozinha ainda não confirmou o recebimento.';}
 else if(stage===1){headline='A cozinha recebeu o mapa';description='O recebimento foi confirmado. O preparo será registrado quando começar.';}
 else if(stage===2){headline='As dietas estão em produção';description='A equipe registrou o preparo. A distribuição ainda não foi confirmada.';}
 else if(stage===3){headline=partial?'Entrega parcialmente concluída':'As dietas saíram para distribuição';description=partial?`${delivered} de ${count} refeições com entrega confirmada.`:'As refeições estão em rota ou recebidas na unidade. A entrega em cada leito exige confirmação.';}
 else{headline='Dietas entregues nos leitos';description='Todas as refeições válidas deste mapa têm entrega confirmada no sistema.';}
 if(problems>0)description+=` Atenção: ${problems} refeição(ões) suspensa(s) ou bloqueada(s), conferir antes de liberar.`;
 return {stage,headline,description,count,delivered,problems,partial,
  received:!!map?.receivedAt,submitted:!draft,completed:stage===4};
}
