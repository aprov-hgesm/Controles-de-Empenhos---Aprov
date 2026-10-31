/**
 * Fail-closed experimental gate. NODE_ENV=production is shared by preview builds.
 * Cloud Run deliberately remains disabled until its non-production deployment
 * identity is explicitly certified. K_SERVICE alone never implies staging.
 */
export function aiExperimentalEnabled(env:NodeJS.ProcessEnv=process.env):boolean {
 if(env.EMPROVEX_AI_W45_ENABLED!=='1')return false;
 const vercel=env.VERCEL==='1'||env.VERCEL_ENV!==undefined;
 const cloudRun=Boolean(env.K_SERVICE||env.K_REVISION||env.K_CONFIGURATION);
 if(vercel&&cloudRun)return false;
 if(vercel)return env.VERCEL==='1'&&env.VERCEL_ENV==='preview';
 if(cloudRun)return false;
 return false;
}
