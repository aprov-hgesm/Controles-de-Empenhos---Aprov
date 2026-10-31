# EMPROVEX — HISTORICAL BOOTSTRAP ONLY (31/10/2026), NOT A RELEASE COMMAND.
# New production versions: ops/release-emprovex-cloud-run.ps1 -Stage / -PromoteRevision.
# EMPROVEX — build-free, isolated Cloud Run production candidate using tested staging image.
# No domain/hosting/cron/public Cloud Run changes. Authorize creation explicitly.
param([switch]$Create)
$ErrorActionPreference='Stop'
$Project='gen-lang-client-0982077967'
$Account='marcoa.r.aquino@gmail.com'
$Region='southamerica-east1'
$Source='emprovex-cloudrun-staging'
$Destination='emprovex-cloudrun-candidate'
$Runtime="emprovex-run-runtime@$Project.iam.gserviceaccount.com"
$ExpectedBranch='feat/cloud-run-r7-service-identity-20261031'
$Root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function MustExit([string]$reason){if($LASTEXITCODE -ne 0){throw $reason}}
function ReadJson([string[]]$raw,[string]$reason){
 MustExit $reason
 return (($raw | Out-String) | ConvertFrom-Json)
}
if((gcloud.cmd config get-value project 2>$null).Trim() -cne $Project){throw 'CUTOVER_WRONG_GCP_PROJECT'}
if((gcloud.cmd config get-value account 2>$null).Trim() -cne $Account){throw 'CUTOVER_WRONG_GCP_ACCOUNT'}
if((git -C $Root branch --show-current).Trim() -cne $ExpectedBranch){throw 'CUTOVER_WRONG_BRANCH'}
if(@(git -C $Root status --porcelain).Count -ne 0){throw 'CUTOVER_UNCOMMITTED_FILES'}
$sourceObj=ReadJson @(gcloud.cmd run services describe $Source "--project=$Project" "--region=$Region" --format=json) 'CUTOVER_SOURCE_MISSING'
if([string]$sourceObj.spec.template.spec.serviceAccountName -cne $Runtime){throw 'CUTOVER_SOURCE_SA_MISMATCH'}
$sourceEnv=@($sourceObj.spec.template.spec.containers[0].env)
$flag=@($sourceEnv|Where-Object{$_.name -eq 'INFINITEPAY_BILLING_ENABLED'})
if($flag.Count -ne 1 -or [string]$flag[0].value -cne '0'){throw 'CUTOVER_SOURCE_NOT_ISOLATED'}
$revision=[string]$sourceObj.status.latestReadyRevisionName
if(-not $revision){throw 'CUTOVER_SOURCE_REVISION_MISSING'}
$revObj=ReadJson @(gcloud.cmd run revisions describe $revision "--project=$Project" "--region=$Region" --format=json) 'CUTOVER_REVISION_READ_FAILED'
$image=[string]$revObj.spec.containers[0].image
if(-not $image -or $image -notmatch '^.+/(.+)(@sha256:[a-f0-9]{64}|:[A-Za-z0-9._-]+)$'){
 throw 'CUTOVER_SOURCE_IMAGE_MISSING'
}

$secrets=[ordered]@{
 'INFINITEPAY_API_KEY'='emprovex-infinitepay-api-key'
 'INFINITEPAY_ORDER_SECRET'='emprovex-infinitepay-order-secret'
 'INFINITEPAY_WEBHOOK_TOKEN'='emprovex-infinitepay-webhook-token'
 'EMPROVEX_BILLING_QA_WORKSPACE_ID'='emprovex-billing-qa-workspace-id'
 'EMPROVEX_BILLING_RULES_CERTIFIED'='emprovex-billing-rules-certified'
 'EMPROVEX_BILLING_ENFORCEMENT_ENABLED'='emprovex-billing-enforcement-enabled'
 'INFINITEPAY_BILLING_PILOT_WORKSPACE_ID'='emprovex-infinitepay-billing-pilot-workspace-id'
 'INFINITEPAY_BILLING_SCOPE'='emprovex-infinitepay-billing-scope'
 'INFINITEPAY_BILLING_ENABLED'='emprovex-infinitepay-billing-enabled'
 'EMPROVEX_BILLING_PUBLIC_ORIGIN'='emprovex-billing-public-origin'
 'INFINITEPAY_HANDLE'='emprovex-infinitepay-handle'
}
foreach($secret in $secrets.Values){
 $state=@(gcloud.cmd secrets versions describe 1 "--secret=$secret" "--project=$Project" --format='value(state)')
 MustExit "CUTOVER_SECRET_UNAVAILABLE: $secret"
 if($state.Count -ne 1 -or $state[0].Trim() -cne 'ENABLED'){throw "CUTOVER_SECRET_NOT_ENABLED: $secret"}
}
$existing=@(gcloud.cmd run services list "--project=$Project" "--region=$Region" --format='value(metadata.name)')
MustExit 'CUTOVER_SERVICES_LIST_FAILED'
if(@($existing|Where-Object{($_ -split '/')[-1] -ceq $Destination}).Count -gt 0){
 throw 'CUTOVER_CANDIDATE_EXISTS: manually inspect; never replace implicitly'
}

