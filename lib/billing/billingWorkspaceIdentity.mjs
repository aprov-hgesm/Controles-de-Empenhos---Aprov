/** Pure helper for the billing page. */
export function isMatchingSession(uid, registeredUid) {
  return typeof uid === 'string' && uid.length > 0 && uid === registeredUid;
}
