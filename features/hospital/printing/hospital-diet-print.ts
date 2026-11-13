/**
 * EMPROVEX hospital print templates. Client-side PDFs; clinical data never enter URL.
 * Existing jsPDF dependency only. Both reports are A4 LANDSCAPE.
 */
import {jsPDF} from 'jspdf';

export type ProductionPrintRow={unit:string;diet:string;observation:string;quantity:number;mealType?:string};
export type DistributionPrintRow={unit:string;bed:string;patient:string;diet:string;observation:string};
type ReportOptions={title:string;subtitle:string;headers:string[];columnWidths:number[];
  lines:string[][];filename:string;blankColumns?:number[];footer:string};

const text=(value:unknown)=>String(value??'').trim().replace(/[\x00-\x1F]/g,' ').slice(0,450)||'—';

function report(options:ReportOptions){
 const d=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
 if(options.columnWidths.reduce((a,b)=>a+b,0)!==277)throw Error('Largura inválida para A4');
 let page=1,y=41;
 const header=()=>{
  d.setTextColor(12,42,82);d.setFont('helvetica','bold');d.setFontSize(16);
  d.text(options.title,10,16);
  d.setFont('helvetica','normal');d.setFontSize(9);d.setTextColor(71,92,118);
  d.text(options.subtitle,10,23);
  d.setDrawColor(200,213,231);d.line(10,28,287,28);
  d.setFillColor(230,238,249);d.rect(10,32,277,9,'F');
  d.setFontSize(8);d.setFont('helvetica','bold');d.setTextColor(24,61,109);
  let x=10;
  for(let i=0;i<options.headers.length;i++){d.text(text(options.headers[i]),x+2,38);x+=options.columnWidths[i]}
  d.setFont('helvetica','normal');d.setTextColor(90,100,115);d.setFontSize(7.5);
  d.text(options.footer,10,203);d.text('Página '+page,286,203,{align:'right'});
  y=41;
 };
 header();
 for(let n=0;n<options.lines.length;n++){
  const values=options.lines[n];
  const parts=values.map((value,i)=>d.splitTextToSize(text(value),options.columnWidths[i]-5) as string[]);
  const count=Math.max(1,...parts.map((p,i)=>options.blankColumns?.includes(i)?1:p.length));
  const height=Math.max(15,6+4.2*count);
  if(y+height>191){d.addPage();page++;header();}
  if(n%2===0){d.setFillColor(249,251,254);d.rect(10,y,277,height,'F')}
  d.setDrawColor(225,234,246);d.setLineWidth(.1);d.line(10,y+height,287,y+height);
  let x=10;
  options.columnWidths.forEach((w,i)=>{
   if(options.blankColumns?.includes(i)){
    d.setDrawColor(83,96,113);d.setLineWidth(.3);d.line(x+4,y+height-4,x+w-4,y+height-4);
   }else{
    d.setTextColor(37,56,84);d.setFont('helvetica',i===0?'bold':'normal');d.setFontSize(8.8);
    d.text(parts[i],x+2,y+6);
   }
   x+=w;
  });
  y+=height;
 }
 return d;
}
function labels<T>(records:T[],draw:(d:jsPDF,r:T,x:number,y:number,w:number)=>void){
 if(!records.length)throw Error('Sem etiquetas para gerar');
 if(records.length>500)throw Error('Mais de 500 etiquetas: selecione um período menor');
 const d=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
 const w=136,h=54,perPage=6;
 records.forEach((r,i)=>{
  if(i&&i%perPage===0)d.addPage();
  const slot=i%perPage,x=10+(slot%2)*(w+5),y=10+Math.floor(slot/2)*(h+6);
  d.setDrawColor(80,107,148);d.setLineWidth(.25);d.roundedRect(x,y,w,h,2,2,'S');
  draw(d,r,x,y,w);
 });
 return d;
}
function save(d:jsPDF,filename:string){
 if(typeof window==='undefined')throw Error('Impressão permitida somente na sessão local do navegador');
 d.save(filename);
}
export function printProductionReport(rows:ProductionPrintRow[],date:string,cycle:string){
 if(!rows.length)throw Error('Nenhuma dieta disponível para o relatório');
 save(report({
  title:'MAPA DE PRODUÇÃO · COZINHA DIETÉTICA',
  subtitle:'Data: '+date+'  |  Mapa: '+cycle+'h  |  Total: '+rows.reduce((n,r)=>n+r.quantity,0)+' dietas',
  headers:['Dieta','Observações / restrições','Unidade','Quantidade','Conferência da produção'],
  columnWidths:[72,95,32,27,51],lines:rows.map(r=>[r.diet+(r.mealType==='PRIMARY'?' · PRINCIPAL':r.mealType==='SECONDARY'?' · SECUNDÁRIA':''),r.observation,r.unit,String(r.quantity),'']),
  blankColumns:[4],filename:'producao-dietas-'+date+'-'+cycle+'h.pdf',
  footer:'Etiqueta de produção sem nome de paciente ou leito · Conferir as restrições antes de preparar'
 }), 'producao-dietas-'+date+'-'+cycle+'h.pdf');
}
export function printProductionLabels(rows:ProductionPrintRow[],date:string,cycle:string){
 const count=rows.reduce((n,r)=>n+r.quantity,0);
 if(count>500)throw Error('Mais de 500 etiquetas: divida o período');
 const many=rows.flatMap(r=>Array.from({length:Math.max(0,r.quantity)},()=>r));
 save(labels(many,(d,r,x,y,w)=>{
  d.setTextColor(31,80,134);d.setFontSize(8);d.setFont('helvetica','bold');
  d.text('EMPROVEX · ETIQUETA DA DIETA',x+5,y+8);
  d.setTextColor(16,45,82);d.setFontSize(15);
  d.text((d.splitTextToSize(text(r.diet),w-11) as string[]).slice(0,2),x+5,y+19);
  d.setFontSize(10);d.text('UNIDADE: '+text(r.unit),x+5,y+32);
  d.setFont('helvetica','normal');d.setFontSize(8.5);
  d.text('OBS.: '+text(r.observation),x+5,y+41,{maxWidth:w-10});
  d.setFontSize(7);d.text(date+' · '+cycle+'h · '+(r.mealType==='SECONDARY'?'SECUNDÁRIA':'PRINCIPAL')+' · Conferir restrições',x+5,y+50);
 }), 'etiquetas-preparo-'+date+'-'+cycle+'h.pdf');
}
export function printDistributionReport(rows:DistributionPrintRow[],date:string,cycle:string,mealLabel='',mealType=''){
 if(!rows.length)throw Error('Nenhum paciente na fila de distribuição');
 save(report({
  title:'CONTROLE DE DISTRIBUIÇÃO · COZINHA DIETÉTICA',
  subtitle:'Data: '+date+'  |  Mapa: '+cycle+'h  |  '+mealLabel+'  |  Hora real da entrega à caneta',
  headers:['Unidade','Leito','Destinatário','Dieta','Observações','Hora exata','Rubrica'],
  columnWidths:[25,22,67,52,55,30,26],
  lines:rows.map(r=>[r.unit,r.bed,r.patient,r.diet,r.observation,'','']),
  blankColumns:[5,6],filename:'distribuicao-dietas-'+date+'-'+cycle+'h-'+mealType+'.pdf',
  footer:'Conferir identidade do paciente ou acompanhante, conforme a etiqueta, antes da entrega · Uso interno restrito'
 }), 'distribuicao-dietas-'+date+'-'+cycle+'h-'+mealType+'.pdf');
}
export function printPatientLabels(rows:DistributionPrintRow[],date:string,cycle:string,mealLabel='',mealType=''){
 save(labels(rows,(d,r,x,y,w)=>{
  d.setTextColor(31,80,134);d.setFontSize(8);d.setFont('helvetica','bold');
  d.text('EMPROVEX · IDENTIFICAÇÃO DA REFEIÇÃO · '+mealLabel,x+5,y+8,{maxWidth:w-10});
  d.setTextColor(16,45,82);d.setFontSize(13);
  d.text((d.splitTextToSize(text(r.patient),w-11) as string[]).slice(0,2),x+5,y+19);
  d.setFontSize(10);
  d.text('UNIDADE: '+text(r.unit)+'    LEITO: '+text(r.bed),x+5,y+32);
  d.setFont('helvetica','normal');d.setFontSize(9);
  d.text('DIETA: '+text(r.diet),x+5,y+40,{maxWidth:w-10});
  d.setFontSize(8);d.text('OBS.: '+text(r.observation),x+5,y+47,{maxWidth:w-10});
  d.setFontSize(7);d.text('Confirmar destinatário e leito antes de entregar',x+5,y+52);
 }), 'etiquetas-pacientes-'+date+'-'+cycle+'h-'+mealType+'.pdf');
}
