# EMPROVEX R7.4 — read-only IAM inspection and optional service-account permission probe.
# No keys, IAM changes, Firestore writes or real customer document reads.
$ErrorActionPreference = 'Stop'
$Project = 'gen-lang-client-0982077967'
$Account = 'marcoa.r.aquino@gmail.com'
$Runtime = "emprovex-run-runtime@$Project.iam.gserviceaccount.com"
$Member = "serviceAccount:$Runtime"
$Allowed = @(
 'ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1',
 'emprovex-warehouse'
)
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
function MustExit($reason) { if ($LASTEXITCODE -ne 0) { throw $reason } }
function GJson([string[]]$result, [string]$reason) {
 MustExit $reason
 return (($result | Out-String) | ConvertFrom-Json)
}
if ((gcloud.cmd config get-value project 2>$null).Trim() -ne $Project) { throw 'R7_PROJECT_MISMATCH' }
if ((gcloud.cmd config get-value account 2>$null).Trim() -ne $Account) { throw 'R7_ACCOUNT_MISMATCH' }

Write-Host '=== R7.4 / STRUCTURAL IAM ==='
$policy = GJson @(gcloud.cmd projects get-iam-policy $Project --format=json) 'R7_IAM_UNREADABLE'
$runtimeBindings = @($policy.bindings | Where-Object { $_.members -contains $Member })

foreach ($role in @('roles/firebaseauth.admin', 'roles/monitoring.viewer')) {
 $bind = @($runtimeBindings | Where-Object {
   $_.role -eq $role -and [string]$_.condition.expression -eq ''
 })
 if ($bind.Count -ne 1) { throw "R7_PROJECT_ROLE_MISSING_OR_DUPLICATED: $role" }
 Write-Host "PASS ROLE: $role"
}
$dbBindings = @($runtimeBindings | Where-Object { $_.role -eq 'roles/datastore.user' })
if ($dbBindings.Count -ne 2) { throw "R7_FIRESTORE_BINDING_COUNT: $($dbBindings.Count)" }
$expected = @($Allowed | ForEach-Object { 'resource.name=="projects/'+$Project+'/databases/'+$_+'"' })
$actual = @($dbBindings | ForEach-Object { [string]$_.condition.expression })
foreach ($expr in $expected) {
 if (@($actual | Where-Object { $_ -ceq $expr }).Count -ne 1) {
   throw "R7_FIRESTORE_CONDITION_MISSING: $expr"
 }
}
Write-Host 'PASS FIRESTORE: exactly two database-scoped bindings for roles/datastore.user'

Write-Host '=== R7.4 / SECRET MANAGER DIRECT IAM ==='
foreach ($id in $Secrets) {
 $p = GJson @(gcloud.cmd secrets get-iam-policy $id --project=$Project --format=json) "R7_SECRET_IAM_UNREADABLE: $id"
 $bind = @($p.bindings | Where-Object {
  $_.role -eq 'roles/secretmanager.secretAccessor' -and
  ($_.members -contains $Member) -and
  ([string]$_.condition.expression -eq '')
 })
 if ($bind.Count -ne 1) { throw "R7_SECRET_ACCESSOR_MISSING: $id" }
 Write-Host "PASS SECRET: $id"
}

Write-Host '=== R7.4 / FIRESTORE DATABASE INVENTORY ==='
$dbNames = @(gcloud.cmd firestore databases list --project=$Project --format='value(name)')
MustExit 'R7_DATABASE_LIST_FAILED'
$found = @($dbNames | ForEach-Object { ($_ -split '/')[-1] })
foreach ($db in $Allowed) {
 if ($db -notin $found) { throw "R7_ALLOWED_DATABASE_MISSING: $db" }
}
Write-Host "PASS: $($found.Count) existing databases; 2 named as intended"
Write-Host 'R7.4 STRUCTURAL IAM PASS — no IAM changes'

# gcloud impersonation requires iam.serviceAccounts.getAccessToken on the runtime SA.
# If it is not available, skip: never grant broader privileges just for this probe.
Write-Host '=== R7.4 / EFFECTIVE ACCESS (IF IMPERSONATION ALREADY AUTHORIZED) ==='
$tokenResult = @(gcloud.cmd auth print-access-token "--impersonate-service-account=$Runtime" --project=$Project 2>$null)
if ($LASTEXITCODE -ne 0 -or $tokenResult.Count -ne 1 -or
    [string]::IsNullOrWhiteSpace($tokenResult[0])) {
 Write-Host 'R7.4 EFFECTIVE: NOT TESTED (no impersonation permission). No IAM role was added.'
 Write-Host 'Next step: read-only probe inside isolated Cloud Run runtime, with attached SA.'
 return
}
$token = [string]$tokenResult[0]
try {
 $headers = @{ Authorization = "Bearer $token" }
 $nonce = 'r7-iam-' + [guid]::NewGuid().ToString('N')
 $pass = 0
 foreach ($db in $found) {
   $uri = "https://firestore.googleapis.com/v1/projects/$Project/databases/$db/documents/__emprovex_r7_iam_probe__/$nonce"
   $status = 0
   try {
     $response = Invoke-WebRequest -Uri $uri -Headers $headers -Method Get -UseBasicParsing -TimeoutSec 20
     $status = [int]$response.StatusCode
   } catch {
     if ($null -eq $_.Exception.Response) {
       throw "R7_FIRESTORE_NETWORK_ERROR: $db (no authorization conclusion)"
     }
     $status = [int]$_.Exception.Response.StatusCode
   }
   $expectedStatus = if ($db -in $Allowed) { 404 } else { 403 }
   if ($status -ne $expectedStatus) {
      throw "R7_EFFECTIVE_ACCESS_MISMATCH: $db HTTP $status, expected $expectedStatus"
   }
   $pass++
   Write-Host "PASS ACCESS: $db HTTP $status (nonexistent probe document)"
 }
 Write-Host "R7.4 EFFECTIVE PASS: $pass/$($found.Count) read-only authorization probes"
} finally {
 $token = $null
 $headers = $null
}
