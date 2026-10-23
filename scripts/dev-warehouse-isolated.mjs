#!/usr/bin/env node
/**
 * Prévia INTERATIVA do Controle de Depósitos, 100% isolada da produção.
 * - Projeto Firebase demo-emprovex-security
 * - Auth + Firestore padrão em 9099/8080 (identidades/escopos de teste)
 * - Warehouse Firestore em 8081 (Rules server-only)
 * - Next.js em http://127.0.0.1:3100
 * - Nenhuma credencial administrativa real, nenhum deploy, nenhuma .env.local
 * Dados fictícios são descartados quando o Emulator encerra.
 */
import { spawn, spawnSync } from 'node:child_process';
import { connect } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const WIN = process.platform === 'win32';
const PROJECT = 'demo-emprovex-security';
const root = process.cwd();
const owned = [];
let stopping = false;

function isBusy(port) {
  return new Promise(resolve => {
    const sock = connect({ host:'127.0.0.1', port });
    const finish = result => { sock.destroy(); resolve(result); };
    sock.setTimeout(700, () => finish(false));
    sock.once('connect', () => finish(true));
    sock.once('error', () => finish(false));
  });
}
function spawnOwned(command, args, env=process.env) {
  const child = spawn(command, args, {
    cwd:root, env, stdio:'inherit',
    shell: WIN && /\.cmd$/i.test(command),
    windowsHide:false,
    detached:!WIN,
  });
  owned.push(child);
  child.on('error', error => console.error('[local seguro] Processo falhou:',error.message));
  return child;
}
async function waitFor(url, child, label) {
  for (let attempt=0;attempt<160;attempt++) {
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error(label+' encerrou antes de iniciar.');
    try {
      const response = await fetch(url,{signal:AbortSignal.timeout(1300)});
      if (response.status < 500) return;
    } catch { /* Emulator ou Next ainda inicializando */ }
    await delay(700);
  }
  throw new Error(label+' não respondeu no endereço local esperado.');
}
async function runSeed(name, env) {
  console.log('[isolado] Preparando dados fictícios:',name);
  const child=spawnOwned(process.execPath,[name],env);
  const exit=await new Promise((resolve,reject)=>{
    child.once('error',reject);
    child.once('exit',code=>resolve(code));
  });
  if (exit!==0) throw new Error('Falha na preparação: '+name+' (exit '+exit+')');
}
function stopAll() {
  if (stopping) return;
  stopping=true;
  for (const child of [...owned].reverse()) {
    if (!child.pid || child.exitCode!==null) continue;
    if (WIN) {
      // Encerra apenas o processo e filhos iniciados por este runner.
      spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'});
    } else {
      try{process.kill(-child.pid,'SIGTERM');}
      catch{try{child.kill('SIGTERM');}catch{}}
    }
  }
}
process.on('SIGINT',()=>{stopAll();process.exit(0);});
process.on('SIGTERM',()=>{stopAll();process.exit(0);});

const demoEnv={
  ...process.env,
  NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS:'1',
  NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID:PROJECT,
  NEXT_PUBLIC_EMPROVEX_E2E_WAREHOUSE_FIRESTORE_PORT:'8081',
  FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',
  EMPROVEX_E2E_SERVER_AUTH:'1',
  EMPROVEX_WAREHOUSE_ADMIN_EMULATOR:'1',
  EMPROVEX_E2E_WAREHOUSE_FIRESTORE_PORT:'8081',
  NEXT_TELEMETRY_DISABLED:'1',
};
// Em modo demo estas variáveis não devem jamais apontar a credenciais ou
// identificação de um projeto real, mesmo que existam na máquina.
delete demoEnv.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
delete demoEnv.GOOGLE_APPLICATION_CREDENTIALS;

try{
  for(const port of [8080,8081,9099,3100]){
    if(await isBusy(port)) throw new Error('Porta '+port+' já está ocupada. '
      +'Feche outro servidor/emulador local antes de usar a prévia segura.');
  }
  console.log('EMPROVEX — PRÉVIA SEGURA: PROJETO FICTÍCIO '+PROJECT);
  console.log('Nunca use contas reais nesta prévia.');
  const npx=WIN?'npx.cmd':'npx';
  const primary=spawnOwned(npx,[
    '--yes','firebase-tools','emulators:start',
    '--config','firebase.security-test.json','--project',PROJECT,
    '--only','auth,firestore',
  ],demoEnv);
  await waitFor('http://127.0.0.1:9099/',primary,'Auth Emulator');
  await waitFor('http://127.0.0.1:8080/',primary,'Firestore Emulator principal');
  await runSeed('scripts/firestore-multitenancy-security.test.mjs',demoEnv);

  const secondaryEnv={...demoEnv};
  delete secondaryEnv.FIRESTORE_EMULATOR_HOST;
  const warehouse=spawnOwned(npx,[
    '--yes','firebase-tools','emulators:start',
    '--config','firebase.warehouse-server-only-browser-test.json',
    '--project',PROJECT,'--only','firestore',
  ],secondaryEnv);
  await waitFor('http://127.0.0.1:8081/',warehouse,'Warehouse Emulator');
  await runSeed('scripts/warehouse-e2e-fixture.mjs',demoEnv);

  const server=spawnOwned(process.execPath,[
    'node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3100',
  ],demoEnv);
  await waitFor('http://127.0.0.1:3100/',server,'Next.js');
  console.log('\n========================================================');
  console.log('  PRÉVIA OPERACIONAL SEGURA PRONTA');
  console.log('  http://127.0.0.1:3100/central-depositos/controle-de-depositos');
  console.log('  Projeto demo: '+PROJECT+' — nenhum dado da produção');
  console.log('  Use o login Google simulado (HGeSM) da página inicial.');
  console.log('  Ctrl+C encerra este ambiente; dados temporários são perdidos.');
  console.log('========================================================\n');
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.once('exit',code=>code===0?resolve():reject(new Error('Next terminou com código '+code)));
  });
}catch(error){
  console.error('[prévia segura] '+(error instanceof Error?error.message:String(error)));
  process.exitCode=1;
}finally{stopAll();}
