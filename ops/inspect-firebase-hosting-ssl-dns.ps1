# EMPROVEX — obter o desafio DNS-01 do certificado Firebase Hosting.
# Somente leitura. Nao altera DNS, certificado, Hosting, Cloud Run ou Vercel.
$ErrorActionPreference = 'Stop'
$Project = 'gen-lang-client-0982077967'
$Site = 'emprovex-cloudrun-943599311487'
$Domain = 'emprovex.com.br'
$Account = 'marcoa.r.aquino@gmail.com'

if ((gcloud.cmd config get-value project 2>$null).Trim() -cne $Project) {
  throw 'SSL_WRONG_PROJECT'
}
if ((gcloud.cmd config get-value account 2>$null).Trim() -cne $Account) {
  throw 'SSL_WRONG_ACCOUNT'
}
$accessToken = @(gcloud.cmd auth print-access-token)
if ($LASTEXITCODE -ne 0 -or $accessToken.Count -ne 1 -or [string]::IsNullOrWhiteSpace($accessToken[0])) {
  throw 'SSL_GCLOUD_TOKEN_UNAVAILABLE'
}
$endpoint = "https://firebasehosting.googleapis.com/v1beta1/projects/$Project/sites/$Site/customDomains/$Domain"
try {
  $domainData = Invoke-RestMethod -Method GET -Uri $endpoint -Headers @{
    Authorization = "Bearer $($accessToken[0])"
  } -TimeoutSec 45
} catch {
  $errorRecord = $_
  $httpCode = if ($errorRecord.Exception.Response) {
    [int]$errorRecord.Exception.Response.StatusCode
  } else { 0 }
  $jsonError = [string]$errorRecord.ErrorDetails.Message
  if (-not $jsonError -and $errorRecord.Exception.Response) {
    try {
      $reader = New-Object System.IO.StreamReader($errorRecord.Exception.Response.GetResponseStream())
      $jsonError = $reader.ReadToEnd()
      $reader.Dispose()
    } catch { $jsonError = '' }
  }
  Write-Host "SSL_API_HTTP: $httpCode"
  if ($jsonError) {
    try {
      $apiError = $jsonError | ConvertFrom-Json
      Write-Host "SSL_API_STATUS: $($apiError.error.status)"
      Write-Host "SSL_API_MESSAGE: $($apiError.error.message)"
      foreach ($detail in @($apiError.error.details)) {
        if ($detail.reason) { Write-Host "SSL_API_REASON: $($detail.reason)" }
      }
    } catch {
      Write-Host "SSL_API_ERROR: $($jsonError.Substring(0,[Math]::Min($jsonError.Length,1200)))"
    }
  }
  if ($httpCode -eq 403) {
    Write-Host 'Acesso 403 ao Firebase Hosting: conferir permissao firebasehosting.sites.get, escopo OAuth e se GCloud e Firebase CLI usam a mesma conta.'
    Write-Host 'Diagnostico local (sem alterar nada): npx.cmd --yes firebase-tools login:list'
    throw 'SSL_API_ACCESS_DENIED_DO_NOT_CHANGE_DNS'
  }
  throw "SSL_API_READ_FAILED_HTTP_$httpCode"
} finally {
  $accessToken = $null
}
if (-not $domainData.name -or $domainData.name -notlike "*/sites/$Site/customDomains/$Domain") {
  throw 'SSL_UNEXPECTED_DOMAIN_RESOURCE'
}
Write-Host '=== FIREBASE HOSTING SSL / SOMENTE LEITURA ==='
Write-Host "SITE: $Site"
Write-Host "DOMINIO: $Domain"
Write-Host "PROPRIEDADE: $($domainData.ownershipState)"
Write-Host "CERTIFICADO: $($domainData.cert.state)"
Write-Host "HOSPEDAGEM: $($domainData.hostState)"
Write-Host "ULTIMA_ATUALIZACAO: $($domainData.updateTime)"

$challenges = @()
if ($domainData.cert.verification.dns.desired) {
  $challenges += @($domainData.cert.verification.dns.desired)
}
if ($domainData.liveMigrationSteps) {
  foreach ($step in @($domainData.liveMigrationSteps)) {
    if ($step.certVerification.dns.desired) {
      $challenges += @($step.certVerification.dns.desired)
    }
  }
}
$records = @(
  foreach ($set in $challenges) {
    foreach ($record in @($set.records)) {
      if ($record.type -eq 'TXT' -and $record.domainName -like '_acme-challenge.*') {
        [PSCustomObject]@{
          NomeCompleto = [string]$record.domainName
          NomeNoRegistroBR = (([string]$record.domainName).TrimEnd('.') -replace '\.emprovex\.com\.br$', '')
          Tipo = 'TXT'
          Valor = [string]$record.rdata
          Acao = [string]$record.requiredAction
        }
      }
    }
  }
)
$records = @($records | Sort-Object NomeCompleto,Valor -Unique)
if ($records.Count -eq 0) {
  Write-Host 'DESAFIO_DNS: ainda nao fornecido pelo Firebase.'
  Write-Host 'Verifique se o TXT hosting-site ja foi reconhecido em PROPRIEDADE.'
  Write-Host 'Se a propriedade estiver pendente, o Firebase ainda precisa atualizar a verificacao.'
  Write-Host 'Detalhes nao sensiveis do estado:'
  @($domainData.issues + $domainData.cert.issues) |
    Where-Object { $_ } |
    Select-Object code, message |
    Format-Table -Wrap
} else {
  Write-Host ''
  Write-Host '=== TXT DNS-01 EXATO PARA REGISTRO.BR ==='
  $records | Format-List NomeCompleto,NomeNoRegistroBR,Tipo,Valor,Acao
  Write-Host 'Crie este novo TXT no Registro.br usando os valores EXATOS acima.'
  Write-Host 'Nao altere A 216.198.79.1, nao remova TXT hosting-site nem google-site-verification.'
  Write-Host 'Depois de salvar, consulte: nslookup -type=TXT _acme-challenge.emprovex.com.br 8.8.8.8'
  Write-Host 'Aguarde ate o Firebase indicar CERT_ACTIVE antes do corte DNS.'
}
