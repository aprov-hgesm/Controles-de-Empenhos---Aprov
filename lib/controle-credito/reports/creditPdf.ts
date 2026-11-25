import { jsPDF } from 'jspdf';
import type { CreditMember } from '../../server/creditControlAuth';

export type CreditReportLine = { label: string; value: string; kind?:'section'|'metric'|'fields'|'note'|'progress'|'table'; fields?:{label:string;value:string}[]; percent?:number|null; table?:{headers:string[];weights:number[];rows:string[][]} };
export const money = (cents: number) => {
  if (!Number.isSafeInteger(cents)) throw new Error('Valor financeiro inválido.');
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
export const displayDate = (date: string | null | undefined) =>
  date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('/') : 'Não informado';
const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/[^\u0020-\u007e\u00a0-\u00ff]/g, '?').slice(0, 1000);

export function creditPdf(member: CreditMember, title: string, lines: CreditReportLine[], year?: number): Uint8Array {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const issued = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  let y = 0;
  const header = () => {

    pdf.setTextColor(0); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14);
    pdf.text('EMPROVEX | Controle de Crédito', 15, 17);
    pdf.setFontSize(11); pdf.text(clean(title), 15, 24);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
    pdf.text(clean('UG ' + member.ug + (year ? ' | Exercício ' + year : '') + (member.role === 'centro' ? ' | Centro ' + member.centerId : ' | Gestão')), 15, 31);
    pdf.text('Emissão: ' + issued, 15, 36);
    pdf.setDrawColor(0); pdf.setLineWidth(0.16); pdf.line(15, 40, 195, 40); y = 47;
  };
  header();
  for (const row of lines) {
    pdf.setFontSize(10);
    const wrapped = pdf.splitTextToSize(clean(row.label + ': ' + row.value), 180) as string[];
    for (const line of wrapped) {
      if (y > 270) { pdf.addPage(); header(); pdf.setFontSize(10); }
      pdf.text(line, 15, y); y += 5;
    }
    y += 2;
  }
  const count = pdf.getNumberOfPages();
  for (let i = 1; i <= count; i++) {
    pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(0);
    pdf.line(15, 278, 195, 278);
    pdf.text('Saldo registrado no sistema; não equivale ao saldo oficial do SIAFI.', 15, 283);
    pdf.text(i + '/' + count, 195, 283, { align: 'right' });
  }
  return new Uint8Array(pdf.output('arraybuffer'));
}

export function creditPdfResponse(bytes: Uint8Array, filename: string): Response {
  return new Response(new Uint8Array(bytes), { headers: {
    'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="' + filename + '"',
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  } });
}

