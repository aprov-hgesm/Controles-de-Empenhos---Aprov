# EMPROVEX R7.3 — prepare Cloud Run permanent identity with least privilege.
# Dry-run by default. -Apply requires typed confirmation. No app deploy / DNS changes.
param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$Projeto='gen-lang-client-0982077967'
$Conta='marcoa.r.aquino@gmail.com'
$SA="emprovex-run-runtime@$Projeto.iam.gserviceaccount.com"
$Member="serviceAccount:$SA"
$BancoPrincipal='ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1'
$BancoDepositos='emprovex-warehouse'
$Bancos=@($BancoPrincipal,$BancoDepositos)
$Segredos=@(
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

function Assert-Exit([string]$msg){
 if($LASTEXITCODE -ne 0){throw $msg}
}
function Read-GcloudJson([string[]]$rows,[string]$msg) {
 Assert-Exit $msg
 return (($rows|Out-String)|ConvertFrom-Json)
}
function Has-DirectBinding($policy,[string]$role,[string]$member,[string]$expression='') {
 return @($policy.bindings|Where-Object {
   $_.role -eq $role -and ($_.members -contains $member) -and
   ([string]$_.condition.expression -ceq $expression)
 }).Count -gt 0
}
Write-Host '=== R7.3 / GUARDRAILS ==='
if((gcloud.cmd config get-value project 2>$null).Trim() -ne $Projeto){throw 'R7_WRONG_PROJECT'}
if((gcloud.cmd config get-value account 2>$null).Trim() -ne $Conta){throw 'R7_WRONG_ACCOUNT'}
$sa=Read-GcloudJson @(gcloud.cmd iam service-accounts describe $SA --project=$Projeto --format=json) 'R7_SA_NOT_FOUND'
if($sa.disabled -eq $true){throw 'R7_RUNTIME_SA_DISABLED'}

# Validate the exact named databases before any IAM mutation.
$names=@(gcloud.cmd firestore databases list --project=$Projeto --format='value(name)')
Assert-Exit 'R7_DATABASE_LIST_FAILED'
$found=@($names|ForEach-Object{($_ -split '/')[-1]})
foreach($id in $Bancos){
 if($id -notin $found){throw "R7_DATABASE_NOT_FOUND: $id"}
 Write-Host "DATABASE TARGET: $id"
}
$projectPolicy=Read-GcloudJson @(gcloud.cmd projects get-iam-policy $Projeto --format=json) 'R7_PROJECT_IAM_READ_FAILED'
# Abort if the permanent account already has an unrestricted Datastore user policy.
if(Has-DirectBinding $projectPolicy 'roles/datastore.user' $Member ''){
 throw 'R7_UNRESTRICTED_DATASTORE_USER_FOUND: review before proceeding'
}
Write-Host '=== R7.3 / VERIFY 11 SECRETS (NO VALUES) ==='
foreach($id in $Segredos){
 $states=@(gcloud.cmd secrets versions list $id --project=$Projeto --format='value(state)')
 Assert-Exit "R7_SECRET_READ_FAILED: $id"
 if($states.Count -ne 1 -or $states[0].Trim().ToLower() -ne 'enabled'){
   throw "R7_SECRET_VERSION_INVALID: $id"
 }
}
Write-Host '11/11 secret versions available; no values inspected.'
Write-Host '=== R7.3 / PLANNED GRANTS ==='
Write-Host 'Secret accessor (per-secret): 11 named secrets, skip existing bindings.'
Write-Host 'Project role: roles/monitoring.viewer (unconditional).'
Write-Host 'Project role: roles/firebaseauth.admin (unconditional).'
Write-Host "Firestore roles/datastore.user: conditional ONLY for $($Bancos -join ', ')."
Write-Host 'No access to the three other Firestore databases; no Owner/Editor, no secret admin.'
if(-not $Apply){
 Write-Host 'R7.3 DRY-RUN PASS: no IAM policies changed. Run with -Apply only when approved.'
 return
}
$confirm=Read-Host 'Digite AUTORIZAR-R7-IAM para conceder essas permissoes'
if($confirm -cne 'AUTORIZAR-R7-IAM'){throw 'R7_USER_ABORTED'}

Write-Host '=== R7.3 / GRANT SECRET ACCESSORS ==='
foreach($id in $Segredos){
 $p=Read-GcloudJson @(gcloud.cmd secrets get-iam-policy $id --project=$Projeto --format=json) "R7_SECRET_IAM_READ_FAILED: $id"
 if(-not(Has-DirectBinding $p 'roles/secretmanager.secretAccessor' $Member '')){
   gcloud.cmd secrets add-iam-policy-binding $id --project=$Projeto --member=$Member --role=roles/secretmanager.secretAccessor --quiet --format=none
   Assert-Exit "R7_SECRET_IAM_GRANT_FAILED: $id"
 }
 Write-Host "READY SECRET: $id"
}
Write-Host '=== R7.3 / PROJECT ROLES ==='
foreach($role in @('roles/monitoring.viewer','roles/firebaseauth.admin')){
 $policy=Read-GcloudJson @(gcloud.cmd projects get-iam-policy $Projeto --format=json) 'R7_PROJECT_IAM_READ_FAILED'
 if(-not(Has-DirectBinding $policy $role $Member '')){
   gcloud.cmd projects add-iam-policy-binding $Projeto --member=$Member --role=$role --condition=None --quiet --format=none
   Assert-Exit "R7_PROJECT_IAM_GRANT_FAILED: $role"
 }
 Write-Host "READY ROLE: $role"
}
Write-Host '=== R7.3 / SCOPED FIRESTORE GRANTS ==='
$Index=0
foreach($id in $Bancos){
 $Index++
 $expr='resource.name=="projects/'+$Projeto+'/databases/'+$id+'"'
 $title="EMPROVEX_R7_DB_$Index"
 $policy=Read-GcloudJson @(gcloud.cmd projects get-iam-policy $Projeto --format=json) 'R7_PROJECT_IAM_READ_FAILED'
 if(-not(Has-DirectBinding $policy 'roles/datastore.user' $Member $expr)){
   # Windows PowerShell 5.1 can strip embedded double quotes in a native CLI
   # argument. A JSON condition file preserves Firestore's exact CEL string.
   $conditionData=@{
     expression=$expr
     title=$title
     description='R7_Cloud_Run_only_database'
   } | ConvertTo-Json -Compress
   $tempFile=Join-Path ([System.IO.Path]::GetTempPath()) ("emprovex-r7-condition-"+[guid]::NewGuid().ToString('N')+".json")
   try {
     [System.IO.File]::WriteAllText(
       $tempFile,$conditionData,(New-Object System.Text.UTF8Encoding($false))
     )
     $parsedCondition=Get-Content -LiteralPath $tempFile -Raw | ConvertFrom-Json
     if($parsedCondition.expression -cne $expr){
       throw "R7_CONDITION_SERIALIZATION_FAILED: $id"
     }
     gcloud.cmd projects add-iam-policy-binding $Projeto `
       --member=$Member --role=roles/datastore.user `
       "--condition-from-file=$tempFile" --quiet --format=none
     Assert-Exit "R7_FIRESTORE_GRANT_FAILED: $id"
   } finally {
     Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
   }
 }
 Write-Host "READY CONDITIONAL DATABASE: $id"
}

Write-Host '=== R7.3 / POST-AUDIT ==='
$p=Read-GcloudJson @(gcloud.cmd projects get-iam-policy $Projeto --format=json) 'R7_PROJECT_IAM_POST_FAILED'
foreach($role in @('roles/monitoring.viewer','roles/firebaseauth.admin')){
 if(-not(Has-DirectBinding $p $role $Member '')){throw "R7_ROLE_NOT_FOUND: $role"}
}
if(Has-DirectBinding $p 'roles/datastore.user' $Member ''){
 throw 'R7_UNRESTRICTED_DATASTORE_USER_AFTER_GRANT'
}
foreach($id in $Bancos){
 $expr='resource.name=="projects/'+$Projeto+'/databases/'+$id+'"'
 if(-not(Has-DirectBinding $p 'roles/datastore.user' $Member $expr)){
   throw "R7_CONDITION_NOT_FOUND: $id"
 }
}
foreach($id in $Segredos){
 $s=Read-GcloudJson @(gcloud.cmd secrets get-iam-policy $id --project=$Projeto --format=json) "R7_SECRET_POST_FAILED: $id"
 if(-not(Has-DirectBinding $s 'roles/secretmanager.secretAccessor' $Member '')){
   throw "R7_ACCESSOR_NOT_FOUND: $id"
 }
}
Write-Host 'R7.3 IAM PASS: 11 secrets, monitoring, Firebase Auth, 2 conditioned databases.'
Write-Host 'No app deployment, payment requests, scheduled jobs or domain changes.'
