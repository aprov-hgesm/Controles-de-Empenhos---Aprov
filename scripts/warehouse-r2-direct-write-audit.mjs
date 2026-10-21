#!/usr/bin/env node
/**
 * WAREHOUSE-SERVER-R2: evidência de cada ponto de escrita SDK do cliente.
 *
 * Modo padrão é AUDIT, informativo. Ao atingir zero, executar:
 *   WAREHOUSE_R2_STRICT=1 node scripts/warehouse-r2-direct-write-audit.mjs
 * e fixar em Application CI antes de alterar firestore.warehouse.rules.
 *
 * Não confundir este inventário estático com prova dinâmica; chamadas indiretas
 * e bibliotecas precisam de revisão independente antes de deploy.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots=[
  'lib/warehouse', 'features/warehouse',
  'app/central-depositos', 'components/warehouse',
];
const skips=/(?:\.test\.|\.spec\.|\.stories\.|__tests__|node_modules)/;
const patterns=[
  ['setDoc', /\bsetDoc\s*\(/g],
  ['updateDoc', /\bupdateDoc\s*\(/g],
  ['deleteDoc', /\bdeleteDoc\s*\(/g],
  ['addDoc', /\baddDoc\s*\(/g],
  ['runTransaction', /\brunTransaction\s*\(/g],
  ['writeBatch', /\bwriteBatch\s*\(/g],
  ['transaction.set', /\btransaction\s*\.\s*set\s*\(/g],
  ['transaction.update', /\btransaction\s*\.\s*update\s*\(/g],
  ['transaction.delete', /\btransaction\s*\.\s*delete\s*\(/g],
  ['batch.commit', /\bbatch\s*\.\s*commit\s*\(/g],
  ['batch.set', /\bbatch\s*\.\s*set\s*\(/g],
  ['batch.update', /\bbatch\s*\.\s*update\s*\(/g],
  ['batch.delete', /\bbatch\s*\.\s*delete\s*\(/g],
];
function scan(dir, files) {
  let entries=[];
  try{ entries=readdirSync(dir,{withFileTypes:true}); }catch{return;}
  for(const item of entries) {
    const full=join(dir,item.name);
    if(item.isDirectory()) scan(full,files);
    else if(/\.[jt]sx?$/.test(item.name)&&!skips.test(full)) files.push(full);
  }
}
const files=[];
roots.forEach(x=>scan(x,files));
const hits=[];
for(const file of files) {
  const txt=readFileSync(file,'utf8');
  const lines=txt.split(/\r?\n/);
  for(let i=0;i<lines.length;i++) {
    const line=lines[i];
    // Evita importar ou comentar como operação. É uma aproximação conservadora:
    // revisões humanas devem confirmar falsos positivos/negativos.
    const candidate=line.trim();
    if(candidate.startsWith('//')||candidate.startsWith('*')
      ||candidate.startsWith('import ')||candidate.startsWith('from ')) continue;
    for(const [name,regex] of patterns) {
      regex.lastIndex=0;
      if(regex.test(candidate)) hits.push({
        file:relative('.',file).replaceAll('\\','/'),
        line:i+1,operation:name,
      });
    }
  }
}
hits.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line);
for(const h of hits) console.log(`${h.file}:${h.line} ${h.operation}`);
console.log('WAREHOUSE_R2_DIRECT_SDK_WRITE_SITES='+hits.length);
console.log('WAREHOUSE_R2_AUDIT_MODE='+(
  process.env.WAREHOUSE_R2_STRICT==='1'?'STRICT':'REPORT'
));
if(hits.length>0 && process.env.WAREHOUSE_R2_STRICT==='1') {
  console.error('BLOCKER: existem gravações diretas antes do corte read-only');
  process.exitCode=1;
}
