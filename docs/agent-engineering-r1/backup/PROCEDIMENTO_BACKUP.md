# GOVERNANCE-BACKUP-01 — Procedimento de salvaguarda Git (Windows/PowerShell)

## Escopo e pré-requisitos
Procedimento **proposto, não executado neste worker**. Exige PowerShell, Git instalado, acesso autorizado de leitura ao GitHub, espaço local suficiente, localização privada para os resultados e destino externo criptografado autorizado. O clone contém histórico e código, podendo preservar **segredos antigos**: tratar todo bundle como confidencial, mesmo que a origem seja pública.

O repositório é `aprov-hgesm/Controles-de-Empenhos---Aprov`. Não operar em produção, Firestore, Vercel, Billing, Rules, `main` ou RC remoto. Os comandos abaixo são leitura remota, escrita **somente local**.

## Execução local sugerida (PowerShell)

```powershell
$ErrorActionPreference = 'Stop'
$Repo = 'https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov.git'
$BackupRoot = Join-Path $HOME ('emprovex-governance-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$Mirror = Join-Path $BackupRoot 'emprovex.git'
$Bundle = Join-Path $BackupRoot 'emprovex-all-refs.bundle'
$Restore = Join-Path $BackupRoot 'restore-test.git'
New-Item -ItemType Directory -Path $BackupRoot | Out-Null

git clone --mirror $Repo $Mirror
if ($LASTEXITCODE -ne 0) { throw 'clone --mirror falhou' }

# Capturar refs de PR explicitamente: nao presumir inclusao no mirror
git -C $Mirror fetch origin '+refs/pull/*/head:refs/pull/*/head'
if ($LASTEXITCODE -ne 0) { throw 'fetch de PRs falhou' }

git -C $Mirror show-ref > (Join-Path $BackupRoot 'refs-capturadas.txt')
if ($LASTEXITCODE -ne 0) { throw 'exportacao das refs falhou' }
git -C $Mirror bundle create $Bundle --all
if ($LASTEXITCODE -ne 0) { throw 'bundle create falhou' }
git -C $Mirror bundle verify $Bundle
if ($LASTEXITCODE -ne 0) { throw 'bundle verify falhou' }

git clone --mirror $Bundle $Restore
if ($LASTEXITCODE -ne 0) { throw 'restore de prova falhou' }

# Provas de referencial minimo; comparar os SHAs com o inventario da data
git -C $Restore rev-parse refs/heads/main
if ($LASTEXITCODE -ne 0) { throw 'main ausente no restore' }
git -C $Restore rev-parse refs/heads/rc-r1-global-frozen-2026-10-09
if ($LASTEXITCODE -ne 0) { throw 'RC ausente no restore' }
git -C $Restore rev-parse refs/pull/295/head
if ($LASTEXITCODE -ne 0) { throw 'PR 295 ausente no restore' }

Get-FileHash -Algorithm SHA256 $Bundle |
  Format-List Path,Hash
Get-FileHash -Algorithm SHA256 (Join-Path $BackupRoot 'refs-capturadas.txt') |
  Format-List Path,Hash
```

**Gates de restauração:** comparar a lista completa de refs e SHAs de origem/espelho/clone restaurado; validar `git fsck --full` no mirror/restauração; conferir a preservação dos heads dos PRs importantes e todos os tags. Se houver refs ausentes, classificar `BLOCKED` ou `PARCIAL`, sem falsear PASS. Não substitua esses checks por um teste de existência simples.

## Metadados GitHub fora do bundle
Exportar separadamente (em diretório privado) PRs abertos e fechados, reviews, comentários, checks, issues, releases, configurações de branch protection, rulesets, permissões e variáveis/configuração dos ambientes (sem expor segredos). Revisar escopo e permissões antes de tentar. Para PRs, o comando ilustrativo requer `gh` autenticado:

```powershell
gh api 'repos/aprov-hgesm/Controles-de-Empenhos---Aprov/pulls?state=all&per_page=100' --paginate --jq '.[] | {number,title,state,draft,head:{ref:.head.ref,sha:.head.sha},base:{ref:.base.ref,sha:.base.sha}}' > (Join-Path $BackupRoot 'pulls.jsonl')
if ($LASTEXITCODE -ne 0) { throw 'exportacao de PRs falhou' }
```

Os exemplos não são auditoria completa de comentários ou proteções. O operador deve organizar exportações adicionais; registrar tanto os resultados quanto as falhas de acesso sem vazar dados.

## Criptografia e cópia externa
1. Criar cópia cifrada do bundle e metadados com ferramenta aprovada (ex.: `age` ou GPG), chave pública de destinatário previamente validada, **nunca** chave privada embutida em script/manifesto.
2. Gravar somente no destino privado expressamente autorizado, com privilégio mínimo, versionamento/imutabilidade e retenção adequada.
3. Comparar SHA-256 dos **bytes cifrados**, tanto no origem como no destino. Fazer prova real de restauração a partir da cópia externa em ambiente isolado.
4. Somente depois de prova de integridade + cobertura + restauração, avaliar `PASS` de backup externo. Não publicar os arquivos ou logs sensíveis no GitHub.

## Relação com Firestore
Este procedimento cobre **somente Git e metadados de governança**. Não exporta dados reais nem substitui `docs/RECUPERACAO_FIRESTORE.md`, `docs/BACKUP_RECOVERY.md` ou políticas de recuperação nativas.