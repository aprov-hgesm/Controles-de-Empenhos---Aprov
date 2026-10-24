# EMPROVEX — Publicação Vercel PowerShell: procedimento canônico vigente

> **GOV-SIMP-01 / validado em 24/10/2026.** Revoga para este projeto Hobby o antigo procedimento padrão `vercel build --prod` + `deploy --prebuilt`, que conflita com as publicações remotas confirmadas. Esta instrução é a fonte única a ser consultada junto com o [memorial](./EMPROVEX_MEMORIAL_OFICIAL.md). Não publicar documentação por conta própria na Vercel.

## Contrato invariável

**UM commit funcional da `main` → UM deployment staged com build remoto → health + smoke/IAM → promoção do MESMO deployment → inspect no domínio.** Nada de Git push como gatilho: `vercel.json` contém `git.deploymentEnabled=false`.

Equipe Vercel: `aprov-hgesms-projects`; projeto: `controles-de-empenhos-aprov` (`prj_DZ2y10DUaXrcHoRMaZ58FkTCvOHB`); domínio `https://emprovex.com.br`. Usar sessão PowerShell autenticada do proprietário, sem compartilhar chaves ou tokens. Verificar apenas a presença do nome `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` em Production, mantendo regras Firebase vigentes. Revisões de Rules e dados são processos independentes.

## 1. Preparação única por SHA — exportação limpa (sem `.git`)

Após certificação do commit na `main`, ajustar o SHA e executar **somente para um release novo**. Se já existir staged `Ready`, **pular diretamente para seção 3**. Exemplo de clonagem isolada, sem build local:

```powershell
$ErrorActionPreference = 'Stop'
$sha = 'SUBSTITUA_PELO_SHA_COMPLETO_DE_40_CARACTERES'
if ($sha -notmatch '^[0-9a-f]{40}$') { throw 'SHA invalido' }
$base = "D:\EMPROVEX-RELEASE-$($sha.Substring(0,12))"
$repo = Join-Path $base 'repositorio'
$export = Join-Path $base 'deploy'
$archive = Join-Path $base 'source.zip'
if (Test-Path $base) { throw 'Pasta ja existe: nao repetir clone; inspecionar release antes de retomar.' }
New-Item -ItemType Directory -Path $base | Out-Null
git clone --single-branch --branch main --depth 1 https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov.git $repo
if ($LASTEXITCODE -ne 0) { throw 'clone falhou' }
$head = (git -C $repo rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $head -ne $sha) { throw "SHA da main inesperado: $head" }
git -C $repo archive --format=zip --output=$archive $sha
if ($LASTEXITCODE -ne 0) { throw 'git archive falhou' }
Expand-Archive -LiteralPath $archive -DestinationPath $export
if (Test-Path (Join-Path $export '.git')) { throw 'archive contem .git' }
Set-Location $export
```

**Justificativa:** `git archive` exporta precisamente o commit revisado; alterações em `.env.local` ou `.vercel/` que o `vercel link` criar depois não invalidam o SHA. Não executar `git status` pós-link como bloqueador de publicação.

## 2. Um único deploy, com build remoto na Vercel

Executar na pasta exportada acima. Conferir visualmente projeto, equipe e **nomes**, nunca valores, de variáveis de Production. Interromper se houver divergência.

```powershell
vercel.cmd project inspect controles-de-empenhos-aprov --scope aprov-hgesms-projects
vercel.cmd link --yes --project controles-de-empenhos-aprov --scope aprov-hgesms-projects
vercel.cmd env ls production --scope aprov-hgesms-projects
vercel.cmd deploy --prod --skip-domain --archive=tgz --scope aprov-hgesms-projects
```

Esse deploy faz build remoto e mantém o domínio principal sem promoção. **Copiar da resposta o ID `dpl_...` e a URL individual imutável `https://controles-de-empenhos-aprov-...vercel.app`.** Registrar também SHA e o deployment que serve o domínio antes da promoção. Não extrair texto da CLI via parser de tabela, regex, ANSI, stdout/stderr ou locale.

## 3. Retomar staged Ready — SEM clone/link/build/deploy

Esta etapa é a **única** necessária após qualquer falso erro de validação. Trabalhar com a URL imutável já conhecida:

```powershell
$url = 'https://URL-IMUTAVEL-DO-DEPLOYMENT.vercel.app'
vercel.cmd inspect $url --scope aprov-hgesms-projects
vercel.cmd curl /api/health --deployment $url --scope aprov-hgesms-projects
```

Conferir manualmente `id` esperado, `target production`, `status Ready` e JSON com `status: ok`. A proteção Vercel Authentication torna `vercel curl` adequado por usar a sessão da CLI. **Nunca passar `--no-color` ao `vercel curl`: na CLI 64.0.2 foi encaminhado ao `curl` nativo e gerou exit code 2.** Não interpretar uma falha do cliente de verificação como falha do deployment.

**Antes do GO funcional:** testar endpoint restrito `GET /api/central-depositos/health` com sessão de fundador e exigir `checks.authenticatedFounder`, `adminAccessToken` e `warehouseTransaction` positivos; negar anônimo; executar smoke autenticado em workspace QA isolado de login, saldo, NF/alocação, saídas inclusive multi-linha/câmera, transferência, devolução, inventário e Central 3D. Não colar token no chat nem executar operações perigosas em dados reais. O health básico isoladamente **não prova IAM de escrita**.

Se qualquer teste falhar, **não promover**. Corrigir operação/segredo/ambiente conforme o defeito, **reaproveitando o mesmo deployment quando possível**. Não repetir build devido a erro de script/saída.

## 4. Promoção do MESMO ID, após GO e autorização

```powershell
vercel.cmd promote $url --yes --scope aprov-hgesms-projects
vercel.cmd inspect https://emprovex.com.br --scope aprov-hgesms-projects
```

Exigir `Success!` e inspecionar o domínio para comprovar **ID idêntico ao staged**, target `production`, status `Ready`. Se a resposta do `promote` falhar ou se perder, primeiro inspecionar o domínio; só então avaliar retry. Promoção não recompila e não publica Firestore Rules.

## 5. Incidente R2 — exemplo real de publicação comprovada

- Código integrado: `7d4eafd582bff8620d98258c560e8cd0a1f2ef60`.
- Deployment: `dpl_86S1rK9dAZoAgQ385AEfB81LEPbz`, `https://controles-de-empenhos-aprov-3srmos6lf-aprov-hgesms-projects.vercel.app`, `production`, `Ready`.
- Health protegido verificado: `vercel.cmd curl /api/health --deployment <URL> --scope aprov-hgesms-projects` → `{"status":"ok","timestamp":"2026-10-24T20:57:35.433Z"}`.
- `vercel.cmd promote <URL> --yes --scope aprov-hgesms-projects` → `Success!`; `vercel.cmd inspect https://emprovex.com.br --scope aprov-hgesms-projects` → mesmo ID. Build remoto 58 s; pós-build 40 s; 4 CPU-minutos.
- Cinco erros do fluxo anterior: promoção sem staged, guard Git mal posicionado, retomada executando novamente preparação, parser frágil de `inspect`, `--no-color` indevido no `vercel curl`. **Proibir reutilização dos scripts PowerShell antigos e wrappers frágeis.**
- Commits futuros apenas de documentos na `main` **não representam outro release no domínio**; comparar SHA funcional do deployment, não apenas HEAD Git. `git.deploymentEnabled=false` evita nova publicação automática.

**Responsáveis:** executor GitHub por código/documentos/certificação; proprietário pela sessão PowerShell e autorização para promoção. Dados, IAM e Firestore Rules exigem suas próprias aprovações.
