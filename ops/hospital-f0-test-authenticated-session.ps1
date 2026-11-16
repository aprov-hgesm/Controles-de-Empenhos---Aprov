<#
.SYNOPSIS
  Teste pontual de login Firebase e sessao hospitalar autenticada.
.DESCRIPTION
  Somente leitura. Solicita senha localmente sem eco e nao grava senha,
  ID token, documentos ou arquivos de diagnostico.
  Compara POST /api/hospital/session diretamente no Cloud Run e pelo Hosting.
#>
[CmdletBinding()]
param([string]$AdminEmail='marcoa.r.aquino@gmail.com')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Net.Http
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12

$project='cozinha-dietetica'
$hospital='hgesm'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envFile=Join-Path $root 'apps\hospital-web\.env.local'
if(-not(Test-Path -LiteralPath $envFile)){throw 'Firebase Web nao configurado em apps/hospital-web/.env.local.'}
$config=Get-Content -LiteralPath $envFile -Raw -Encoding UTF8
$match=[regex]::Match($config,'(?m)^VITE_HOSPITAL_FIREBASE_API_KEY=(\S+)\s*$')
if(-not $match.Success){throw 'Chave publica Firebase Web ausente do arquivo local.'}
$apiKey=$match.Groups[1].Value

function Send-Json([System.Net.Http.HttpClient]$client,[string]$url,[string]$json,[hashtable]$extraHeaders=@{}) {
  $request=New-Object System.Net.Http.HttpRequestMessage ([System.Net.Http.HttpMethod]::Post),$url
  try {
    $request.Content=New-Object System.Net.Http.StringContent ($json,[Text.Encoding]::UTF8,'application/json')
    foreach($name in $extraHeaders.Keys){
      $null=$request.Headers.TryAddWithoutValidation($name,[string]$extraHeaders[$name])
    }
    $response=$client.SendAsync($request).GetAwaiter().GetResult()
    try {
      $raw=$response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
      $type=if($null -ne $response.Content.Headers.ContentType){[string]$response.Content.Headers.ContentType.MediaType}else{'indefinido'}
      $parsed=$null
      if($raw.TrimStart().StartsWith('{')){
        try{$parsed=ConvertFrom-Json -InputObject $raw}catch{}
      }
      return @{http=[int]$response.StatusCode;type=$type;bytes=[Text.Encoding]::UTF8.GetByteCount($raw);parsed=$parsed}
    }finally{$response.Dispose()}
  }finally{$request.Dispose()}
}
$handler=New-Object System.Net.Http.HttpClientHandler
$handler.AllowAutoRedirect=$false
$client=New-Object System.Net.Http.HttpClient ($handler)
$client.Timeout=[TimeSpan]::FromSeconds(35)
$idToken=$null
try {
  $secure=Read-Host ('Digite a senha de '+$AdminEmail) -AsSecureString
  $ptr=[IntPtr]::Zero
  $plain=$null
  try {
    $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    $loginJson=ConvertTo-Json -Compress -InputObject @{
      email=$AdminEmail;password=$plain;returnSecureToken=$true
    }
    $login=Send-Json $client ('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+[uri]::EscapeDataString($apiKey)) $loginJson
  }finally{
    $plain=$null;$loginJson=$null
    if($ptr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
    $secure.Dispose()
  }
  if($login.http -ne 200 -or $null -eq $login.parsed -or -not $login.parsed.idToken){
    throw ('Firebase Authentication nao confirmou login: HTTP '+$login.http+'. Confira a senha, o usuario e o projeto.')
  }
  $idToken=[string]$login.parsed.idToken
  $login=$null
  Write-Host ('PASS: Firebase Authentication confirmou '+$AdminEmail) -ForegroundColor Green

  $cloudUrl=(& gcloud.cmd run services describe cozinha-dietetica-api "--project=$project" '--region=southamerica-east1' '--format=value(status.url)')
  if($LASTEXITCODE -ne 0 -or -not $cloudUrl){throw 'Nao foi possivel consultar a URL do Cloud Run.'}
  $cloudUrl=($cloudUrl|Out-String).Trim()
  $targets=@(
    @{name='Cloud Run direto';url=($cloudUrl+'/api/hospital/session')}
    @{name='Firebase Hosting';url='https://cozinha-dietetica-web.web.app/api/hospital/session'}
  )
  $body=ConvertTo-Json -Compress -InputObject @{organizationId=$hospital}
  foreach($target in $targets){
    $result=Send-Json $client $target.url $body @{
      Authorization=('Bearer '+$idToken)
      'x-hospital-organization-id'=$hospital
    }
    $part=($target.name+': HTTP '+$result.http+' | '+$result.type+' | '+$result.bytes+' bytes')
    if($result.http -eq 200 -and $null -ne $result.parsed -and $result.parsed.status -eq 200){
      Write-Host ('PASS '+$part) -ForegroundColor Green
      Write-Host ('  Perfis autenticados: '+(@($result.parsed.roles) -join ', '))
      Write-Host ('  Unidades autorizadas: '+(@($result.parsed.unitIds) -join ', '))
    }else {
      Write-Host ('FALHA '+$part) -ForegroundColor Yellow
      if($null -ne $result.parsed){
        $serverMessage=if($null -ne $result.parsed.PSObject.Properties['message']){$result.parsed.message}else{'JSON sem mensagem'}
        Write-Host ('  Mensagem da API: '+$serverMessage)
      }else{
        Write-Host '  Resposta nao e JSON valido. Nenhum dado de sessao foi exibido.'
      }
    }
  }
}finally{
  $idToken=$null
  $client.Dispose()
  $handler.Dispose()
}
