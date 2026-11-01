/** Fail closed: only Vercel previews and the explicitly named private
 * Cloud Run W6 homologation SERVICE may expose experimental AI routes.
 * K_SERVICE or NODE_ENV=production alone never authorize staging.
 */
const W6_CANDIDATE_SERVICE='emprovex-ai-w6-homologation';
export function aiExperimentalEnabled(env:NodeJS.ProcessEnv=process.env):boolean {
 if(env.EMPROVEX_AI_W45_ENABLED!=='1')return false;
 const vercel=env.VERCEL==='1'||env.VERCEL_ENV!==undefined;
 const cloudRun=Boolean(env.K_SERVICE||env.K_REVISION||env.K_CONFIGURATION);
 if(vercel&&cloudRun)return false;
 if(vercel)return env.VERCEL==='1'&&env.VERCEL_ENV==='preview';
 if(!cloudRun)return false;
 return env.EMPROVEX_AI_HOMOLOGATION_ENABLED==='1'&&
   env.K_SERVICE===W6_CANDIDATE_SERVICE&&
   env.K_CONFIGURATION===W6_CANDIDATE_SERVICE&&
   typeof env.K_REVISION==='string'&&
   env.K_REVISION.startsWith(W6_CANDIDATE_SERVICE+'-');
}
export function aiLfm3Enabled(env:NodeJS.ProcessEnv=process.env):boolean {
 return aiExperimentalEnabled(env)&&env.K_SERVICE===W6_CANDIDATE_SERVICE&&
   env.EMPROVEX_AI_LFM3_ENABLED==='1';
}

/** W7 requires an additional explicit opt-in; W6 being enabled is not consent for open chat. */
export function aiConversationalModelEnabled(env:NodeJS.ProcessEnv=process.env):boolean {
 return aiLfm3Enabled(env)&&env.EMPROVEX_AI_W7_GENERATIVE_ENABLED==='1';
}
