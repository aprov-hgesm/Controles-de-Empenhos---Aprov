import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import test from "node:test";
import { dirname, resolve, join, delimiter } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = resolve(root, "scripts/firestore-recovery.mjs");
const expectedProject = "gen-lang-client-0982077967";
const mainDatabase =
  "ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1";
const warehouseDatabase = "emprovex-warehouse";

function run(args, envOverride = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...envOverride },
  });
}

test("plan is read-only and identifies both production databases", () => {
  const result = run(["plan"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, new RegExp(expectedProject));
  assert.match(result.stdout, new RegExp(mainDatabase));
  assert.match(result.stdout, new RegExp(warehouseDatabase));
  assert.match(result.stdout, /nenhuma alteração executada/i);
});

test("apply fails closed without an explicit database", () => {
  const result = run(["apply"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--database=<id>/);
});

test("apply fails closed without the exact confirmation", () => {
  const result = run(["apply", "--database=" + warehouseDatabase]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Aplicação bloqueada/);
});

for (const protectedDatabase of [mainDatabase, warehouseDatabase]) {
  test("restore-plan rejects production target " + protectedDatabase, () => {
    const result = run([
      "restore-plan",
      "--database=" + mainDatabase,
      "--backup=projects/" + expectedProject + "/locations/us-east1/backups/example",
      "--target=" + protectedDatabase,
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /banco novo e isolado/i);
  });
}

test("restore-plan only prints a command for an isolated database", () => {
  const result = run([
    "restore-plan",
    "--database=" + warehouseDatabase,
    "--backup=projects/" + expectedProject + "/locations/us-east1/backups/example",
    "--target=emprovex-restore-2026-10-01",
  ]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /nenhuma alteração executada/i);
  assert.match(result.stdout, new RegExp(warehouseDatabase));
  assert.match(result.stdout, /--destination-database=emprovex-restore-2026-10-01/);
  assert.match(result.stdout, /operations list/);
});

test("restore-plan rejects unknown source database", () => {
  const result = run([
    "restore-plan",
    "--database=unknown-db",
    "--backup=projects/" + expectedProject + "/locations/us-east1/backups/example",
    "--target=emprovex-restore-2026-10-01",
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Banco não reconhecido/);
});


// Coordinator-owned offline regression coverage: mocks the entire gcloud binary;
// no credentials, network calls, production reads, or restores are performed.
function runWithMockGcloud(args, scenario) {
  const directory = mkdtempSync(join(tmpdir(), "emprovex-recovery-mock-"));
  try {
    const executable = join(directory, "gcloud");
    const lines = [
      "#!/usr/bin/env node",
      "const args = process.argv.slice(2);",
      "const scenario = process.env.EMPROVEX_MOCK_RECOVERY_SCENARIO;",
      "if (args[0] === '--version') { console.log('Google Cloud SDK mocked'); process.exit(0); }",
      "if (args[0] === 'firestore' && args[1] === 'backups' && args[2] === 'describe') {",
      "  if (scenario === 'gcloud-error') { console.error('mock query failed'); process.exit(9); }",
      "  const backup = {",
      "    name: 'projects/gen-lang-client-0982077967/locations/us-east1/backups/example',",
      "    database: 'projects/gen-lang-client-0982077967/databases/emprovex-warehouse',",
      "    state: 'READY',",
      "    snapshotTime: '2020-01-01T00:00:00Z',",
      "    expireTime: '2099-01-01T00:00:00Z',",
      "  };",
      "  if (scenario === 'wrong-source') backup.database = 'projects/gen-lang-client-0982077967/databases/other-db';",
      "  if (scenario === 'not-ready') backup.state = 'CREATING';",
      "  if (scenario === 'expired') backup.expireTime = '2020-01-02T00:00:00Z';",
      "  console.log(JSON.stringify(backup)); process.exit(0);",
      "}",
      "if (args[0] === 'firestore' && args[1] === 'databases' && args[2] === 'list') {",
      "  console.log(JSON.stringify(scenario === 'target-exists' ? [{",
      "    name: 'projects/gen-lang-client-0982077967/databases/emprovex-restore-2026-10-27'",
      "  }] : [])); process.exit(0);",
      "}",
      "console.error('Unexpected mocked gcloud invocation: ' + args.join(' ')); process.exit(10);",
    ];
    writeFileSync(executable, lines.join('\n') + '\n', { mode: 0o755 });
    const path = directory + delimiter + (process.env.PATH || "");
    return run([
      "restore-inspect",
      "--project=" + expectedProject,
      "--database=" + warehouseDatabase,
      "--backup=projects/" + expectedProject + "/locations/us-east1/backups/example",
      "--target=emprovex-restore-2026-10-27",
      ...args,
    ], { PATH: path, EMPROVEX_MOCK_RECOVERY_SCENARIO: scenario });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const mockOnly = { skip: process.platform === "win32" };

test("restore-inspect accepts only an existing READY backup from the correct database and unused target", mockOnly, () => {
  const r = runWithMockGcloud([], "valid");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /BACKUP E DESTINO ELEGIVEIS/);
  assert.match(r.stdout, /"restoreExecuted": false/);
  assert.match(r.stdout, /--destination-database=emprovex-restore-2026-10-27/);
});

for (const [scenario, message] of [
  ["wrong-source", /nao corresponde exatamente/],
  ["not-ready", /nao esta READY/],
  ["expired", /expirado/],
  ["target-exists", /Destino ja existe/],
  ["gcloud-error", /gcloud falhou/],
]) {
  test("restore-inspect fails closed on " + scenario, mockOnly, () => {
    const r = runWithMockGcloud([], scenario);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, message);
    assert.doesNotMatch(r.stdout, /--destination-database=/);
  });
}

test("restore-inspect requires the explicit project before invoking gcloud", mockOnly, () => {
  const r = run([
    "restore-inspect",
    "--database=" + warehouseDatabase,
    "--backup=projects/" + expectedProject + "/locations/us-east1/backups/example",
    "--target=emprovex-restore-2026-10-27",
  ]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--project=/);
});
