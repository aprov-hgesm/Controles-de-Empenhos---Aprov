# EMPROVEX R6 — Preparacao de migracao das 8 configuracoes restantes.
# Nao le valores da Vercel, nao altera Cloud Run, nao faz deploy.
$ErrorActionPreference='Stop'
$Projeto='gen-lang-client-0982077967'
$Numero='943599311487'
$Conta='marcoa.r.aquino@gmail.com'
$Regiao='southamerica-east1'
$Team='aprov-hgesms-projects'
$Pool='emprovex-vercel-r6'
$Provider='vercel-production'
$Migrator='emprovex-r6-migrator'
$Email="$Migrator@$Projeto.iam.gserviceaccount.com"
$Subject="owner:$Team"+':project:controles-de-empenhos-aprov:environment:production'
$Principal="principal://iam.googleapis.com/projects/$Numero/locations/global/workloadIdentityPools/$Pool/subject/$Subject"
$Segredos=@(
 'emprovex-billing-qa-workspace-id',
 'emprovex-billing-rules-certified',
 'emprovex-billing-enforcement-enabled',
 'emprovex-infinitepay-billing-pilot-workspace-id',
 'emprovex-infinitepay-billing-scope',
 'emprovex-infinitepay-billing-enabled',
 'emprovex-billing-public-origin',
 'emprovex-infinitepay-handle'
)
function AssertExit([string]$message){if($LASTEXITCODE -ne 0){throw $message}}
if((gcloud.cmd config get-value project 2>$null).Trim() -ne $Projeto){throw 'Projeto Google incorreto'}
if((gcloud.cmd config get-value account 2>$null).Trim() -ne $Conta){throw 'Conta Google incorreta'}
if($Migrator.Length -lt 6 -or $Migrator.Length -gt 30){throw 'ID da service account invalido'}
Write-Host '=== R6: VERIFICAR OU CRIAR COFRES VAZIOS ==='
$Existentes=@(gcloud.cmd secrets list --project=$Projeto --format='value(name)')
AssertExit 'Falha ao listar cofres'
$Ids=@($Existentes|ForEach-Object{($_ -split '/')[-1]})
foreach($id in $Segredos){
 if($id -notin $Ids){
   gcloud.cmd secrets create $id --project=$Projeto --replication-policy=user-managed --locations=$Regiao --format=none
   AssertExit "Falha ao criar $id"
   Write-Host "CRIADO: $id"
 }else{
   Write-Host "EXISTENTE: $id"
 }
 $Versoes=@(gcloud.cmd secrets versions list $id --project=$Projeto --format='value(name)')
 AssertExit "Falha ao consultar versoes $id"
 if($Versoes.Count -gt 0){throw "R6_COLECAO_NAO_VAZIA: $id. Nao execute outra transferencia"}
}
Write-Host '=== R6: APIS DE FEDERACAO ==='
gcloud.cmd services enable sts.googleapis.com iamcredentials.googleapis.com --project=$Projeto
AssertExit 'Falha ao habilitar APIs de federacao'
Write-Host '=== R6: WORKLOAD IDENTITY POOL ==='
$Pools=@(gcloud.cmd iam workload-identity-pools list --location=global --project=$Projeto --format='value(name)')
AssertExit 'Falha ao listar pools'
if(-not($Pools|Where-Object{$_ -like "*/workloadIdentityPools/$Pool"})){
 gcloud.cmd iam workload-identity-pools create $Pool --location=global --project=$Projeto --display-name='EMPROVEX R6 config transfer'
 AssertExit 'Falha ao criar pool'
}
$Providers=@(gcloud.cmd iam workload-identity-pools providers list --workload-identity-pool=$Pool --location=global --project=$Projeto --format='value(name)')
AssertExit 'Falha ao listar providers'
if(-not($Providers|Where-Object{$_ -like "*/providers/$Provider"})){
 gcloud.cmd iam workload-identity-pools providers create-oidc $Provider `
 --workload-identity-pool=$Pool --location=global `
 --issuer-uri="https://oidc.vercel.com/$Team" `
 --allowed-audiences="https://vercel.com/$Team" `
 --attribute-mapping='google.subject=assertion.sub' `
 --attribute-condition="assertion.sub=='$Subject'" --project=$Projeto
 AssertExit 'Falha ao criar provider'
}else{Write-Warning 'Provider existente: confirmar atributos manualmente antes do deploy R6'}
Write-Host '=== R6: CONTA MIGRADORA TEMPORARIA ==='
$Accounts=@(gcloud.cmd iam service-accounts list --project=$Projeto --format='value(email)')
AssertExit 'Falha ao listar contas'
if($Email -notin $Accounts){
 gcloud.cmd iam service-accounts create $Migrator --project=$Projeto --display-name='EMPROVEX R6 config migration'
 AssertExit 'Falha ao criar migrador'
}
gcloud.cmd iam service-accounts add-iam-policy-binding $Email `
 --member=$Principal --role=roles/iam.workloadIdentityUser --project=$Projeto --quiet --format=none
AssertExit 'Falha ao conceder workloadIdentityUser'
foreach($id in $Segredos){
 foreach($role in @('roles/secretmanager.viewer','roles/secretmanager.secretVersionAdder')){
   gcloud.cmd secrets add-iam-policy-binding $id `
    --member="serviceAccount:$Email" --role=$role --project=$Projeto --quiet --format=none
   AssertExit "Falha IAM: $id $role"
 }
 Write-Host "R6 IAM READY: $id"
}
Write-Host 'R6 PREPARACAO CONCLUIDA; NENHUM VALOR TRANSFERIDO'
