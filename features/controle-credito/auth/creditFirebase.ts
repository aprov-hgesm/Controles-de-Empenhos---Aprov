import { getApps, initializeApp } from 'firebase/app';
import { browserSessionPersistence, browserPopupRedirectResolver, initializeAuth, getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import config from '@/firebase-applet-config.json';

// Named app + per-tab persistence: never mutate the operational/default Auth session.
const name='emprovex-credit-control';
const emulated=process.env.NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS==='1';
const project=process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID?.trim();
const existing=getApps().find(app=>app.name===name);
const app=existing??initializeApp(emulated&&project?{...config,projectId:project,authDomain:project+'.firebaseapp.com'}:config,name);
export const creditAuth=existing?getAuth(app):initializeAuth(app,{persistence:browserSessionPersistence,popupRedirectResolver:browserPopupRedirectResolver});
if(!existing&&emulated)connectAuthEmulator(creditAuth,'http://127.0.0.1:9099',{disableWarnings:true});
export const creditGoogleProvider=new GoogleAuthProvider();
creditGoogleProvider.setCustomParameters({prompt:'select_account'});
