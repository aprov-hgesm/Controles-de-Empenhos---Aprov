# EMPROVEX R4: create restricted Workload Identity Federation for Vercel -> GCP.
# Requires Vercel Settings > Security > OIDC Federation issuer mode = Team.
# No secret values are read or written. Does NOT deploy or change billing.
$ErrorActionPreference='Stop'
$Projeto='gen-lang-client-0982077967'
$Numero='943599311487'
$Conta='marcoa.r.aquino@gmail.com'
$Team='aprov-hgesms-projects'
$Pool='emprovex-vercel-r4'
$Provider='vercel-production'
$Migrator='emprovex-vercel-secret-migrator'
$Email="$Migrator@$Projeto.iam.gserviceaccount.com"
$Subject="owner:$Team"+':project:controles-de-empenhos-aprov:environment:production'
$Principal="principal://iam.googleapis.com/projects/$Numero/locations/global/workloadIdentityPools/$Pool/subject/$Subject"
$Segredos=@('emprovex-infinitepay-api-key','emprovex-infinitepay-order-secret','emprovex-infinitepay-webhook-token')
function AssertExit([string]$Message){if($LASTEXITCODE -ne 0){throw $Message}}
if((gcloud.cmd config get-value project 2>$null).Trim() -ne $Projeto){throw 'Wrong Google project'}
if((gcloud.cmd config get-value account 2>$null).Trim() -ne $Conta){throw 'Wrong Google account'}
Write-Host 'R4: Enabling only federation prerequisites'
gcloud.cmd services enable sts.googleapis.com iamcredentials.googleapis.com --project=$Projeto
AssertExit 'Failed to enable services'
$existing=@(gcloud.cmd iam workload-identity-pools list --location=global --project=$Projeto --format='value(name)')
AssertExit 'Pool listing failed'
if(-not ($existing | Where-Object {$_ -like "*/workloadIdentityPools/$Pool"})){
 gcloud.cmd iam workload-identity-pools create $Pool --location=global --project=$Projeto --display-name='EMPROVEX migration R4'
 AssertExit 'Pool creation failed'
}
$existingProviders=@(gcloud.cmd iam workload-identity-pools providers list --workload-identity-pool=$Pool --location=global --project=$Projeto --format='value(name)')
AssertExit 'Provider listing failed'
if(-not ($existingProviders | Where-Object {$_ -like "*/providers/$Provider"})){
 gcloud.cmd iam workload-identity-pools providers create-oidc $Provider `
 --workload-identity-pool=$Pool --location=global `
 --issuer-uri="https://oidc.vercel.com/$Team" `
 --allowed-audiences="https://vercel.com/$Team" `
 --attribute-mapping='google.subject=assertion.sub' `
 --attribute-condition="assertion.sub=='$Subject'" --project=$Projeto
 AssertExit 'Provider creation failed'
} else {Write-Warning 'Existing provider: verify issuer/audience/condition before deploy'}
$accounts=@(gcloud.cmd iam service-accounts list --project=$Projeto --format='value(email)')
AssertExit 'Service account listing failed'
if($Email -notin $accounts){
 gcloud.cmd iam service-accounts create $Migrator --project=$Projeto `
 --display-name='EMPROVEX Vercel R4 temporary migration identity'
 AssertExit 'Migrator creation failed'
}
gcloud.cmd iam service-accounts add-iam-policy-binding $Email `
 --member=$Principal --role=roles/iam.workloadIdentityUser `
 --project=$Projeto --quiet --format=none
AssertExit 'Federation binding failed'
foreach($id in $Segredos){
 foreach($role in @('roles/secretmanager.viewer','roles/secretmanager.secretVersionAdder')){
   gcloud.cmd secrets add-iam-policy-binding $id `
     --member="serviceAccount:$Email" --role=$role `
     --project=$Projeto --quiet --format=none
   AssertExit "Secret IAM failed: $id $role"
 }
 Write-Host "R4 WIF IAM READY: $id"
}
Write-Host 'R4 WIF READY; NO SECRETS HAVE BEEN TRANSFERRED'
