import { test, expect } from '@playwright/test';

const PASSWORD = ['Emprovex', 'Teste!2026'].join('-');
const OPERATOR = ['sector-lifecycle', 'example.test'].join('@');
const FOUNDER = ['aprov1hgesm', 'gmail.com'].join('@');
const WORKSPACE_ID = 'workspace-lifecycle';
const UG = '160416';
const PROJECT_ID = 'demo-emprovex-security';
const FIRESTORE_BASE =
  `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const EMULATOR_ADMIN_HEADER = ['Bearer', 'owner'].join(' ');

function encodeValue(value) {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: encodeFields(value) } };
  }
  throw new Error(`Tipo Firestore não suportado no E2E: ${typeof value}`);
}

function encodeFields(record) {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, encodeValue(value)])
  );
}

function decodeValue(value) {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(decodeValue);
  }
  if ('mapValue' in value) {
    return decodeFields(value.mapValue.fields || {});
  }
  return undefined;
}

function decodeFields(fields) {
  return Object.fromEntries(
    Object.entries(fields || {}).map(([key, value]) => [key, decodeValue(value)])
  );
}

function documentUrl(path) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${FIRESTORE_BASE}/${encoded}`;
}

async function emulatorGet(path) {
  const response = await fetch(documentUrl(path), {
    headers: { Authorization: EMULATOR_ADMIN_HEADER },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Firestore GET falhou em ${path}: ${response.status} ${await response.text()}`);
  }
  const payload = await response.json();
  return decodeFields(payload.fields || {});
}

async function emulatorSet(path, data) {
  const response = await fetch(documentUrl(path), {
    method: 'PATCH',
    headers: {
      Authorization: EMULATOR_ADMIN_HEADER,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
  if (!response.ok) {
    throw new Error(`Firestore PATCH falhou em ${path}: ${response.status} ${await response.text()}`);
  }
}

async function emulatorDelete(path) {
  const response = await fetch(documentUrl(path), {
    method: 'DELETE',
    headers: { Authorization: EMULATOR_ADMIN_HEADER },
  });
  if (response.status !== 404 && !response.ok) {
    throw new Error(`Firestore DELETE falhou em ${path}: ${response.status} ${await response.text()}`);
  }
}

function slotPath(slotId) {
  return `workspaces/${WORKSPACE_ID}/sessionSlots/${slotId}`;
}

function revocationPath(sessionId) {
  return `workspaces/${WORKSPACE_ID}/sessionRevocations/${sessionId}`;
}

async function clearSlots() {
  await Promise.all([
    emulatorDelete(slotPath('slot-1')),
    emulatorDelete(slotPath('slot-2')),
  ]);
}

async function workspaceSessions() {
  const [slot1, slot2] = await Promise.all([
    emulatorGet(slotPath('slot-1')),
    emulatorGet(slotPath('slot-2')),
  ]);
  return [
    slot1 ? { slotId: 'slot-1', ...slot1 } : null,
    slot2 ? { slotId: 'slot-2', ...slot2 } : null,
  ].filter(Boolean);
}

async function loginSector(page) {
  await page.getByTestId('sector-login-email').fill(OPERATOR);
  await page.getByTestId('sector-login-password').fill(PASSWORD);
  await page.getByTestId('sector-login-submit').click();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible({
    timeout: 20_000,
  });
}

async function prepareLogin(page) {
  await page.goto('/');
  await page.getByTestId('sector-login-email').fill(OPERATOR);
  await page.getByTestId('sector-login-password').fill(PASSWORD);
}

async function logoutIfAuthenticated(page) {
  const logout = page.getByTestId('logout');
  if (await logout.isVisible().catch(() => false)) {
    await logout.click();
    await expect(page.getByTestId('sector-login-email')).toBeVisible({
      timeout: 15_000,
    });
  }
}

async function sessionTabRole(page) {
  return page.evaluate(() => {
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith('emprovex:session-tab-role:v1:')) {
        return sessionStorage.getItem(key);
      }
    }
    return null;
  });
}

function leaseSeed({
  slotId,
  sessionId,
  expiresAt,
  uid = 'expired-e2e-uid',
  browserInstanceId = 'expired-e2e-browser',
}) {
  const now = Date.now();
  return {
    leaseVersion: 'emprovex_session_v1',
    slotId,
    sessionId,
    workspaceId: WORKSPACE_ID,
    ug: UG,
    uid,
    accountEmail: OPERATOR,
    browserInstanceId,
    startedAt: new Date(now - 30 * 60 * 1000),
    lastSeenAt: new Date(now - 20 * 60 * 1000),
    expiresAt,
  };
}

test.describe.serial('Bloco 16.8 — E2E integrado de capacidade e revogação', () => {
  test.beforeEach(async () => {
    await clearSlots();
  });

  test.afterEach(async () => {
    await clearSlots();
  });

  test('heartbeat eficiente renova lease de 30 minutos sem redescobrir capacidade', async ({ page }) => {
    await page.goto('/');
    await loginSector(page);

    const [session] = await workspaceSessions();
    expect(session).toBeTruthy();
    expect(session.workspaceId).toBe(WORKSPACE_ID);
    expect(session.ug).toBe(UG);

    const initialExpiry = Date.parse(session.expiresAt);
    const initialLastSeen = Date.parse(session.lastSeenAt);
    expect(initialExpiry - initialLastSeen).toBeGreaterThan(29 * 60 * 1000);
    expect(initialExpiry - initialLastSeen).toBeLessThanOrEqual(30 * 60 * 1000 + 15_000);

    await page.evaluate(({ workspaceId, uid }) => {
      const key = `emprovex:workspace-lease-renewed:v1:${workspaceId}:${uid}`;
      localStorage.setItem(key, String(Date.now() - (16 * 60 * 1000)));
      window.dispatchEvent(new Event('online'));
    }, { workspaceId: WORKSPACE_ID, uid: session.uid });

    await expect.poll(async () => {
      const current = await emulatorGet(slotPath(session.slotId));
      return current ? Date.parse(current.expiresAt) : 0;
    }, {
      timeout: 15_000,
      intervals: [250, 500, 1000],
    }).toBeGreaterThan(initialExpiry);

    await expect.poll(async () => page.evaluate((workspaceId) => {
      for (let index = 0; index < sessionStorage.length; index += 1) {
        const key = sessionStorage.key(index);
        if (key?.startsWith(`emprovex:usage:v1:${workspaceId}:`)) {
          return Boolean(sessionStorage.getItem(key));
        }
      }
      return false;
    }, WORKSPACE_ID), {
      timeout: 10_000,
      intervals: [200, 500],
    }).toBe(true);

    const buffered = await page.evaluate((workspaceId) => {
      for (let index = 0; index < sessionStorage.length; index += 1) {
        const key = sessionStorage.key(index);
        if (key?.startsWith(`emprovex:usage:v1:${workspaceId}:`)) {
          return JSON.parse(sessionStorage.getItem(key) || '{}');
        }
      }
      return null;
    }, WORKSPACE_ID);

    expect(buffered.workspaceId).toBe(WORKSPACE_ID);
    expect(buffered.ug).toBe(UG);
    expect(buffered.estimatedDocumentReads).toBeGreaterThan(0);
    expect(buffered.estimatedDocumentWrites).toBeGreaterThan(0);

    await logoutIfAuthenticated(page);
  });

  test('slot expirado pode ser retomado por uma nova identidade de sessão', async ({ page }) => {
    await emulatorSet(slotPath('slot-1'), leaseSeed({
      slotId: 'slot-1',
      sessionId: 'expired-block-16-8',
      expiresAt: new Date(Date.now() - 60_000),
    }));

    await page.goto('/');
    await loginSector(page);

    const reclaimed = await emulatorGet(slotPath('slot-1'));
    expect(reclaimed).toBeTruthy();
    expect(reclaimed.sessionId).not.toBe('expired-block-16-8');
    expect(reclaimed.workspaceId).toBe(WORKSPACE_ID);
    expect(reclaimed.ug).toBe(UG);
    expect(Date.parse(reclaimed.expiresAt)).toBeGreaterThan(Date.now());

    await logoutIfAuthenticated(page);
  });

  test('duas tentativas concorrentes disputando o último slot produzem exatamente um vencedor', async ({ browser }) => {
    await emulatorSet(slotPath('slot-1'), leaseSeed({
      slotId: 'slot-1',
      sessionId: 'occupied-last-slot-race',
      uid: 'occupied-last-slot-uid',
      browserInstanceId: 'occupied-last-slot-browser',
      expiresAt: new Date(Date.now() + 20 * 60 * 1000),
    }));

    const contextB = await browser.newContext();
    const contextC = await browser.newContext();
    const pageB = await contextB.newPage();
    const pageC = await contextC.newPage();

    try {
      await Promise.all([prepareLogin(pageB), prepareLogin(pageC)]);
      await Promise.all([
        pageB.getByTestId('sector-login-submit').click(),
        pageC.getByTestId('sector-login-submit').click(),
      ]);

      const state = async (page) => {
        if (await page.getByRole('navigation', { name: 'Navegação principal' }).isVisible().catch(() => false)) {
          return 'inside';
        }
        if (await page.getByText('Limite de acessos simultâneos atingido.', { exact: false }).isVisible().catch(() => false)) {
          return 'blocked';
        }
        return 'pending';
      };

      await expect.poll(async () => {
        const states = [await state(pageB), await state(pageC)].sort();
        return states.join(',');
      }, {
        timeout: 20_000,
        intervals: [200, 400, 800],
      }).toBe('blocked,inside');

      const sessions = await workspaceSessions();
      expect(sessions).toHaveLength(2);
      expect(new Set(sessions.map((item) => item.sessionId)).size).toBe(2);
      expect(sessions.some((item) => item.sessionId === 'occupied-last-slot-race')).toBe(true);
    } finally {
      await contextC.close();
      await contextB.close();
    }
  });

  test('revogação administrativa derruba líder e follower, tombstone bloqueia retorno e novo login cria nova identidade', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    let sibling = null;
    let oldSessionId = null;

    try {
      await page.goto('/');
      await loginSector(page);

      sibling = await context.newPage();
      await sibling.goto('/');
      await expect(sibling.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible({
        timeout: 20_000,
      });

      await expect.poll(async () => {
        const roles = [await sessionTabRole(page), await sessionTabRole(sibling)].sort();
        return roles.join(',');
      }, {
        timeout: 15_000,
        intervals: [100, 250, 500],
      }).toBe('follower,leader');

      const [session] = await workspaceSessions();
      expect(session).toBeTruthy();
      oldSessionId = session.sessionId;
      const oldSessionKey =
        `emprovex:workspace-session:v1:${WORKSPACE_ID}:${session.uid}`;

      await emulatorSet(revocationPath(oldSessionId), {
        revocationVersion: 'emprovex_session_revocation_v1',
        sessionId: oldSessionId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        uid: session.uid,
        accountEmail: OPERATOR,
        slotId: session.slotId,
        createdAt: new Date(),
        createdBy: FOUNDER,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      await emulatorDelete(slotPath(session.slotId));

      await expect(page.getByTestId('sector-login-email')).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        page.getByRole('navigation', { name: 'Navegação principal' })
      ).toHaveCount(0);
      await expect(sibling.getByTestId('sector-login-email')).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        sibling.getByRole('navigation', { name: 'Navegação principal' })
      ).toHaveCount(0);
      await sibling.close();
      sibling = null;

      await page.evaluate(({ key, sessionId }) => {
        localStorage.setItem(key, sessionId);
      }, { key: oldSessionKey, sessionId: oldSessionId });

      await page.getByTestId('sector-login-email').fill(OPERATOR);
      await page.getByTestId('sector-login-password').fill(PASSWORD);
      await page.getByTestId('sector-login-submit').click();

      await expect(
        page.getByText('Esta sessão foi encerrada pela administração. Faça login novamente.', {
          exact: false,
        })
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('sector-login-email')).toBeVisible();

      expect(await page.evaluate((key) => localStorage.getItem(key), oldSessionKey)).toBeNull();

      await page.getByTestId('sector-login-email').fill(OPERATOR);
      await page.getByTestId('sector-login-password').fill(PASSWORD);
      await page.getByTestId('sector-login-submit').click();
      await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible({
        timeout: 20_000,
      });

      const [newSession] = await workspaceSessions();
      expect(newSession).toBeTruthy();
      expect(newSession.sessionId).not.toBe(oldSessionId);
      expect(await emulatorGet(revocationPath(oldSessionId))).toBeTruthy();

      await logoutIfAuthenticated(page);
    } finally {
      if (sibling && !sibling.isClosed()) await sibling.close();
      await context.close();
      if (oldSessionId) await emulatorDelete(revocationPath(oldSessionId));
    }
  });
});
