#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const policy = JSON.parse(
  readFileSync(resolve(root, "ops/firestore-recovery.json"), "utf8"),
);

const command = process.argv[2] || "plan";
const flags = parseFlags(process.argv.slice(3));
const expectedResource = `projects/${policy.projectId}/databases/${policy.databaseId}`;

const commands = {
  enableProtection: [
    "firestore",
    "databases",
    "update",
    `--project=${policy.projectId}`,
    `--database=${policy.databaseId}`,
    "--enable-pitr",
    "--delete-protection",
    "--quiet",
  ],
  createDailySchedule: [
    "firestore",
    "backups",
    "schedules",
    "create",
    `--project=${policy.projectId}`,
    `--database=${policy.databaseId}`,
    `--retention=${policy.dailyBackupRetention}`,
    "--recurrence=daily",
  ],
};

main().catch((error) => {
  console.error(`\nERRO: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  switch (command) {
    case "plan":
      printPlan();
      return;
    case "status":
      ensureGcloud();
      printStatus(await inspect());
      return;
    case "verify": {
      ensureGcloud();
      const status = await inspect();
      printStatus(status);
      if (!status.ready) process.exitCode = 2;
      return;
    }
    case "apply":
      ensureApplyConfirmation();
      ensureGcloud();
      await ensureBilling();
      await applyRecoveryControls();
      return;
    case "restore-plan":
      printRestorePlan();
      return;
    default:
      throw new Error(
        `Comando desconhecido: ${command}. Use plan, status, verify, apply ou restore-plan.`,
      );
  }
}

function parseFlags(args) {
  return Object.fromEntries(
    args.map((arg) => {
      const [key, ...value] = arg.replace(/^--/, "").split("=");
      return [key, value.join("=")];
    }),
  );
}

function ensureGcloud() {
  const check = spawnSync("gcloud", ["--version"], { encoding: "utf8" });
  if (check.error?.code === "ENOENT") {
    throw new Error(
      "Google Cloud CLI não encontrado. Instale o gcloud ou use o Cloud Shell.",
    );
  }
  if (check.status !== 0) throw new Error("Não foi possível executar o gcloud.");
}

function runGcloud(args) {
  const result = spawnSync("gcloud", args, { encoding: "utf8" });
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim();
    throw new Error(`gcloud falhou: ${detail || args.join(" ")}`);
  }
  return result.stdout.trim();
}

function runJson(args) {
  const output = runGcloud([...args, "--format=json"]);
  return output ? JSON.parse(output) : null;
}

function printPlan() {
  console.log("Plano de recuperação do Firestore (nenhuma alteração executada)\n");
  console.log(`Projeto:  ${policy.projectId}`);
  console.log(`Banco:    ${policy.databaseId}`);
  console.log(`Região:   ${policy.location}`);
  console.log(`Backup:   diário, retenção ${policy.dailyBackupRetention}`);
  console.log("Proteção: PITR + proteção contra exclusão\n");
  console.log("Comandos que o modo apply poderá executar:");
  console.log(`gcloud ${commands.enableProtection.join(" ")}`);
  console.log(`gcloud ${commands.createDailySchedule.join(" ")}`);
  console.log("\nO modo apply exige faturamento ativo e confirmação literal do banco.");
}

async function inspect() {
  const database = runJson([
    "firestore",
    "databases",
    "describe",
    `--project=${policy.projectId}`,
    `--database=${policy.databaseId}`,
  ]);
  assertDatabase(database);

  const schedules =
    runJson([
      "firestore",
      "backups",
      "schedules",
      "list",
      `--project=${policy.projectId}`,
      `--database=${policy.databaseId}`,
    ]) || [];
  const dailySchedules = schedules.filter(isDailySchedule);

  const backups =
    runJson([
      "firestore",
      "backups",
      "list",
      `--project=${policy.projectId}`,
      `--location=${policy.location}`,
    ]) || [];
  const completedBackups = backups.filter(
    (backup) =>
      backup.database === expectedResource &&
      String(backup.state).toUpperCase() === "READY",
  );

  const pitrEnabled =
    database.pointInTimeRecoveryEnablement ===
    "POINT_IN_TIME_RECOVERY_ENABLED";
  const deleteProtectionEnabled =
    database.deleteProtectionState === "DELETE_PROTECTION_ENABLED";
  const dailyScheduleReady =
    dailySchedules.length === 1 &&
    retentionSeconds(dailySchedules[0].retention) ===
      policy.dailyBackupRetentionSeconds;
  const backupReady = completedBackups.length > 0;

  return {
    projectId: policy.projectId,
    databaseId: policy.databaseId,
    pitrEnabled,
    deleteProtectionEnabled,
    dailyScheduleReady,
    backupReady,
    completedBackupCount: completedBackups.length,
    ready:
      pitrEnabled &&
      deleteProtectionEnabled &&
      dailyScheduleReady &&
      backupReady,
  };
}

function assertDatabase(database) {
  if (!database || database.name !== expectedResource) {
    throw new Error(
      `Banco retornado não corresponde ao alvo protegido: ${expectedResource}`,
    );
  }
  if (database.locationId && database.locationId !== policy.location) {
    throw new Error(
      `Região inesperada: ${database.locationId}; esperado ${policy.location}.`,
    );
  }
}

function isDailySchedule(schedule) {
  return (
    Object.hasOwn(schedule, "dailyRecurrence") ||
    String(schedule.recurrence || "").toUpperCase() === "DAILY"
  );
}

function retentionSeconds(value) {
  if (typeof value === "number") return value;
  const match = String(value || "").match(/^(\d+)s$/);
  return match ? Number(match[1]) : NaN;
}

function printStatus(status) {
  console.log(JSON.stringify(status, null, 2));
  if (!status.ready) {
    console.log(
      "\nBloco 0 ainda não concluído: todos os controles e pelo menos um backup READY são obrigatórios.",
    );
  }
}

function ensureApplyConfirmation() {
  const suppliedProject = flags.project;
  const suppliedDatabase = flags.database;
  const suppliedConfirmation = flags.confirm;

  if (
    suppliedProject !== policy.projectId ||
    suppliedDatabase !== policy.databaseId ||
    suppliedConfirmation !== expectedResource
  ) {
    throw new Error(
      [
        "Aplicação bloqueada. Informe explicitamente o alvo correto:",
        `--project=${policy.projectId}`,
        `--database=${policy.databaseId}`,
        `--confirm=${expectedResource}`,
      ].join("\n"),
    );
  }
}

async function ensureBilling() {
  const billing = runJson([
    "billing",
    "projects",
    "describe",
    policy.projectId,
  ]);
  if (billing?.billingEnabled !== true) {
    throw new Error(
      "Faturamento não está ativo. PITR e backups programados exigem o plano Blaze.",
    );
  }
}

async function applyRecoveryControls() {
  const before = await inspect();

  if (!before.pitrEnabled || !before.deleteProtectionEnabled) {
    console.log("Ativando PITR e proteção contra exclusão...");
    runGcloud(commands.enableProtection);
  }

  const schedules =
    runJson([
      "firestore",
      "backups",
      "schedules",
      "list",
      `--project=${policy.projectId}`,
      `--database=${policy.databaseId}`,
    ]) || [];
  const dailySchedules = schedules.filter(isDailySchedule);

  if (dailySchedules.length > 1) {
    throw new Error("Mais de um agendamento diário encontrado; revisão manual necessária.");
  }

  if (dailySchedules.length === 0) {
    console.log("Criando backup diário com retenção de 14 semanas...");
    runGcloud(commands.createDailySchedule);
  } else if (
    retentionSeconds(dailySchedules[0].retention) !==
    policy.dailyBackupRetentionSeconds
  ) {
    const scheduleId = String(dailySchedules[0].name || "").split("/").pop();
    if (!scheduleId) throw new Error("Agendamento diário sem identificador válido.");
    console.log("Atualizando retenção do backup diário para 14 semanas...");
    runGcloud([
      "firestore",
      "backups",
      "schedules",
      "update",
      `--project=${policy.projectId}`,
      `--database=${policy.databaseId}`,
      `--backup-schedule=${scheduleId}`,
      `--retention=${policy.dailyBackupRetention}`,
      "--quiet",
    ]);
  }

  const after = await inspect();
  printStatus(after);
  if (
    !after.pitrEnabled ||
    !after.deleteProtectionEnabled ||
    !after.dailyScheduleReady
  ) {
    throw new Error(
      "A verificação pós-aplicação falhou: um ou mais controles não ficaram ativos.",
    );
  }
  if (!after.backupReady) {
    console.log(
      "\nConfiguração aplicada. Aguarde o primeiro backup ficar READY e execute npm run recovery:verify.",
    );
  }
}

function printRestorePlan() {
  const backup = flags.backup;
  const target = flags.target;
  if (!backup || !target) {
    throw new Error(
      "Informe --backup=projects/.../locations/.../backups/... e --target=emprovex-restore-AAAA-MM-DD.",
    );
  }
  const backupPrefix = `projects/${policy.projectId}/locations/${policy.location}/backups/`;
  if (!backup.startsWith(backupPrefix)) {
    throw new Error(`O backup precisa pertencer a ${backupPrefix}`);
  }
  if (!/^[a-z][a-z0-9-]{2,61}[a-z0-9]$/.test(target)) {
    throw new Error("ID do banco de restauração inválido.");
  }
  if (target === policy.databaseId || target === "(default)") {
    throw new Error("A restauração deve usar um banco novo e isolado.");
  }

  console.log("Plano de restauração (nenhuma alteração executada)\n");
  console.log(
    `gcloud firestore databases restore --project=${policy.projectId} --source-backup=${backup} --destination-database=${target}`,
  );
  console.log("\nApós restaurar, valide IAM, regras, índices e contagens antes de remover o banco de teste.");
}
