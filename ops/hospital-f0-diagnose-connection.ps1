<#
.SYNOPSIS
  Diagnostica sem credenciais o proxy Firebase Hosting -> Cloud Run hospitalar.
.DESCRIPTION
  Somente leitura. Nao cria contas, nao altera IAM, nao faz deploy.
  Verifica se POST /api/hospital/session sem token retorna JSON 401 em ambos destinos.
#>
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

$serviceUrl=(& gcloud.cmd run services describe cozinha-dietetica-api --project=cozinha-dietetica --region=southamerica-east1 --format='value(status.url)')
if($LASTEXITCODE -ne 0 -or -not $serviceUrl){throw 'Nao foi possivel consultar URL da API no Cloud Run.'}
$serviceUrl=($serviceUrl | Out-String).Trim()
$targets=@(
  @{name='Cloud Run sem token';url=($serviceUrl+'/api/hospital/session');auth=$false}
  @{name='Hosting sem token';url='https://cozinha-dietetica-web.web.app/api/hospital/session';auth=$false}
  @{name='Cloud Run com token falso de teste';url=($serviceUrl+'/api/hospital/session');auth=$true}
  @{name='Hosting com token falso de teste';url='https://cozinha-dietetica-web.web.app/api/hospital/session';auth=$true}
)
$results=@()
foreach($target in $targets){
  $status=0
  $contentType=''
  $body=''
  $requestHeaders=@{'x-hospital-organization-id'='hgesm'}
  if($target.auth){
    # Apenas valor invalido de teste, nunca um token ou senha de usuario.
    $requestHeaders['Authorization']='Bearer diagnostico-not-a-firebase-id-token-0000000000000000'
  }
  try{
    $response=Invoke-WebRequest -Uri $target.url -Method POST -UseBasicParsing -TimeoutSec 40 -ErrorAction Stop `
      -Headers $requestHeaders -ContentType 'application/json' `
      -Body '{"organizationId":"hgesm"}'
    $status=[int]$response.StatusCode
    $contentType=[string]$response.Headers['Content-Type']
    $body=[string]$response.Content
  }catch{
    $response=$_.Exception.Response
    if($null -eq $response){
      Write-Host ($target.name+': falha de rede: '+$_.Exception.Message) -ForegroundColor Red
      continue
    }
    $status=[int]$response.StatusCode
    $contentType=[string]$response.ContentType
    $stream=$response.GetResponseStream()
    if($null -ne $stream){
      $reader=New-Object IO.StreamReader($stream)
      try{$body=$reader.ReadToEnd()}finally{$reader.Dispose()}
    }
  }
  $parsed=$null
  try{$parsed=$body|ConvertFrom-Json}catch{}
  # PowerShell 5.1 pode consumir o corpo de respostas HTTP 4xx antes deste catch.
  # Aqui verificamos apenas status e Content-Type, sem afirmar que o JSON foi lido.
  $isExpected=($contentType -match 'application/json') -and $status -eq 401
  $result=if($isExpected){'OK'}else{'FALHA'}
  Write-Host ($target.name+': '+$result+' | HTTP '+$status+' | Content-Type '+$contentType) -ForegroundColor $(if($isExpected){'Green'}else{'Yellow'})
  if(-not $isExpected){
    $safe=($body -replace '\\s+',' ')
    if($safe.Length -gt 350){$safe=$safe.Substring(0,350)+'...'}
    Write-Host ('  Resposta (sem credenciais): '+$safe)
  }
  $results+=@{name=$target.name;pass=$isExpected;http=$status}
}
if($results.Count -ne 4){throw 'Nem todos os destinos responderam. Verifique o erro de rede acima.'}
if(@($results|Where-Object {-not $_.pass}).Count -gt 0){
  Write-Warning 'HTTP/status de conteudo divergentes. Nao altere contas nem IAM apenas por este teste.'
}else{
  Write-Host 'API e Hosting respondem HTTP 401 com Content-Type JSON: roteamento basico confirmado.' -ForegroundColor Green
  Write-Host 'Se o navegador ainda falhar apos o login, examine somente o HTTP da requisicao autenticada (sem compartilhar token).'
}
