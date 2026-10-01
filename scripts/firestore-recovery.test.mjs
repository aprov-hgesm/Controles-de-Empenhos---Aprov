import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = resolve(root, "scripts/firestore-recovery.mjs");
const expectedProject = "gen-lang-client-0982077967";
const mainDatabase =
  "ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1";
const warehouseDatabase = "emprovex-warehouse";

function run(args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
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
