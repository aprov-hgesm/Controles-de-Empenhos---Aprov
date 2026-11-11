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
  const {PDFDocument,StandardFonts}=await import('pdf-lib');
  const doc=await PDFDocument.create();
  const font=await doc.embedFont(StandardFonts.Helvetica);
  const bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const PAGE_W=595,PAGE_H=842,PAD=36,LINE=12;
  let page,y;
  function newPage(){
    page=doc.addPage([PAGE_W,PAGE_H]);y=PAGE_H-PAD;
    page.drawText('EMPROVEX | Cozinha Dietetica - Relatorio QA',{x:PAD,y,font:bold,size:12});y-=20;
    page.drawText(pdfText(title[report.view]||report.view),{x:PAD,y,font:bold,size:11});y-=20;
    page.drawText(pdfText('UTC '+report.generatedAt+' | OM '+report.filters.organizationId+' | UG '+report.filters.ug),{x:PAD,y,font,size:8});y-=14;
    page.drawText(pdfText('Periodo local '+from+' a '+to+' (America/Sao_Paulo)'),{x:PAD,y,font,size:8});y-=14;
    page.drawText('Sem inferencia de culpa, entrega ou quantidade aferida.',{x:PAD,y,font,size:8});y-=24;
  }
  newPage();
  let i=0;
  for(const row of rows){
    if(y<90)newPage();
    i++;
    page.drawText(pdfText(String(i)+' | '+columns.filter(c=>!['detail','administrativeAttribution'].includes(c)).slice(0,5).map(c=>c+': '+plain(row[c])).join(' | '),102),{x:PAD,y,font:bold,size:8});y-=LINE;
    for(let k=0;k<columns.length;k+=3){
      if(y<70)newPage();
      const text=columns.slice(k,k+3).map(c=>c+': '+plain(row[c])).join(' | ');
      page.drawText(pdfText(text,114),{x:PAD+6,y,font,size:7.5});y-=LINE;
    }
    y-=5;
  }
  if(!rows.length){page.drawText('Sem registros para os filtros selecionados.',{x:PAD,y,font,size:10});}
  const bytes=await doc.save();
  return {filename,mime:'application/pdf',bytes};
}
export function serializeHospitalCSV(report){return csv(report)}
export const HOSPITAL_REPORT_COLUMNS=SCHEMAS;
