<#
.SYNOPSIS
    Extrai backend hospitalar para Cloud Run dedicado.
.DESCRIPTION
    Copia somente codigo clinico W10-W12 e rotas API; nao modifica
    original, Firestore, IAM, regras, Cloud Run ou o EMPROVEX.
#>
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$base=Join-Path $root 'apps\hospital-api'
if(-not(Test-Path (Join-Path $base 'app\api\hospital\session\route.ts'))){
    throw 'Rota de sessao independente nao encontrada.'
}
function Copy-Folder([string]$relative,[string]$destination) {
    $source=Join-Path $root $relative
    if(-not(Test-Path $source)){throw "Origem ausente: $source"}
    New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
    if(Test-Path $destination){Remove-Item $destination -Recurse -Force}
    Copy-Item $source $destination -Recurse -Force
}
Copy-Folder 'lib\server\hospital' (Join-Path $base 'lib\server\hospital')
Copy-Folder 'features\hospital\core' (Join-Path $base 'features\hospital\core')
New-Item -ItemType Directory -Force -Path (Join-Path $base 'features\hospital\production') | Out-Null
Copy-Item (Join-Path $root 'features\hospital\production\contracts.ts') (Join-Path $base 'features\hospital\production\contracts.ts') -Force
$routesSource=Join-Path $root 'app\api\hospital'
$routesDest=Join-Path $base 'app\api\hospital'
foreach($entry in Get-ChildItem $routesSource -Directory) {
    $target=Join-Path $routesDest $entry.Name
    if(Test-Path $target){Remove-Item $target -Recurse -Force}
    Copy-Item $entry.FullName $target -Recurse -Force
}

# Flags com nomes independentes para o novo runtime, exclusivamente nas copias.
$files=@(Get-ChildItem (Join-Path $base 'lib\server\hospital') -Recurse -File -Include '*.mjs','*.d.mts')
$files+=@(Get-ChildItem $routesDest -Recurse -File -Include '*.ts')
foreach($f in $files){
    $before=[System.IO.File]::ReadAllText($f.FullName)
    $after=$before.Replace('HOSPITAL_GCP_QA_ENABLED','HOSPITAL_GCP_ENABLED')
    $after=$after.Replace('HOSPITAL_FIRESTORE_QA_ENABLED','HOSPITAL_FIRESTORE_ENABLED')
    $after=$after.Replace('HOSPITAL_GCP_QA_PRIVATE','HOSPITAL_API_PUBLIC')
    # O modulo administrativo legado usava um cabecalho diferente do frontend.
    $after=$after.Replace("headers.get('x-hospital-organization')", "headers.get('x-hospital-organization-id')")
    $after=$after.Replace("HOSPITAL_SERVICE='cozinha-dietetica-qa'","HOSPITAL_SERVICE='cozinha-dietetica-api'")
    if($after -ne $before){
        [System.IO.File]::WriteAllText($f.FullName,$after,[System.Text.UTF8Encoding]::new($false))
    }
}
$runtimeFile=Join-Path $base 'lib\server\hospital\firebase\gcp-qa-runtime.mjs'
$runtime=[System.IO.File]::ReadAllText($runtimeFile)
if(-not $runtime.Contains("HOSPITAL_SERVICE='cozinha-dietetica-api'") -or
   -not $runtime.Contains("env.HOSPITAL_API_PUBLIC==='1'")){
    throw 'Fronteira GCP divergente: abortar.'
}

# Exige a origem exata HTTPS do Hosting para operacoes de distribuicao.
$originFile=Join-Path $base 'lib\server\hospital\distribution\origin-guard.mjs'
$before=[System.IO.File]::ReadAllText($originFile)
$needle='if(source.origin===target.origin)return true;'
$replacement=@'
if(source.origin===target.origin)return true;
   if(nodeEnv==='production'&&typeof process.env.HOSPITAL_PUBLIC_ORIGIN==='string'&&
      source.origin===process.env.HOSPITAL_PUBLIC_ORIGIN)return true;
'@
if(-not $before.Contains($needle)){throw 'Origin guard alterado; revise antes de build.'}
[System.IO.File]::WriteAllText($originFile,$before.Replace($needle,$replacement.TrimEnd()),[System.Text.UTF8Encoding]::new($false))

# Nao incluir gates de interface legados no backend.
$legacy=Join-Path $base 'lib\server\hospital\firebase\qa-ui-gate.mjs'
if(Test-Path $legacy){Remove-Item $legacy -Force}
$routes=@(Get-ChildItem $routesDest -Recurse -Filter route.ts -File)
if($routes.Count -lt 10){throw "Extracao incompleta: apenas $($routes.Count) rotas."}
Write-Host "PASS: Backend hospitalar extraido com $($routes.Count) endpoints." -ForegroundColor Green
Write-Host 'Sem limitacao qa_* para hospitais legitimamente vinculados.'
Write-Host 'Proximo: cd apps/hospital-api; npm.cmd install; npm.cmd run build'
