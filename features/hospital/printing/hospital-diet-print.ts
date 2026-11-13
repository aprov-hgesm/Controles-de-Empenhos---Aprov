/**
 * Hospital print engine: A4 landscape reports and printable paired labels.
 * Private, client-generated PDFs only; no network, URL identifiers or patient data in production PDFs.
 * Printing a PDF never changes a meal or delivery state.
 */
import {jsPDF} from 'jspdf';
import type {PrintPhase} from './meal-print-selection';

export type ProductionPrintRow={unit:string;diet:string;observation:string;quantity:number;mealType?:string;
 consistency?:string;recipientType?:'PATIENT'|'COMPANION';phase?:PrintPhase};
export type DistributionPrintRow={
 unit:string;bed:string;patient:string;diet:string;observation:string;
 recipientType?:'PATIENT'|'COMPANION';allergyAlert?:boolean;allergyNote?:string;corrected?:boolean;
 phase?:PrintPhase;identityIncomplete?:boolean;
};
type ReportOptions={
 title:string;subtitle:string;headers:string[];columnWidths:number[];
 lines:string[][];blankColumns?:number[];footer:string;
 alertRows?:boolean[];
};
const navy=[10,31,64] as const;
const blue=[25,84,169] as const;
const ink=[28,52,83] as const;
const muted=[93,111,134] as const;
const border=[218,229,242] as const;
const safe=(value:unknown,max=800)=>String(value??'').trim().replace(/[\x00-\x1F\x7F]/g,' ').slice(0,max)||'—';
const lines=(d:jsPDF,v:unknown,width:number)=>d.splitTextToSize(safe(v),Math.max(6,width-5)) as string[];
const compact=(d:jsPDF,value:unknown,width:number,maxLines=2)=>{
 const wrapped=lines(d,value,width);
 if(wrapped.length<=maxLines)return wrapped;
 const clipped=wrapped.slice(0,maxLines);
 const last=clipped.length-1;
 clipped[last]=clipped[last].replace(/[.\s]+$/,'')+'…';
 return clipped;
};

