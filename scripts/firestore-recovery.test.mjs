import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = resolve(root, "scripts/firestore-recovery.mjs");
const expectedProject = "gen-lang-client-0982077967";
const expectedDatabase =
  "ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1";

function run(args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("plan is read-only and identifies the production database", () => {
  const result = run(["plan"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, new RegExp(expectedProject));
  assert.match(result.stdout, new RegExp(expectedDatabase));
  assert.match(result.stdout, /nenhuma alteração executada/i);
});

test("apply fails closed without the exact confirmation", () => {
  const result = run(["apply"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Aplicação bloqueada/);
});

test("restore-plan rejects the production database as target", () => {
  const result = run([
    "restore-plan",
    `--backup=projects/${expectedProject}/locations/us-east1/backups/example`,
    `--target=${expectedDatabase}`,
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /banco novo e isolado/);
});

test("restore-plan only prints a command for an isolated database", () => {
  const result = run([
    "restore-plan",
    `--backup=projects/${expectedProject}/locations/us-east1/backups/example`,
    "--target=emprovex-restore-2026-09-15",
  ]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /nenhuma alteração executada/i);
  assert.match(result.stdout, /--destination-database=emprovex-restore-2026-09-15/);
});

