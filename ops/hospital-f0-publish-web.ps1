<#
.SYNOPSIS
  Publica somente o frontend Cozinha Dietetica e habilita a API para o proxy Firebase Hosting.
.DESCRIPTION
  Valida seguranca de rotas sem token Firebase ainda com IAM privado, libera invocacao
  HTTP somente para cozinha-dietetica-api, revalida negacoes, publica somente o target
  hospital-web, e verifica o rewrite. Reverte o IAM que este script adicionou se falhar.
  Nunca altera cozinha-dietetica-qa, EMPROVEX ou regras Firestore.
#>
[CmdletBinding()]
param([switch]$Publish)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if(-not $Publish){throw 'Para autorizar a publicacao, execute com -Publish.'}

$project = 'cozinha-dietetica'
$region = 'southamerica-east1'
$service = 'cozinha-dietetica-api'
$site = 'cozinha-dietetica-web'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$web = Join-Path $root 'apps\hospital-web'
$rc = Join-Path $web '.firebaserc'
$envPath = Join-Path $web '.env.local'
if(-not(Test-Path $envPath)){throw 'Falta .env.local: execute hospital-f0-configure-web.ps1 -Build.'}
if(-not(Test-Path $rc)){throw 'Falta .firebaserc: execute hospital-f0-setup-hosting.ps1 -Provision.'}
if(-not(Test-Path (Join-Path $web 'firebase.json'))){throw 'firebase.json nao encontrado.'}
$mapping = Get-Content -LiteralPath $rc -Raw | ConvertFrom-Json
$targetRoot = $mapping.PSObject.Properties['targets']
if($null -eq $targetRoot){throw 'Falta targets no .firebaserc.'}
$projectTarget = $targetRoot.Value.PSObject.Properties[$project]
if($null -eq $projectTarget){throw 'Falta projeto no .firebaserc.'}
$hostingTarget = $projectTarget.Value.PSObject.Properties['hosting']
if($null -eq $hostingTarget){throw 'Falta mapeamento hosting no .firebaserc.'}
$siteTarget = $hostingTarget.Value.PSObject.Properties['hospital-web']
if($null -eq $siteTarget){throw 'Falta target hospital-web no .firebaserc.'}
$actual = @($siteTarget.Value)
if($actual -notcontains $site){throw 'Site/target do Firebase Hosting nao corresponde ao projeto isolado.'}

function Run-Gcloud([string[]]$arguments){
  $result = & gcloud.cmd @arguments
  if($LASTEXITCODE -ne 0){throw ('gcloud falhou: '+($arguments -join ' '))}
  return $result
}
function Get-HttpStatus([string]$address,[string]$method='GET',[hashtable]$headers=@{},[string]$payload=''){
  $requestParams = @{Uri=$address;Method=$method;Headers=$headers;UseBasicParsing=$true;TimeoutSec=35;ErrorAction='Stop'}
  if($method -eq 'POST'){$requestParams.ContentType='application/json';$requestParams.Body=$payload}
  try {
    $r = Invoke-WebRequest @requestParams
    return [int]$r.StatusCode
  }catch{
    if($null -ne $_.Exception.Response){
      return [int]$_.Exception.Response.StatusCode
    }
    throw
  }
}
function Check-HospitalDenials([string]$base,[hashtable]$headers){
  $testHeaders=@{}
  foreach($key in $headers.Keys){$testHeaders[$key]=$headers[$key]}
  $testHeaders['x-hospital-organization-id']='smoke-test'
  $sessionStatus=Get-HttpStatus ($base+'/api/hospital/session') 'POST' $testHeaders '{"organizationId":"smoke-test"}'
  if($sessionStatus -ne 401){throw "Sem Firebase token, /session retornou HTTP $sessionStatus (esperado 401)."}
  Write-Host "PASS /api/hospital/session: HTTP $sessionStatus" -ForegroundColor Green
  $paths=@('/api/hospital/patients','/api/hospital/production','/api/hospital/reporting',
    '/api/hospital/nutrition-audit','/api/hospital/administration','/api/hospital/production/stream')
  foreach($path in $paths){
    $status=Get-HttpStatus ($base+$path) 'GET' $testHeaders
    if($status -ge 200 -and $status -lt 300){
      throw "Rota clinica $path aceitou requisicao sem Firebase Auth: HTTP $status"
    }
    Write-Host "PASS $path sem Firebase token: HTTP $status" -ForegroundColor Green
  }
  # Operacoes inexistentes e corpo controlado: nunca cria ou modifica dados clinicos.
  $postPaths=@('/api/hospital/patients','/api/hospital/diets','/api/hospital/maps',
    '/api/hospital/production','/api/hospital/distribution','/api/hospital/administration',
    '/api/hospital/contingency','/api/hospital/nutrition-audit')
  foreach($path in $postPaths){
    $body='{"operation":"__auth_probe__","payload":{},"organizationId":"smoke-test"}'
    $status=Get-HttpStatus ($base+$path) 'POST' $testHeaders $body
    if($status -ge 200 -and $status -lt 300){
      throw "Comando clinico $path aceitou requisicao sem Firebase Auth: HTTP $status"
    }
    Write-Host "PASS POST $path sem Firebase token: HTTP $status" -ForegroundColor Green
  }
}

# O servico QA nao faz parte desta publicacao: nenhuma consulta ou alteracao a ele.