function report(options:ReportOptions){
 const d=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
 if(options.columnWidths.reduce((a,b)=>a+b,0)!==277||options.columnWidths.length!==options.headers.length)
  throw Error('Configuração de colunas inválida para A4 horizontal.');
 let y=48;
 const head=()=>{
  d.setFillColor(...navy);d.rect(0,0,297,34,'F');
  d.setFillColor(74,177,243);d.rect(0,33,297,1,'F');
  d.setTextColor(152,203,247);d.setFont('helvetica','bold');d.setFontSize(8);
  d.text('EMPROVEX   /   COZINHA DIETÉTICA',10,10);
  d.setFont('helvetica','bold');d.setFontSize(15);d.setTextColor(255,255,255);
  d.text(safe(options.title,95),10,20);
  d.setFont('helvetica','normal');d.setFontSize(8.2);d.setTextColor(218,233,253);
  d.text(safe(options.subtitle,130),10,28);
  d.setFillColor(233,240,250);d.rect(10,37,277,10,'F');
  d.setTextColor(...ink);d.setFont('helvetica','bold');d.setFontSize(8);
  let x=10;
  options.headers.forEach((h,i)=>{d.text(compact(d,h,options.columnWidths[i],2),x+2,42);x+=options.columnWidths[i]});
  y=49;
 };
 const newPage=()=>{d.addPage();head()};
 head();
 options.lines.forEach((values,rowIndex)=>{
  d.setFont('helvetica','normal');d.setFontSize(8.1);
  const parts=values.map((value,i)=>options.blankColumns?.includes(i)?['']:lines(d,value,options.columnWidths[i]));
  const total=Math.max(1,...parts.map(x=>x.length));
  let offset=0;
  while(offset<total){
   let fit=Math.floor((193-y-6)/4.25);
   if(fit<2){newPage();fit=Math.floor((193-y-6)/4.25);}
   const count=Math.min(total-offset,fit);
   const height=Math.max(13,6+count*4.25);
   if(rowIndex%2===0){d.setFillColor(248,251,254);d.rect(10,y,277,height,'F');}
   if(options.alertRows?.[rowIndex]){d.setFillColor(177,48,48);d.rect(10,y,1.3,height,'F');}
   d.setDrawColor(...border);d.setLineWidth(.22);d.line(10,y+height,287,y+height);
   let x=10;
   values.forEach((_,i)=>{
    const w=options.columnWidths[i];
    if(options.blankColumns?.includes(i)){
     d.setDrawColor(104,126,152);d.line(x+4,y+height-4,x+w-4,y+height-4);
    }else{
     d.setTextColor(...ink);d.setFont('helvetica',i===0?'bold':'normal');d.setFontSize(8.1);
     const segment=parts[i].slice(offset,offset+count);
     if(segment.length)d.text(segment,x+2,y+5.6);
    }
    x+=w;
   });
   y+=height;offset+=count;
  }
 });
 const pages=d.getNumberOfPages();
 for(let i=1;i<=pages;i++){
  d.setPage(i);
  d.setDrawColor(...border);d.line(10,198,287,198);
  d.setTextColor(...muted);d.setFont('helvetica','normal');d.setFontSize(7.5);
  d.text(safe(options.footer,140),10,203,{maxWidth:235});
  d.text('Página '+i+' de '+pages,286,203,{align:'right'});
 }
 return d;
}
function labels<T>(records:T[],draw:(d:jsPDF,r:T,x:number,y:number,w:number)=>void){
 if(!records.length)throw Error('Nenhuma etiqueta disponível para este filtro.');
 if(records.length>5000)throw Error('Solicitação excepcional de mais de 5 mil etiquetas: divida por unidade e refeição.');
 const d=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
 // Two columns, three labels per column. Millimetre dimensions stay inside A4.
 const w=136,h=60,perPage=6;
 records.forEach((r,i)=>{
  if(i&&i%perPage===0)d.addPage();
  const slot=i%perPage,x=10+(slot%2)*141,y=7+Math.floor(slot/2)*64;
  d.setDrawColor(179,198,222);d.setLineWidth(.3);d.roundedRect(x,y,w,h,2,2,'S');
  draw(d,r,x,y,w);
 });
 return d;
}
function save(d:jsPDF,filename:string){
 if(typeof window==='undefined')throw Error('Emissão de PDF exige sessão local no navegador.');
 d.save(filename);
}
const phaseNote=(phase?:PrintPhase)=>{
 switch(phase){
  case 'PLANEJAMENTO':return 'PLANEJAMENTO - NÃO LIBERADA';
  case 'PREPARO':return 'EM PREPARO - NÃO LIBERADA';
  case 'PRONTA':return 'PRONTA - CONFERIR ANTES DA ENTREGA';
  case 'EM_ROTA':return 'EM ROTA - CONFERIR DESTINATÁRIO';
  case 'ENTREGUE':return 'ENTREGA REGISTRADA';
  default:return 'CONFERIR ESTADO ANTES DE UTILIZAR';
 }
};
const pill=(d:jsPDF,title:string,x:number,y:number,alert=false)=>{
 if(alert)d.setFillColor(254,226,226);else d.setFillColor(232,242,255);
 d.roundedRect(x,y,40,7,2,2,'F');
 if(alert)d.setTextColor(139,31,31);else d.setTextColor(...blue);
 d.setFont('helvetica','bold');d.setFontSize(6.7);
 d.text(safe(title,27),x+2,y+4.8);
};

