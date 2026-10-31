# EMPROVEX — ONE integrated Cloud Run staging homologation.
# Default: safe HTTP/identity/hosting checks; -Browser opens the private service on localhost.
# No secrets read, Firestore writes, payment calls, or IAM/deployment/domain mutations.
param([switch]$Browser)
$ErrorActionPreference='Stop'
$Project='gen-lang-client-0982077967'
$Account='marcoa.r.aquino@gmail.com'
$Region='southamerica-east1'
$Service='emprovex-cloudrun-staging'
$Runtime="emprovex-run-runtime@$Project.iam.gserviceaccount.com"
$Port=8089

function CheckExit([string]$why) { if($LASTEXITCODE -ne 0){ throw $why } }
function Get-Status([string]$url,[hashtable]$headers,[string]$name,[int[]]$accepted) {
 $status=0
 $payload=''
 try {
   $r=Invoke-WebRequest -Uri $url -Headers $headers -UseBasicParsing -TimeoutSec 40 -MaximumRedirection 0
   $status=[int]$r.StatusCode
   if($name -eq 'health' -or $name -eq 'clock'){ $payload=[string]$r.Content }
 } catch {
   if(-not $_.Exception.Response) { throw "HOMOLOG_NETWORK_ERROR: $name ($($_.Exception.GetType().Name))" }
   $status=[int]$_.Exception.Response.StatusCode
 }
 if($status -notin $accepted){throw "HOMOLOG_BAD_HTTP: $name HTTP $status"}
 if($name -eq 'health'){
   try{$body=$payload|ConvertFrom-Json}
   catch{throw 'HOMOLOG_HEALTH_NOT_JSON'}
   if($body.status -cne 'ok'){throw 'HOMOLOG_HEALTH_NOT_OK'}
 }
 if($name -eq 'clock'){
   try{$body=$payload|ConvertFrom-Json}
   catch{throw 'HOMOLOG_CLOCK_NOT_JSON'}
   if($body.source -cne 'emprovex-server'){throw 'HOMOLOG_CLOCK_NOT_APP'}
 }
 Write-Host "PASS $name : HTTP $status"
}
function Find-Value($env,[string]$key) {
 $item=@($env|Where-Object{$_.name -eq $key})
 if($item.Count -ne 1){return $null}
 if($item[0].valueFrom){return '[SECRET_REFERENCE]'}
 return [string]$item[0].value
}

Write-Host '=== EMPROVEX / HOMOLOGACAO INTEGRADA EM UMA EXECUCAO ==='
if((gcloud.cmd config get-value project 2>$null).Trim() -ne $Project){throw 'HOMOLOG_WRONG_PROJECT'}
if((gcloud.cmd config get-value account 2>$null).Trim() -ne $Account){throw 'HOMOLOG_WRONG_ACCOUNT'}
$ServiceJson=@(gcloud.cmd run services describe $Service "--region=$Region" "--project=$Project" --format=json)
CheckExit 'HOMOLOG_SERVICE_NOT_FOUND'
$CloudRun=($ServiceJson|Out-String)|ConvertFrom-Json
if([string]$CloudRun.spec.template.spec.serviceAccountName -cne $Runtime){
 throw 'HOMOLOG_RUNTIME_IDENTITY_UNEXPECTED'
}
$envVars=@($CloudRun.spec.template.spec.containers[0].env)
foreach($item in @(
 @{key='EMPROVEX_CLOUD_RUN_STAGE';value='1'},
 @{key='INFINITEPAY_BILLING_ENABLED';value='0'},
 @{key='EMPROVEX_BILLING_ENFORCEMENT_ENABLED';value='0'}
)){
 if((Find-Value $envVars $item.key) -cne $item.value){
  throw "HOMOLOG_STAGING_GUARD_FAILED: $($item.key)"
 }
}
if(@($envVars|Where-Object{$_.valueFrom}).Count -ne 0){
 throw 'HOMOLOG_STAGING_SECRETS_MOUNTED: manual review required'
}
$PolicyJson=@(gcloud.cmd run services get-iam-policy $Service "--region=$Region" "--project=$Project" --format=json)
CheckExit 'HOMOLOG_SERVICE_IAM_UNREADABLE'
$Policy=($PolicyJson|Out-String)|ConvertFrom-Json
if(@($Policy.bindings|Where-Object{
 $_.members -contains 'allUsers' -or $_.members -contains 'allAuthenticatedUsers'
}).Count -ne 0){throw 'HOMOLOG_PUBLIC_IAM_FOUND'}
$url=[string]$CloudRun.status.url
if(-not $url.StartsWith('https://')){throw 'HOMOLOG_SERVICE_URL_UNAVAILABLE'}
Write-Host 'PASS private Cloud Run service, attached identity and staging flags'
Write-Host 'PASS InfinitePay credentials not mounted; no Cloud Run public IAM'
Write-Host "SERVICE: $Service"
Write-Host "URL: $url"

Write-Host '=== ONE-PASS HTTP CHECKS (GET ONLY) ==='
$token=@(gcloud.cmd auth print-identity-token)
CheckExit 'HOMOLOG_GCLOUD_ID_TOKEN_FAILED'
if($token.Count -ne 1 -or [string]::IsNullOrWhiteSpace($token[0])){throw 'HOMOLOG_NO_ID_TOKEN'}
$headers=@{Authorization="Bearer $($token[0])"}
try {
 Get-Status "$url/api/health" $headers 'health' @(200)
 Get-Status "$url/" $headers 'institutional' @(200)
 Get-Status "$url/central-empenhos" $headers 'login-shell' @(200)
 Get-Status "$url/central-depositos" $headers 'warehouse-shell' @(200)
 Get-Status "$url/api/system-time" $headers 'clock' @(200)
 # Unauthenticated API application requests: no Firebase user token supplied.
 Get-Status "$url/api/cron/usage-snapshot" $headers 'cron-requires-secret' @(401)
 Get-Status "$url/api/central-depositos/status" $headers 'warehouse-requires-login' @(401,403)
 Get-Status "$url/api/admin/billing" $headers 'billing-admin-requires-login' @(401,403)
} finally {
 $headers=$null
 $token=$null
}
Write-Host '=== STATUS ==='
Write-Host 'HOMOLOGACAO TECNICA INTEGRADA: PASS'
Write-Host 'NOT YET CERTIFIED: Firebase login, browser App Check, Drive, transactions, payments.'
Write-Host 'Staging uses the production Firebase project: do not mutate customer data.'
Write-Host 'Vercel, custom domain, Secret Manager, Cloud Run IAM and cron remain unchanged.'
if($Browser){
 Write-Host ''
 Write-Host "PROXY PRIVATE: http://localhost:$Port/central-empenhos"
 Write-Host 'Leave this PowerShell open while testing the visual login.'
 Write-Host 'Do not use a real customer workspace for writes or checkout.'
 Write-Host 'Stop proxy with Ctrl+C. If local Firebase sign-in is unauthorized, stop and report it.'
 gcloud.cmd run services proxy $Service "--project=$Project" "--region=$Region" "--port=$Port"
 CheckExit 'HOMOLOG_BROWSER_PROXY_FAILED'
}
