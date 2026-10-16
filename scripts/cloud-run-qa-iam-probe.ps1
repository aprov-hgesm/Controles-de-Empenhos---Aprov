# EMPROVEX CLOUD-RUN-R1 W7: QA impersonation and positive-read probe
# Read-only. No production calls, no IAM mutation, no JSON keys, no token output.
$ErrorActionPreference = 'Stop'
$qa = 'emprovex-qa-r1-261015-6275'
$runtime = 'emprovex-qa-runtime@emprovex-qa-r1-261015-6275.iam.gserviceaccount.com'
$token = $null

try {
  Write-Output ('EMPROVEX QA: Teste somente leitura com identidade temporaria: ' + $qa)
  Write-Output 'Solicitando token temporario da service account, sem exibi-lo...'
  # Windows PowerShell 5.1 may promote redirected native stderr to a terminating
  # NativeCommandError if ErrorActionPreference is Stop. Capture it safely without
  # showing stderr or the access token to the terminal.
  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $raw = @(& gcloud.cmd auth print-access-token ('--impersonate-service-account=' + $runtime) ('--project=' + $qa) 2>&1)
    $gcloudExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($gcloudExitCode -ne 0) {
    $failure = (@($raw) | ForEach-Object { [string]$_ }) -join ' '
    if ($failure -match 'iam.serviceAccounts.getAccessToken|PERMISSION_DENIED|Permission denied|403|TokenCreator') {
      Write-Output 'PENDENTE: TOKEN_CREATOR_NAO_AUTORIZADO. Verificar permissao na conta de servico QA.'
    } elseif ($failure -match 'UNAUTHENTICATED|Login Required|Reauthentication|invalid_grant') {
      Write-Output 'PENDENTE: SESSAO_GCLOUD. Revisar autenticacao local, sem divulgar credenciais.'
    } elseif ($failure -match 'NOT_FOUND|does not exist|not found') {
      Write-Output 'PENDENTE: IDENTIDADE_QA_NAO_ENCONTRADA pelo gcloud.'
    } else {
      Write-Output ('PENDENTE: TOKEN_GCLOUD_FALHOU; exit=' + $gcloudExitCode + '. Detalhes sensiveis omitidos.')
    }
    exit 2
  }
  $token = (@($raw) | ForEach-Object { ([string]$_).Trim() } |
    Where-Object { $_ -match '^[A-Za-z0-9._~+/-]{40,}={0,2}$' } |
    Select-Object -Last 1)
  if (-not $token) {
    Write-Output 'PENDENTE: TOKEN_AUSENTE_OU_FORMATO_INESPERADO. Nenhum token sera exibido.'
    exit 2
  }
  Write-Output 'PASS: Token temporario obtido (conteudo nao exibido).'

  $uriPrefix = 'https://firestore.googleapis.com/v1/projects/' + $qa + '/databases/'
  foreach ($db in @('qa-core', 'qa-warehouse')) {
    # Explicitly limited to 1 document from a dedicated QA-only collection. Never echo the body.
    $uri = $uriPrefix + $db + '/documents/emprovexQaSecurityProbe?pageSize=1'
    $headers = @{ Authorization = 'Bearer ' + $token }
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Method Get -Uri $uri -Headers $headers -TimeoutSec 25 -ErrorAction Stop
      if ([int]$response.StatusCode -ne 200) { throw ('HTTP inesperado: ' + [int]$response.StatusCode) }
      Write-Output ('PASS: ' + $db + ' HTTP 200 para identidade runtime QA.')
    } catch {
      $status = 0
      if ($_.Exception.Response) {
        try { $status = [int]$_.Exception.Response.StatusCode } catch {}
      }
      if ($status -eq 403) {
        Write-Output ('FAIL: ' + $db + ' retornou HTTP 403; IAM condicional pode nao estar autorizado efetivamente.')
      } else {
        Write-Output ('FAIL: ' + $db + ' acesso nao certificado; HTTP=' + $status)
      }
      exit 1
    }
  }
  Write-Output 'PASS PARCIAL: Duas leituras reais QA autorizadas, sem gravacoes.'
  Write-Output 'PENDENTE: Testes negativos independentes, Rules/Auth QA e verificacao do bundle.'
} catch {
  Write-Output 'FAIL: falha controlada da sonda IAM, sem divulgacao de credenciais ou alteracoes.'
  exit 1
} finally {
  $token = $null
  $raw = $null
}
