# EMPROVEX Cloud Run — deploy a separate PRIVATE staging service, never production.
# Dry-run by default. -Deploy requires a typed confirmation and can incur costs.
param([switch]$Deploy)
$ErrorActionPreference='Stop'
$Project='gen-lang-client-0982077967'
$Account='marcoa.r.aquino@gmail.com'
$Region='southamerica-east1'
$Service='emprovex-cloudrun-staging'
$Runtime="emprovex-run-runtime@$Project.iam.gserviceaccount.com"
$BuildAccount='943599311487-compute@developer.gserviceaccount.com'
$BuildMember="serviceAccount:$BuildAccount"
$ExpectedBranch='feat/cloud-run-r7-service-identity-20261031'
$Root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function MustExit([string]$message) { if($LASTEXITCODE -ne 0){throw $message} }
if((gcloud.cmd config get-value project 2>$null).Trim() -ne $Project){throw 'WRONG_GCP_PROJECT'}
if((gcloud.cmd config get-value account 2>$null).Trim() -ne $Account){throw 'WRONG_GCP_ACCOUNT'}
if((git -C $Root branch --show-current).Trim() -ne $ExpectedBranch){throw 'WRONG_GIT_BRANCH'}
if(@(git -C $Root status --porcelain).Count -gt 0){throw 'UNCOMMITTED_WORKING_TREE'}
if(-not (Test-Path (Join-Path $Root 'Dockerfile')) -or
   -not (Test-Path (Join-Path $Root '.dockerignore'))){throw 'CONTAINER_BUILD_FILES_MISSING'}
if(-not (Select-String -Path (Join-Path $Root 'next.config.ts') -Pattern "output: 'standalone'" -SimpleMatch -Quiet)){
 throw 'NEXT_STANDALONE_NOT_ENABLED'
}
$SACheck=@(gcloud.cmd iam service-accounts describe $Runtime --project=$Project --format='value(disabled)')
MustExit 'RUNTIME_ACCOUNT_NOT_FOUND'
if($SACheck -contains 'True'){throw 'RUNTIME_ACCOUNT_DISABLED'}

# An earlier failed source build may leave a staging service resource.
# Reuse only if it already has the expected runtime identity and private IAM.
$Existing=@(gcloud.cmd run services list --project=$Project --region=$Region --format='value(metadata.name)')
MustExit 'RUN_SERVICES_LIST_FAILED'
$ServiceExists=@($Existing | Where-Object { ($_ -split '/')[-1] -eq $Service }).Count -gt 0
if($ServiceExists){
 $ExistingJson=@(gcloud.cmd run services describe $Service --project=$Project --region=$Region --format=json)
 MustExit 'STAGING_EXISTING_DESCRIBE_FAILED'
 $ExistingObject=($ExistingJson|Out-String)|ConvertFrom-Json
 if([string]$ExistingObject.spec.template.spec.serviceAccountName -cne $Runtime){
  throw 'STAGING_EXISTING_RUNTIME_MISMATCH: manual review required'
 }
 $ExistingPolicyJson=@(gcloud.cmd run services get-iam-policy $Service --project=$Project --region=$Region --format=json)
 MustExit 'STAGING_EXISTING_IAM_READ_FAILED'
 $ExistingPolicy=($ExistingPolicyJson|Out-String)|ConvertFrom-Json
 if(@($ExistingPolicy.bindings|Where-Object{
   $_.members -contains 'allUsers' -or $_.members -contains 'allAuthenticatedUsers'
 }).Count -gt 0){
  throw 'STAGING_EXISTING_PUBLIC_BINDING: manual review required'
 }
}
# Use the EXACT default Compute Engine build account reported by the failed build.
# Grant only the Google-documented roles/run.builder role, never Owner or Editor.
$BuildAccountEnabled=@(gcloud.cmd iam service-accounts describe $BuildAccount --project=$Project --format='value(disabled)')
MustExit 'CLOUD_BUILD_ACCOUNT_NOT_FOUND'
if($BuildAccountEnabled -contains 'True'){throw 'CLOUD_BUILD_ACCOUNT_DISABLED'}
$ProjectIamJson=@(gcloud.cmd projects get-iam-policy $Project --format=json)
MustExit 'PROJECT_IAM_READ_FAILED'
$ProjectIam=($ProjectIamJson|Out-String)|ConvertFrom-Json
$BuilderGranted=@($ProjectIam.bindings|Where-Object{
 $_.role -eq 'roles/run.builder' -and
 ($_.members -contains $BuildMember) -and
 ([string]$_.condition.expression -eq '')
}).Count -gt 0
Write-Host '=== EMPROVEX PRIVATE CLOUD RUN STAGING / PRECHECK ==='
Write-Host "PROJECT: $Project"
Write-Host "REGION: $Region"
Write-Host "SERVICE: $Service"
Write-Host "RUNTIME: $Runtime"
Write-Host "BUILD IDENTITY: $BuildAccount"
Write-Host "BUILD ROLE: roles/run.builder (already granted: $BuilderGranted)"
Write-Host "EXISTING STAGING SERVICE: $ServiceExists"
Write-Host "GIT SHA: $((git -C $Root rev-parse HEAD).Trim())"
Write-Host 'ACCESS: IAM-authenticated only (no public allUsers access)'
Write-Host 'BILLING: InfinitePay and financial enforcement disabled in staging.'
Write-Host 'SECRETS: NONE mounted in initial smoke test.'
Write-Host 'SERVICES: Cloud Run builds source with Dockerfile, 0 min / 1 max instance.'
Write-Host 'DOES NOT: update domain, Vercel, webhooks, cron, Firebase Auth domains, or main.'
Write-Host 'COST: Cloud Build, Artifact Registry and Cloud Run may be billed.'
if(-not $Deploy){
 Write-Host 'EMPROVEX STAGING DRY-RUN PASS; no IAM binding or service modified.'
 return
}
$Confirmation=Read-Host 'Digite CRIAR-STAGING-PRIVADO para autorizar build IAM e deploy'
if($Confirmation -cne 'CRIAR-STAGING-PRIVADO'){throw 'DEPLOY_CANCELLED'}

