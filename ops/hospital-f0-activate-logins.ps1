<#
.SYNOPSIS
 Ativa os acessos Firebase e publica a interface hospitalar em uma unica execucao.
.DESCRIPTION
 Execute no computador autorizado; senhas sao solicitadas sem eco pelo terminal.
 Nao grava senhas nem altera o EMPROVEX ou o Cloud Run QA.
#>
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$AdminEmail)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$setup=Join-Path $root 'ops\hospital-f0-create-access.ps1'
$publish=Join-Path $root 'ops\hospital-f0-publish-web.ps1'
foreach($file in @($setup,$publish)){
  if(-not(Test-Path -LiteralPath $file)){throw "Script obrigatorio ausente: $file"}
}
Write-Host 'Etapa 1/2: contas e vinculos hospitalares' -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $setup -AdminEmail $AdminEmail
if($LASTEXITCODE -ne 0){throw 'Cadastro interrompido. Nada sera publicado por esta execucao.'}
Write-Host 'Etapa 2/2: publicar portal Cozinha Dietetica' -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $publish -Publish
if($LASTEXITCODE -ne 0){throw 'Publicacao nao concluida. As contas ja criadas foram preservadas.'}
Write-Host 'HABILITACAO CONCLUIDA: https://cozinha-dietetica-web.web.app' -ForegroundColor Green
Write-Host 'Entre com uma das contas cadastradas e selecione o perfil autorizado.'
