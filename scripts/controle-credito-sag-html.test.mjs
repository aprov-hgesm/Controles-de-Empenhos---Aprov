import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSagCreditHtml as parse } from '../lib/controle-credito/sagCreditHtml.mjs';
const fields = (key,value) => '<div class="nc-field"><span class="nc-label">'+key+'</span><span class="nc-value">'+value+'</span></div>';
const row = (ug,nd,pi,value) => '<tr>'+[ug,'1','1','1','123456','1000000000',nd,'123456',pi,'R$ '+value].map(s=>'<td>'+s+'</td>').join('')+'</tr>';
const table=(kind,rows)=>'<span class="nc-det-titulo nc-det-'+kind+'">'+kind+'</span><table class="nc-det-table"><thead><tr>'+['UG Fav','Item','Num','Esf','PTRES','Fonte','ND','UGR','PI','Valor'].map(c=>'<th>'+c+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table>';
const seq=(ug,id,amount,origin,destination)=>'<div class="nc-item-header"><span>Sequencial '+id+'</span><span>R$ '+amount+'</span></div><div class="nc-item-body">'+table('origem',origin)+table('destino',destination)+'</div>';
const group=(ug,amount,sequences)=>'<div class="nc-ug-header"><span><span class="glyphicon"></span> '+ug+' — UG TESTE</span><span>R$ '+amount+'</span></div><div class="nc-ug-body">'+sequences+'</div>';
const oneSeq=(ug,id,amount)=>seq(ug,id,amount,row(ug,'339000','-',amount),row(ug,'339030','TESTE123456',amount));
function fixture(groups=group('654321','10.000,01',oneSeq('654321',1,'10.000,01')),total='10.000,01',count='1'){
  return '<!DOCTYPE html><html><head><style>.example{color:red}</style></head><body><div class="doc-wrapper"><div class="doc-header-tipo">Nota de Crédito Orçamentário</div><div class="doc-header-numero">2026NC000001</div>'+
    [['Número NC','123456000012026NC000001'],['UG Emitente','123456'],['Operação','DESCENTRALIZACAO'],['Data Emissão','04/11/2026'],['Sistema Origem','SIAFI-STN'],['Valor Total',total],['Descentralização','PROVISAO'],['Qtde. UGs Fav.',count]].map(([k,v])=>fields(k,v)).join('')+
    '<div class="nc-obs"><span class="nc-value">CRÉDITO &amp; TESTE. PRAZO DE EMPENHO 30 NOV 26.</span></div><div class="nc-section">'+groups+'</div></div><script>throw Error("never executed");</script></body></html>';
}
test('direct extraction, exact cents, origin not counted twice, script inert',()=>{
 const r=parse(fixture(),'654321');
 assert.equal(r.totalCents,1000001);
 assert.equal(r.documentTotalCents,1000001);
 assert.equal(r.deadline,'2026-11-30');
 assert.equal(r.sequences[0].destination[0].fonte,'1000000000');
 assert.equal(r.sequences[0].destination[0].nd,'339030');
 assert.equal(r.sequences[0].origin[0].nd,'339000');
 assert.equal(r.description,'CRÉDITO & TESTE. PRAZO DE EMPENHO 30 NOV 26.');
 assert.deepEqual(r.warnings,[]);
});
test('multiple UGs only yield credit for authenticated UG',()=>{
 const html=fixture(group('654321','10.000,01',oneSeq('654321',1,'10.000,01'))+group('654322','2,00',oneSeq('654322',1,'2,00')),'10.002,01','2');
 const r=parse(html,'654322');
 assert.equal(r.totalCents,200); assert.equal(r.documentTotalCents,1000201);
 assert.equal(r.sequences.length,1); assert.equal(r.sequences[0].destination[0].ug,'654322');
});
test('multiple sequences and rows retain budget cell breakdown',()=>{
 const g=group('654321','10,00',seq('654321',1,'8,00',row('654321','339000','-','8,00'),row('654321','339030','TESTE1','3,00')+row('654321','339039','TESTE2','5,00'))+oneSeq('654321',2,'2,00'));
 const r=parse(fixture(g,'10,00'),'654321');
 assert.equal(r.totalCents,1000); assert.equal(r.sequences.length,2); assert.equal(r.sequences[0].destination.length,2);
});
test('rejects malformed, duplicate, unsupported operation, mismatch and wrong UG',()=>{
 for(const h of [fixture().replace('10.000,01','10.000,02'),fixture().replace('1000000000','100000000O'),fixture().replace('PROVISAO','RECOLHIMENTO'),fixture().replace('</body>',''),fixture().replace('2026NC000001','2026NE000001'),fixture().replace('class="nc-field"','class="nc-field" class="nc-field"')]) assert.throws(()=>parse(h,'654321'));
 assert.throws(()=>parse(fixture(),'999999'));
});
test('unknown or competing deadlines require review',()=>{
 const r=parse(fixture().replace('30 NOV 26','30 FEV 26'),'654321');
 assert.equal(r.deadline,null); assert.ok(r.warnings.length);
 const r2=parse(fixture().replace('30 NOV 26.','30 NOV 26. PRAZO DE EMPENHO 01 DEZ 26.'),'654321');
 assert.equal(r2.deadline,null);
});
