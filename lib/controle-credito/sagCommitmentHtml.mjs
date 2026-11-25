// Parser determinístico de exportação HTML do SAG. Sem DOM, OCR, dependência ou rede.
export function parseSagCommitmentHtml(html, expectedUg) {
  const fail = message => { throw new Error(message); };
  if (typeof html !== 'string' || !html.trim() || html.length > 1_000_000 || !/^\d{6}$/.test(expectedUg)) fail('Arquivo HTML ou UG inválidos.');
  const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|ndash|mdash);/gi, (all, name) => {
    const n = name.toLowerCase();
    if(n.startsWith('#')) {
      const cp = n.startsWith('#x') ? Number.parseInt(n.slice(2),16) : Number(n.slice(1));
      if(!Number.isInteger(cp)||cp<32||cp>0x10ffff||(cp>=0xd800&&cp<=0xdfff)) fail('Entidade HTML inválida.');
      return String.fromCodePoint(cp);
    }
    return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—'})[n];
  });
  const clean = s => s.replace(/\s+/g,' ').trim();
  const norm = s => clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  // Leitor estrito do template exportado pelo SAG, sem DOM, rede ou execução.
  // Não é um sanitizador nem um interpretador HTML genérico.
  const root = {tag:'root',classes:[],children:[],parts:[]};
  const stack = [root];
  const voids = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  const allowed = new Set(['html','head','title','body','div','span','a','table','thead','tbody','tfoot','tr','th','td','p','strong','b','i','em','small','button','section','header','footer','br','meta','link','hr','img','col','colgroup','script','style']);
  const token = /<!--[\s\S]*?-->|<!doctype\s+html\s*>|<\/?[a-z][a-z0-9:-]*(?:\s+(?:[^"'<>]|"[^"]*"|'[^']*')*)?\s*\/?>|[^<]+/giy;
  let cursor=0, nodes=0;
  while(cursor<html.length){
    token.lastIndex=cursor;
    const m=token.exec(html);
    if(!m) fail('HTML não reconhecido ou malformado.');
    const t=m[0]; cursor=token.lastIndex;
    if(t.startsWith('<!--')||/^<!doctype/i.test(t)) continue;
    const parent=stack[stack.length-1];
    if(!t.startsWith('<')){ parent.parts.push(decode(t)); continue; }
    const name=/^<\/?([a-z][a-z0-9:-]*)/i.exec(t)?.[1].toLowerCase();
    if(!name||!allowed.has(name)) fail('Estrutura HTML não suportada.');
    if(t.startsWith('</')){
      if(stack.length<2||parent.tag!==name) fail('Estrutura HTML inconsistente.');
      stack.pop(); continue;
    }
    if(name==='script'||name==='style'){
      const end=new RegExp('</'+name+'\\s*>','gi'); end.lastIndex=cursor;
      const match=end.exec(html); if(!match) fail('Bloco HTML incompleto.');
      cursor=end.lastIndex; continue;
    }
    if(++nodes>20000||stack.length>80) fail('Arquivo HTML excede os limites de estrutura.');
    const attrs=t.slice(1+name.length,-1);
    const attrPattern=/([^\s=/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let a, classes=[], seenClass=false;
    while((a=attrPattern.exec(attrs))){
      if(a[1].toLowerCase()==='class'){
        if(seenClass) fail('Atributo de classe duplicado.');
        seenClass=true; classes=decode(a[2]??a[3]??a[4]??'').split(/\s+/).filter(Boolean);
      }
    }
    const node={tag:name,classes,children:[],parts:[]};
    parent.children.push(node); parent.parts.push(node);
    if(!voids.has(name)&&!t.endsWith('/>')) stack.push(node);
    if(name==='br') parent.parts.push(' ');
  }
  if(stack.length!==1) fail('HTML incompleto.');
  const val = node => clean(node.parts.map(part=>typeof part==='string'?part:val(part)).join(''));
  const has=(n,c)=>n.classes.includes(c);
  const find=(n,p)=>n.children.flatMap(child=>[...(p(child)?[child]:[]),...find(child,p)]);
  const by=(n,c)=>find(n,x=>has(x,c));
  const one=(arr,label)=>arr.length===1?arr[0]:fail(label+' ausente ou ambíguo.');
  const wrapper=one(by(root,'doc-wrapper'),'Documento SAG');
  if(norm(val(one(by(wrapper,'doc-header-tipo'),'Tipo')))!=='NOTA DE EMPENHO') fail('Documento não é NE.');
  const fields=new Map();
  for(const n of [...by(wrapper,'ne-field'),...by(wrapper,'ne-obs')]){
    const label=norm(val(one(by(n,'ne-label'),'Rótulo'))), value=val(one(by(n,'ne-value'),'Valor'));
    if(fields.has(label))fail('Campo duplicado: '+label);
    fields.set(label,value);
  }
  const field=(label,re)=>{const v=fields.get(label);if(!v||re&&!re.test(v))fail('Campo inválido: '+label);return v;};
  const ug=field('UG EMITENTE',/^\d{6}$/);
  if(ug!==expectedUg)fail('UG incompatível.');
  const full=field('NUMERO NE',/^\d{6,20}20\d{2}NE\d{6}$/);
  const id=full.slice(-12);
  if(!full.startsWith(ug)||val(one(by(wrapper,'doc-header-numero'),'Número'))!==id)fail('Número divergente.');
  const rawDate=field('DATA EMISSAO',/^\d{2}\/\d{2}\/(?:\d{2}|20\d{2})$/);
  const [day,month,y]=rawDate.split('/'),year=y.length===2?'20'+y:y;
  const iso=year+'-'+month+'-'+day;
  if(year!==id.slice(0,4)||!Number.isFinite(Date.parse(iso+'T00:00:00Z'))||new Date(iso+'T00:00:00Z').toISOString().slice(0,10)!==iso)fail('Data inválida.');
  const cents=s=>{if(!/^(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}$/.test(s))fail('Valor inválido.');const v=Number(s.replace(/[.,]/g,''));if(!Number.isSafeInteger(v)||v<0)fail('Valor inválido.');return v;};
  const netCents=cents(field('VALOR'));
  if(!netCents)fail('NE sem valor.');
  const tipoEmpenho=norm(field('TIPO EMPENHO'));
  if(!/^(GLOBAL|ESTIMATIVO|ORDINARIO)$/.test(tipoEmpenho))fail('Tipo incompatível.');
  const supplierCnpj=field('FAVORECIDO',/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
  const description=field('OBSERVACAO');
  const references=[...new Set(description.match(/\b20\d{2}NC\d{6}\b/g)||[])];
  const section=one(by(wrapper,'ne-section').filter(n=>by(n,'itens').length===1),'Lista de itens');
  const rows=find(one(find(section,n=>n.tag==='tbody'),'Itens'),n=>n.tag==='tr');
  if(!rows.length||rows.length>5000)fail('Lista de itens inválida.');
  let sum=0;
  for(const row of rows){
    const td=row.children.filter(n=>n.tag==='td').map(val);
    if(td.length!==8||norm(td[3])!=='INCLUSAO')fail('NE contém ajuste ou item incompatível; use conciliação.');
    sum+=cents(td[7]);if(!Number.isSafeInteger(sum))fail('Total inválido.');
  }
  if(sum!==netCents)fail('Total divergente da lista de itens.');
  const modalidade=norm(field('MOD. LICITACAO'));
  const warnings=['Nome do favorecido não informado pelo HTML SAG; identificado pelo CNPJ.'];
  if(references.length!==1)warnings.push('Referência da NC ausente ou ambígua; confira o vínculo.');
  return {id,ug,supplier:supplierCnpj,supplierCnpj,description,date:day+'/'+month+'/'+year,tipoEmpenho,processo:field('PROCESSO'),valorTotal:netCents/100,naturezaDespesa:field('NAT. DESPESA',/^\d{6}$/),ptres:field('PTRES',/^\d{6}$/),fonteRecurso:field('FONTE',/^\d{10}$/),ugr:field('UG RESPONSAVEL',/^\d{6}$/),planoInterno:field('PLANO INTERNO',/^[A-Z0-9]{1,20}$/),notaCredito:references.length===1?references[0]:null,modalidadeContratacao:modalidade.includes('PREGAO')?'PREGAO':modalidade.includes('DISPENSA')?'DISPENSA_ELETRONICA':'OUTRA',numeroContratacao:null,pregao:'',contrato:null,classification:'',tipoObjeto:'OUTRO',items:[],warnings,pageCountDetected:0,itemRowsDetected:rows.length,duplicatedRowsIgnored:0,number:id,issueDate:iso,netCents,requiresReview:true};
}