Write-Host 'Atualizando os componentes hospitalares e compilando o frontend...' -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'ops\hospital-f0-extract-web.ps1')
if($LASTEXITCODE -ne 0){throw 'Falha ao atualizar os componentes hospitalares.'}
Push-Location $web
try{
  & npm.cmd run build
  if($LASTEXITCODE -ne 0){throw 'Falha ao compilar frontend.'}
}finally{Pop-Location}
if(-not(Test-Path (Join-Path $web 'dist\index.html'))){throw 'dist/index.html nao encontrado.'}

$base = ((Run-Gcloud -arguments @('run','services','describe',$service,"--project=$project",
 "--region=$region",'--format=value(status.url)')) | Out-String).Trim()
$token = ((Run-Gcloud -arguments @('auth','print-identity-token')) | Out-String).Trim()
if(-not $base -or -not $token){throw 'Nao foi possivel obter a URL ou identidade para teste privado.'}
$privateHeaders=@{'X-Serverless-Authorization'='Bearer '+$token}
$healthy=Get-HttpStatus ($base+'/health') 'GET' $privateHeaders
if($healthy -ne 200){throw "/health privado retornou HTTP $healthy."}
Write-Host 'PASS: health privado (200)' -ForegroundColor Green
Check-HospitalDenials $base $privateHeaders

# Firebase Hosting -> Cloud Run nao envia identidade Google IAM de usuario.
# A invocacao HTTP sera publica; cada endpoint clinico continua exigindo token Firebase.
$policy = (Run-Gcloud -arguments @('run','services','get-iam-policy',$service,
 "--project=$project","--region=$region",'--format=json')) | Out-String | ConvertFrom-Json
$alreadyPublic=$false
$bindingsProp=$policy.PSObject.Properties['bindings']
$bindings = if($null -eq $bindingsProp){@()}else{@($bindingsProp.Value)}
foreach($binding in $bindings){
  if($null -ne $binding -and $binding.role -eq 'roles/run.invoker' -and
    @($binding.members) -contains 'allUsers'){$alreadyPublic=$true}
}
$added=$false
try{
  if(-not $alreadyPublic){
    Write-Host 'Habilitando invocacao HTTP na nova API (autorizacao clinica continua obrigatoria)...' -ForegroundColor Cyan
    $null=Run-Gcloud -arguments @('run','services','add-iam-policy-binding',$service,
      "--project=$project","--region=$region",
      '--member=allUsers','--role=roles/run.invoker','--quiet','--format=none')
    $added=$true
  }else{
    Write-Host 'A invocacao HTTP ja esta configurada na nova API.' -ForegroundColor Green
  }
  # IAM pode levar alguns segundos para propagar.
  $healthPublic=0
  for($attempt=0;$attempt -lt 5;$attempt++){
    if($attempt -gt 0){Start-Sleep -Seconds 3}
    $healthPublic=Get-HttpStatus ($base+'/health')
    if($healthPublic -eq 200){break}
  }
  if($healthPublic -ne 200){throw "Apos liberar invocacao, /health retornou HTTP $healthPublic."}
  Write-Host 'PASS: health publico (200) - sem dados clinicos' -ForegroundColor Green
  Check-HospitalDenials $base @{}

  Write-Host 'Publicando exclusivamente o site hospital-web...' -ForegroundColor Cyan
  Push-Location $web
  try{
    & firebase.cmd deploy '--only' 'hosting:hospital-web' '--project' $project '--non-interactive'
    if($LASTEXITCODE -ne 0){throw 'Firebase Hosting deploy falhou.'}
  }finally{Pop-Location}

  $hosting='https://'+$site+'.web.app'
  $siteHttpStatus=Get-HttpStatus ($hosting+'/')
  if($siteHttpStatus -ne 200){throw "Site Firebase retornou HTTP $siteHttpStatus."}
  $sessionHosting=0
  for($attempt=0;$attempt -lt 5;$attempt++){
    if($attempt -gt 0){Start-Sleep -Seconds 3}
    $sessionHosting=Get-HttpStatus ($hosting+'/api/hospital/session') 'POST' @{
      'x-hospital-organization-id'='smoke-test'
    } '{"organizationId":"smoke-test"}'
    if($sessionHosting -eq 401){break}
  }
  if($sessionHosting -ne 401){
    throw "Rewrite Firebase Hosting/API retornou HTTP $sessionHosting (esperado 401)."
  }
  Write-Host 'PASS: Hosting HTTP 200 e API via rewrite HTTP 401 sem token clinico.' -ForegroundColor Green
  Write-Host ('SITE PUBLICADO: '+$hosting) -ForegroundColor Green
  Write-Host 'Acesso clinico segue vinculado a usuario Firebase e organizacao autorizada.'
}catch{
  $failure=$_.Exception.Message
  if($added){
    Write-Warning 'Falha na validacao/publicacao. Restaurando IAM privado da API.'
    & gcloud.cmd run services remove-iam-policy-binding $service "--project=$project" ("--region=$region") '--member=allUsers' '--role=roles/run.invoker' '--quiet' '--format=none'
    if($LASTEXITCODE -ne 0){Write-Warning 'NAO FOI POSSIVEL reverter IAM. Revise o acesso da API imediatamente.'}
  }
  throw $failure
}
