/**
 * Comprovante de envio institucional em PDF A4 retrato.
 * Apenas metadados do mapa: nenhum nome, leito, diagnóstico ou prescrição.
 * Nunca imprime a página do sistema ou inclui dados em URL.
 */
import {jsPDF} from 'jspdf';

export type MapReceiptDocument={
 mapId:string;unitId:string;unitLabel?:string;localDate:string;cycleId:'06'|'10'|'16';
 submittedAt:string;submittedByUid:string;receivedAt?:string|null;receivedByUid?:string|null;
 submissionVersion:number;currentVersion:number;status:'SUBMITTED'|'CLOSED';
 late?:boolean;hasLateAmendment?:boolean;
 primaryCount:number;secondaryCount:number;companionCount:number;
};
const NAVY=[11,31,64] as const;
const BLUE=[30,85,174] as const;
const INK=[24,49,83] as const;
const MUTED=[97,119,146] as const;
const LINE=[218,229,241] as const;
const PALE=[246,249,254] as const;
const localStamp=(iso:string)=>{
 if(!iso||Number.isNaN(Date.parse(iso)))return 'Não registrado';
 return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',
  hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso)).replace(',', ' às')+' (Brasília)';
};
const localDay=(day:string)=>{
 const [year,month,date]=day.split('-');
 return year&&month&&date?date+'/'+month+'/'+year:day;
};
const clean=(input:unknown,max=250)=>String(input??'').replace(/[\x00-\x1F\x7F]/g,' ').trim().slice(0,max);
const fileName=(r:MapReceiptDocument)=>'comprovante-envio-'+r.localDate+'-'+r.cycleId+'h-'+clean(r.unitId,45).replace(/[^a-zA-Z0-9_-]/g,'-')+'.pdf';

