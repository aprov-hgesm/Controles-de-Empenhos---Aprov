import assert from 'node:assert/strict';
import { generateBulkStockTemplate, parseBulkStockWorkbook, STOCK_MAX_FILE_BYTES } from '../lib/server/warehouseBulkStockWorkbook';

function expectReject(buffer:Buffer,code:string){
  assert.throws(()=>parseBulkStockWorkbook(buffer),(error:unknown)=>{
    return error instanceof Error && error.message===code;
  });
}
const rows=[
  ['Arroz integral','80','Kg','2027-04-18','','Estante','9','1','','Contagem física inicial','Termo 001'],
  ['Arroz integral','300','Kg','2027-04-18','','Estante','9','2','','Contagem física inicial','Termo 001'],
  ['Creme de confeiteiro','13','Und','2026-11-22','','Estante','9','4','LOTE-ABC','Contagem física inicial','Termo 001'],
];
const buffer=generateBulkStockTemplate(rows);
assert.equal(buffer.subarray(0,2).toString('utf8'),'PK');
const parsed=parseBulkStockWorkbook(buffer);
assert.equal(parsed.length,3);
assert.equal(parsed[0].material,'Arroz integral');
assert.equal(parsed[0].quantity,80);
assert.equal(parsed[0].barcode,null);
assert.equal(parsed[0].localType,'Estante');
assert.equal(parsed[0].localNumber,'9');
assert.equal(parsed[0].subposition,'1');
assert.equal(parsed[0].expiresOn,'2027-04-18');
assert.equal(parsed[1].quantity,300);
assert.equal(parsed[1].subposition,'2');
assert.equal(parsed[2].lot,'LOTE-ABC');
assert.equal(parsed[2].line,4);
console.log('PASS: Excel com célula vazia em E2 e local obrigatório em F2 preservado; materiais repetidos e lotes');
expectReject(generateBulkStockTemplate(),'STOCK_IMPORT_EMPTY');
expectReject(generateBulkStockTemplate([['Arroz integral','','Kg','','','Estante','9','1']]),'STOCK_IMPORT_INVALID_ROW_2');
expectReject(Buffer.from('not an xlsx'),'STOCK_IMPORT_NOT_XLSX');
expectReject(Buffer.alloc(STOCK_MAX_FILE_BYTES+1),'STOCK_IMPORT_TOO_LARGE');
console.log('PASS: cabeçalho vazio, linha inválida, formato inválido e limite de upload');
console.log('WAREHOUSE BULK STOCK XLSX R1 PASS');
