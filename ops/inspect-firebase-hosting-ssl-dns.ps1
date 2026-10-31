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
    'x-goog-user-project' = $Project
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
Write-Host "ULTIMA_ATUALIZACAO_RECURSO: $($domainData.updateTime)"
Write-Host "ULTIMA_CONSULTA_DNS_PROPRIEDADE: $($domainData.requiredDnsUpdates.checkTime)"
Write-Host "ULTIMA_CONSULTA_DNS_ACME: $($domainData.cert.verification.dns.checkTime)"
Write-Host "RECONCILIANDO: $($domainData.reconciling)"
$issueList = @($domainData.issues) + @($domainData.cert.issues)
foreach ($issue in $issueList) {
  if ($issue.code -or $issue.message) {
    Write-Host "AVISO_FIREBASE: [$($issue.code)] $($issue.message)"
  }
}
$ownershipExpected = @(
  foreach ($set in @($domainData.requiredDnsUpdates.desired)) {
    foreach ($record in @($set.records)) {
      if ($record.type -eq 'TXT' -and $record.rdata -like 'hosting-site=*') {
        [string]$record.rdata
      }
    }
  }
)
$ownershipDiscovered = @(
  foreach ($set in @($domainData.requiredDnsUpdates.discovered)) {
    foreach ($record in @($set.records)) {
      $normalizedText = ([string]$record.rdata).Trim().Trim('"')
      if ($record.type -eq 'TXT' -and $normalizedText -like 'hosting-site=*') {
        $normalizedText
      }
    }
  }
)
Write-Host '=== DNS APICE OBSERVADO PELO FIREBASE (sem filtros de propriedade) ==='
foreach ($set in @($domainData.requiredDnsUpdates.discovered)) {
  Write-Host "DNS_CONJUNTO: $($set.domainName)"
  if ($set.checkError) {
    Write-Host "DNS_CONSULTA_ERRO: [$($set.checkError.code)] $($set.checkError.message)"
  }
  foreach ($record in @($set.records)) {
    if ($record.type -eq 'TXT' -or $record.type -eq 'A' -or $record.type -eq 'AAAA') {
      Write-Host "DNS_REGISTRO: $($record.type) | $($record.rdata) | $($record.requiredAction)"
    }
  }
}
Write-Host "TXT_PROPRIEDADE_ESPERADO: $($ownershipExpected -join ', ')"
Write-Host "TXT_PROPRIEDADE_DETECTADO_FIREBASE: $($ownershipDiscovered -join ', ')"
$acmeDiscovered = @(
  foreach ($set in @($domainData.cert.verification.dns.discovered)) {
    foreach ($record in @($set.records)) {
      if ($record.type -eq 'TXT' -and $set.domainName -like '_acme-challenge.*') {
        [string]$record.rdata
      }
    }
  }
)
Write-Host "TXT_ACME_DETECTADO_FIREBASE: $($acmeDiscovered -join ', ')"

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
  if ($domainData.ownershipState -eq 'OWNERSHIP_ACTIVE' -and $domainData.cert.state -eq 'CERT_ACTIVE') {
    Write-Host 'SSL ATIVO: dominio e certificado verificados; nenhuma entrada TXT nova e necessaria.'
    Write-Host 'Publicacao de codigo: ops/release-emprovex-cloud-run.ps1 (nao alterar DNS/Hosting).'
    if ($domainData.hostState -eq 'HOST_MISMATCH') {
      Write-Host 'HOST_MISMATCH: verificar se o registro A autoritativo e 199.36.158.100 e aguardar caches DNS.'
    }
  } else {
    Write-Host 'Se TXT ja existe, NAO recrie registro: aguarde a verificacao pelo Firebase.'
    Write-Host 'Mantenha os registros existentes e confirme o estado antes de qualquer alteracao.'
  }
}