Write-Host '=== EMPROVEX / PREPARAR CANDIDATO PRIVADO ==='
Write-Host "PROJECT: $Project"
Write-Host "SOURCE REVISION: $revision"
Write-Host "IMAGE: $image"
Write-Host "CANDIDATE: $Destination"
Write-Host "RUNTIME: $Runtime"
Write-Host "SECRETS: $($secrets.Count) Secret Manager references, version 1 only"
Write-Host 'INITIAL ACCESS: PRIVATE (no public IAM)'
Write-Host 'FINANCIAL FLAGS: preserve value of migrated production secrets (not printed)'
Write-Host 'CRON: remains on Vercel, no Cloud Scheduler created'
Write-Host 'NO DNS, Firebase Hosting, production Vercel or Firestore Rules changes'
Write-Host 'Cloud Run usage may incur charges'
if(-not $Create){
 Write-Host 'CANDIDATE DRY-RUN PASS: no changes made.'
 return
}
$confirm=Read-Host 'Digite CRIAR-CANDIDATO-PRIVADO para autorizar'
if($confirm -cne 'CRIAR-CANDIDATO-PRIVADO'){throw 'CUTOVER_ABORTED'}
$mounts=($secrets.Keys|ForEach-Object{"$_=$($secrets[$_]):1"}) -join ','
# Cloud Run prod candidate uses identical image from homologated staging.
$args=@(
 'run','deploy',$Destination,"--image=$image",
 "--project=$Project","--region=$Region","--service-account=$Runtime",
 '--no-allow-unauthenticated','--ingress=all','--port=8080',
 '--cpu=1','--memory=1Gi','--min-instances=0','--max-instances=2',
 '--concurrency=20','--timeout=60s',
 "--set-secrets=$mounts",
 '--set-env-vars=EMPROVEX_CLOUD_RUN_STAGE=0,APP_URL=https://emprovex.com.br',
 '--quiet'
)
& gcloud.cmd @args
MustExit 'CUTOVER_CANDIDATE_DEPLOY_FAILED'
$obj=ReadJson @(gcloud.cmd run services describe $Destination "--project=$Project" "--region=$Region" --format=json) 'CUTOVER_CANDIDATE_DESCRIBE_FAILED'
if([string]$obj.spec.template.spec.serviceAccountName -cne $Runtime){throw 'CUTOVER_CANDIDATE_SA_MISMATCH'}
$mounted=@($obj.spec.template.spec.containers[0].env | Where-Object{$_.valueFrom.secretKeyRef})
if($mounted.Count -ne $secrets.Count){throw 'CUTOVER_SECRET_REFERENCE_COUNT_MISMATCH'}
foreach($var in $secrets.Keys){
 if(@($mounted|Where-Object{$_.name -ceq $var}).Count -ne 1){throw "CUTOVER_SECRET_REFERENCE_MISSING: $var"}
}
$p=ReadJson @(gcloud.cmd run services get-iam-policy $Destination "--project=$Project" "--region=$Region" --format=json) 'CUTOVER_CANDIDATE_IAM_READ_FAILED'
if(@($p.bindings|Where-Object{$_.members -contains 'allUsers' -or $_.members -contains 'allAuthenticatedUsers'}).Count -ne 0){
 throw 'CUTOVER_CANDIDATE_PUBLIC_IAM_FOUND'
}
Write-Host 'CANDIDATE PASS: correct SA, 11 pinned Secret Manager references, private IAM.'
Write-Host "CANDIDATE PRIVATE URL: $($obj.status.url)"
Write-Host 'No domain/Hosting/cron change. Candidate is NOT customer-facing.'