if(-not $BuilderGranted){
 Write-Host '=== CLOUD BUILD / GRANT OFFICIAL BUILD ROLE ==='
 gcloud.cmd projects add-iam-policy-binding $Project `
   "--member=$BuildMember" `
   --role=roles/run.builder `
   --condition=None `
   --quiet --format=none
 MustExit 'CLOUD_BUILD_BUILDER_ROLE_GRANT_FAILED'
 Write-Host 'BUILD ROLE: granted to Compute Engine default build service account.'
}else{
 Write-Host 'BUILD ROLE: already granted; no IAM update.'
}

$DeployArgs=@(
 'run','deploy',$Service,
 '--source','.',
 "--region=$Region",
 "--project=$Project",
 "--service-account=$Runtime",
 '--no-allow-unauthenticated',
 '--ingress=all',
 '--port=8080',
 '--cpu=1',
 '--memory=1Gi',
 '--min-instances=0',
 '--max-instances=1',
 '--concurrency=10',
 '--timeout=60s',
 '--set-env-vars=EMPROVEX_CLOUD_RUN_STAGE=1,INFINITEPAY_BILLING_ENABLED=0,EMPROVEX_BILLING_ENFORCEMENT_ENABLED=0',
 '--quiet'
)
Push-Location $Root
try {
  # No production InfinitePay secrets are injected to this staging service.
  & gcloud.cmd @DeployArgs
  MustExit 'CLOUD_RUN_STAGING_DEPLOY_FAILED'
} finally { Pop-Location }
Write-Host '=== DEPLOYED PRIVATE SERVICE ==='
$ServiceJson=@(gcloud.cmd run services describe $Service --region=$Region --project=$Project --format=json)
MustExit 'STAGING_DESCRIBE_FAILED'
$Obj=($ServiceJson|Out-String)|ConvertFrom-Json
$ObjURL=[string]$Obj.status.url
if(-not $ObjURL.StartsWith('https://')){throw 'STAGING_NO_HTTPS_URL'}
if([string]$Obj.spec.template.spec.serviceAccountName -cne $Runtime){
 throw 'STAGING_WRONG_RUNTIME_IDENTITY'
}
$PolicyJson=@(gcloud.cmd run services get-iam-policy $Service --region=$Region --project=$Project --format=json)
MustExit 'STAGING_IAM_READ_FAILED'
$Policy=($PolicyJson|Out-String)|ConvertFrom-Json
$PublicBindings=@($Policy.bindings|Where-Object{
 $_.members -contains 'allUsers' -or $_.members -contains 'allAuthenticatedUsers'
})
if($PublicBindings.Count -gt 0){throw 'STAGING_PUBLIC_IAM_BINDING_FOUND'}
Write-Host 'PASS: runtime identity correct; no allUsers/allAuthenticatedUsers IAM binding.'
Write-Host "STAGING PRIVATE URL: $ObjURL"
Write-Host 'Deploy finished; Cloud Run IAM authentication required for requests.'
Write-Host 'Financial integration and login on the staging host are NOT certified.'
Write-Host 'EMPROVEX STAGING DEPLOY PASS (private; no domain cutover).'
