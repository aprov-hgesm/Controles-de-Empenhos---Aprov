/**
 * W4 migration safety interlock. Cloud Run cannot start from an uncertified
 * source/build (including an accidental deployment of the Vercel artifact).
 * Remove this lock only in a separately authorized, tested release after R04,
 * R01/R02 and the two isolated Firestore databases are certified remotely.
 * No effect on the current Vercel deployment or local development.
 */
export async function register() {
  if (process.env.K_SERVICE) {
    throw new Error('CLOUD_RUN_RUNTIME_NOT_CERTIFIED_R01_R02_R04');
  }
}
