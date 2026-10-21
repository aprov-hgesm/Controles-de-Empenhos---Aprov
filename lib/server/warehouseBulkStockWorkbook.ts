import { inflateRawSync } from 'node:zlib';

/** Modelo e leitor XLSX limitados, sem macros e sem execução de fórmulas. */
export const STOCK_MAX_ROWS=1500;
export const STOCK_MAX_FILE_BYTES=5*1024*1024;
export const STOCK_HEADERS=[
  'Material','Quantidade','Unidade','Data de Validade','Código de Barras',
  'Tipo de local','Nº Local','Subposição','Lote (opcional)','Procedência','Referência',
] as const;
export interface BulkStockRow {
  line:number;material:string;quantity:number;unit:string;expiresOn:string|null;
  barcode:string|null;localType:string;localNumber:string;subposition:string|null;
  lot:string|null;provenance:string|null;reference:string|null;
}
export class StockImportError extends Error {
  constructor(public readonly code:string,public readonly status=400) {super(code);}
}
function fail(code:string):never {throw new StockImportError(code);}
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const decode=(s:string)=>s.replace(/&#x([0-9a-f]+);|&#([0-9]+);|&(amp|lt|gt|quot|apos);/gi,
  (_,hex:string,dec:string,named:string)=>named?
    ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[named]:
    String.fromCodePoint(Number.parseInt(hex||dec,hex?16:10)));
