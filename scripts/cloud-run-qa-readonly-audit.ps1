# EMPROVEX CLOUD-RUN-R1 / W7
# Auditoria local de infraestrutura IAM/Firestore do QA, apenas consultas.
# Requer gcloud.cmd autenticado no Windows. Nunca altera o projeto padrao.
$ErrorActionPreference = 'Stop'
$qa = 'emprovex-qa-r1-261015-6275'
$runtime = 'emprovex-qa-runtime@emprovex-qa-r1-261015-6275.iam.gserviceaccount.com'
$principal = 'serviceAccount:' + $runtime

function Read-GcloudJson {
  param([string[]]$Arguments)
  $result = & gcloud.cmd @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ('Falha na consulta gcloud: ' + ($Arguments -join ' ') + [Environment]::NewLine + ($result -join [Environment]::NewLine))
  }
  return (($result -join [Environment]::NewLine) | ConvertFrom-Json)
}

try {
  Write-Output ('EMPROVEX QA: Auditoria de leitura / projeto fixado: ' + $qa)
  $project = Read-GcloudJson -Arguments @('projects', 'describe', $qa, '--format=json')
  if ($project.projectId -ne $qa -or $project.lifecycleState -ne 'ACTIVE') {
    throw 'Identidade ou estado do projeto QA divergente'
  }
  Write-Output 'PASS: Projeto QA separado identificado.'

  $billing = Read-GcloudJson -Arguments @('billing', 'projects', 'describe', $qa, '--format=json')
  if ($billing.billingEnabled -ne $true) { throw 'Faturamento QA nao habilitado' }
  Write-Output 'PASS: Faturamento QA ativo. Orçamento e alertas devem ser conferidos em gate proprio.'

  $enabled = & gcloud.cmd services list --enabled --project=$qa --format="value(config.name)" 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'Falha na lista de APIs do QA' }
  foreach ($api in @('firestore.googleapis.com', 'iam.googleapis.com', 'iamcredentials.googleapis.com', 'firebaserules.googleapis.com')) {
    if (@($enabled) -notcontains $api) { throw ('API esperada ausente: ' + $api) }
  }
  Write-Output 'PASS: APIs de seguranca e Firestore QA habilitadas.'

  foreach ($name in @('qa-core', 'qa-warehouse')) {
    $db = Read-GcloudJson -Arguments @('firestore', 'databases', 'describe', ('--database=' + $name), ('--project=' + $qa), '--format=json')
    if ($db.name -ne ('projects/' + $qa + '/databases/' + $name)) { throw ('Database ID divergente: ' + $name) }
    if ($db.locationId -ne 'us-east1' -or $db.databaseEdition -ne 'STANDARD' -or $db.type -ne 'FIRESTORE_NATIVE') {
      throw ('Edicao/tipo/regiao divergente: ' + $name)
    }
    if ($db.deleteProtectionState -ne 'DELETE_PROTECTION_ENABLED') {
      throw ('Protecao contra exclusao ausente: ' + $name)
    }
    if ($db.pointInTimeRecoveryEnablement -ne 'POINT_IN_TIME_RECOVERY_DISABLED') {
      throw ('PITR inesperado: ' + $name)
    }
    if ($name -eq 'qa-core' -and $db.freeTier -ne $true) { throw 'Free tier Core inesperado' }
    if ($name -eq 'qa-warehouse' -and $db.freeTier -ne $false) { throw 'Free tier Warehouse inesperado' }
    Write-Output ('PASS: ' + $name + ' Firestore QA conforme contrato.')
  }

  $account = Read-GcloudJson -Arguments @('iam', 'service-accounts', 'describe', $runtime, ('--project=' + $qa), '--format=json')
  if ($account.email -ne $runtime -or $account.disabled -eq $true) {
    throw 'Identidade de runtime QA inexistente ou desabilitada'
  }
  Write-Output 'PASS: Identidade runtime QA presente.'

  $policy = Read-GcloudJson -Arguments @('projects', 'get-iam-policy', $qa, '--format=json')
  $runtimeBindings = @($policy.bindings | Where-Object { @($_.members) -contains $principal })
  if ($runtimeBindings.Count -ne 2) { throw 'Bindings IAM runtime: esperado exatamente 2, um por banco' }
  foreach ($name in @('qa-core','qa-warehouse')) {
    $expression = "resource.name=='projects/$qa/databases/$name'"
    $expected = @($runtimeBindings | Where-Object {
      $_.role -eq 'roles/datastore.user' -and $_.condition.expression -eq $expression
    })
    if ($expected.Count -ne 1) { throw ('IAM condicional ausente ou amplo demais: ' + $name) }
    Write-Output ('PASS: IAM condicional do ' + $name + ' presente.')
  }
  foreach ($binding in @($policy.bindings)) {
    if (@($binding.members) -contains 'allUsers' -or @($binding.members) -contains 'allAuthenticatedUsers') {
      throw 'Binding IAM publico inesperado no QA'
    }
  }
  Write-Output 'PASS: Sem principals publicos nos bindings explicitos do projeto QA.'
  Write-Output 'PENDENTE: Provas IAM efetivas, Firebase Auth/Rules publicadas, bundle staging e Cloud Run.'
  Write-Output 'PASS PARCIAL: inventario QA verificado sem emitir credenciais ou acessar producao.'
} catch {
  Write-Error ('FAIL: ' + $_.Exception.Message)
  exit 1
}
