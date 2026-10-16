# EMPROVEX CLOUD-RUN-R1 W7: QA impersonation and positive-read probe
# Read-only. No production calls, no IAM mutation, no JSON keys, no token output.
$ErrorActionPreference = 'Stop'
$qa = 'emprovex-qa-r1-261015-6275'
$runtime = 'emprovex-qa-runtime@emprovex-qa-r1-261015-6275.iam.gserviceaccount.com'
$token = $null

try {
  Write-Output ('EMPROVEX QA: Teste somente leitura com identidade temporaria: ' + $qa)
  Write-Output 'Solicitando token temporario da service account, sem exibi-lo...'
  $raw = & gcloud.cmd auth print-access-token ('--impersonate-service-account=' + $runtime) ('--project=' + $qa) 2>$null
  if ($LASTEXITCODE -ne 0 -or $null -eq $raw) {
    Write-Output 'PENDENTE: A identidade local ainda nao pode impersonar o runtime QA.'
    Write-Output 'Verificar roles/iam.serviceAccountTokenCreator restrito SOMENTE a conta de servico QA.'
    exit 2
  }
  $token = (@($raw) | Where-Object { $_ -is [string] -and $_.Trim().Length -ge 40 } | Select-Object -Last 1)
  if (-not $token) { throw 'Nenhum token temporario valido encontrado na resposta do gcloud' }
  $token = $token.Trim()
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
  Write-Output 'FAIL: erro na operacao de teste temporario; nenhuma alteracao efetuada.'
  exit 1
} finally {
  $token = $null
  $raw = $null
}
