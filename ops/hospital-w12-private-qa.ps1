# Run from a clean checkout of the current W12 branch.
# W12 only: no-traffic, private Cloud Run tag, synthetic organization, no patient seeding.
param([string]$HospitalApiKey,[string]$HospitalAppId)
$ErrorActionPreference = 'Stop'
$account='marcoa.r.aquino@gmail.com'
$project='cozinha-dietetica'
$region='southamerica-east1'
$service='cozinha-dietetica-qa'
$branch='feat/cozinha-dietetica-w12-homologacao-piloto'
$runtime='hospital-qa-runtime@cozinha-dietetica.iam.gserviceaccount.com'
$repository='southamerica-east1-docker.pkg.dev/cozinha-dietetica/hospital-qa/hospital-web'
$tag='w12qa'
$organization='qa_hgesm_w12_20261112'

function Assert-Exit([string]$phase) {
  if($LASTEXITCODE -ne 0){throw "$phase failed (exit=$LASTEXITCODE). Stop."}
}
function Read-Service {
  $json = & gcloud.cmd --account=$account run services describe $service `
    --project=$project --region=$region --format=json
  Assert-Exit 'Cloud Run describe'
  return ($json | Out-String | ConvertFrom-Json)
}
function Assert-Service($item) {
  if($item.metadata.name -ne $service){throw 'Wrong service'}
  if($item.metadata.annotations.'run.googleapis.com/ingress' -ne 'internal'){throw 'Ingress is not internal'}
  if($item.spec.template.spec.serviceAccountName -ne $runtime){throw 'Wrong runtime SA'}
  if([string]$item.metadata.annotations.'run.googleapis.com/maxScale' -ne '1'){throw 'Service-wide maxScale is not 1'}
}
function Assert-IAM {
  $policy = & gcloud.cmd --account=$account run services get-iam-policy $service `
    --project=$project --region=$region --format=json
  Assert-Exit 'Cloud Run IAM read'
  if(($policy | Out-String) -match 'allUsers|allAuthenticatedUsers'){throw 'Public invoker found; abort'}
}
$actualBranch=(& git branch --show-current | Out-String).Trim()
Assert-Exit 'Git branch'
if($actualBranch -ne $branch){throw "Wrong branch: $actualBranch"}
$changes=@(& git status --porcelain)
Assert-Exit 'Git status'
if($changes.Count -gt 0){throw 'Dirty checkout; abort'}
& git fetch origin $branch
Assert-Exit 'Git fetch'
$head=(& git rev-parse HEAD | Out-String).Trim()
Assert-Exit 'Git HEAD'
$remote=(& git rev-parse "origin/$branch" | Out-String).Trim()
Assert-Exit 'Git remote HEAD'
if($head -ne $remote){throw 'Run git pull --ff-only first; source SHA does not match'}
if(-not (Test-Path 'ops/hospital-w12-cloudbuild-qa.yaml')){throw 'Missing W12 build manifest'}
if(-not $HospitalApiKey){$HospitalApiKey=Read-Host 'Hospital Firebase WEB apiKey (public config)'}
if(-not $HospitalAppId){$HospitalAppId=Read-Host 'Hospital Firebase WEB appId (public config)'}
if([string]::IsNullOrWhiteSpace($HospitalApiKey) -or [string]::IsNullOrWhiteSpace($HospitalAppId)){
  throw 'Missing public Firebase Web config'
}

$before=Read-Service
Assert-Service $before
Assert-IAM
$activeBefore=@($before.status.traffic | Where-Object {[int]$_.percent -gt 0} |
  ForEach-Object {"$($_.revisionName):$($_.percent)"} | Sort-Object) -join '|'
Write-Host "Source HEAD: $head"
Write-Host "Current active traffic: $activeBefore"

$buildId=(& gcloud.cmd --account=$account builds submit . `
  --project=$project --config='ops/hospital-w12-cloudbuild-qa.yaml' `
  --substitutions="_HOSPITAL_API_KEY=$HospitalApiKey,_HOSPITAL_APP_ID=$HospitalAppId" `
  --suppress-logs --format='value(id)' | Out-String).Trim()
Assert-Exit 'Cloud Build'
if($buildId -notmatch '^[0-9a-fA-F-]{36}$'){throw "Unrecognized Cloud Build ID: $buildId"}
$status=(& gcloud.cmd --account=$account builds describe $buildId --project=$project `
  --format='value(status)' | Out-String).Trim()
Assert-Exit 'Build status'
if($status -ne 'SUCCESS'){throw "Build not successful: $status"}
$digest=(& gcloud.cmd --account=$account builds describe $buildId --project=$project `
  --format='value(results.images[0].digest)' | Out-String).Trim()
Assert-Exit 'Build digest'
if($digest -notmatch '^sha256:[0-9a-f]{64}$'){throw "Digest not available for $buildId; no deploy"}
$image="$repository@$digest"

& gcloud.cmd --account=$account run deploy $service `
  --project=$project --region=$region --image=$image `
  --service-account=$runtime --ingress=internal --no-allow-unauthenticated `
  --no-traffic --tag=$tag --min-instances=0 --max-instances=1 --max=1 `
  --concurrency=10 --cpu=1 --memory=512Mi `
  --update-env-vars="HOSPITAL_QA_ORGANIZATION_ID=$organization,HOSPITAL_QA_APP_READY=1"
Assert-Exit 'Private W12 revision deployment'

$after=Read-Service
Assert-Service $after
Assert-IAM
$activeAfter=@($after.status.traffic | Where-Object {[int]$_.percent -gt 0} |
  ForEach-Object {"$($_.revisionName):$($_.percent)"} | Sort-Object) -join '|'
$tagged=@($after.status.traffic | Where-Object {$_.tag -eq $tag})
if($activeBefore -ne $activeAfter){throw 'W11 traffic changed; inspect service'}
if($tagged.Count -ne 1 -or [int]$tagged[0].percent -ne 0){
  throw 'Zero-traffic tag missing; inspect service'
}
Write-Host 'PASS: W12 private tagged revision deployed; live W11 traffic unchanged.'
Write-Host "Build ID: $buildId"
Write-Host "Source HEAD: $head"
Write-Host "Image: $image"
Write-Host "Private tag URL: $($tagged[0].url)"
Write-Host "Synthetic org: $organization"
Write-Host 'Synthetic accounts/Firestore clinical flows NOT YET TESTED.'
