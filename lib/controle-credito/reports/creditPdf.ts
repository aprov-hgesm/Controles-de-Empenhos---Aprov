import { jsPDF } from 'jspdf';
import type { CreditMember } from '../../server/creditControlAuth';

export type CreditReportLine = { label: string; value: string; kind?:'section'|'metric'|'fields'|'note'; fields?:{label:string;value:string}[] };
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
    pdf.setFillColor(11,28,48); pdf.rect(0,0,210,4,'F');
    pdf.setTextColor(11,28,48); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14);
    pdf.text('EMPROVEX | Controle de Crédito', 15, 17);
    pdf.setFontSize(11); pdf.text(clean(title), 15, 24);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
    pdf.text(clean('UG ' + member.ug + (year ? ' | Exercício ' + year : '') + (member.role === 'centro' ? ' | Centro ' + member.centerId : ' | Gestão')), 15, 31);
    pdf.text('Emissão: ' + issued, 15, 36);
    pdf.setDrawColor(42,93,157); pdf.setLineWidth(0.5); pdf.line(15, 40, 195, 40); y = 47;
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
    pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(70);
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

/** A4 institutional report. Keeps selectable text, repeats the identity and
 * active record heading on continuation pages, and never splits a metric row. */
export function creditReportPdf(member:CreditMember,title:string,lines:CreditReportLine[],year:number):Uint8Array{
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  const navy=[16,37,61] as const,blue=[35,79,125] as const,gray=[82,99,118] as const;
  const issued=new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
  const width=182,left=14,right=196,bottom=270;
  let y=0,section='',stripe=0;
  function font(size:number,bold=false){pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);}
  function wrap(value:string,w:number,size:number,bold=false):string[]{font(size,bold);return pdf.splitTextToSize(clean(value),w) as string[];}
  function header(continuation=false){
    pdf.setFillColor(...navy);pdf.rect(0,0,210,5,'F');pdf.setFillColor(198,156,68);pdf.rect(14,5,27,1.5,'F');
    font(10,true);pdf.setTextColor(...blue);pdf.text('EMPROVEX  /  CONTROLE DE CRÉDITO',left,14);
    font(8);pdf.setTextColor(...gray);pdf.text('GESTÃO ORÇAMENTÁRIA',right,14,{align:'right'});
    const heading=wrap(title,width,15,true);pdf.setTextColor(...navy);pdf.text(heading,left,23);y=23+heading.length*6;
    font(9);pdf.setTextColor(...gray);pdf.text(clean('UG '+member.ug+'  |  Exercício '+year+'  |  '+(member.role==='centro'?'Centro '+member.centerId:'Gestão')),left,y+1);
    pdf.text('Emissão: '+issued,left,y+6);y+=11;
    pdf.setDrawColor(201,212,224);pdf.setLineWidth(.35);pdf.line(left,y,right,y);y+=6;
    if(continuation&&section){font(9,true);pdf.setTextColor(...blue);const h=wrap(section+' (continuação)',width,9,true);pdf.text(h,left,y+3);y+=h.length*4+6;}
  }
  function page(){pdf.addPage();header(true);stripe=0;}
  function room(h:number){if(y+h>bottom)page();}
  function sectionRow(row:CreditReportLine){
    const hLines=wrap(row.label,width-8,11,true),vLines=row.value?wrap(row.value,width-8,8.5):[];
    const h=7+hLines.length*4.6+vLines.length*3.8;
    // leave room for the next data row, not a stranded heading.
    if(y+h+15>bottom){section='';page();}
    section=row.label;stripe=0;
    pdf.setFillColor(232,239,247);pdf.roundedRect(left,y,width,h,2,2,'F');pdf.setFillColor(...blue);pdf.rect(left,y,1.2,h,'F');
    font(11,true);pdf.setTextColor(...navy);pdf.text(hLines,left+4,y+5.5);
    if(vLines.length){font(8.5);pdf.setTextColor(...gray);pdf.text(vLines,left+4,y+5.5+hLines.length*4.6);}
    y+=h+3;
  }
  function metrics(fields:{label:string;value:string}[]){
    // A short financial table, with separate column headings and right-aligned monetary values.
    const gap=3,cols=fields.length,w=(width-(cols-1)*gap)/cols;
    const prepared=fields.map(f=>({l:wrap(f.label,w-8,8,true),v:wrap(f.value,w-8,11,true)}));
    const lh=Math.max(...prepared.map(f=>f.l.length)),vh=Math.max(...prepared.map(f=>f.v.length));
    const h=10+lh*3.6+vh*4.6;room(h+2);
    prepared.forEach((f,i)=>{const x=left+i*(w+gap);pdf.setFillColor(247,249,252);pdf.setDrawColor(204,216,230);pdf.roundedRect(x,y,w,h,1.5,1.5,'FD');font(8,true);pdf.setTextColor(...gray);pdf.text(f.l,x+4,y+5);font(11,true);pdf.setTextColor(...navy);pdf.text(f.v,x+w-4,y+7+lh*3.6,{align:'right'});});y+=h+3;
  }
  function detail(row:CreditReportLine){
    const label=wrap(row.label,39,8.5,true),value=wrap(row.value,132,9),step=4.5;
    // Keep both label and content visible; very long rows continue on following pages.
    let offset=0;
    const total=Math.max(label.length,value.length,1);
    while(offset<total){
      if(y+12>bottom)page();
      const count=Math.min(total-offset,Math.max(1,Math.floor((bottom-y-5)/step)));
      const h=count*step+5;
      if(stripe%2===0){pdf.setFillColor(246,248,251);pdf.rect(left,y,width,h,'F');}
      font(8.5,true);pdf.setTextColor(...blue);pdf.text(label.slice(offset,offset+count),left+3,y+4.5);
      font(9);pdf.setTextColor(...navy);pdf.text(value.slice(offset,offset+count),left+45,y+4.5);
      pdf.setDrawColor(226,232,240);pdf.setLineWidth(.15);pdf.line(left,y+h,right,y+h);y+=h;offset+=count;
      if(offset<total)page();
    }
    stripe++;
  }
  header();
  for(let i=0;i<lines.length;i++){
    const row=lines[i];
    if(row.kind==='section'){sectionRow(row);continue;}
    if(row.kind==='metric'){
      const fields=[{label:row.label,value:row.value}];
      while(fields.length<3&&lines[i+1]?.kind==='metric'){const next=lines[++i];fields.push({label:next.label,value:next.value});}
      metrics(fields);continue;
    }
    if(row.kind==='fields'&&row.fields?.length){metrics(row.fields);continue;}
    detail(row);
  }
  if(!lines.length)detail({label:'Resultado',value:'Nenhum registro encontrado.'});
  const pages=pdf.getNumberOfPages();
  for(let n=1;n<=pages;n++){pdf.setPage(n);pdf.setDrawColor(203,213,225);pdf.setLineWidth(.35);pdf.line(left,277,right,277);font(8);pdf.setTextColor(...gray);pdf.text('Valores registrados no EMPROVEX. Não substituem o saldo oficial do SIAFI.',left,282);font(8,true);pdf.text('Página '+n+' / '+pages,right,287,{align:'right'});}
  return new Uint8Array(pdf.output('arraybuffer'));
}
