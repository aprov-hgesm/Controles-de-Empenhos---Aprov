/**
 * ADMIN-NEIGHBORHOOD-R1 — presentation-only, deterministic model.
 * Reads only data already present in the administrative view.
 * "Online" means a non-expired monitored session, not live human interaction.
 */
export const NEIGHBORHOOD_BLOCK_SIZE = 9;

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

/** Prefer the registered OM abbreviation. Never guess a short name from an e-mail. */
export function neighborhoodSectorLabel(workspace, account) {
  if (account?.accountType === 'platformAdmin') return 'Admin EMPROVEX';
  const shortName = String(workspace?.institutionalProfile?.organizationShortName || '').trim();
  if (shortName) return 'Aprov ' + shortName.replace(/^aprov(?:isionamento)?\s*[-·:]?\s*/i, '');
  const ug = String(workspace?.ug || account?.ug || '').trim();
  return ug ? 'Aprov UG ' + ug : 'Aprov · OM não informada';
}

export function buildNeighborhoodResidents(accounts = [], sessions = [], options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const sessionsAvailable = options.sessionsAvailable === true;
  const latestSessions = new Map();
  // Directory workspaces are already loaded by PlatformAdminView; no new reads.
  const workspaces = Array.isArray(options.workspaces) ? options.workspaces : [];
  const byWorkspaceId = new Map(workspaces.filter(w => w?.id).map(w => [w.id, w]));
  const byAuthorizedEmail = new Map(workspaces.filter(w => w?.authorizedEmail)
    .map(w => [normalizeEmail(w.authorizedEmail), w]));

  if (sessionsAvailable) {
    for (const session of sessions) {
      const expiration = Date.parse(session.expiresAt || '');
      if (!Number.isFinite(expiration) || expiration <= now) continue;
      const candidateKeys = [
        session.uid ? 'uid:' + session.uid : null,
        session.accountEmail ? 'mail:' + normalizeEmail(session.accountEmail) : null,
      ].filter(Boolean);
      for (const key of candidateKeys) {
        const previous = latestSessions.get(key);
        if (!previous || String(previous.lastSeenAt || '') < String(session.lastSeenAt || '')) {
          latestSessions.set(key, session);
        }
      }
    }
  }

  const distinct = new Map();
  for (const account of accounts) {
    const email = normalizeEmail(account?.email);
    if (!email || distinct.has(email)) continue;
    const session = sessionsAvailable
      ? account.firebaseUid
        ? latestSessions.get('uid:' + account.firebaseUid)
        : latestSessions.get('mail:' + email)
      : null;
    const disabled = account.status === 'disabled';
    const workspace = byWorkspaceId.get(account.workspaceId)
      || (!account.workspaceId ? byAuthorizedEmail.get(email) : null);
    const profile = workspace?.institutionalProfile;
    distinct.set(email, {
      id: email,
      label: neighborhoodSectorLabel(workspace, account),
      email,
      workspaceId: account.workspaceId || workspace?.id || null,
      ug: workspace?.ug || account.ug || null,
      workspaceName: workspace?.name || null,
      workspaceStatus: workspace?.status || null,
      organizationName: profile?.organizationName || null,
      organizationShortName: profile?.organizationShortName || null,
      sectionName: profile?.sectionName || null,
      defaultDeliveryLocation: profile?.defaultDeliveryLocation || null,
      kind: account.accountType === 'platformAdmin' ? 'admin' : 'sector',
      disabled,
      presence: !sessionsAvailable ? 'unknown' : disabled ? 'disabled' : session ? 'online' : 'offline',
      lastSeenAt: session?.lastSeenAt || account.lastLoginAt || null,
    });
  }
  return [...distinct.values()].sort((a, b) =>
    (a.kind === 'admin' ? -1 : 1) - (b.kind === 'admin' ? -1 : 1)
    || a.email.localeCompare(b.email)
  );
}


/**
 * A single canonical founder occupies the central tower; never duplicate it
 * in a secondary lot or manufacture an extra account during loading.
 */
export function partitionNeighborhoodResidents(residents, founderEmail) {
  const normalizedFounder = normalizeEmail(founderEmail);
  const founder = residents.find((resident) => resident.email === normalizedFounder) || null;
  return {
    founder,
    neighborhood: residents.filter((resident) => resident.email !== normalizedFounder),
  };
}

export function neighborhoodQuota(snapshot) {
  const amount = snapshot?.billableReadUnits;
  const reference = snapshot?.billingReference?.readUnitsDailyLimit;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0
    || typeof reference !== 'number' || !Number.isFinite(reference) || reference <= 0) {
    return { known: false, percentage: null, waterLevel: 0, exceeded: false };
  }
  const percentage = amount / reference * 100;
  return {
    known: true,
    percentage,
    waterLevel: Math.max(0, Math.min(1, percentage / 100)),
    exceeded: percentage > 100,
  };
}

export function neighborhoodPages(residents, page, size = NEIGHBORHOOD_BLOCK_SIZE) {
  const pageCount = Math.max(1, Math.ceil(residents.length / size));
  const currentPage = Math.max(0, Math.min(pageCount - 1, Math.trunc(page)));
  return {
    page: currentPage,
    pageCount,
    displayed: residents.slice(currentPage * size, (currentPage + 1) * size),
  };
}
