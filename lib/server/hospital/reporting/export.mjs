const SCHEMAS=Object.freeze({
  maps:['unitId','localDate','cycleId','mapStatus','version','versionKind','items','addedItems','recordedAt','submittedAt','submittedWithinDeadline','actorRef'],
  production:['unitId','localDate','cycleId','dietCode','mealType','planned','sent','preparing','ready','dispatched','received','delivered','cancelled','suspended'],
  timeliness:['unitId','localDate','cycleId','mapDue','principalTolerance','submittedOnTime','submittedLate','notSubmitted','extraordinary','primaryDeliveredWithinTolerance','primaryDeliveredAfterTolerance','primaryNotDelivered','secondaryDelivered','averagePrepMinutes','averageDispatchToDeliveryMinutes'],
  occurrences:['unitId','category','eventType','occurredAt','actorRef','detail','evidenceEventId','administrativeAttribution'],
  nutrition:['unitId','status','createdAt','contactedAt','closedAt','responseMinutes','medicalResponseRecorded','actorRef','inconformityRecorded'],
  waste:['unitId','localDate','cycleId','dietCode','mealType','planned','ready','delivered','cancelledBeforePreparation','cancelledAfterPreparation','readyNotDelivered','measuredQuantity','measurementStatus'],
});
const title={maps:'Mapas diarios',production:'Producao e distribuicao',timeliness:'Pontualidade',occurrences:'Ocorrencias',nutrition:'Auditorias de Nutricao',waste:'Desperdicio potencial'};
function plain(value){
  if(value===null||value===undefined)return '';
  const str=typeof value==='object'?JSON.stringify(value):String(value);
  return str.replace(/[\r\n\t\u0000-\u001f\u007f]/g,' ').slice(0,300);
}
function csvCell(value){
  let s=plain(value);
  // Spreadsheet formula injection, including formulae hidden behind spaces.
  if(/^[\s]*[=+\-@\uFF1D\uFF0B\uFF0D]/u.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
function allowed(report){
  const columns=SCHEMAS[report?.view];
  if(!columns||!report||!Array.isArray(report.rows)||!report.filters)throw new Error('Relatorio invalido');
  if(report.partial)throw new Error('Exportacao parcial desabilitada: restrinja filtros');
  return columns;
}
function exportRows(report){
  const columns=allowed(report);
  return {columns,rows:report.rows.map(row=>Object.fromEntries(columns.map(c=>[c,row?.[c]??null])))};
}
function csv(report){
  const {columns,rows}=exportRows(report);
  const head=['EMPROVEX Cozinha Dietetica - RELATORIO QA','Gerado UTC: '+plain(report.generatedAt),'OM/UG: '+plain(report.filters.organizationId)+' / '+plain(report.filters.ug),
    'Periodo local America/Sao_Paulo: '+plain(report.filters.from)+' ate '+plain(report.filters.to),'Filtros: '+JSON.stringify(report.filters),
    'Apenas dados operacionais minimizados. Nao atribui responsabilidade administrativa automaticamente.',''];
  const lines=head.map(x=>csvCell(x)).concat(columns.map(csvCell).join(','));
  for(const row of rows)lines.push(columns.map(c=>csvCell(row[c])).join(','));
  return '\uFEFF'+lines.join('\r\n')+'\r\n';
}
function pdfText(v,max=100){
  return plain(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E\xA0-\xFF]/g,'?').slice(0,max);
}
export async function exportHospitalReport(report,format){
  const {columns,rows}=exportRows(report);
  const ext=String(format||'').toLowerCase();
  if(!['csv','pdf'].includes(ext))throw new Error('Formato indisponivel');
  const from=report.filters.from,to=report.filters.to;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to))throw new Error('Data invalida');
  const filename='emprovex-dietetica-'+report.view+'-'+from+'-'+to+'.'+ext;
  if(ext==='csv')return {filename,mime:'text/csv; charset=utf-8',bytes:new TextEncoder().encode(csv(report))};
  const {PDFDocument,StandardFonts,rgb}=await import('pdf-lib');
  const doc=await PDFDocument.create();
  doc.setTitle('EMPROVEX | '+(title[report.view]||report.view));
  doc.setSubject('Relatorio institucional, dados operacionais minimizados');
  const font=await doc.embedFont(StandardFonts.Helvetica);
  const bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const ink=rgb(.10,.21,.36),muted=rgb(.40,.48,.58),navy=rgb(.05,.14,.28),
   pale=rgb(.96,.98,1),line=rgb(.84,.89,.94),blue=rgb(.11,.34,.69);
  const PAGE_W=595,PAGE_H=842,PAD=36,LEFT=PAD,RIGHT=PAGE_W-PAD;
  let page,y;
  const cleanLabel=value=>pdfText(value,300);
  const wrap=(value,width,size=8.5,face=font)=>{
    const content=cleanLabel(value),words=content.split(/\s+/).filter(Boolean);
    const out=[],limit=Math.max(10,width);
    let current='';
    for(const word of words){
      const together=current?current+' '+word:word;
      if(face.widthOfTextAtSize(together,size)<=limit){current=together;continue}
      if(current){out.push(current);current=''}
      let token='';
      for(const ch of word){
        if(token&&face.widthOfTextAtSize(token+ch,size)>limit){out.push(token);token=ch}else token+=ch;
      }
      current=token;
    }
    if(current)out.push(current);
    return out.length?out:['—'];
  };
  const start=()=>{
    page=doc.addPage([PAGE_W,PAGE_H]);
    page.drawRectangle({x:0,y:PAGE_H-98,width:PAGE_W,height:98,color:navy});
    page.drawRectangle({x:0,y:PAGE_H-101,width:PAGE_W,height:3,color:blue});
    page.drawText('EMPROVEX  /  COZINHA DIETETICA',{x:PAD,y:PAGE_H-31,font:bold,size:9,color:rgb(.66,.84,.99)});
    page.drawText(cleanLabel(title[report.view]||report.view),{x:PAD,y:PAGE_H-59,font:bold,size:20,color:rgb(1,1,1)});
    page.drawText('Relatorio operacional  |  '+from+' a '+to+'  |  America/Sao_Paulo',
      {x:PAD,y:PAGE_H-80,font,size:9,color:rgb(.85,.92,1)});
    page.drawRectangle({x:PAD,y:PAGE_H-150,width:PAGE_W-2*PAD,height:34,color:pale,borderColor:line,borderWidth:.6});
    page.drawText('UNIDADE / CONTEXTO',{x:PAD+12,y:PAGE_H-127,font:bold,size:7.5,color:muted});
    page.drawText(cleanLabel(report.filters.ug+' / '+report.filters.organizationId),
      {x:PAD+12,y:PAGE_H-141,font:bold,size:9,color:ink});
    page.drawText('TOTAL DE REGISTROS',{x:PAGE_W-170,y:PAGE_H-127,font:bold,size:7.5,color:muted});
    page.drawText(String(rows.length),{x:PAGE_W-170,y:PAGE_H-141,font:bold,size:10,color:ink});
    y=PAGE_H-175;
  };
  const space=(height)=>{
    if(y-height<78)start();
  };
  start();
  if(!rows.length){
    page.drawRectangle({x:LEFT,y:y-52,width:RIGHT-LEFT,height:52,color:pale,borderColor:line,borderWidth:.6});
    page.drawText('Nenhum registro para os filtros selecionados.',{x:LEFT+13,y:y-30,font,size:11,color:ink});
  }
  rows.forEach((row,index)=>{
    space(36);
    page.drawRectangle({x:LEFT,y:y-25,width:RIGHT-LEFT,height:25,color:pale,borderColor:line,borderWidth:.5});
    page.drawRectangle({x:LEFT,y:y-25,width:3,height:25,color:blue});
    page.drawText('REGISTRO '+String(index+1).padStart(3,'0'),
      {x:LEFT+12,y:y-17,font:bold,size:10,color:ink});
    y-=32;
    for(let i=0;i<columns.length;i+=2){
      const fields=columns.slice(i,i+2).map(key=>({
        key,parts:wrap(row?.[key]??'—',235,8.3)
      }));
      const maxHeight=Math.max(...fields.map(f=>f.parts.length))*11+18;
      if(y-maxHeight<78){
        start();
        page.drawText('REGISTRO '+String(index+1)+'  /  CONTINUACAO',
          {x:LEFT,y:y-10,font:bold,size:9,color:blue});
        y-=22;
      }
      const xPositions=[LEFT+11,LEFT+270];
      fields.forEach((f,k)=>{
        const x=xPositions[k];
        page.drawText(cleanLabel(f.key).toUpperCase(),{x,y:y-10,font:bold,size:7,color:muted});
        f.parts.forEach((part,j)=>page.drawText(part,{x,y:y-23-j*11,font,size:8.3,color:ink}));
      });
      const used=Math.max(maxHeight,23);
      y-=used;
      page.drawLine({start:{x:LEFT+9,y:y+4},end:{x:RIGHT-9,y:y+4},thickness:.32,color:line});
    }
    y-=14;
  });
  const pages=doc.getPages();
  pages.forEach((p,i)=>{
    p.drawLine({start:{x:LEFT,y:62},end:{x:RIGHT,y:62},thickness:.6,color:line});
    p.drawText('EMPROVEX  |  Uso hospitalar restrito  |  Documento sem inferencia de entrega ou responsabilidade',
      {x:LEFT,y:46,font,size:7.5,color:muted});
    p.drawText('Pagina '+(i+1)+' de '+pages.length,{x:RIGHT-73,y:46,font:bold,size:7.5,color:muted});
    p.drawText('Gerado em UTC: '+cleanLabel(report.generatedAt),{x:LEFT,y:32,font,size:7.1,color:muted});
  });
  const bytes=await doc.save();
  return {filename,mime:'application/pdf',bytes};
}
export function serializeHospitalCSV(report){return csv(report)}
export const HOSPITAL_REPORT_COLUMNS=SCHEMAS;
