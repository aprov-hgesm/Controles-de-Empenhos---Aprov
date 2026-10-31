# HISTORICAL INITIAL CUTOVER TOOL ONLY. Site, certificate and DNS are already in production.
# For new app versions do NOT redeploy Hosting; use ops/release-emprovex-cloud-run.ps1.
# EMPROVEX Firebase Hosting routing to Cloud Run in Sao Paulo.
# In its initial stage the Cloud Run candidate MUST remain PRIVATE.
# This does not alter emprovex.com.br DNS, Vercel or Firestore Rules.
param([switch]$Prepare)
$ErrorActionPreference='Stop'
$Project='gen-lang-client-0982077967'
$Account='marcoa.r.aquino@gmail.com'
$Region='southamerica-east1'
$Service='emprovex-cloudrun-candidate'
$Site='emprovex-cloudrun-943599311487'
$ConfigDir=Join-Path $PSScriptRoot 'cloud-run-hosting'

function MustExit([string]$reason){if($LASTEXITCODE -ne 0){throw $reason}}
if((gcloud.cmd config get-value project 2>$null).Trim() -cne $Project){throw 'HOSTING_PROJECT_MISMATCH'}
if((gcloud.cmd config get-value account 2>$null).Trim() -cne $Account){throw 'HOSTING_ACCOUNT_MISMATCH'}
if(-not(Test-Path (Join-Path $ConfigDir 'firebase.json'))){throw 'HOSTING_CONFIG_NOT_FOUND'}
$Config=Get-Content (Join-Path $ConfigDir 'firebase.json') -Raw | ConvertFrom-Json
if($Config.hosting.site -cne $Site -or
   $Config.hosting.rewrites[0].run.serviceId -cne $Service -or
   $Config.hosting.rewrites[0].run.region -cne $Region){
 throw 'HOSTING_CONFIG_UNEXPECTED'
}
$serviceRaw=@(gcloud.cmd run services describe $Service "--project=$Project" "--region=$Region" --format=json)
MustExit 'HOSTING_CANDIDATE_SERVICE_MISSING'
$svc=($serviceRaw|Out-String)|ConvertFrom-Json
if(-not [string]$svc.status.url){throw 'HOSTING_CANDIDATE_NOT_READY'}
$polRaw=@(gcloud.cmd run services get-iam-policy $Service "--project=$Project" "--region=$Region" --format=json)
MustExit 'HOSTING_CANDIDATE_IAM_READ_FAILED'
$pol=($polRaw|Out-String)|ConvertFrom-Json
if(@($pol.bindings|Where-Object{
 $_.members -contains 'allUsers' -or $_.members -contains 'allAuthenticatedUsers'
}).Count -ne 0){throw 'HOSTING_CANDIDATE_ALREADY_PUBLIC'}
Write-Host '=== EMPROVEX / PREPARAR DOMINIO (SEM CORTE DNS) ==='
Write-Host "SITE: $Site"
Write-Host "DESTINO: $Service in $Region"
Write-Host 'Cloud Run candidate remains private; website will not serve the app until final activation.'
Write-Host 'Hosting config is isolated: never deploy Firestore Rules.'
Write-Host 'Vercel, DNS, domain, InfinitePay callbacks and cron unaffected.'
Write-Host 'Firebase Hosting usage may incur charges.'
if(-not $Prepare){Write-Host 'HOSTING DRY-RUN PASS — no changes made.';return}
$confirm=Read-Host 'Digite CRIAR-HOSTING-SEM-DNS para autorizar'
if($confirm -cne 'CRIAR-HOSTING-SEM-DNS'){throw 'HOSTING_CANCELLED'}

# Resolve Firebase CLI through npx, without requiring global installation.
$listing=@(& npx.cmd --yes firebase-tools hosting:sites:list "--project=$Project" --json)
MustExit 'HOSTING_SITE_LIST_FAILED'
$listJson=($listing|Out-String)|ConvertFrom-Json
if($listJson.status -cne 'success'){throw 'HOSTING_SITE_LIST_NOT_SUCCESS'}
$allSites=@($listJson.result)
$exists=@($allSites|Where-Object{($_.name -split '/')[-1] -eq $Site}).Count -gt 0
if(-not $exists){
 & npx.cmd --yes firebase-tools hosting:sites:create $Site "--project=$Project" --non-interactive
 MustExit 'HOSTING_SITE_CREATE_FAILED'
 Write-Host "SITE CREATED: $Site"
}else{
 Write-Host "SITE REUSED: $Site"
}
Push-Location $ConfigDir
try{
 & npx.cmd --yes firebase-tools deploy --only hosting "--project=$Project" --config firebase.json --non-interactive
 MustExit 'HOSTING_DEPLOY_FAILED'
}finally{Pop-Location}
Write-Host "HOSTING EDGE READY: https://$Site.web.app"
Write-Host 'Application intentionally private. DNS not touched; Vercel production preserved.'
