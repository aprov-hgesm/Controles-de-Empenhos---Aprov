import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {inflateSync} from 'node:zlib';
import ts from 'typescript';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('credit uses a named app and per-tab auth throughout, without signing out operational Auth',()=>{
  const auth=read('features/controle-credito/auth/creditFirebase.ts');
  assert.match(auth,/emprovex-credit-control/);
  assert.match(auth,/initializeApp\([\s\S]*?,name\)/);
  assert.match(auth,/persistence:browserSessionPersistence/);
  for(const path of ['auth/useCreditSession.ts','auth/CreditLogin.tsx','client.ts','documents/CreditDocuments.tsx','documents/CreditDriveProvider.tsx']){
    const code=read('features/controle-credito/'+path);
    assert.match(code,/creditAuth/);
    assert.doesNotMatch(code,/from ['"]@\/lib\/firebase['"]/);
  }
  assert.doesNotMatch(read('app/controle-credito/page.tsx'),/sessão compartilhada/);
});
test('NC-first workflow retains server revision and confirmation, correct search and password minimum',()=>{
  const workspace=read('features/controle-credito/ui/Workspace.tsx'),forms=read('features/controle-credito/ui/Forms.tsx');
  assert.match(workspace,/beginNe\(c\)/);
  assert.match(workspace,/initialCreditId=\{selectedNc\?\.id\}/);
  assert.match(workspace,/Número da NC ou finalidade/);
  assert.match(workspace,/Prazo para empenho/);
  assert.match(workspace,/emprovex-app-sidebar/);
  assert.match(forms,/1 · Selecionar NC/);
  assert.match(forms,/selected&&<><div/);
  assert.match(forms,/expectedCreditRevision:selected.credit.revision/);
  assert.match(forms,/acknowledgeDeficit:ack/);
  assert.match(forms,/archiveImported\(user,'nc'/);
  assert.match(forms,/archiveImported\(user,'ne'/);
  assert.match(read('app/api/admin/controle-credito/route.ts'),/password.length<8/);
  assert.match(read('components/admin/AdminCreditAccessPanel.tsx'),/minLength=\{8\}/);
});
test('document connection checks manager and original download preserves private hash verification',()=>{
  const server=read('lib/server/creditControlDocuments.ts'),route=read('app/api/controle-credito/drive/route.ts');
  assert.match(route,/requireCreditMember\(request,true\)/);
  assert.match(server,/const token=await checkedToken\(m,request\);await ensureFolder/);
  assert.match(server,/const bytes=await verifyFile\(m,token,d\);\s*if\(d.entityType==='nc'/);
  assert.match(server,/parseSagCreditHtml\(new TextDecoder/);
  assert.match(server,/PDF textual reconstruído/);
  assert.match(server,/creditPdfResponse\(creditPdf/);
});
test('PDF generator emits real selectable text rather than a screenshot',async()=>{
  const require=createRequire(import.meta.url);
  const jspdf=pathToFileURL(require.resolve('jspdf')).href;
  const code=read('lib/controle-credito/reports/creditPdf.ts').replace("import { jsPDF } from 'jspdf';",`import pkg from ${JSON.stringify(jspdf)}; const {jsPDF}=pkg;`);
  const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const {creditPdf}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  const pdf=Buffer.from(creditPdf({uid:'demo',email:'demo@example.invalid',ug:'654321',role:'gestor',centerId:null},'Nota de Crédito',[{label:'NC',value:'2026NC000001'}]));
  assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
  const text=pdf.toString('latin1');let decoded='';
  for(const m of text.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)){try{decoded+=inflateSync(Buffer.from(m[1],'latin1')).toString('latin1');}catch{}}
  assert.match(decoded,/2026NC000001/);
  assert.match(decoded,/Tj/);
});

test('R1.3 official images, direct edit, deletion confirmation and document generation isolation',()=>{
  const fs=requireForProfileTest();
  const avatar=read('features/controle-credito/ui/CreditProfileAvatar.tsx');
  for(const name of ['Gestor','Aprov','Almox','Farm','LAC','Odonto']){
    const file='Imagem  - Perfil '+name+'.png';
    assert.ok(avatar.includes(file));
    assert.ok(fs(file).subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  }
  assert.match(avatar,/from 'next\/image'/);
  const workspace=read('features/controle-credito/ui/Workspace.tsx');
  assert.match(workspace,/open\('nc',c.id,'edit'\)/);
  assert.match(workspace,/expectedCommitmentCount:target.count/);
  assert.match(workspace,/role="alertdialog"/);
  assert.match(workspace,/Detalhar/);
  const docs=read('lib/server/creditControlDocuments.ts');
  assert.match(docs,/d.entityKey!==entityKey\(d.entityType,record\)/);
  assert.match(docs,/documentRows\(m,'entityKey',entityKey\(kind,record\)\)/);
  assert.match(docs,/value:\{stringValue:value\}/);
  assert.match(read('app/api/controle-credito/notas-credito/route.ts'),/export async function DELETE[\s\S]*requireCreditMember\(request,true\)/);
  assert.match(read('app/api/controle-credito/notas-empenho/route.ts'),/export async function DELETE[\s\S]*requireCreditMember\(request,true\)/);
});
function requireForProfileTest(){return name=>readFileSync(new URL('../public/branding/'+encodeURIComponent(name),import.meta.url));}

test('R1.4 reuses operational auth loader, circular profile art and single Drive control while preserving report filters',()=>{
  const page=read('app/controle-credito/page.tsx');
  const w=read('features/controle-credito/ui/Workspace.tsx');
  const docs=read('features/controle-credito/documents/CreditDocuments.tsx');
  const avatar=read('features/controle-credito/ui/CreditProfileAvatar.tsx');
  const drive=read('features/controle-credito/documents/CreditDriveProvider.tsx');
  assert.match(page,/if\(loading\)return <EmprovexAuthLoading hasAuthenticatedIdentity=\{Boolean\(user\)\}/);
  assert.match(read('app/login/page.tsx'),/<EmprovexAuthLoading hasAuthenticatedIdentity/);
  assert.match(avatar,/overflow-hidden rounded-full/);
  assert.match(avatar,/rounded-full object-contain/);
  assert.doesNotMatch(avatar,/rounded-xl border/);
  const sidebar=w.slice(w.indexOf('<aside aria-label='),w.indexOf('</aside>'));
  assert.doesNotMatch(sidebar,/member\.email|member\.ug|Autorizado/);
  assert.match(sidebar,/creditProfileName\(profile\)/);
  assert.equal((w.match(/<CreditDriveControl\b/g)||[]).length,1);
  assert.match(w,/<CreditDriveControl compact\/>/);
  assert.doesNotMatch(docs,/<CreditDriveControl\b/);
  assert.match(drive,/d\.disconnect\(\);setMenu\(false\)/);
  assert.match(w,/documentMode==='reports'/);
  assert.match(w,/docKind\+':'\+selectedDoc.id/); // document key includes note type
  assert.match(w,/entityType=\{docKind\} entityId=\{selectedDoc.id\}/);
  assert.match(w,/visibleDocs\.map/);
  for(const key of ['saldo','prazos','nc','nc-detalhe','ne-centro'])assert.ok(w.includes("id:'"+key+"'"));
  assert.match(w,/type:report,year,nc:/);
  assert.match(w,/center:report==='ne-centro'\?reportCenter/);
  assert.match(w,/from:report==='ne-centro'\?from/);
  assert.match(w,/to:report==='ne-centro'\?to/);
  assert.match(w,/t.availableCents<0\?'deficit':'available'/);
});

test('R1.5 compact picker, no full list teardown and cache protection',()=>{
  const picker=read('features/controle-credito/ui/CreditRecordPicker.tsx'),form=read('features/controle-credito/ui/Forms.tsx'),w=read('features/controle-credito/ui/Workspace.tsx');
  assert.match(picker,/matches\.slice\(0,35\)/);assert.match(picker,/role="combobox"/);assert.match(picker,/ArrowDown/);
  assert.match(form,/onOpen=\{\(\)=>setCatalogOpen\(true\)\}/);
  assert.match(form,/useCreditChoices\(user,year,catalogOpen/);
  assert.match(form,/expectedCreditRevision:selected.credit.revision/);
  assert.match(w,/aria-busy=\{!ready\}/);assert.match(w,/Atualizando somente os registros/);
  assert.match(w,/tab==='ne'\?'ne-list':tab==='nc'\?'nc-list'/);
  assert.doesNotMatch(w,/setLoading\(true\);setLoadError\(''\);setView\(null\)/);
  assert.match(read('app/controle-credito/layout.tsx'),/dynamic='force-dynamic'/);
  assert.match(read('next.config.ts'),/source: '\/controle-credito',[\s\S]{0,150}no-store/);
});
test('R1.5 structured report handles multiple pages and retains selectable text',async()=>{
  const require=createRequire(import.meta.url);
  const jspdf=pathToFileURL(require.resolve('jspdf')).href;
  const code=read('lib/controle-credito/reports/creditPdf.ts').replace("import { jsPDF } from 'jspdf';",`import pkg from ${JSON.stringify(jspdf)}; const {jsPDF}=pkg;`);
  const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const {creditReportPdf}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  const lines=[{kind:'section',label:'Resumo financeiro',value:''},{kind:'metric',label:'Crédito registrado',value:'R$ 1.234,56'},{kind:'metric',label:'Empenhado',value:'R$ 234,56'},{kind:'metric',label:'Saldo disponível',value:'R$ 1.000,00'},{kind:'section',label:'NC 2026NC000001',value:'Emissão 01/01/2026'},...Array.from({length:80},(_,i)=>({label:'Finalidade',value:'Registro '+i+' '+('texto de teste '.repeat(18))})),{label:'Final',value:'REGISTRO-FINAL'}];
  const pdf=Buffer.from(creditReportPdf({uid:'demo',email:'demo@example.invalid',ug:'654321',role:'gestor',centerId:null},'Relatório de execução',lines,2026));
  assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
  const text=pdf.toString('latin1');let decoded='';
  for(const m of text.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)){try{decoded+=inflateSync(Buffer.from(m[1],'latin1')).toString('latin1');}catch{}}
  assert.ok((text.match(/\/Type \/Page\b/g)||[]).length>1);
  assert.match(decoded,/2026NC000001/);assert.match(decoded,/REGISTRO-FINAL/);assert.match(decoded,/1.234,56/);assert.match(decoded,/Tj/);
});

test('R1.6 original NE sharing has a manager-only sync endpoint, current generation and centre isolation',()=>{
  const docs=read('lib/server/creditControlDocuments.ts'),ui=read('features/controle-credito/documents/CreditDocuments.tsx');
  assert.match(docs,/shareCenter===m.centerId/);
  assert.match(docs,/shareRecipients.includes\(m.email.trim\(\).toLowerCase\(\)\)/);
  assert.match(docs,/withCreditSharingLock\(m,'upload-ne'/);
  assert.match(docs,/validateSource\(bytes,'ne',m,record\)/);
  assert.match(docs,/persistShare\(m,doc,'pending',known/);
  assert.match(docs,/reconcile\(d.driveId,desired,known,allowGrant\)/);
  const founder=read('app/api/admin/controle-credito/route.ts');assert.match(founder,/withCreditSharingLock\(actor,'founder-access'/);assert.match(founder,/await requireNoExternalCreditShare\(actor,center,email\)/);
  assert.match(docs,/m.role==='centro'&&kind==='nc'\)return \[projected\]/);
  assert.match(ui,/Visualizar NE original/);
  const route=read('app/api/controle-credito/documentos/[id]/route.ts');assert.match(route,/export async function POST[\s\S]*requireCreditMember\(request,true\)/);
  for(const path of ['notas-empenho','notas-credito','administracao']){
    const s=read('app/api/controle-credito/'+path+'/route.ts');assert.match(s,/withCreditSharingLock\(member,/);assert.match(s,/await revokeCreditShares\(member,request,/);
  }
});
