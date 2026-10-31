# EMPROVEX R7.5 - On-demand Cloud Run job IAM proof (no Firestore writes).
# Default: read-only dry-run. -Execute requires exact manual confirmation.
param([switch]$Execute)
$ErrorActionPreference = 'Stop'
$Project = 'gen-lang-client-0982077967'
$Account = 'marcoa.r.aquino@gmail.com'
$Region = 'southamerica-east1'
$Runtime = "emprovex-run-runtime@$Project.iam.gserviceaccount.com"
$Job = 'emprovex-r7-iam-probe'
$Image = 'docker.io/library/node:24-alpine'

function CheckExit([string]$reason) {
 if($LASTEXITCODE -ne 0){throw $reason}
}
$Root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if((git -C $Root branch --show-current).Trim() -ne 'feat/cloud-run-r7-service-identity-20261031'){
 throw 'R7_BRANCH_MISMATCH'
}
if((gcloud.cmd config get-value project 2>$null).Trim() -ne $Project){throw 'R7_PROJECT_MISMATCH'}
if((gcloud.cmd config get-value account 2>$null).Trim() -ne $Account){throw 'R7_ACCOUNT_MISMATCH'}

$Code=Join-Path $PSScriptRoot 'cloud-run-r7-effective-iam-probe.cjs'
if(-not(Test-Path -LiteralPath $Code)){throw 'R7_PROBE_CODE_MISSING'}
node --check $Code
CheckExit 'R7_PROBE_SYNTAX_ERROR'

$Source=[System.IO.File]::ReadAllText($Code,[System.Text.Encoding]::UTF8)
if($Source -notmatch 'R7_PROBE: PASS' -or $Source -notmatch '/documents/emprovex_r7_iam_probe/' -or $Source -match '/documents/__emprovex_r7_iam_probe__/'){
 throw 'R7_PROBE_SOURCE_UNEXPECTED'
}
$Encoded=[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($Source))
if($Encoded.Length -gt 12000){throw 'R7_PROBE_TOO_LONG'}

Write-Host '=== R7.5 / LOCATE PREVIOUS ISOLATED JOB ==='
$Jobs=@(gcloud.cmd run jobs list --region=$Region --project=$Project --format='value(metadata.name)')
CheckExit 'R7_JOBS_LIST_ERROR'
$Exists=@($Jobs|Where-Object{($_ -split '/')[-1] -eq $Job}).Count -gt 0
if($Exists){
 $Raw=@(gcloud.cmd run jobs describe $Job --region=$Region --project=$Project --format=json)
 CheckExit 'R7_PROBE_JOB_DESCRIBE_FAILED'
 $Existing=(($Raw|Out-String)|ConvertFrom-Json)
 $Spec=$Existing.spec.template.spec.template.spec
 if(-not $Spec){$Spec=$Existing.spec.template.spec}
 $CurrentSA=[string]$Spec.serviceAccountName
 $CurrentContainers=@($Spec.containers)
 if($CurrentSA -cne $Runtime -or $CurrentContainers.Count -ne 1 -or
    [string]$CurrentContainers[0].image -notmatch '/node(@|:)' -or
    @($CurrentContainers[0].command) -notcontains 'node'){
   throw 'R7_PROBE_EXISTING_JOB_UNEXPECTED: do not modify this job'
 }
 Write-Host "JOB: $Job (previous test verified; safe to update)"
}else{
 Write-Host "JOB: $Job (new, single-run, no HTTP endpoint)"
}
Write-Host "REGION: $Region"
Write-Host "SERVICE IDENTITY: $Runtime"
Write-Host 'CONTAINER: Official Node.js Docker image'
Write-Host 'ACCESS CHECKS: five GETs on nonexistent Firestore documents'
Write-Host 'EXPECTED: two HTTP 404 and three HTTP 403'
Write-Host 'COST: Cloud Run job execution and minimal Firestore API usage may be billable'
Write-Host 'No secrets/keys read, no writes, no deployment of EMPROVEX'
if(-not $Execute){
 Write-Host 'R7.5 DRY-RUN PASS: no Cloud Run job created or modified.'
 return
}
$confirmation=Read-Host 'Digite EXECUTAR-R7-PROBE para criar e executar o job'
if($confirmation -cne 'EXECUTAR-R7-PROBE'){throw 'R7_PROBE_CANCELLED'}

Write-Host '=== R7.5 / CREATE OR FIX EXISTING ISOLATED JOB ==='
# Exactly two Node arguments: --eval and a base64-decoded inline script.
# The encoded source contains no credentials and is read from the tracked file.
$Args="--eval,eval(atob('$Encoded'))"
if($Exists){
 gcloud.cmd run jobs update $Job `
  --command=node `
  "--args=$Args" `
  --service-account=$Runtime `
  --region=$Region `
  --project=$Project `
  --tasks=1 `
  --max-retries=0 `
  --quiet
 CheckExit 'R7_PROBE_JOB_UPDATE_FAILED'
}else{
 gcloud.cmd run jobs create $Job `
  --image=$Image `
  --command=node `
  "--args=$Args" `
  --service-account=$Runtime `
  --region=$Region `
  --project=$Project `
  --tasks=1 `
  --max-retries=0 `
  --task-timeout=120s `
  --cpu=1 `
  --memory=512Mi `
  --quiet
 CheckExit 'R7_PROBE_JOB_CREATE_FAILED'
}

Write-Host '=== R7.5 / EXECUTE JOB AND CHECK EXIT STATUS ==='
gcloud.cmd run jobs execute $Job `
 --region=$Region `
 --project=$Project `
 --wait `
 --quiet
CheckExit 'R7_PROBE_EXECUTION_FAILED: inspect Cloud Run Job logs; do not modify IAM blindly'

Write-Host '=== R7.5 / RESULT ==='
Write-Host 'R7.5 EFFECTIVE IAM PASS: Cloud Run job completed without errors.'
Write-Host 'Inspect logs for five PASS statements (2 allowed and 3 denied).'
Write-Host "Job can be removed after logs have been reviewed: $Job"
