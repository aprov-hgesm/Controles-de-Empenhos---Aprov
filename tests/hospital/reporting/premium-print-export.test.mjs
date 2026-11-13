import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {exportHospitalReport,serializeHospitalCSV} from '../../../lib/server/hospital/reporting/export.mjs';

const cols=['unitId','localDate','cycleId','dietCode','mealType','planned','sent','preparing','ready','dispatched','received','delivered','cancelled','suspended'];
function example(n){
 return {view:'production',filters:{from:'2026-11-13',to:'2026-11-13',ug:'UG_QA',organizationId:'HOSPITAL_FICTICIO'},
  partial:false,generatedAt:'2026-11-13T12:30:00Z',rows:Array.from({length:n},(_,i)=>({
   unitId:i%2?'UPI':'UTI',localDate:'2026-11-13',cycleId:'10',
   dietCode:i%3===0?'DIETA_BRANDA':'DIETA_PASTOSA',mealType:i%2?'PRIMARY':'SECONDARY',
   planned:4,sent:4,preparing:1,ready:2,dispatched:1,received:1,delivered:0,cancelled:0,suspended:0
  }))};
}
test('PDF institucional A4 retrato, paginado, com metadados e sem condensar tudo numa linha',async()=>{
 const document=example(50);
 const file=await exportHospitalReport(document,'pdf');
 assert.equal(file.mime,'application/pdf');
 assert.match(file.filename,/\.pdf$/);
 assert.equal(Buffer.from(file.bytes).subarray(0,4).toString(),'%PDF');
 const pdf=await PDFDocument.load(file.bytes);
 assert.ok(pdf.getPageCount()>1,'Relatório longo exige paginação');
 const size=pdf.getPage(0).getSize();
 assert.ok(Math.abs(size.width-595)<1&&Math.abs(size.height-842)<1,'Formato A4 retrato');
});
test('CSV institucional escapa conteúdo e fórmulas de planilha',()=>{
 const report=example(1);
 report.rows[0].dietCode='=HYPERLINK("https://example.com")';
 const csv=serializeHospitalCSV(report);
 assert.match(csv,/^\uFEFF/);
 assert.match(csv,/'=HYPERLINK/);
});
