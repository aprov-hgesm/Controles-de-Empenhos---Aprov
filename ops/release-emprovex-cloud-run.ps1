# EMPROVEX — release Cloud Run (PowerShell Windows).
# -Status: leitura; -Stage: build revisao SEM trafego; -PromoteRevision/-RollbackRevision: roteamento.
# Nao altera DNS, Hosting, Secret Manager, Firestore Rules nem cron.
param([switch]$Status,[switch]$Stage,[string]$PromoteRevision,[string]$RollbackRevision)
$ErrorActionPreference='Stop'
$Project='gen-lang-client-0982077967'
$Region='southamerica-east1'
$Service='emprovex-cloudrun-candidate'
$Runtime="emprovex-run-runtime@$Project.iam.gserviceaccount.com"
$Domain='emprovex.com.br'
$HostingIp='199.36.158.100'
$Root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$count=[int][bool]$Status + [int][bool]$Stage + [int][bool]$PromoteRevision + [int][bool]$RollbackRevision
if($count -ne 1){throw 'Escolha exatamente uma operacao: -Status, -Stage, -PromoteRevision ou -RollbackRevision.'}
function MustExit([string]$msg){if($LASTEXITCODE -ne 0){throw $msg}}
function ReadGcloud([string[]]$argsList){
  $raw=& gcloud.cmd @argsList
  MustExit 'CLOUD_RUN_READ_FAILED'
  return (($raw | Out-String) | ConvertFrom-Json)
}
if((gcloud.cmd config get-value project 2>$null).Trim() -cne $Project){throw 'GCP_WRONG_PROJECT'}
$account=(gcloud.cmd auth list --filter='status:ACTIVE' --format='value(account)')
MustExit 'GCP_WRONG_SESSION'
if(-not $account){throw 'GCP_MISSING_ACCOUNT'}
$serviceArgs=@('run','services','describe',$Service,"--project=$Project","--region=$Region",'--format=json')
$svc=ReadGcloud $serviceArgs
if([string]$svc.spec.template.spec.serviceAccountName -cne $Runtime){throw 'RUNTIME_IDENTITY_MISMATCH'}
$envs=@($svc.spec.template.spec.containers[0].env)
$essentials=@('INFINITEPAY_API_KEY','INFINITEPAY_ORDER_SECRET','INFINITEPAY_WEBHOOK_TOKEN','INFINITEPAY_BILLING_ENABLED','EMPROVEX_BILLING_ENFORCEMENT_ENABLED','EMPROVEX_BILLING_PUBLIC_ORIGIN')
foreach($name in $essentials){
  if(@($envs|Where-Object{$_.name -ceq $name}).Count -ne 1){throw "ESSENTIAL_ENV_MISSING: $name"}
}
$iam=ReadGcloud @('run','services','get-iam-policy',$Service,"--project=$Project","--region=$Region",'--format=json')
$public=@($iam.bindings|Where-Object{$_.role -eq 'roles/run.invoker' -and $_.members -contains 'allUsers'})
if($public.Count -ne 1){throw 'CLOUD_RUN_INVOCATION_NOT_PUBLIC'}
$traffic=@($svc.status.traffic|Where-Object{[int]$_.percent -gt 0}|ForEach-Object{"$($_.revisionName):$($_.percent)%"})
Write-Host '=== EMPROVEX / CLOUD RUN ==='
Write-Host "Projeto: $Project / Regiao: $Region / Servico: $Service"
Write-Host "Traffic: $($traffic -join ' | ')"
Write-Host "Conta: $account"
Write-Host 'Segredos financeiros essenciais: presentes por nome (valores nao revelados).'
if($Status){return}
if($Stage){
  $branch=(git -C $Root branch --show-current).Trim()
  MustExit 'GIT_BRANCH_FAILED'
  if($branch -cne 'main'){throw 'STAGE_REQUIRES_MERGED_MAIN'}
  if(@(git -C $Root status --porcelain).Count -gt 0){throw 'STAGE_REQUIRES_CLEAN_GIT'}
  $sha=(git -C $Root rev-parse HEAD).Trim()
  MustExit 'GIT_HEAD_FAILED'
  if($sha -notmatch '^[a-f0-9]{40}$'){throw 'GIT_SHA_INVALID'}
  $tag='r'+$sha.Substring(0,12)
  Write-Host "Fonte: main SHA=$sha"
  Write-Host "Nova revisao SEM TRAFEGO, tag=$tag. Build pode gerar custos."
  if((Read-Host 'Digite STAGE-CLOUD-RUN para confirmar') -cne 'STAGE-CLOUD-RUN'){throw 'STAGE_CANCELLED'}
  $deployArgs=@('run','deploy',$Service,"--project=$Project","--region=$Region","--source=$Root","--service-account=$Runtime",'--no-traffic',"--tag=$tag",'--quiet')
  & gcloud.cmd @deployArgs
  MustExit 'CLOUD_RUN_STAGING_FAILED'
  $latest=ReadGcloud $serviceArgs
  Write-Host "REVISAO_CRIADA: $($latest.status.latestCreatedRevisionName)"
  foreach($entry in @($latest.status.traffic|Where-Object{$_.tag -ceq $tag})){
    Write-Host "URL_PREVIA: $($entry.url)"
  }
  Write-Host 'Sem promover trafego. Use -PromoteRevision somente apos verificar a revisao.'
  return
}
$target=if($PromoteRevision){$PromoteRevision}else{$RollbackRevision}
if($target -notmatch '^emprovex-cloudrun-candidate-[a-z0-9-]+$'){throw 'REVISION_NAME_INVALID'}
$rev=ReadGcloud @('run','revisions','describe',$target,"--project=$Project","--region=$Region",'--format=json')
$ready=@($rev.status.conditions|Where-Object{$_.type -eq 'Ready' -and $_.status -eq 'True'})
if($ready.Count -ne 1){throw 'REVISION_NOT_READY'}
if([string]$rev.spec.serviceAccountName -cne $Runtime){throw 'REVISION_RUNTIME_MISMATCH'}
$action=if($RollbackRevision){'ROLLBACK'}else{'PROMOVER'}
Write-Host "Acao: $action | Revisao: $target | Anterior: $($traffic -join ' | ')"
if((Read-Host "Digite $action para atribuir 100% do trafego") -cne $action){throw 'ACTION_CANCELLED'}
& gcloud.cmd run services update-traffic $Service "--project=$Project" "--region=$Region" "--to-revisions=$target=100" '--quiet'
MustExit 'CLOUD_RUN_TRAFFIC_UPDATE_FAILED'
$live=ReadGcloud $serviceArgs
if(@($live.status.traffic|Where-Object{[int]$_.percent -eq 100 -and $_.revisionName -ceq $target}).Count -ne 1){throw 'CLOUD_RUN_TRAFFIC_NOT_CONFIRMED'}
Write-Host "TRAFEGO_100_PORCENTO: $target"
Write-Host "Verificar: curl.exe -i --max-time 20 --resolve $($Domain):443:$($HostingIp) https://$($Domain)/api/health"
Write-Host 'Para retornar: -RollbackRevision <REVISAO_ANTERIOR> (nao reverte dados).'
