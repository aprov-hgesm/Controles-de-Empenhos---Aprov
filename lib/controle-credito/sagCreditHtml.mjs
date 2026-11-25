// Parser determinístico de exportação HTML do SAG. Sem DOM, OCR, dependência ou rede.
export function parseSagCreditHtml(html, expectedUg) {
  const fail = message => { throw new Error(message); };
  if (typeof html !== 'string' || !html.trim() || html.length > 1_000_000 || !(typeof expectedUg==='string'?/^\d{6}$/.test(expectedUg):Array.isArray(expectedUg)&&expectedUg.length>0&&expectedUg.every(u=>typeof u==='string'&&/^\d{6}$/.test(u)))) fail('Arquivo HTML ou UG inválidos.');
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
  if(norm(val(one(by(wrapper,'doc-header-tipo'),'Tipo de documento')))!=='NOTA DE CREDITO ORCAMENTARIO') fail('Documento não é uma NC do SAG.');
  const number=val(one(by(wrapper,'doc-header-numero'),'Número da NC'));
  if(!/^20\d{2}NC\d{6}$/.test(number)) fail('Número da NC inválido.');
  const fields=new Map();
  for(const row of by(wrapper,'nc-field')){
    const key=norm(val(one(by(row,'nc-label'),'Rótulo')));
    if(fields.has(key)) fail('Campo duplicado: '+key);
    fields.set(key,val(one(by(row,'nc-value'),'Valor de '+key)));
  }
  const required=key=>fields.get(key)||fail('Campo ausente: '+key);
  const fullNumber=required('NUMERO NC'), issuingUg=required('UG EMITENTE');
  if(!/^\d{6}$/.test(issuingUg)||!/^\d+20\d{2}NC\d{6}$/.test(fullNumber)||!fullNumber.startsWith(issuingUg)||!fullNumber.endsWith(number)) fail('Identificadores da NC divergentes.');
  const operation=required('OPERACAO'), decentralization=required('DESCENTRALIZACAO');
  if(norm(operation)!=='DESCENTRALIZACAO'||norm(decentralization)!=='PROVISAO') fail('Operação de crédito ainda não suportada para importação automática.');
  const parseDate=(y,m,d)=>{
    const iso=y+'-'+m.padStart(2,'0')+'-'+d.padStart(2,'0'), time=Date.parse(iso+'T00:00:00Z');
    return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===iso?iso:null;
  };
  const em=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(required('DATA EMISSAO'));
  const issueDate=em&&parseDate(em[3],em[2],em[1]);
  if(!issueDate) fail('Data de emissão inválida.');
  const cents=s=>{
    const m=/^(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})$/.exec(s);
    const n=m?Number(m[1].replace(/\./g,'')+m[2]):NaN;
    if(!Number.isSafeInteger(n)||n<=0) fail('Valor monetário inválido.');
    return n;
  };
  const sum=values=>values.reduce((a,b)=>{const n=a+b;if(!Number.isSafeInteger(n))fail('Total excede limite.');return n;},0);
  const totalCents=cents(required('VALOR TOTAL'));
  const description=val(one(by(one(by(wrapper,'nc-obs'),'Descrição'),'nc-value'),'Texto da descrição'));
  const months={JAN:'01',FEV:'02',MAR:'03',ABR:'04',MAI:'05',JUN:'06',JUL:'07',AGO:'08',SET:'09',OUT:'10',NOV:'11',DEZ:'12'};
  const dates=[...norm(description).matchAll(/\bPRAZO (?:DE|PARA) EMPENHO\s*:?\s*(\d{1,2})(?:\s+([A-Z]{3})\s+|\/(\d{1,2})\/)(\d{4}|\d{2})\b/g)];
  const dm=dates[0]; let deadline=dates.length===1&&(dm[3]||months[dm[2]])?parseDate(dm[4].length===2?'20'+dm[4]:dm[4],dm[3]||months[dm[2]],dm[1]):null;
  const warnings=[];
  if(deadline&&deadline<issueDate) deadline=null;
  if(!deadline) warnings.push('Prazo de empenho ausente ou ambíguo; conferir na descrição.');
  const headerColumns=['UG FAV','ITEM','NUM','ESF','PTRES','FONTE','ND','UGR','PI','VALOR'];
  const parseTable=(table,ug)=>{
    const headers=find(one(find(table,n=>n.tag==='thead'),'Cabeçalho da tabela'),n=>n.tag==='th').map(n=>norm(val(n)));
    if(headers.join('|')!==headerColumns.join('|')) fail('Colunas orçamentárias incompatíveis.');
    const rows=find(one(find(table,n=>n.tag==='tbody'),'Corpo da tabela'),n=>n.tag==='tr');
    if(!rows.length) fail('Tabela orçamentária vazia.');
    return rows.map(row=>{
      const v=row.children.filter(n=>n.tag==='td').map(val);
      if(v.length!==10||v[0]!==ug||!v.slice(1,4).every(x=>/^\d+$/.test(x))||!/^\d{6}$/.test(v[4])||!/^\d{10}$/.test(v[5])||!/^\d{6}$/.test(v[6])||!/^\d{6}$/.test(v[7])||! /^(?:[A-Z0-9]{1,20}|-)$/.test(v[8])) fail('Célula orçamentária inválida ou UG incompatível.');
      return {ug:v[0],item:v[1],num:v[2],esfera:v[3],ptres:v[4],fonte:v[5],nd:v[6],ugr:v[7],pi:v[8]==='-'?null:v[8],cents:cents(v[9])};
    });
  };
  const section=one(by(wrapper,'nc-section'),'Detalhamento por UG');
  const groups=[]; const seenUg=new Set();
  const children=section.children;
  for(let i=0;i<children.length;i++){
    const header=children[i];
    if(!has(header,'nc-ug-header')) continue;
    const body=children[++i];
    if(!body||!has(body,'nc-ug-body')) fail('Detalhamento de UG ausente.');
    const labels=header.children.filter(n=>n.tag==='span');
    const ug=/^(\d{6})\s+[—–-]\s+/.exec(labels[0]?val(labels[0]):'')?.[1];
    if(!ug||labels.length!==2||seenUg.has(ug)) fail('UG favorecida duplicada ou inválida.');
    seenUg.add(ug);
    const ugCents=cents(val(labels[1])); const seqs=[], seenSeq=new Set();
    for(let j=0;j<body.children.length;j++){
      const sh=body.children[j]; if(!has(sh,'nc-item-header')) continue;
      const sb=body.children[++j]; if(!sb||!has(sb,'nc-item-body')) fail('Detalhamento de sequencial ausente.');
      const spans=sh.children.filter(n=>n.tag==='span');
      const seq=/^SEQUENCIAL\s+(\d+)$/.exec(norm(spans[0]?val(spans[0]):''))?.[1];
      if(!seq||spans.length!==2||seenSeq.has(seq)) fail('Sequencial duplicado ou inválido.');
      seenSeq.add(seq); const seqCents=cents(val(spans[1]));
      const tables={}; const used=new Set();
      for(let k=0;k<sb.children.length;k++){
        const label=sb.children[k]; const kind=has(label,'nc-det-origem')?'origin':has(label,'nc-det-destino')?'destination':null;
        if(!kind) continue;
        const table=sb.children[++k]; if(tables[kind]||!table||table.tag!=='table'||!has(table,'nc-det-table')) fail('Tabela orçamentária ausente ou duplicada.');
        used.add(table); tables[kind]=parseTable(table,ug);
      }
      if(!tables.origin||!tables.destination||find(sb,n=>n.tag==='table').some(t=>!used.has(t))) fail('Tabelas de origem e destino inconsistentes.');
      if(sum(tables.origin.map(r=>r.cents))!==seqCents||sum(tables.destination.map(r=>r.cents))!==seqCents) fail('Valores de origem e destino divergentes do sequencial.');
      seqs.push({sequence:seq,totalCents:seqCents,...tables});
    }
    if(!seqs.length||seqs.length!==by(body,'nc-item-header').length||seqs.length!==by(body,'nc-item-body').length||sum(seqs.map(s=>s.totalCents))!==ugCents) fail('Valores dos sequenciais divergentes da UG.');
    groups.push({ug,totalCents:ugCents,sequences:seqs});
  }
  if(groups.length!==by(section,'nc-ug-header').length||groups.length!==by(section,'nc-ug-body').length||String(groups.length)!==required('QTDE. UGS FAV.')||sum(groups.map(g=>g.totalCents))!==totalCents) fail('Total ou quantidade de UGs favorecidas divergente.');
  const authorizedUgs=typeof expectedUg==='string'?[expectedUg]:expectedUg;
  const matching=authorizedUgs.flatMap(ug=>groups.filter(g=>g.ug===ug));
  if(matching.length>1) fail('NC contém mais de uma UG autorizada. Selecione a UG favorecida antes de importar.');
  const selected=matching[0];
  if(!selected) fail('NC não destinada à UG autorizada.');
  if(selected.sequences.some(s=>s.destination.some(c=>!c.pi))) warnings.push('PI de destino não informado; conferir.');
  return {number,fullNumber,issuingUg,beneficiaryUg:selected.ug,issueDate,operation,decentralization,sourceSystem:required('SISTEMA ORIGEM'),description,deadline,documentTotalCents:totalCents,totalCents:selected.totalCents,sequences:selected.sequences,warnings,requiresReview:true};
}