export function createMapReceiptPdf(r:MapReceiptDocument){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(r.localDate)||!['06','10','16'].includes(r.cycleId)||
  !r.mapId||!r.unitId||!r.submittedAt||Number.isNaN(Date.parse(r.submittedAt)))
  throw Error('Comprovante incompleto: o mapa deve estar enviado antes da impressão.');
 for(const n of [r.primaryCount,r.secondaryCount,r.companionCount,r.submissionVersion,r.currentVersion])
  if(!Number.isInteger(n)||n<0)throw Error('Totais ou versões inválidos para o comprovante.');
 const pdf=new jsPDF({format:'a4',orientation:'portrait',unit:'mm'});
 pdf.setProperties({title:'EMPROVEX | Comprovante de envio do mapa '+r.cycleId+'h',subject:'Registro de envio institucional sem dados clínicos',author:'EMPROVEX Cozinha Dietética'});
 const line=(x:number,y:number,w:number)=>{pdf.setDrawColor(...LINE);pdf.setLineWidth(.25);pdf.line(x,y,x+w,y)};
 const heading=(value:string,x:number,y:number)=>{pdf.setFont('helvetica','bold');pdf.setFontSize(10);pdf.setTextColor(...INK);pdf.text(value,x,y)};
 const kicker=(value:string,x:number,y:number)=>{pdf.setFont('helvetica','bold');pdf.setFontSize(7.2);pdf.setTextColor(...MUTED);pdf.text(value.toUpperCase(),x,y)};
 const plain=(value:string,x:number,y:number,font=10)=>{pdf.setFont('helvetica','normal');pdf.setFontSize(font);pdf.setTextColor(...INK);pdf.text(clean(value),x,y)};
 const block=(label:string,value:string,x:number,y:number,w:number)=>{
  kicker(label,x,y);pdf.setFont('helvetica','bold');pdf.setFontSize(10.8);pdf.setTextColor(...INK);
  const lines=pdf.splitTextToSize(clean(value),w);
  pdf.text(lines.slice(0,2),x,y+8);
 };
 // Institutional masthead
 pdf.setFillColor(...NAVY);pdf.rect(0,0,210,47,'F');
 pdf.setFillColor(64,174,240);pdf.rect(0,45,210,2,'F');
 pdf.setTextColor(144,202,248);pdf.setFont('helvetica','bold');pdf.setFontSize(9);
 pdf.text('EMPROVEX  /  GESTÃO HOSPITALAR',16,15);
 pdf.setFont('helvetica','bold');pdf.setTextColor(255,255,255);pdf.setFontSize(19);
 pdf.text('Comprovante de envio',16,30);
 pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.setTextColor(206,223,245);
 pdf.text('COZINHA DIETÉTICA  ·  CONTROLE DE MAPAS',16,38);
 // Submission / receipt status
 const received=Boolean(r.receivedAt&&Number.isFinite(Date.parse(r.receivedAt)));
 pdf.setFillColor(...PALE);pdf.roundedRect(16,57,178,28,3,3,'F');
 pdf.setFillColor(...(received?[34,128,91] as const:BLUE));pdf.roundedRect(22,63,2,16,1,1,'F');
 kicker('Situação do documento',29,65);
 pdf.setTextColor(...INK);pdf.setFont('helvetica','bold');pdf.setFontSize(12.8);
 pdf.text(received?'Recebimento confirmado pela Cozinha':'Enviado à Cozinha · recebimento pendente',29,74);
 kicker(r.late?'ENVIO FORA DO PRAZO':'REGISTRO ELETRÔNICO',29,80);
 heading('Identificação do mapa',16,97);
 line(16,101,178);
 block('Unidade assistencial',clean(r.unitLabel||r.unitId),16,111,82);
 block('Data do mapa',localDay(r.localDate),112,111,42);
 block('Horário',r.cycleId+'h',167,111,27);
 block('Situação do mapa',r.status==='CLOSED'?'Fechado':'Enviado',16,132,52);
 block('Versão do envio',String(r.submissionVersion),86,132,37);
 block('Versão atual',String(r.currentVersion),145,132,49);
 line(16,147,178);
 heading('Quantitativos atuais',16,159);
 plain('Contagem da versão atual; adendos posteriores permanecem identificáveis.',16,165,8);
 const stats=[
  {name:'REFEIÇÃO PRINCIPAL',value:r.primaryCount},
  {name:'REFEIÇÃO SECUNDÁRIA',value:r.secondaryCount},
  {name:'ACOMPANHANTES',value:r.companionCount},
 ];
 stats.forEach((s,i)=>{
  const x=16+i*61;
  pdf.setFillColor(...PALE);pdf.setDrawColor(...LINE);
  pdf.roundedRect(x,172,56,27,2,2,'FD');
  kicker(s.name,x+4,179);
  pdf.setFont('helvetica','bold');pdf.setFontSize(19);pdf.setTextColor(...INK);
  pdf.text(String(s.value),x+4,193);
 });
 heading('Rastreabilidade do envio',16,213);
 line(16,217,178);
 kicker('Enviado em',16,226);plain(localStamp(r.submittedAt),16,234,9);
 kicker('Recebido pela cozinha',108,226);
 plain(received?localStamp(r.receivedAt!):'Aguardando confirmação',108,234,8.8);
 kicker('Identificador do mapa',16,246);
 pdf.setFont('courier','normal');pdf.setFontSize(7.7);pdf.setTextColor(...INK);
 pdf.text(pdf.splitTextToSize(clean(r.mapId,250),173).slice(0,2),16,252);
 kicker('Responsável pelo envio (registro técnico)',16,263);
 pdf.setFont('courier','normal');pdf.setFontSize(7.4);pdf.setTextColor(...INK);
 pdf.text(pdf.splitTextToSize(clean(r.submittedByUid||'Não identificado'),170).slice(0,1),16,269);
 // Fixed footer with a clear limitation of evidence.
 pdf.setFillColor(...PALE);pdf.rect(0,278,210,19,'F');
 pdf.setDrawColor(...LINE);pdf.line(0,278,210,278);
 pdf.setTextColor(...MUTED);pdf.setFont('helvetica','normal');pdf.setFontSize(7.4);
 pdf.text('Comprova o registro de envio; não comprova preparo, distribuição ou entrega de refeição.',16,285);
 pdf.text('Sem dados de pacientes ou leitos  |  Uso institucional restrito  |  1 / 1',16,291);
 return pdf;
}
export function downloadMapReceipt(r:MapReceiptDocument){
 if(typeof window==='undefined')throw Error('O arquivo só pode ser gerado no navegador autorizado.');
 createMapReceiptPdf(r).save(fileName(r));
}
/** Opens only the isolated PDF; never window.print() on the whole application. */
export function openMapReceiptForPrint(r:MapReceiptDocument):'preview'|'download'{
 if(typeof window==='undefined')throw Error('A impressão requer um navegador autorizado.');
 const pdf=createMapReceiptPdf(r);
 pdf.autoPrint(); // the PDF reader controls the physical printer; no deliveries are modified.
 const blobUrl=URL.createObjectURL(pdf.output('blob'));
 const preview=window.open(blobUrl,'_blank');
 if(!preview){
  URL.revokeObjectURL(blobUrl);
  pdf.save(fileName(r));
  return 'download';
 }
 preview.opener=null;
 window.setTimeout(()=>URL.revokeObjectURL(blobUrl),5*60_000);
 return 'preview';
}
