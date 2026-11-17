import {getApp,getApps,initializeApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';

const projectId=import.meta.env.VITE_HOSPITAL_FIREBASE_PROJECT_ID||'cozinha-dietetica';
if(projectId!=='cozinha-dietetica')throw Error('Projeto Firebase hospitalar divergente.');
const apiKey=import.meta.env.VITE_HOSPITAL_FIREBASE_API_KEY;
const appId=import.meta.env.VITE_HOSPITAL_FIREBASE_APP_ID;
if(!apiKey||!appId)throw Error('Configure o app Web do Firebase Authentication hospitalar.');
const name='cozinha-dietetica-autonoma';
const app=getApps().some(a=>a.name===name)?getApp(name):initializeApp({
  projectId,apiKey,appId,authDomain:`${projectId}.firebaseapp.com`
},name);
export const auth=getAuth(app);
