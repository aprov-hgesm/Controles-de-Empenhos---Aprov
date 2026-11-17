<#
.SYNOPSIS
  Configura o frontend isolado usando o SDK oficial do aplicativo Web Firebase existente.
.DESCRIPTION
  Le somente as configuracoes PUBLICAS do Firebase Web app via Firebase CLI,
  grava apps/hospital-web/.env.local (ignorado pelo git) e opcionalmente compila.
  Nao cria projetos, contas, regras, usuarios, Cloud Run ou deploy.
#>
[CmdletBinding()]
param(
  [string]$OrganizationId,
  [switch]$Build
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectId = 'cozinha-dietetica'
$appId = '1:947369899527:web:d2da054f7b9ce707195ca2'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$webPath = Join-Path $repoRoot 'apps\hospital-web'
$envPath = Join-Path $webPath '.env.local'

$firebaseCommand = Get-Command firebase.cmd -ErrorAction SilentlyContinue
if (-not $firebaseCommand) { throw 'firebase.cmd nao encontrado. Instale firebase-tools e faca firebase.cmd login.' }

$tempPath = Join-Path ([IO.Path]::GetTempPath()) ('hospital-sdk-' + [guid]::NewGuid().ToString('N') + '.json')
try {
  Write-Host 'Consultando configuracao publica do aplicativo Firebase Web...' -ForegroundColor Cyan
  & $firebaseCommand.Source 'apps:sdkconfig' 'WEB' $appId '--project' $projectId '--out' $tempPath
  if ($LASTEXITCODE -ne 0) { throw 'Firebase CLI nao conseguiu obter a configuracao do app.' }
  if (-not (Test-Path -LiteralPath $tempPath)) { throw 'Firebase CLI nao gerou a configuracao JSON.' }
  $config = Get-Content -LiteralPath $tempPath -Encoding UTF8 -Raw | ConvertFrom-Json

  if ([string]$config.projectId -ne $projectId) { throw 'Projeto divergente na configuracao do Firebase.' }
  if ([string]$config.appId -ne $appId) { throw 'App ID divergente na configuracao do Firebase.' }
  if ([string]::IsNullOrWhiteSpace([string]$config.apiKey)) { throw 'Firebase SDK nao forneceu apiKey.' }

  $hospitalId = ''
  if (Test-Path -LiteralPath $envPath) {
    $existing = Get-Content -LiteralPath $envPath -Encoding UTF8 -Raw
    $match = [regex]::Match($existing, '(?m)^VITE_HOSPITAL_ORGANIZATION_ID=(.*)$')
    if ($match.Success) { $hospitalId = $match.Groups[1].Value.Trim() }
  }
  if ($PSBoundParameters.ContainsKey('OrganizationId')) {
    $hospitalId = $OrganizationId.Trim()
  }
  if ($hospitalId -match '[\r\n]') { throw 'OrganizationId nao pode conter quebra de linha.' }

  $lines = @(
    '# Firebase Web SDK: valores publicos, obtidos via firebase apps:sdkconfig.'
    '# Nao adicionar segredos, chave privada ou service account neste arquivo.'
    ('VITE_HOSPITAL_FIREBASE_PROJECT_ID=' + $projectId)
    ('VITE_HOSPITAL_FIREBASE_API_KEY=' + [string]$config.apiKey)
    ('VITE_HOSPITAL_FIREBASE_APP_ID=' + $appId)
    ('VITE_HOSPITAL_ORGANIZATION_ID=' + $hospitalId)
  )
  [IO.File]::WriteAllText($envPath, ($lines -join "`n") + "`n", [Text.UTF8Encoding]::new($false))

  Write-Host 'PASS: configuracao Firebase do frontend gravada em .env.local (ignorado pelo Git).' -ForegroundColor Green
  Write-Host ('Projeto: ' + $projectId)
  Write-Host ('Web App: ' + $appId)
  Write-Host 'A chave publica nao foi exibida no terminal.'
} finally {
  if (Test-Path -LiteralPath $tempPath) { Remove-Item -LiteralPath $tempPath -Force }
}

if ($Build) {
  Push-Location $webPath
  try {
    if (-not (Test-Path -LiteralPath (Join-Path $webPath 'node_modules'))) {
      & npm.cmd install --no-audit --no-fund
      if ($LASTEXITCODE -ne 0) { throw 'npm install falhou.' }
    }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Compilacao do frontend falhou.' }
    if (-not (Test-Path -LiteralPath (Join-Path $webPath 'dist\index.html'))) {
      throw 'Compilacao nao gerou dist/index.html.'
    }
    Write-Host 'PASS: frontend compilado com Firebase Web configurado.' -ForegroundColor Green
  } finally { Pop-Location }
}
Write-Host 'Nenhum deploy ou recurso GCP/Firebase foi alterado.'