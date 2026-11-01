/** Fail closed AI environment gates.
 * W6 test service remains isolated. Production requires explicit pilot opt-in,
 * an exact Cloud Run service identity, and a second per-user founder guard.
 * Neither a Vercel deployment nor NODE_ENV grants access.
 */
const W6_CANDIDATE_SERVICE='emprovex-ai-w6-homologation';
const PILOT_SERVICE='emprovex-cloudrun-candidate';

function onExactService(env:NodeJS.ProcessEnv,name:string):boolean {
 return env.K_SERVICE===name && env.K_CONFIGURATION===name &&
   typeof env.K_REVISION==='string'&&env.K_REVISION.startsWith(name+'-') &&
   env.VERCEL!=='1'&&env.VERCEL_ENV===undefined;
}

/** Disabled by default. Does NOT authorize a user by itself.
 * Caller must additionally verify the founder identity before any read.
 */
export function aiProductionPilotEnabled(env:NodeJS.ProcessEnv=process.env):boolean {
 return env.EMPROVEX_AI_W45_ENABLED==='1' &&
   env.EMPROVEX_AI_PRODUCTION_PILOT_ENABLED==='1' &&
   onExactService(env,PILOT_SERVICE);
}
export function aiExperimentalEnabled(env:NodeJS.ProcessEnv=process.env):boolean {
 if(env.EMPROVEX_AI_W45_ENABLED!=='1')return false;
 const vercel=env.VERCEL==='1'||env.VERCEL_ENV!==undefined;
 const cloudRun=Boolean(env.K_SERVICE||env.K_REVISION||env.K_CONFIGURATION);
 if(vercel&&cloudRun)return false;
 if(vercel)return env.VERCEL==='1'&&env.VERCEL_ENV==='preview';
 if(!cloudRun)return false;
 if(aiProductionPilotEnabled(env))return true;
 return env.EMPROVEX_AI_HOMOLOGATION_ENABLED==='1' &&
   onExactService(env,W6_CANDIDATE_SERVICE);
}
export function aiLfm3Enabled(env:NodeJS.ProcessEnv=process.env):boolean {
 return aiExperimentalEnabled(env)&&
   (onExactService(env,W6_CANDIDATE_SERVICE)||aiProductionPilotEnabled(env))&&
   env.EMPROVEX_AI_LFM3_ENABLED==='1';
}

/** W7 creative responses are additional opt-in; inherit W6 private IAM
 * and exact Cloud Run founder-only pilot gates without widening access.
 */
export function aiConversationalModelEnabled(env:NodeJS.ProcessEnv=process.env):boolean {
 return aiLfm3Enabled(env)&&env.EMPROVEX_AI_W7_GENERATIVE_ENABLED==='1';
}