/** Monochrome A4; only narrow progress bars contain ink-filled geometry. */
export function creditReportPdf(member:CreditMember,title:string,lines:CreditReportLine[],year:number):Uint8Array{
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  const issued=new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
  const left=12,right=198,width=186,bottom=269,step=4.1;
  let y=0,section='';
  function font(size:number,bold=false){pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor(0);}
  function wrap(value:string,w:number,size:number,bold=false):string[]{font(size,bold);return pdf.splitTextToSize(clean(value),w) as string[];}
  function rule(at:number,heavy=false){pdf.setDrawColor(0);pdf.setLineWidth(heavy?.18:.11);pdf.line(left,at,right,at);}
  function header(continuation=false){
    font(9,true);pdf.text('EMPROVEX | CONTROLE DE CRÉDITO',left,13);
    font(8);pdf.text('GESTÃO ORÇAMENTÁRIA',right,13,{align:'right'});
    const heading=wrap(title,width,15,true);pdf.text(heading,left,21);y=21+heading.length*5;
    font(9);pdf.text(clean('UG '+member.ug+' | Exercício '+year+' | '+(member.role==='centro'?'Centro '+member.centerId:'Gestão')),left,y+1);
    pdf.text('Emissão: '+issued,left,y+5);y+=8;rule(y,true);y+=4;
    if(continuation&&section){const h=wrap(section+' (continuação)',width,10,true);pdf.text(h,left,y+3);y+=h.length*4+3;}
  }
  function page(){pdf.addPage();header(true);}
  function room(h:number){if(y+h>bottom)page();}
  function sectionRow(row:CreditReportLine){
    const labels=wrap(row.label,width,12,true),values=row.value?wrap(row.value,width,9):[];
    const h=6+labels.length*4.7+values.length*4;
    if(y+h+15>bottom){section='';page();}
    section=row.label;rule(y,true);font(12,true);pdf.text(labels,left,y+4.6);
    if(values.length){font(9);pdf.text(values,left,y+4.6+labels.length*4.7);}
    y+=h;
  }
  function metrics(fields:{label:string;value:string}[]){
    const gap=3,w=(width-(fields.length-1)*gap)/fields.length;
    const data=fields.map(f=>({l:wrap(f.label,w-4,9,true),v:wrap(f.value,w-4,12,true)}));
    const lh=Math.max(...data.map(f=>f.l.length)),vh=Math.max(...data.map(f=>f.v.length));
    const h=5+lh*3.9+vh*5;room(h+2);
    data.forEach((f,i)=>{const x=left+i*(w+gap);pdf.setDrawColor(0);pdf.setLineWidth(.11);pdf.rect(x,y,w,h,'S');font(9,true);pdf.text(f.l,x+2,y+4);font(12,true);pdf.text(f.v,x+2,y+4+lh*3.9+1);});y+=h+2;
  }
  function detail(row:CreditReportLine){
    const label=wrap(row.label,40,9,true),value=wrap(row.value,141,10);
    let offset=0;const total=Math.max(label.length,value.length,1);
    while(offset<total){
      room(9);const count=Math.min(total-offset,Math.max(1,Math.floor((bottom-y-3)/step))),h=count*step+2;
      font(9,true);if(offset<label.length)pdf.text(label.slice(offset,offset+count),left,y+3.3,{lineHeightFactor:1.16});
      font(10);if(offset<value.length)pdf.text(value.slice(offset,offset+count),left+44,y+3.3,{lineHeightFactor:1.16});
      y+=h;offset+=count;if(offset<total)page();
    }
  }
  function progress(row:CreditReportLine){
    const label=wrap(row.value,width,9,true),h=label.length*4+5;room(h+1);
    font(9,true);pdf.text(label,left,y+3.2);
    if(row.percent!==null&&row.percent!==undefined&&Number.isFinite(row.percent)){
      const w=70,fill=w*Math.min(100,Math.max(0,row.percent))/100;
      pdf.setDrawColor(0);pdf.setLineWidth(.12);pdf.rect(left,y+label.length*4,w,2.2,'S');
      if(fill>0){pdf.setFillColor(0);pdf.rect(left,y+label.length*4,fill,2.2,'F');}
    }
    y+=h;
  }
  function table(row:CreditReportLine){
    const t=row.table!;const total=t.weights.reduce((a,b)=>a+b,0),ws=t.weights.map(w=>width*w/total);
    function prepare(values:string[],heading=false){return values.map((v,i)=>wrap(v,ws[i]-3,heading?8.5:9,heading||i===0));}
    function height(values:string[][]){return Math.max(...values.map(v=>v.length),1)*3.9+2;}
    function draw(values:string[][],heading=false){let x=left;const h=height(values);values.forEach((v,i)=>{font(heading?8.5:9,heading||i===0);pdf.text(v,i===0?x+1:x+ws[i]-1,y+3.2,{align:i===0?'left':'right',lineHeightFactor:1.15});x+=ws[i];});y+=h;rule(y,heading);}
    const headers=prepare(t.headers,true);const titleLines=wrap(row.label,width,10,true);
    const headingHeight=titleLines.length*4+height(headers)+3;
    function head(){font(10,true);pdf.text(titleLines,left,y+3.3);y+=titleLines.length*4+1;draw(headers,true);}
    const rows=t.rows.map(v=>prepare(v));
    room(headingHeight+(rows.length?height(rows[0]):0));head();
    for(const cells of rows){const h=height(cells);if(y+h>bottom){page();head();}draw(cells);}
    y+=3;
  }
  // Keep short NC summaries intact; long reports continue with the record heading.
  function estimate(row:CreditReportLine):number{
    if(row.kind==='section')return 6+wrap(row.label,width,12,true).length*4.7+(row.value?wrap(row.value,width,9).length*4:0);
    if(row.kind==='fields'&&row.fields?.length){const w=(width-(row.fields.length-1)*3)/row.fields.length;return 7+Math.max(...row.fields.map(f=>wrap(f.label,w-4,9,true).length))*3.9+Math.max(...row.fields.map(f=>wrap(f.value,w-4,12,true).length))*5;}
    if(row.kind==='progress')return wrap(row.value,width,9,true).length*4+5;
    if(row.kind==='table'&&row.table){const t=row.table,total=t.weights.reduce((a,b)=>a+b,0);return 8+wrap(row.label,width,10,true).length*4+[t.headers,...t.rows].reduce((sum,r,i)=>sum+Math.max(...r.map((v,k)=>wrap(v,width*t.weights[k]/total-3,i?9:8.5,!i||k===0).length))*3.9+2,0);}
    return Math.max(wrap(row.label,40,9,true).length,wrap(row.value,141,10).length)*step+2;
  }
  header();
  for(let i=0;i<lines.length;i++){
    const row=lines[i];
    if(row.kind==='section'){
      if(row.label.startsWith('NC ')){let end=i+1;while(end<lines.length&&lines[end].kind!=='section')end++;const h=lines.slice(i,end).reduce((a,b)=>a+estimate(b),0);if(h<bottom-43&&y+h>bottom){section='';page();}}
      sectionRow(row);continue;
    }
    if(row.kind==='metric'){const fields=[{label:row.label,value:row.value}];while(fields.length<3&&lines[i+1]?.kind==='metric'){const n=lines[++i];fields.push({label:n.label,value:n.value});}metrics(fields);continue;}
    if(row.kind==='fields'&&row.fields?.length){metrics(row.fields);continue;}
    if(row.kind==='progress'){progress(row);continue;}
    if(row.kind==='table'&&row.table){table(row);continue;}
    detail(row);
  }
  if(!lines.length)detail({label:'Resultado',value:'Nenhum registro encontrado.'});
  const pages=pdf.getNumberOfPages();
  for(let n=1;n<=pages;n++){pdf.setPage(n);rule(273);font(8);pdf.text('Valores registrados no EMPROVEX. Não substituem o saldo oficial do SIAFI.',left,277);pdf.text('Prazo vencido não comprova recolhimento. Confirme a disponibilidade no SIAFI.',left,281);font(8,true);pdf.text('Página '+n+' / '+pages,right,285,{align:'right'});}
  return new Uint8Array(pdf.output('arraybuffer'));
}