export function printProductionReport(rows:ProductionPrintRow[],date:string,cycle:string){
 if(!rows.length)throw Error('Nenhuma dieta disponível para o relatório.');
 const count=rows.reduce((n,r)=>n+r.quantity,0);
 save(report({
  title:'MAPA DE PRODUÇÃO',
  subtitle:'Data: '+date+'   •   Ciclo: '+cycle+'h   •   '+count+' porções   •   Impressão A4 horizontal',
  headers:['DIETA / REFEIÇÃO','CONSISTÊNCIA, RESTRIÇÕES E OBSERVAÇÕES','UNIDADE','QTDE.','CONFERÊNCIA'],
  columnWidths:[73,94,33,24,53],
  lines:rows.map(r=>[
   r.diet+(r.mealType==='PRIMARY'?' · PRINCIPAL':r.mealType==='SECONDARY'?' · SECUNDÁRIA':'')+
     (r.recipientType==='COMPANION'?' · ACOMPANHANTE':' · PACIENTE'),
   [r.consistency&&r.consistency!=='NÃO INFORMADA'?'Consistência: '+r.consistency.replaceAll('_',' '):'',r.observation,phaseNote(r.phase)].filter(Boolean).join(' · '),
   r.unit,String(r.quantity),''
  ]),
  blankColumns:[4],
  alertRows:rows.map(r=>/ALERGIA:/i.test(r.observation)),
  footer:'Mapa para organização e conferência · Imprimir não significa preparo ou entrega · Sem nomes/leitos'
 }), 'producao-dietas-'+date+'-'+cycle+'h.pdf');
}
export function printProductionLabels(rows:ProductionPrintRow[],date:string,cycle:string){
 const count=rows.reduce((n,r)=>n+r.quantity,0);
 if(count>5000)throw Error('Solicitação excepcional de mais de 5 mil etiquetas: divida por unidade e refeição.');
 const many=rows.flatMap(r=>Array.from({length:Math.max(0,r.quantity)},()=>r));
 save(labels(many,(d,r,x,y,w)=>{
  const allergy=/ALERGIA:/i.test(r.observation);
  if(allergy)d.setFillColor(151,38,38);else d.setFillColor(...navy);d.rect(x+2.5,y+3,2,54,'F');
  d.setTextColor(...muted);d.setFont('helvetica','bold');d.setFontSize(7.5);
  d.text('EMPROVEX  /  PREPARO E PORCIONAMENTO',x+8,y+8);
  pill(d,r.recipientType==='COMPANION'?'ACOMPANHANTE':'PACIENTE',x+w-45,y+3);
  d.setTextColor(...ink);d.setFont('helvetica','bold');d.setFontSize(12.5);
  d.text(compact(d,r.diet,w-17,2),x+8,y+17);
  d.setFont('helvetica','bold');d.setFontSize(8.6);
  d.text('UNIDADE: '+safe(r.unit,25)+'  ·  '+(r.mealType==='SECONDARY'?'SECUNDÁRIA':'PRINCIPAL'),x+8,y+30,{maxWidth:w-16});
  d.setFont('helvetica','normal');d.setFontSize(7.6);
  d.text(compact(d,'OBS.: '+safe(r.observation,450),w-17,2),x+8,y+38);
  if(allergy){d.setTextColor(151,38,38);d.setFont('helvetica','bold');d.setFontSize(7.1);
    d.text('ALERGIA REGISTRADA - CONFERIR COMPOSIÇÃO',x+8,y+48,{maxWidth:w-16});}
  d.setFont('helvetica','bold');d.setFontSize(7.5);
  d.setTextColor(...(r.phase==='PLANEJAMENTO'||r.phase==='PREPARO'?[153,78,22] as const:ink));
  d.text(phaseNote(r.phase),x+8,y+54,{maxWidth:w-16});
 }), 'etiquetas-preparo-'+date+'-'+cycle+'h.pdf');
}
export function printDistributionReport(rows:DistributionPrintRow[],date:string,cycle:string,mealLabel='',mealType=''){
 if(!rows.length)throw Error('Nenhuma refeição identificada para distribuição.');
 save(report({
  title:'CONTROLE DE DISTRIBUIÇÃO',
  subtitle:'Data: '+date+'   •   Ciclo: '+cycle+'h   •   '+mealLabel+'   •   Horário real registrado à caneta',
  headers:['UNIDADE','LEITO','DESTINATÁRIO','DIETA','OBSERVAÇÕES / ALERGIAS','HORA','RUBRICA'],
  columnWidths:[23,22,66,50,60,28,28],
  lines:rows.map(r=>[r.unit,r.bed,r.patient,r.diet,
   [r.recipientType==='COMPANION'?'ACOMPANHANTE':null,
    r.allergyAlert?'ALERGIA: '+(r.allergyNote||'CONFERIR PRONTUÁRIO'):null,
    r.corrected?'DIETA CORRIGIDA':null,r.identityIncomplete?'IDENTIFICAÇÃO PENDENTE - CONFERIR':null,
    phaseNote(r.phase),r.observation].filter(Boolean).join(' · '),
   '','']),
  blankColumns:[5,6],alertRows:rows.map(r=>!!r.allergyAlert),
  footer:'Planejamento/organização: pedidos não liberados não podem ser distribuídos · Conferir identidade e alergias'
 }), 'distribuicao-dietas-'+date+'-'+cycle+'h-'+mealType+'.pdf');
}
export function printPatientLabels(rows:DistributionPrintRow[],date:string,cycle:string,mealLabel='',mealType=''){
 save(labels(rows,(d,r,x,y,w)=>{
  const allergy=!!r.allergyAlert;
  if(allergy)d.setFillColor(147,35,35);else d.setFillColor(...navy);d.rect(x+2.5,y+3,2,54,'F');
  d.setFont('helvetica','bold');d.setFontSize(7.2);d.setTextColor(...muted);
  d.text('EMPROVEX  /  IDENTIFICAÇÃO DE REFEIÇÃO',x+8,y+8);
  pill(d,r.recipientType==='COMPANION'?'ACOMPANHANTE':'PACIENTE',x+w-45,y+3,allergy);
  d.setTextColor(...ink);d.setFont('helvetica','bold');d.setFontSize(12);
  d.text(compact(d,r.patient,w-17,2),x+8,y+17);
  d.setFontSize(9);d.text('UNIDADE: '+safe(r.unit,25)+'   LEITO: '+safe(r.bed,25),x+8,y+29,{maxWidth:w-16});
  d.setFont('helvetica','bold');d.setFontSize(8.5);
  d.text(compact(d,r.diet,w-17,1),x+8,y+36);
  d.setFont('helvetica','normal');d.setFontSize(7.2);d.setTextColor(...muted);
  d.text(compact(d,safe(r.observation,400),w-17,1),x+8,y+42);
  if(allergy){
   d.setTextColor(148,35,35);d.setFont('helvetica','bold');d.setFontSize(7.1);
   const alert=safe(r.allergyNote,180);
   d.text('ALERGIA: '+alert,x+8,y+49,{maxWidth:w-17});
  }else if(r.identityIncomplete||r.corrected){
   d.setTextColor(...(r.identityIncomplete?[160,75,17] as const:blue));
   d.setFont('helvetica','bold');d.setFontSize(7);
   d.text(r.identityIncomplete?'IDENTIFICAÇÃO PENDENTE - CONFERIR':'DIETA CORRIGIDA - CONFERIR VERSÃO',x+8,y+49,{maxWidth:w-17});
  }
  d.setTextColor(...(r.phase==='PLANEJAMENTO'||r.phase==='PREPARO'?[153,78,22] as const:ink));
  d.setFont('helvetica','bold');d.setFontSize(7.3);
  d.text(phaseNote(r.phase),x+8,y+55,{maxWidth:w-16});
 }), 'etiquetas-pacientes-'+date+'-'+cycle+'h-'+mealType+'.pdf');
}
