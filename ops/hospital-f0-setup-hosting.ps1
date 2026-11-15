<#
.SYNOPSIS
    Configura o Firebase Hosting do produto hospitalar, sem tocar no EMPROVEX.
.DESCRIPTION
    Sem -Provision: somente leitura. Com -Provision: cria/vincula o site Hosting
    cozinha-dietetica e aplica target apenas em apps/hospital-web.
    Nao altera Firestore, IAM, Cloud Run nem publica o app.
.EXAMPLE
    .\ops\hospital-f0-setup-hosting.ps1
    .\ops\hospital-f0-setup-hosting.ps1 -Provision
#>
[CmdletBinding()]
param(
    [string]$ProjectId = 'cozinha-dietetica',
    [string]$SiteId = 'cozinha-dietetica-web',
    [string]$Target = 'hospital-web',
    [switch]$Provision
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Find-Tool([string[]]$Candidates) {
    foreach ($candidate in $Candidates) {
        $item = Get-Command $candidate -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($item) { return $item.Source }
    }
    return $null
}
function Invoke-Checked([string]$Tool, [string[]]$Arguments) {
    $output = & $Tool @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        $details = ($output | Out-String).Trim()
        throw "$Tool $($Arguments -join ' ') falhou (exit=$LASTEXITCODE). $details"
    }
    return ($output | Out-String).Trim()
}
function Site-Ids($json) {
    $obj = $json | ConvertFrom-Json
    $result = $obj
    if ($null -ne $obj.PSObject.Properties['result']) { $result = $obj.result }
    if ($null -eq $result) { return @() }
    if ($null -ne $result.PSObject.Properties['sites']) { $result = $result.sites }
    $ids = @()
    foreach ($entry in @($result)) {
        if ($null -eq $entry) { continue }
        $id = ''
        if ($null -ne $entry.PSObject.Properties['siteId']) { $id = [string]$entry.siteId }
        if (-not $id -and $null -ne $entry.PSObject.Properties['name']) {
            $id = ([string]$entry.name -split '/')[-1]
        }
        if ($id) { $ids += $id }
    }
    return @($ids)
}

