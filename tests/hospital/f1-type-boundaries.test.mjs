/**
 * F1: each independently built hospital app owns its TypeScript project.
 * Keep the shared hospital modules typechecked with EMPROVEX at the repository root.
 * No Firebase credentials, network calls or patient data are used here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const root=fileURLToPath(new URL('../../',import.meta.url));
const configPath=path.join(root,'tsconfig.json');
const read=ts.readConfigFile(configPath,ts.sys.readFile);
if(read.error)throw Error(ts.flattenDiagnosticMessageText(read.error.messageText,'\n'));
const parsed=ts.parseJsonConfigFileContent(read.config,ts.sys,root,undefined,configPath);
const files=parsed.fileNames.map(file=>path.relative(root,file).split(path.sep).join('/'));

test('F1: the root TypeScript project does not compile independent hospital apps',()=>{
 assert.deepEqual(parsed.errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n')),[]);
 const leaks=files.filter(file=>file.startsWith('apps/hospital-web/')||file.startsWith('apps/hospital-api/'));
 assert.deepEqual(leaks,[], 'Root project must not pull separate app trees via include globs');
});

test('F1: root EMPROVEX and shared hospital features remain checked',()=>{
 assert.ok(files.some(file=>file.startsWith('app/')&&file.endsWith('.tsx')),'EMPROVEX Next app must remain in root program');
 assert.ok(files.includes('features/hospital/maps/MeusMapasView.tsx'),'Shared hospital features must remain typechecked');
});

test('F1: both extracted hospital apps have independent compilation configurations',()=>{
 for(const app of ['apps/hospital-web','apps/hospital-api']){
  assert.ok(ts.sys.fileExists(path.join(root,app,'tsconfig.json')),app+' tsconfig missing');
  assert.ok(ts.sys.fileExists(path.join(root,app,'package.json')),app+' package missing');
 }
});
