# EMPROVEX MOBILE TRUST — Release PowerShell (Vercel externo)
# Uso: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\publicar-mobile-trust.ps1 -ExpectedCommit <SHA_MAIN> -Promover
# Sem -Promover: cria deployment staged, verifica health e preserva o dominio.
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-f]{40}$')]
  [string]$ExpectedCommit,
  [switch]$Promover
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$scope = 'aprov-hgesms-projects'
$project = 'controles-de-empenhos-aprov'
$repo = 'https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov.git'
$start = (Get-Location).Path
$releaseRoot = Join-Path $HOME 'Emprovex-Releases'
$releaseDir = Join-Path $releaseRoot ('mobile-trust-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))

function Require-Command([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Comando ausente: $name"
  }
}
function Assert-Exit([string]$step) {
  if ($LASTEXITCODE -ne 0) { throw "$step falhou (exit code $LASTEXITCODE). Publicacao interrompida." }
}
function Check-Health([string]$target, [string]$label) {
  # vercel curl usa bypass interno para deployment protegido.
  $raw = @(& vercel.cmd curl /api/health --deployment $target --scope $scope)
  Assert-Exit "Health $label"
  $payload = ($raw -join [Environment]::NewLine) | ConvertFrom-Json
  if ($payload.status -ne 'ok') { throw "Health $label retornou status inesperado" }
  Write-Host ('HEALTH_' + $label + '=PASS')
}

try {
  Require-Command 'git.exe'
  Require-Command 'vercel.cmd'
  Require-Command 'curl.exe'
  New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
  if (Test-Path $releaseDir) { throw "Diretorio de release ja existe: $releaseDir" }

  Write-Host 'EMPROVEX MOBILE TRUST — RELEASE ISOLADA'
  Write-Host "Projeto: $scope/$project"
  Write-Host "Commit aprovado: $ExpectedCommit"
  & git.exe clone --single-branch --branch main $repo $releaseDir
  Assert-Exit 'Clone da main'
  Set-Location $releaseDir
  $sha = (& git.exe rev-parse HEAD).Trim()
  Assert-Exit 'Leitura do commit'
  if ($sha -ne $ExpectedCommit) {
    throw "MAIN_DIVERGENTE: esperado=$ExpectedCommit atual=$sha. Nao publicar versao diferente."
  }
  $dirty = @(& git.exe status --porcelain)
  Assert-Exit 'Estado do repositorio'
  if ($dirty.Count -gt 0) { throw 'Checkout com alteracoes locais: release abortada.' }
  Write-Host "MAIN_SHA=PASS ($sha)"

  $config = Get-Content -Raw -Encoding UTF8 (Join-Path $releaseDir 'vercel.json') | ConvertFrom-Json
  if ($config.git.deploymentEnabled -ne $false) {
    throw 'DEPLOY_AUTOMATICO_NAO_DESATIVADO: confira vercel.json'
  }

  & vercel.cmd link --yes --project $project --scope $scope
  Assert-Exit 'Link com o projeto Vercel'
  if (-not (Test-Path '.vercel/project.json')) { throw 'VERCEL_LINK_AUSENTE' }
  Write-Host 'VERCEL_LINK=PASS'

  # Conferir somente os NOMES. Jamais imprimir valores de env, tokens ou .env.
  $names = @(& vercel.cmd env ls production --scope $scope)
  Assert-Exit 'Nomes de variaveis Production'
  if (($names -join [Environment]::NewLine) -notmatch 'FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON') {
    throw 'Credencial de servidor ausente em Production. Corrigir na Vercel antes de publicar.'
  }
  Write-Host 'WAREHOUSE_ADMIN_ENV_NAME=PASS (valor oculto)'

  # Build remoto: o prebuild local da R368 falhou por artefato ausente.
  Write-Host 'Criando deployment de producao sem atribuir o dominio...'
  $result = @(& vercel.cmd deploy --prod --skip-domain --yes --scope $scope)
  Assert-Exit 'Deploy staged'
  $urls = @($result | Where-Object { $_ -match '^https://[a-z0-9-]+\.vercel\.app/?$' })
  if ($urls.Count -ne 1) { throw 'URL de deployment inesperada; nao promover.' }
  $url = $urls[0].TrimEnd('/')
  Write-Host "STAGED_URL=$url"

  & vercel.cmd inspect $url --scope $scope
  Assert-Exit 'Inspecao do deployment staged'
  Check-Health $url 'STAGED'
  Write-Host 'STATUS=STAGED_READY'

  if (-not $Promover) {
    Write-Host "Dominio oficial preservado. Para promover este mesmo build, sem rebuild:"
    Write-Host "vercel.cmd promote $url --yes --scope $scope"
    Write-Host 'Antes, conferir login, Operador Movel e smoke autenticado em workspace QA.'
    return
  }

  Write-Host 'Confirme login, consulta e movimentacoes do Operador Movel no deployment staged.'
  Write-Host 'Use workspace QA isolado: /api/health sozinho nao comprova escrita Warehouse.'
  $decision = Read-Host 'Digite PROMOVER para publicar ESTE deployment em emprovex.com.br'
  if ($decision -cne 'PROMOVER') {
    Write-Host 'PROMOCAO_CANCELADA: dominio oficial preservado.'
    return
  }
  & vercel.cmd promote $url --yes --scope $scope
  Assert-Exit 'Promocao do deployment'
  $official = Invoke-RestMethod -Method Get -Uri 'https://emprovex.com.br/api/health' -TimeoutSec 45
  if ($official.status -ne 'ok') {
    throw 'PROMOVIDO, mas health oficial falhou. Inspecionar Vercel e executar rollback se necessario.'
  }
  & vercel.cmd inspect 'https://emprovex.com.br' --scope $scope
  Assert-Exit 'Inspecao do dominio oficial'
  Write-Host "PRODUCAO=PASS ($sha)"
  Write-Host "DEPLOYMENT=$url"
}
finally {
  Set-Location $start
}