if ($ProjectId -ne 'cozinha-dietetica') {
    throw 'Projeto divergente: este script destina-se somente ao Firebase cozinha-dietetica.'
}
if ($SiteId -notmatch '^[a-z][a-z0-9-]{3,28}[a-z0-9]$') {
    throw 'SiteId invalido: 5 a 30 caracteres, minusculas, numeros e hifen.'
}
if ($Target -ne 'hospital-web') {
    throw 'Target divergente: este script usa somente hospital-web.'
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$webPath = Join-Path $repoRoot 'apps\hospital-web'
$config = Join-Path $webPath 'firebase.json'
if (-not (Test-Path -LiteralPath $config)) {
    throw "Configuracao independente ausente: $config"
}
$hosting = Get-Content -LiteralPath $config -Raw | ConvertFrom-Json
if (-not $hosting.hosting -or $hosting.hosting.target -ne $Target -or
    $hosting.hosting.public -ne 'dist' -or $hosting.PSObject.Properties['firestore']) {
    throw 'firebase.json nao corresponde ao Hosting isolado esperado.'
}
if ($hosting.hosting.PSObject.Properties['rewrites']) {
    foreach ($rewrite in @($hosting.hosting.rewrites)) {
        if ($rewrite.PSObject.Properties['function']) {
            throw 'Cloud Function nao autorizada na configuracao de Hosting hospitalar.'
        }
        if ($rewrite.PSObject.Properties['run']) {
            if ($rewrite.source -ne '/api/hospital/**' -or
                $rewrite.run.serviceId -ne 'cozinha-dietetica-api' -or
                $rewrite.run.region -ne 'southamerica-east1') {
                throw 'Rewrite Cloud Run divergente: apenas o novo backend hospitalar e autorizado.'
            }
        }
    }
}

$gcloud = Find-Tool @('gcloud.cmd', 'gcloud')
$firebase = Find-Tool @('firebase.cmd', 'firebase')
if (-not $gcloud) { throw 'gcloud nao encontrado no PATH do PowerShell.' }
if (-not $firebase) {
    throw 'Firebase CLI ausente. Instale Node.js e: npm.cmd install -g firebase-tools'
}
Write-Host ''
Write-Host '=== FIREBASE HOSTING HOSPITALAR — INSPECAO ===' -ForegroundColor Cyan
Write-Host "Projeto: $ProjectId | Site: $SiteId | Target: $Target"
Write-Host "Pasta: $webPath"
Write-Host "Acao: $(if($Provision){'PROVISIONAMENTO'}else{'SOMENTE LEITURA'})"

$gcpProject = Invoke-Checked $gcloud @('projects','describe',$ProjectId,'--format=value(projectId)')
if ($gcpProject.Trim() -ne $ProjectId) { throw 'gcloud respondeu projeto divergente.' }
Write-Host "PASS: projeto $ProjectId acessivel pelo gcloud" -ForegroundColor Green

try {
    $siteJson = Invoke-Checked $firebase @('hosting:sites:list','--project',$ProjectId,'--json')
    $sites = @(Site-Ids $siteJson)
} catch {
    throw "Nao foi possivel listar os sites Firebase. Execute firebase.cmd login e confirme permissoes. $($_.Exception.Message)"
}
Write-Host "Sites encontrados: $($sites.Count)"
foreach ($site in $sites) { Write-Host " - $site" }

try {
    $ingress = Invoke-Checked $gcloud @('run','services','describe','cozinha-dietetica-qa',
        '--project',$ProjectId,'--region','southamerica-east1',
        '--format=value(metadata.annotations.run.googleapis.com/ingress)')
    if ($ingress -eq 'internal') {
        Write-Host 'PASS: Cloud Run QA preservado com ingress internal.' -ForegroundColor Green
    } else {
        Write-Warning "Cloud Run QA com ingress '$ingress' (esperado: internal). Nada foi modificado."
    }
} catch {
    Write-Warning 'Nao foi possivel verificar o Cloud Run QA. O script nao vai alterá-lo.'
}

if (-not $Provision) {
    Write-Host ''
    Write-Host 'Inspecao concluida. Para criar/vincular o site execute:' -ForegroundColor Yellow
    Write-Host '.\ops\hospital-f0-setup-hosting.ps1 -Provision'
    return
}
Push-Location $webPath
try {
    if ($sites -notcontains $SiteId) {
        Write-Host "Criando site exclusivo: $SiteId" -ForegroundColor Yellow
        $null = Invoke-Checked $firebase @('hosting:sites:create',$SiteId,'--project',$ProjectId)
    } else {
        Write-Host 'Site ja esta no projeto. Vinculando target local.'
    }
    $null = Invoke-Checked $firebase @('target:apply','hosting',$Target,$SiteId,'--project',$ProjectId)
    $rc = Join-Path $webPath '.firebaserc'
    if (-not (Test-Path -LiteralPath $rc)) { throw 'Firebase nao gravou .firebaserc.' }
    $mapping = Get-Content -LiteralPath $rc -Raw | ConvertFrom-Json
    $targetValue = $mapping.targets.$ProjectId.$Target
    if (@($targetValue) -notcontains $SiteId) {
        throw 'Target Hosting divergente apos aplicacao.'
    }
    $final = Site-Ids (Invoke-Checked $firebase @('hosting:sites:list','--project',$ProjectId,'--json'))
    if (@($final) -notcontains $SiteId) { throw 'Site nao confirmado no projeto apos criacao.' }

    Write-Host ''
    Write-Host 'PASS: Hosting hospitalar isolado e target configurados.' -ForegroundColor Green
    Write-Host "Site ID: $SiteId"
    Write-Host "Endereco esperado APOS deploy: https://$SiteId.web.app"
    Write-Host "Config Hosting: $config"
    Write-Host "Target: $rc"
    Write-Host 'Nenhum deploy, regra Firestore, IAM ou Cloud Run foi alterado.'
} finally {
    Pop-Location
}
