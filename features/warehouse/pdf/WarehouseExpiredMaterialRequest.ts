'use client';

/**
 * Pedido administrativo de material vencido — não executa retirada,
 * não altera saldos e NÃO substitui lançamento/baixa no SISCOFIS.
 */
export interface WarehouseExpiredRequestLine {
  description:string;
  quantity:number;
  unitLabel:string;
  expiry:string;
  position:string;
  lotId:string;
}
export interface WarehouseExpiredRequestInput {
  ug:string;
  workspaceId:string;
  requestId:string;
  operatorName:string;
  destinationName:string;
  lines:WarehouseExpiredRequestLine[];
}
export async function downloadWarehouseExpiredRequest(input:WarehouseExpiredRequestInput):Promise<void>{
  if(!input.lines.length||input.lines.length>120
    ||input.lines.some(row=>!(row.quantity>0)||!/^\d{4}-\d{2}-\d{2}$/.test(row.expiry)))
    throw new Error('WAREHOUSE_EXPIRED_REQUEST_INVALID');
  const now=new Date();
  const today=now.toISOString().slice(0,10);
  if(input.lines.some(row=>row.expiry>=today))
    throw new Error('WAREHOUSE_EXPIRED_REQUEST_NOT_EXPIRED');
  const {jsPDF}=await import('jspdf');
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  let y=20,page=1;
  const newPage=()=>{
    doc.addPage();page++;y=20;
    doc.setFontSize(10);doc.text('EMPROVEX · Pedido de material vencido (continuação)',14,y);y+=13;
  };
  doc.setFont('helvetica','bold');doc.setFontSize(16);
  doc.text('PEDIDO DE MATERIAL VENCIDO',14,y);y+=9;
  doc.setFont('helvetica','normal');doc.setFontSize(10);
  doc.text('Solicitação administrativa de recolhimento / destinação — sem saída física automática',14,y);y+=8;
  doc.text('UG: '+input.ug+' · Identificador: '+input.requestId,14,y);y+=6;
  doc.text('Emitido em: '+now.toLocaleString('pt-BR'),14,y);y+=6;
  doc.text('Operador: '+(input.operatorName||'Não informado'),14,y);y+=6;
  doc.text('Destino proposto: '+(input.destinationName||'A definir'),14,y);y+=12;
  doc.setTextColor(160,37,37);doc.setFont('helvetica','bold');
  const warning='MATERIAL VENCIDO: NÃO LIBERADO PARA CONSUMO, PREPARO OU DISTRIBUIÇÃO.';
  doc.text(warning,14,y);y+=6;
  doc.setFont('helvetica','normal');doc.setFontSize(9);
  doc.text('Esta ficha não é autorização de uso, descarte ou movimentação de estoque.',14,y);
  doc.setTextColor(0,0,0);y+=12;
  for(let i=0;i<input.lines.length;i++){
    const row=input.lines[i];
    if(y>257)newPage();
    doc.setFontSize(10);doc.setFont('helvetica','bold');
    const name=doc.splitTextToSize((i+1)+'. '+row.description,180);
    doc.text(name,14,y);y+=name.length*5;
    doc.setFont('helvetica','normal');doc.setFontSize(9);
    doc.text('Qtd.: '+row.quantity.toLocaleString('pt-BR')+' '+row.unitLabel
      +' | Validade: '+row.expiry.split('-').reverse().join('/'),14,y);y+=5;
    const loc=doc.splitTextToSize('Origem: '+row.position,175);
    doc.text(loc,14,y);y+=loc.length*4+6;
  }
  if(y>245)newPage();
  y+=8;
  doc.setFontSize(9);doc.text('Responsável pela análise / destinação: ______________________________',14,y);
  y+=8;doc.text('Observações: _____________________________________________________',14,y);
  for(let p=1;p<=doc.getNumberOfPages();p++){
    doc.setPage(p);doc.setFontSize(8);
    doc.text('Documento auxiliar · sem baixa de estoque · Página '+p+'/'+doc.getNumberOfPages(),14,287);
  }
  doc.save('EMPROVEX_Pedido_Material_Vencido_'+today+'_'+input.requestId.slice(-8)+'.pdf');
}