const attr=(xml:string,key:string)=>{
  for(const m of xml.matchAll(/ ([\w:]+)=["']([^"']*)["']/g))if(m[1]===key)return decode(m[2]);
  return '';
};
function crc32(data:Buffer):number{
  let n=0xffffffff;
  for(const b of data){n^=b;for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;}
  return (n^0xffffffff)>>>0;
}
function packageXlsx(files:Record<string,string>):Buffer{
  const parts:Buffer[]=[],central:Buffer[]=[];let offset=0;
  for(const [path,contents] of Object.entries(files)){
    const name=Buffer.from(path),data=Buffer.from(contents),crc=crc32(data);
    const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);
    h.writeUInt16LE(0x800,6);h.writeUInt32LE(crc,14);h.writeUInt32LE(data.length,18);
    h.writeUInt32LE(data.length,22);h.writeUInt16LE(name.length,26);
    parts.push(h,name,data);
    const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);
    c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt32LE(crc,16);
    c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);
    c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);
    central.push(c,name);offset+=h.length+name.length+data.length;
  }
  const cd=Buffer.concat(central),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(Object.keys(files).length,8);
  end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(cd.length,12);
  end.writeUInt32LE(offset,16);
  return Buffer.concat([...parts,cd,end]);
}
function column(n:number):string{
  let t='';for(let i=n+1;i>0;i=Math.floor((i-1)/26))
    t=String.fromCharCode(65+(i-1)%26)+t;
  return t;
}
function sheetXml(rows:string[][]):string{
  const rowXml=rows.map((row,i)=>'<row r="'+(i+1)+'">'+row.map((v,j)=>v?
    '<c r="'+column(j)+(i+1)+'" t="inlineStr"><is><t>'+esc(v)+'</t></is></c>':'').join('')+'</row>').join('');
  return '<?xml version="1.0" encoding="UTF-8"?>'+
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+
    '<cols>'+[34,16,17,21,24,20,14,16,22,27,32].map((w,i)=>
      '<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('')+'</cols>'+
    '<sheetData>'+rowXml+'</sheetData></worksheet>';
}
export function generateBulkStockTemplate(sampleRows:string[][]=[]):Buffer{
  const wb='<?xml version="1.0" encoding="UTF-8"?>'+
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
    '<sheets><sheet name="Materiais" sheetId="1" r:id="rId1"/><sheet name="Instrucoes" sheetId="2" r:id="rId2"/></sheets></workbook>';
  const rel='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'+
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>';
  const help=[
    ['ETAPA','INSTRUÇÃO'],
    ['1','Cadastre antes o depósito, os locais e as subposições no EMPROVEX.'],
    ['2','Cada linha representa material + posição + eventual lote/validade.'],
    ['3','Use as colunas da aba Materiais; não altere os cabeçalhos.'],
    ['4','Data AAAA-MM-DD; a importação adiciona saldo, não substitui inventário.'],
    ['5','Revise todas as linhas na prévia antes de confirmar.'],
    ['6','O SISCOFIS não é modificado por esta operação.'],
  ];
  return packageXlsx({
    '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':wb,'xl/_rels/workbook.xml.rels':rel,
    'xl/worksheets/sheet1.xml':sheetXml([Array.from(STOCK_HEADERS),...sampleRows]),
    'xl/worksheets/sheet2.xml':sheetXml(help),
  });
}
function unzip(buffer:Buffer):Map<string,string>{
  if(buffer.length>STOCK_MAX_FILE_BYTES)throw new StockImportError('STOCK_IMPORT_TOO_LARGE',413);
  if(buffer.length<22)fail('STOCK_IMPORT_NOT_XLSX');
  let e=-1;
  for(let p=buffer.length-22;p>=Math.max(0,buffer.length-65557);p--)
    if(buffer.readUInt32LE(p)===0x06054b50){e=p;break;}
  if(e<0)fail('STOCK_IMPORT_NOT_XLSX');
  const count=buffer.readUInt16LE(e+10),size=buffer.readUInt32LE(e+12),offset=buffer.readUInt32LE(e+16);
  if(count>300||offset+size>e)fail('STOCK_IMPORT_ZIP_INVALID');
  let pos=offset,expanded=0;
  const allowed=new Set(['xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/sharedStrings.xml',
    'xl/worksheets/sheet1.xml','xl/worksheets/sheet2.xml','xl/worksheets/sheet3.xml','xl/worksheets/sheet4.xml']);
  const result=new Map<string,string>();
  for(let i=0;i<count;i++){
    if(pos+46>buffer.length||buffer.readUInt32LE(pos)!==0x02014b50)fail('STOCK_IMPORT_ZIP_INVALID');
    const method=buffer.readUInt16LE(pos+10),clen=buffer.readUInt32LE(pos+20);
    const ulen=buffer.readUInt32LE(pos+24),n=buffer.readUInt16LE(pos+28),
      x=buffer.readUInt16LE(pos+30),c=buffer.readUInt16LE(pos+32),local=buffer.readUInt32LE(pos+42);
    const name=buffer.subarray(pos+46,pos+46+n).toString('utf8');
    pos+=46+n+x+c;
    if(!allowed.has(name))continue;
    expanded+=ulen;
    if(expanded>25000000||ulen>25000000)fail('STOCK_IMPORT_ZIP_BOMB');
    if(local+30>buffer.length||buffer.readUInt32LE(local)!==0x04034b50)fail('STOCK_IMPORT_ZIP_INVALID');
    const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28);
    if(start+clen>buffer.length)fail('STOCK_IMPORT_ZIP_INVALID');
    const b=buffer.subarray(start,start+clen);
    let d:Buffer=Buffer.alloc(0);
    try{d=method===0?b:method===8?inflateRawSync(b,{maxOutputLength:25000000}):fail('STOCK_IMPORT_ZIP_METHOD');}
    catch{fail('STOCK_IMPORT_ZIP_CORRUPT');}
    if(d.length!==ulen)fail('STOCK_IMPORT_ZIP_INVALID');
    const xml=d.toString('utf8');
    if(/<!DOCTYPE|<!ENTITY/i.test(xml))fail('STOCK_IMPORT_XML_UNSAFE');
    result.set(name,xml);
  }
  return result;
}
function innerText(xml:string):string{
  return decode([...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m=>m[1]).join(''));
}
function excelRows(sheet:string,strings:string[]):Array<{line:number;cells:string[]}>{
  const rows:Array<{line:number;cells:string[]}>=[],seen=new Set<number>();
  for(const m of sheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)){
    const line=Number(attr(m[1],'r')),cells:string[]=[];
    if(!Number.isInteger(line)||line<1||line>100000||seen.has(line))fail('STOCK_IMPORT_ROW_INVALID');
    seen.add(line);
    for(const c of m[2].matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)){
      const address=attr(c[1],'r'),letters=address.match(/^[A-Z]+/i)?.[0]?.toUpperCase()||'';
      let index=0;for(const ch of letters)index=index*26+ch.charCodeAt(0)-64;
      index--;
      if(index<0||index>20)continue;
      const body=c[2]||'',t=attr(c[1],'t');
      if(/<f(?:\s|>)/.test(body))fail('STOCK_IMPORT_FORMULA_FORBIDDEN');
      const value=body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1]||'';
      cells[index]=t==='s'?strings[Number(value)]||'':t==='inlineStr'?innerText(body):decode(value);
    }
    rows.push({line,cells});
    if(rows.length>STOCK_MAX_ROWS+20)fail('STOCK_IMPORT_TOO_MANY_ROWS');
  }
  return rows;
}
function canonical(v:string):string{
  return v.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
}
function field(v:unknown,max:number):string{
  const result=String(v??'').trim().replace(/\s+/g,' ');
  if(result.length>max)fail('STOCK_IMPORT_FIELD_TOO_LONG');
  return result;
}
function date(value:string):string|null{
  if(!value)return null;
  let y=0,m=0,d=0;
  if(/^\d{4}-\d{2}-\d{2}/.test(value))[y,m,d]=value.slice(0,10).split('-').map(Number);
  else if(/^\d{2}\/\d{2}\/\d{4}$/.test(value))[d,m,y]=value.split('/').map(Number);
  else if(/^\d{4,5}(\.0+)?$/.test(value)){
    const parsed=new Date(Date.UTC(1899,11,30)+Number(value)*86400000);
    y=parsed.getUTCFullYear();m=parsed.getUTCMonth()+1;d=parsed.getUTCDate();
  }else fail('STOCK_IMPORT_DATE_INVALID');
  const check=new Date(Date.UTC(y,m-1,d));
  if(y<1900||y>2150||check.getUTCFullYear()!==y||check.getUTCMonth()+1!==m||check.getUTCDate()!==d)
    fail('STOCK_IMPORT_DATE_INVALID');
  return [y,String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
}
export function parseBulkStockWorkbook(buffer:Buffer):BulkStockRow[]{
  const files=unzip(buffer),workbook=files.get('xl/workbook.xml')||'',
    relationshipFile=files.get('xl/_rels/workbook.xml.rels')||'';
  const strings=[...(files.get('xl/sharedStrings.xml')||'').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)]
    .map(m=>innerText(m[1]));
  const materialsSheet=[...workbook.matchAll(/<sheet\b([^>]*)(?:\/>|>)/g)]
    .find(m=>canonical(attr(m[1],'name'))==='materiais');
  const relId=materialsSheet?attr(materialsSheet[1],'r:id'):'';
  let path='xl/worksheets/sheet1.xml';
  if(relId)for(const match of relationshipFile.matchAll(/<Relationship\b([^>]*)(?:\/>|>)/g))
    if(attr(match[1],'Id')===relId){
      const target=attr(match[1],'Target').replace(/^\//,'');
      path=target.startsWith('xl/')?target:'xl/'+target;
    }
  const xml=files.get(path);
  if(!xml)fail('STOCK_IMPORT_SHEET_MISSING');
  const all=excelRows(xml,strings);
  const header=all.find(r=>r.line<=12&&canonical(r.cells[0]||'')==='material'
    &&canonical(r.cells[1]||'')==='quantidade'&&canonical(r.cells[2]||'')==='unidade');
  if(!header)fail('STOCK_IMPORT_HEADERS_INVALID');
  for(let i=0;i<8;i++)if(canonical(header.cells[i]||'')!==canonical(STOCK_HEADERS[i]))
    fail('STOCK_IMPORT_HEADERS_INVALID');
  const result:BulkStockRow[]=[];
  for(const row of all.filter(r=>r.line>header.line)){
    const v=row.cells;
    if(v.every(x=>!x||!x.trim()))continue;
    const material=field(v[0],240),unit=field(v[2],80),
      quantity=Number(field(v[1],40).replace(',','.')),
      localType=field(v[5],80),localNumber=field(v[6],80);
    if(!material||!unit||!localType||!localNumber||!Number.isFinite(quantity)||
      quantity<=0||quantity>1e9||Math.abs(quantity-Math.round(quantity*1e6)/1e6)>1e-9)
      throw new StockImportError('STOCK_IMPORT_INVALID_ROW_'+row.line);
    let expiresOn:string|null;
    try{expiresOn=date(field(v[3],24));}
    catch{throw new StockImportError('STOCK_IMPORT_DATE_ROW_'+row.line);}
    result.push({line:row.line,material,quantity,unit,expiresOn,localType,localNumber,
      barcode:field(v[4],128)||null,subposition:field(v[7],80)||null,
      lot:field(v[8],80)||null,provenance:field(v[9],180)||null,
      reference:field(v[10],160)||null});
    if(result.length>STOCK_MAX_ROWS)fail('STOCK_IMPORT_TOO_MANY_ROWS');
  }
  if(!result.length)fail('STOCK_IMPORT_EMPTY');
  return result;
}
