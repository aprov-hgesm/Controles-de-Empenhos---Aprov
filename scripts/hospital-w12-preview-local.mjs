#!/usr/bin/env node
// One-command, synthetic W12 UI preview. Does NOT use real Firebase/GCP or Cloud Run.
import {spawn,spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {connect} from 'node:net';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const demoProject='demo-cozinha-dietetica';
const isWindows=process.platform==='win32';
const timeoutMs=150000;
let emulator=null,server=null,stopping=false;
process.chdir(root);

if(existsSync(join(root,'.env.production.local'))){
  console.error('PREVIEW_LOCAL_BLOQUEADO: .env.production.local neste clone.');
  process.exit(1);
}
if(!existsSync(join(root,'node_modules','next','dist','bin','next'))){
  console.error('Dependencias ausentes: execute npm.cmd ci antes da previa.');
  process.exit(1);
}
const java=spawnSync('java',['-version'],{encoding:'utf8'});
if(java.error||java.status!==0){
  console.error('Firestore Emulator requer Java instalado. Verifique: java -version (preferencialmente Java 21).');
  process.exit(1);
}

const env={
  ...process.env,
  NODE_ENV:'development',
  GOOGLE_APPLICATION_CREDENTIALS:'',
  FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON:'',
  GOOGLE_CLOUD_PROJECT:demoProject,
  GCLOUD_PROJECT:demoProject,
  FIREBASE_PROJECT_ID:demoProject,
  HOSPITAL_GCP_QA_ENABLED:'0',
  HOSPITAL_GCP_QA_PRIVATE:'0',
  HOSPITAL_FIRESTORE_QA_ENABLED:'1',
  FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',
  HOSPITAL_QA_ORGANIZATION_ID:'qa_hgesm_preview',
  HOSPITAL_QA_APP_READY:'1',
  NEXT_PUBLIC_HOSPITAL_AUTH_EMULATOR:'1',
  NEXT_PUBLIC_HOSPITAL_FIREBASE_PROJECT_ID:demoProject,
  NEXT_PUBLIC_HOSPITAL_FIREBASE_API_KEY:'preview-local-key',
  NEXT_PUBLIC_HOSPITAL_FIREBASE_APP_ID:'1:1234567890:web:previewlocaldemo'
};
delete env.HOSPITAL_FIRESTORE_SERVICE_ACCOUNT_EMAIL;

function portOpen(port){
  return new Promise(resolve=>{
    const sock=connect({host:'127.0.0.1',port});
    const done=value=>{sock.destroy();resolve(value)};
    sock.once('connect',()=>done(true));
    sock.once('error',()=>done(false));
    sock.setTimeout(1200,()=>done(false));
  });
}
async function waitPorts(){
  const began=Date.now();
  while(Date.now()-began<timeoutMs&&!stopping){
    if(emulator?.exitCode!==null||emulator?.signalCode){
      throw Error('Emuladores finalizaram antes de iniciar. Confira os logs/versao do Java.');
    }
    if(await portOpen(8080)&&await portOpen(9099))return;
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  throw Error('Emuladores nao iniciaram dentro do prazo: verifique Java e portas 8080/9099.');
}
function start(command,args,envValues){
  return spawn(command,args,{cwd:root,env:envValues,stdio:'inherit',windowsHide:false});
}
function runAndWait(file,args){
  return new Promise((resolve,reject)=>{
    const child=start(process.execPath,[file,...args],env);
    child.once('error',reject);
    child.once('exit',(code,signal)=>code===0?resolve():reject(Error('Preparacao da previa falhou: '+(code??signal))));
  });
}
function stop(){
  if(stopping)return;
  stopping=true;
  if(server&&!server.killed)server.kill();
  if(emulator&&!emulator.killed)emulator.kill();
}
process.once('SIGINT',()=>{stop();process.exitCode=0});
process.once('SIGTERM',()=>{stop();process.exitCode=0});
async function main(){
  for(const port of [8080,9099,3100]){
    if(await portOpen(port))throw Error('Porta local '+port+' ocupada. Feche o processo que a utiliza.');
  }
  console.log('=== EMPROVEX COZINHA DIETETICA: PREVIA LOCAL ISOLADA ===');
  console.log('Firebase projetado SOMENTE para '+demoProject+' (Auth+Firestore Emulator).');
  const tool='npx.cmd --yes firebase-tools emulators:start --project '+demoProject+
    ' --config firebase.hospital-w10-test.json --only auth,firestore';
  emulator=isWindows
    ?start('cmd.exe',['/d','/s','/c',tool],env)
    :start('npx',['--yes','firebase-tools','emulators:start','--project',demoProject,
      '--config','firebase.hospital-w10-test.json','--only','auth,firestore'],env);
  emulator.once('error',error=>console.error('Falha ao iniciar emulador:',error.message));
  await waitPorts();
  await runAndWait(join(root,'scripts','hospital-w12-preview-seed.mjs'),[]);
  console.log('\nAbra: http://127.0.0.1:3100/cozinha-dietetica');
  console.log('Use os logins de teste exibidos acima. Para sair, pressione Ctrl+C.\n');
  server=start(process.execPath,[join(root,'node_modules','next','dist','bin','next'),
    'dev','--hostname','127.0.0.1','--port','3100'],env);
  server.once('error',error=>console.error('Falha no Next.js:',error.message));
  server.once('exit',(code)=>{stop();process.exitCode=code??0});
}
main().catch(error=>{console.error('PREVIEW_LOCAL_ERROR:',error.message);stop();process.exitCode=1});
