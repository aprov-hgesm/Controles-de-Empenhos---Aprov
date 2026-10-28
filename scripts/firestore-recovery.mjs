#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isMissingGcloud, spawnGcloudSync } from "./lib/gcloud-command.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const policy = JSON.parse(
  readFileSync(resolve(root, "ops/firestore-recovery.json"), "utf8"),
);

const command = process.argv[2] || "plan";
const flags = parseFlags(process.argv.slice(3));

main().catch((error) => {
  console.error("\nERRO: " + error.message);
  process.exitCode = 1;
});

async function main() {
  switch (command) {
    case "plan":
      printPlan(resolveDatabasePolicies());
      return;
    case "status": {
      ensureGcloud();
      printStatus(await inspectMany(resolveDatabasePolicies()));
      return;
    }
    case "verify": {
      ensureGcloud();
      const statuses = await inspectMany(resolveDatabasePolicies());
      printStatus(statuses);
      if (!statuses.every((status) => status.ready)) process.exitCode = 2;
      return;
    }
    case "apply": {
      const databasePolicy = resolveDatabasePolicies({ requireExplicit: true })[0];
      ensureApplyConfirmation(databasePolicy);
      ensureGcloud();
      await ensureBilling();
      await applyRecoveryControls(databasePolicy);
      return;
    }
    case "restore-plan":
      printRestorePlan(resolveDatabasePolicies({ requireExplicit: true })[0]);
      return;
    case "restore-inspect": {
      const selected = resolveDatabasePolicies({ requireExplicit: true })[0];
      const request = parseRestoreRequest(selected, { requireProject: true });
      ensureGcloud();
      inspectRestoreRequest(selected, request);
      return;
    }
    default:
      throw new Error(
        "Comando desconhecido: " + command + ". Use plan, status, verify, apply, restore-plan ou restore-inspect.",
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

function resolveDatabasePolicies({ requireExplicit = false } = {}) {
  const selector = String(flags.database || (requireExplicit ? "" : "all")).trim();

  if (!selector) {
    throw new Error(
      "Informe --database=<id> para esta operação. O modo de escrita nunca seleciona bancos implicitamente.",
    );
  }

  if (selector === "all") {
    if (requireExplicit) {
      throw new Error("Esta operação exige um único --database=<id>; --database=all é bloqueado.");
    }
    return policy.databases;
  }

  const selected = policy.databases.find((item) => item.id === selector);
  if (!selected) {
    throw new Error(
      "Banco não reconhecido: " + selector + ". Permitidos: " + policy.databases.map((item) => item.id).join(", ") + ".",
    );
  }
  return [selected];
}

function expectedResource(databasePolicy) {
  return "projects/" + policy.projectId + "/databases/" + databasePolicy.id;
}

function ensureGcloud() {
  const check = spawnGcloudSync(["--version"]);
  if (isMissingGcloud(check)) {
    throw new Error(
      "Google Cloud CLI não encontrado. Use o Cloud Shell ou instale o gcloud.",
    );
  }
  if (check.status !== 0) throw new Error("Não foi possível executar o gcloud.");
}

function runGcloud(args) {
  const result = spawnGcloudSync(args);
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim();
    throw new Error("gcloud falhou: " + (detail || args.join(" ")));
  }
  return result.stdout.trim();
}

function runJson(args) {
  const output = runGcloud([...args, "--format=json"]);
  return output ? JSON.parse(output) : null;
}

function protectionCommand(databasePolicy) {
  return [
    "firestore",
    "databases",
    "update",
    "--project=" + policy.projectId,
    "--database=" + databasePolicy.id,
    "--enable-pitr",
    "--delete-protection",
    "--quiet",
  ];
}

function createDailyScheduleCommand(databasePolicy) {
  return [
    "firestore",
    "backups",
    "schedules",
    "create",
    "--project=" + policy.projectId,
    "--database=" + databasePolicy.id,
    "--retention=" + databasePolicy.dailyBackupRetention,
    "--recurrence=daily",
  ];
}

function printPlan(databasePolicies) {
  console.log("Plano de recuperação do Firestore (nenhuma alteração executada)\n");
  console.log("Projeto: " + policy.projectId);
  for (const databasePolicy of databasePolicies) {
    console.log("\nBanco: " + databasePolicy.id + " (" + databasePolicy.role + ")");
    console.log("Backup: diário, retenção " + databasePolicy.dailyBackupRetention);
    console.log("Objetivos: RPO " + databasePolicy.rpoHours + "h / RTO " + databasePolicy.rtoHours + "h");
    console.log("Proteção: PITR + proteção contra exclusão");
    console.log("Comandos que o modo apply poderá executar:");
    console.log("gcloud " + protectionCommand(databasePolicy).join(" "));
    console.log("gcloud " + createDailyScheduleCommand(databasePolicy).join(" "));
  }
  console.log(
    "\nO modo apply exige faturamento ativo, um único --database e confirmação literal do recurso.",
  );
}

async function inspectMany(databasePolicies) {
  const statuses = [];
  for (const databasePolicy of databasePolicies) {
    statuses.push(await inspectDatabase(databasePolicy));
  }
  return statuses;
}

async function inspectDatabase(databasePolicy) {
  const resource = expectedResource(databasePolicy);
  const database = runJson([
    "firestore",
    "databases",
    "describe",
    "--project=" + policy.projectId,
    "--database=" + databasePolicy.id,
  ]);
  assertDatabase(databasePolicy, database);

  const location = String(database.locationId || "").trim();
  if (!location) {
    throw new Error("O banco " + databasePolicy.id + " não informou locationId.");
  }

  const schedules =
    runJson([
      "firestore",
      "backups",
      "schedules",
      "list",
      "--project=" + policy.projectId,
      "--database=" + databasePolicy.id,
    ]) || [];
  const dailySchedules = schedules.filter(isDailySchedule);

  const backups =
    runJson([
      "firestore",
      "backups",
      "list",
      "--project=" + policy.projectId,
      "--location=" + location,
    ]) || [];
  const completedBackups = backups.filter(
    (backup) =>
      backup.database === resource &&
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
      databasePolicy.dailyBackupRetentionSeconds;
  const backupReady = completedBackups.length > 0;

  const controlsReady =
    (!databasePolicy.requirePitr || pitrEnabled) &&
    (!databasePolicy.requireDeleteProtection || deleteProtectionEnabled) &&
    dailyScheduleReady;

  return {
    projectId: policy.projectId,
    databaseId: databasePolicy.id,
    role: databasePolicy.role,
    location,
    pitrEnabled,
    deleteProtectionEnabled,
    dailyScheduleReady,
    backupReady,
    completedBackupCount: completedBackups.length,
    rpoHours: databasePolicy.rpoHours,
    rtoHours: databasePolicy.rtoHours,
    ready: controlsReady && backupReady,
  };
}

function assertDatabase(databasePolicy, database) {
  const resource = expectedResource(databasePolicy);
  if (!database || database.name !== resource) {
    throw new Error(
      "Banco retornado não corresponde ao alvo protegido: " + resource,
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

function printStatus(statuses) {
  console.log(
    JSON.stringify(
      {
        projectId: policy.projectId,
        databases: statuses,
        ready: statuses.every((status) => status.ready),
      },
      null,
      2,
    ),
  );

  if (!statuses.every((status) => status.ready)) {
    console.log(
      "\nRecuperação nativa ainda não certificada: cada banco precisa dos controles e de pelo menos um backup READY.",
    );
  }
}

function ensureApplyConfirmation(databasePolicy) {
  const suppliedProject = flags.project;
  const suppliedConfirmation = flags.confirm;
  const resource = expectedResource(databasePolicy);

  if (
    suppliedProject !== policy.projectId ||
    suppliedConfirmation !== resource
  ) {
    throw new Error(
      [
        "Aplicação bloqueada. Informe explicitamente o alvo correto:",
        "--project=" + policy.projectId,
        "--database=" + databasePolicy.id,
        "--confirm=" + resource,
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
      "Faturamento não está ativo. PITR e backups programados exigem billing habilitado.",
    );
  }
}

async function applyRecoveryControls(databasePolicy) {
  const before = await inspectDatabase(databasePolicy);

  if (
    (databasePolicy.requirePitr && !before.pitrEnabled) ||
    (databasePolicy.requireDeleteProtection && !before.deleteProtectionEnabled)
  ) {
    console.log("Ativando proteções em " + databasePolicy.id + "...");
    runGcloud(protectionCommand(databasePolicy));
  }

  const schedules =
    runJson([
      "firestore",
      "backups",
      "schedules",
      "list",
      "--project=" + policy.projectId,
      "--database=" + databasePolicy.id,
    ]) || [];
  const dailySchedules = schedules.filter(isDailySchedule);

  if (dailySchedules.length > 1) {
    throw new Error(
      "Mais de um agendamento diário encontrado em " + databasePolicy.id + "; revisão manual necessária.",
    );
  }

  if (dailySchedules.length === 0) {
    console.log(
      "Criando backup diário de " + databasePolicy.id + " com retenção " + databasePolicy.dailyBackupRetention + "...",
    );
    runGcloud(createDailyScheduleCommand(databasePolicy));
  } else if (
    retentionSeconds(dailySchedules[0].retention) !==
    databasePolicy.dailyBackupRetentionSeconds
  ) {
    const scheduleId = String(dailySchedules[0].name || "").split("/").pop();
    if (!scheduleId) throw new Error("Agendamento diário sem identificador válido.");
    console.log(
      "Atualizando retenção do backup diário de " + databasePolicy.id + " para " + databasePolicy.dailyBackupRetention + "...",
    );
    runGcloud([
      "firestore",
      "backups",
      "schedules",
      "update",
      "--project=" + policy.projectId,
      "--database=" + databasePolicy.id,
      "--backup-schedule=" + scheduleId,
      "--retention=" + databasePolicy.dailyBackupRetention,
      "--quiet",
    ]);
  }

  const after = await inspectDatabase(databasePolicy);
  printStatus([after]);

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

/**
 * Planejamento offline: bloqueia destinos conhecidos, mas NAO comprova a
 * existencia, origem ou estado do backup. Nao executa gcloud.
 */
function parseRestoreRequest(databasePolicy, { requireProject = false } = {}) {
  const backup = String(flags.backup || "").trim();
  const target = String(flags.target || "").trim();
  const suppliedProject = String(flags.project || "").trim();

  if (!backup || !target) {
    throw new Error(
      "Informe --database=<origem> --backup=projects/.../locations/.../backups/... e --target=emprovex-restore-AAAA-MM-DD.",
    );
  }
  if ((requireProject && suppliedProject !== policy.projectId) ||
      (suppliedProject && suppliedProject !== policy.projectId)) {
    throw new Error("Informe --project=" + policy.projectId + " exatamente; outro projeto e bloqueado.");
  }

  const match = backup.match(/^projects\/([a-z][a-z0-9-]*)\/locations\/([a-z0-9-]+)\/backups\/([A-Za-z0-9_-]+)$/);
  if (!match || match[1] !== policy.projectId) {
    throw new Error("O backup precisa ter resource name valido no projeto " + policy.projectId + ".");
  }

  const protectedIds = new Set([...policy.databases.map((item) => item.id), "(default)"]);
  if (protectedIds.has(target)) {
    throw new Error("A restauracao exige um banco novo e isolado; bancos de producao sao bloqueados.");
  }
  if (!/^[a-z][a-z0-9-]{2,61}[a-z0-9]$/.test(target) ||
      !target.startsWith("emprovex-restore-")) {
    throw new Error("Destino invalido: use um ID novo com prefixo emprovex-restore-.");
  }

  return { backup, target, location: match[2], backupId: match[3] };
}

function restoreCommand(request) {
  return "gcloud firestore databases restore --project=" + policy.projectId +
    " --source-backup=" + request.backup +
    " --destination-database=" + request.target;
}

function printPostRestoreCommands(request) {
  console.log("\nLeituras posteriores a uma restauracao AUTORIZADA:");
  console.log("gcloud firestore operations list --project=" + policy.projectId +
    " --database=" + request.target + " --format=json");
  console.log("gcloud firestore databases describe --project=" + policy.projectId +
    " --database=" + request.target + " --format=json");
  console.log(
    "\nA conclusao da operacao nao equivale a recuperacao certificada. Conferir dados por workspace, auditoria, IAM, Rules e TTL; nunca habilitar acesso de clientes antes da aprovacao.",
  );
}

function printRestorePlan(databasePolicy) {
  const request = parseRestoreRequest(databasePolicy);

  console.log("Plano OFFLINE de restauracao (nenhuma alteracao executada)\n");
  console.log("Origem DECLARADA, ainda nao conferida: " + databasePolicy.id);
  console.log("Backup DECLARADO, estado/origem/expiracao NAO VERIFICADOS: " + request.backup);
  console.log("Destino proposto: " + request.target);
  console.log("\nCOMANDO APENAS DE REFERENCIA - NAO EXECUTAR AINDA:");
  console.log(restoreCommand(request));
  console.log("\nAntes de qualquer restore, realizar a inspeção autenticada somente leitura:");
  console.log("node scripts/firestore-recovery.mjs restore-inspect" +
    " --project=" + policy.projectId +
    " --database=" + databasePolicy.id +
    " --backup=" + request.backup +
    " --target=" + request.target);
  printPostRestoreCommands(request);
}

/**
 * Executado SOMENTE em etapa posterior pelo Coordenador.
 * Consulta metadata dos recursos sem escrever ou restaurar qualquer dado.
 * Falha fechada se a origem estiver divergente, backup nao READY, vencido
 * ou o destino estiver presente (inclusive listado como deletado).
 */
function inspectRestoreRequest(databasePolicy, request) {
  const backup = runJson([
    "firestore", "backups", "describe",
    "--project=" + policy.projectId,
    "--location=" + request.location,
    "--backup=" + request.backupId,
  ]);
  const expectedSource = expectedResource(databasePolicy);
  if (!backup || backup.name !== request.backup ||
      backup.database !== expectedSource) {
    throw new Error(
      "Backup nao corresponde exatamente ao recurso declarado e ao banco de origem " + expectedSource + ".",
    );
  }
  if (String(backup.state || "").toUpperCase() !== "READY") {
    throw new Error("Backup nao esta READY. Nenhum restore autorizado.");
  }

  const snapshotTime = String(backup.snapshotTime || "");
  const expireTime = String(backup.expireTime || "");
  const snapshotMs = Date.parse(snapshotTime);
  const expirationMs = Date.parse(expireTime);
  const now = Date.now();
  if (!Number.isFinite(snapshotMs) || !Number.isFinite(expirationMs) ||
      snapshotMs > now || expirationMs <= now || expirationMs <= snapshotMs) {
    throw new Error("Snapshot/expiracao ausente, invalido ou backup expirado. Operacao bloqueada.");
  }

  const databases = runJson([
    "firestore", "databases", "list",
    "--project=" + policy.projectId,
    "--show-deleted",
  ]);
  if (!Array.isArray(databases)) {
    throw new Error("Nao foi possivel determinar com seguranca os IDs de bancos ja utilizados.");
  }
  const destinationResource = "projects/" + policy.projectId + "/databases/" + request.target;
  if (databases.some((db) => db?.name === destinationResource)) {
    throw new Error("Destino ja existe ou foi utilizado antes; escolha outro ID inequivocamente novo.");
  }

  console.log("INSPECAO SOMENTE LEITURA: BACKUP E DESTINO ELEGIVEIS (restore NAO executado)\n");
  console.log(JSON.stringify({
    projectId: policy.projectId,
    sourceDatabase: databasePolicy.id,
    backup: backup.name,
    state: backup.state,
    location: request.location,
    snapshotTime,
    expireTime,
    destinationDatabase: request.target,
    destinationAbsentFromActiveAndDeletedList: true,
    restoreExecuted: false,
    dataIntegrityVerified: false,
    rpoObserved: "NAO EXECUTADO",
    rtoObserved: "NAO EXECUTADO",
  }, null, 2));
  console.log("\nComando preparado PARA REVISAO E AUTORIZACAO EXPLICITA do Coordenador:");
  console.log(restoreCommand(request));
  printPostRestoreCommands(request);
}
