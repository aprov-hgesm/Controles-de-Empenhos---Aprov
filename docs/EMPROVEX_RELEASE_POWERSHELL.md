# EMPROVEX — Procedimento canônico PowerShell (um prebuild, um deploy)

**Sem Cloud Shell, sem Vercel na conta do ChatGPT e sem deploy automático.** Utilizar exclusivamente a sessão Vercel do Fundador na equipe `aprov-hgesms-projects`. Não copiar credenciais nem tokens para o chat ou para GitHub Actions.

## 1. Pré-condições

- Código consolidado por squash em **um único commit na main**, SHA de 40 caracteres informado no handoff; seis release gates e CI aprovados.
- Confirmar no projeto `controles-de-empenhos-aprov` a presença de `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` em Production como segredo server-side. **Não imprimir o valor.** Validar IAM Firebase Auth e database nomeado `emprovex-warehouse`.
- Não habilitar flags de Emulator na Vercel; não alterar Rules Firebase nessa publicação.

## 2. Checkout limpo e prebuild único

```powershell
$ErrorActionPreference = 'Stop'
$scope = 'aprov-hgesms-projects'
$expectedSha = 'SUBSTITUIR_PELO_SHA_FINAL_DA_MAIN'
$workdir = Join-Path $HOME 'emprovex-warehouse-r2-release'
if ($expectedSha -notmatch '^[a-f0-9]{40}$') { throw 'SHA final da main ausente' }
if (Test-Path $workdir) { throw 'Use um diretório novo e limpo para esta release' }
git clone --single-branch --branch main https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov.git $workdir
if ($LASTEXITCODE -ne 0) { throw 'Clone falhou' }
Set-Location $workdir
$head = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $head -ne $expectedSha) { throw "SHA incorreto: $head" }
vercel.cmd link --yes --project controles-de-empenhos-aprov --scope $scope
if ($LASTEXITCODE -ne 0) { throw 'Projeto/scope incorretos' }
vercel.cmd pull --yes --environment=production --scope $scope
if ($LASTEXITCODE -ne 0) { throw 'Falha ao obter configurações de produção' }
vercel.cmd env ls production --scope $scope
if ($LASTEXITCODE -ne 0) { throw 'Falha na consulta das variáveis' }
```

**PARE E CONFIRA:** a lista deve apresentar o NOME `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` em Production; não imprimir valores. Em caso de ausência ou IAM incerto, corrigir pela conta proprietária antes de publicar.

```powershell
vercel.cmd build --prod --scope $scope
if ($LASTEXITCODE -ne 0) { throw 'Prebuild falhou; publicação bloqueada' }
```

## 3. Um deployment staged sem tocar emprovex.com.br

```powershell
vercel.cmd deploy --prebuilt --archive=tgz --prod --skip-domain --scope $scope
if ($LASTEXITCODE -ne 0) { throw 'Deploy staged falhou; não promover' }
$url = 'COLE_AQUI_URL_IMUTAVEL_RETORNADA_PELA_VERCEL'
vercel.cmd inspect $url --scope $scope
if ($LASTEXITCODE -ne 0) { throw 'Deployment não inspecionável' }
vercel.cmd curl "$url/api/health" --scope $scope
if ($LASTEXITCODE -ne 0) { throw 'Health básico falhou' }
```

Verificar **Ready**, URL do deployment e health básico 200. O health básico não comprova permissão de escrita no Warehouse.

## 4. Gate de hospedagem e publicação

- O endpoint `GET /api/central-depositos/health` exige ID token do **fundador**; no deployment staged deve retornar `ok:true`, `authenticatedFounder:true`, `adminAccessToken:true`, `warehouseTransaction:true` (HTTP 200). Anônimo deve ser 401. **Jamais compartilhar o token por mensagem ou log**.
- Fazer smoke de saldo/lote/saída/devolução/inventário em workspace QA isolado, sem dados reais, com plano de rollback. Health read-only não prova escrita.
- Se qualquer verificação falhar: **não promover**; domínio oficial mantém versão anterior.
- Se todas passarem e houver GO expresso, promover **o mesmo deployment** (sem rebuild):

```powershell
vercel.cmd promote $url --scope $scope
if ($LASTEXITCODE -ne 0) { throw 'Promoção falhou' }
vercel.cmd inspect https://emprovex.com.br --scope $scope
vercel.cmd curl https://emprovex.com.br/api/health --scope $scope
```

**Rules:** manter as regras atuais; `firestore.warehouse.server-only.rules` só em alteração controlada posterior, com rollback e teste de equivalência.

**Responsáveis:** ChatGPT/GitHub pela consolidação, CI e memorial. Fundador pelo PowerShell/conta proprietária Vercel e GO operacional.
