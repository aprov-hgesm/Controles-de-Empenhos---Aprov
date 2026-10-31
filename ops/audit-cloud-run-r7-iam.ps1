# EMPROVEX R7.2 — auditoria read-only de identidade/IAM.
# Nao altera IAM, contas, bancos, secrets, Cloud Run, Vercel, dominios ou billing.
$ErrorActionPreference = 'Stop'

$Projeto = 'gen-lang-client-0982077967'
$ContaEsperada = 'marcoa.r.aquino@gmail.com'
$Service = "emprovex-run-runtime@$Projeto.iam.gserviceaccount.com"
$Member = "serviceAccount:$Service"
$Secrets = @(
 'emprovex-infinitepay-api-key',
 'emprovex-infinitepay-order-secret',
 'emprovex-infinitepay-webhook-token',
 'emprovex-billing-qa-workspace-id',
 'emprovex-billing-rules-certified',
 'emprovex-billing-enforcement-enabled',
 'emprovex-infinitepay-billing-pilot-workspace-id',
 'emprovex-infinitepay-billing-scope',
 'emprovex-infinitepay-billing-enabled',
 'emprovex-billing-public-origin',
 'emprovex-infinitepay-handle'
)
function CheckExit([string]$msg) {
 if ($LASTEXITCODE -ne 0) { throw $msg }
}
function ReadJson([string[]]$rows, [string]$msg) {
 CheckExit $msg
 return (($rows | Out-String) | ConvertFrom-Json)
}
if ((gcloud.cmd config get-value project 2>$null).Trim() -ne $Projeto) {
 throw 'R7_AUDIT_WRONG_PROJECT'
}
if ((gcloud.cmd config get-value account 2>$null).Trim() -ne $ContaEsperada) {
 throw 'R7_AUDIT_WRONG_ACCOUNT'
}
Write-Host '=== R7.2 / CONTA PERMANENTE CLOUD RUN ==='
$sa = ReadJson @(gcloud.cmd iam service-accounts describe $Service --project=$Projeto --format=json) 'R7_AUDIT_SA_READ_ERROR'
if ($sa.disabled -eq $true) { throw 'R7_AUDIT_RUNTIME_ACCOUNT_DISABLED' }
Write-Host "RUNTIME ACCOUNT: $($sa.email) [ENABLED]"

Write-Host '=== R7.2 / ROLES DE PROJETO (BINDINGS DIRETOS) ==='
$policy = ReadJson @(gcloud.cmd projects get-iam-policy $Projeto --format=json) 'R7_AUDIT_PROJECT_IAM_ERROR'
$roles = @($policy.bindings | Where-Object {
 $_.members -contains $Member
} | ForEach-Object { $_.role } | Sort-Object -Unique)
foreach ($role in @(
 'roles/datastore.user',
 'roles/firebaseauth.admin',
 'roles/monitoring.viewer'
)) {
 if ($role -in $roles) { Write-Host "DIRETO: $role" }
 else { Write-Host "NAO ENCONTRADO DIRETAMENTE: $role" }
}
Write-Host "TOTAL DE ROLES DIRETOS: $($roles.Count)"
Write-Host 'Aviso: roles de grupos, hierarquia de organizacao e IAM Conditions nao estao avaliados.'

Write-Host '=== R7.2 / ACESSO DIRETO AOS 11 SEGREDOS ==='
$direct = 0
foreach ($id in $Secrets) {
 $secretPolicy = ReadJson @(gcloud.cmd secrets get-iam-policy $id --project=$Projeto --format=json) "R7_AUDIT_SECRET_IAM_ERROR: $id"
 $binding = @($secretPolicy.bindings | Where-Object {
   $_.role -eq 'roles/secretmanager.secretAccessor' -and ($_.members -contains $Member)
 })
 if ($binding.Count -gt 0) {
   Write-Host "SECRET ACCESSOR DIRETO: $id"
   $direct++
 } else {
   Write-Host "SEM BINDING DIRETO: $id"
 }
}
Write-Host "SECRET ACCESSOR DIRETO: $direct/$($Secrets.Count) cofres"
Write-Host 'Nota: ausencia de binding direto nao prova ausencia de permissao herdada.'

Write-Host '=== R7.2 / FIRESTORE BANCOS EXISTENTES ==='
gcloud.cmd firestore databases list --project=$Projeto --format='table(name,locationId,type)'
CheckExit 'R7_AUDIT_FIRESTORE_DATABASES_READ_ERROR'

Write-Host '=== R7.2 / APIS ATIVADAS ==='
$apis = @(gcloud.cmd services list --enabled --project=$Projeto --format='value(config.name)')
CheckExit 'R7_AUDIT_SERVICES_READ_ERROR'
foreach ($api in @(
 'run.googleapis.com',
 'secretmanager.googleapis.com',
 'firestore.googleapis.com',
 'identitytoolkit.googleapis.com',
 'monitoring.googleapis.com'
)) {
 if ($api -in $apis) { Write-Host "ENABLED: $api" }
 else { Write-Host "NAO LISTADA COMO ATIVA: $api" }
}
Write-Host '=== R7.2 / AUDITORIA SOMENTE LEITURA FINALIZADA ==='
