<#
.SYNOPSIS
    Extrai exclusivamente o frontend hospitalar testado na PR #554.
.DESCRIPTION
    Gera uma copia independente dos modulos React hospitalares em
    apps/hospital-web/src/features/hospital. Nao modifica os originais,
    nao faz deploy, nao acessa Firestore ou GCP.
.EXAMPLE
    .\ops\hospital-f0-extract-web.ps1
#>
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$source = Join-Path $repo 'features\hospital'
$dest = Join-Path $repo 'apps\hospital-web\src\features\hospital'
if (-not (Test-Path $source)) {throw 'Codigo-fonte hospitalar nao encontrado.'}
if (-not (Test-Path (Join-Path $repo 'apps\hospital-web\src\App.tsx'))) {
    throw 'Aplicacao web independente ainda nao foi criada.'
}

$folders=@('core','patients','diets','maps','production','distribution','nutrition-audit','administration','reporting','printing')
New-Item -ItemType Directory -Force -Path $dest | Out-Null
foreach($folder in $folders) {
    $from=Join-Path $source $folder
    $to=Join-Path $dest $folder
    if(-not (Test-Path $from)){throw "Modulo ausente: $from"}
    if(Test-Path $to){Remove-Item $to -Recurse -Force}
    Copy-Item $from $to -Recurse -Force
}

$integration=Join-Path $dest 'integration'
New-Item -ItemType Directory -Force -Path $integration | Out-Null
$approved=@(
  'DistributionQueue.tsx','KitchenMapsBoard.tsx','MealProgressPair.tsx',
  'TrackingView.tsx','UnitMapStatusCard.tsx','OrderProgress.tsx',
  'meal-period.mjs','navigation.mjs','order-progress.mjs',
  'order-progress.d.mts','navigation.d.mts','hospital-premium.css'
)
foreach($file in $approved) {
    $from=Join-Path (Join-Path $source 'integration') $file
    if(-not(Test-Path $from)){throw "Arquivo hospitalar ausente: $file"}
    Copy-Item $from (Join-Path $integration $file) -Force
}

# Isolamento de marca no codigo distribuido: os arquivos originais ficam intactos.
$types=@('*.tsx','*.ts','*.mjs','*.css','*.md')
foreach($entry in (Get-ChildItem $dest -Recurse -File -Include $types)) {
    $original=[System.IO.File]::ReadAllText($entry.FullName)
    $changed=$original.Replace('EMPROVEX','COZINHA DIETETICA').Replace('Emprovex','Cozinha Dietetica')
    $changed=$changed.Replace('--emprovex-accent','--hospital-accent')
    # Alinhar o cabecalho de acesso administrativo ao contrato unico da API.
    $changed=$changed.Replace("'x-hospital-organization':organizationId", "'x-hospital-organization-id':organizationId")
    if($entry.Name -eq 'AdministrationView.tsx'){
        # Os codigos de permissao permanecem tecnicos, os rotulos da interface sao brasileiros.
        $changed=$changed.Replace("['UNIT','Unidade']", "['UNIT','Unidade Assistencial']")
        $changed=$changed.Replace("['KITCHEN','Cozinha']", "['KITCHEN','Cozinha Dietética']")
        $changed=$changed.Replace("m.roles.join(' / ')", "m.roles.map(role=>({UNIT:'Unidade Assistencial',KITCHEN:'Cozinha Dietética',NUTRITION:'Nutrição',HOSPITAL_ADMIN:'Administrador'} as Record<string,string>)[role]??role).join(' / ')")
    }
    if($changed -ne $original){
        [System.IO.File]::WriteAllText($entry.FullName,$changed,[System.Text.UTF8Encoding]::new($false))
    }
}
$adminView=Join-Path $dest 'administration\AdministrationView.tsx'
if(-not(Test-Path $adminView)){throw 'Administracao hospitalar ausente na extracao.'}
$adminCode=[IO.File]::ReadAllText($adminView)
if($adminCode.Contains("'x-hospital-organization':organizationId") -or
   -not $adminCode.Contains("'x-hospital-organization-id':organizationId")){
  throw 'Frontend administrativo nao usa o cabecalho de organizacao correto.'
}
$forbidden=@('HospitalShell.tsx','access.ts')
foreach($file in $forbidden){
    if(Test-Path (Join-Path $integration $file)){throw "Dependencia antiga indevida: $file"}
}
$files=(Get-ChildItem $dest -File -Recurse).Count
Write-Host "Extracao concluida: $files arquivos hospitalares copiados, sem imports da interface financeira." -ForegroundColor Green
Write-Host 'Proximo comando: cd apps/hospital-web; npm.cmd install; npm.cmd run build'
Write-Host 'O backend clinico continua sendo separado e exige o gateway autenticado antes do deploy live.'
