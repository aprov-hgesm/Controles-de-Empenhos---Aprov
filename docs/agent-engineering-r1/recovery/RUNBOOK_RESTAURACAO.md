# RUNBOOK_RESTAURACAO — GOVERNANCE-RECOVERY-01

Versão: 2026-10-14. Natureza: **procedimento preparatório, NÃO é registro de restauração executada**.

## 0. Contrato e limites

Somente leitura do backup externo e restauração em **diretório temporário/local descartável**. Proibido `git push`, alterações em `main`, RC, remotos, configs GitHub, Rules, Firebase/Vercel, dados reais, secrets e IAM. **Não executar** comandos de destruição de branches nem restaurar em ambiente operacional. Nunca considerar documentação de um processo prova de que o processo foi executado.

## 1. Prérequisitos antes do ensaio

1. W1 fornece: pacote físico/externo acessível, manifesto de conteúdo/versão, `sha256` de cada artefato (registrado também em canal independente), tipo de pacote, mapa de refs, base e hashes esperados dos documentos. Identificar proveniência/licença de quaisquer terceiros.
2. Verificar que o backup **não** contém senhas, tokens, cookies, chaves, dumps pessoais/operacionais nem `.env`. Não subir artefato em PR público.
3. Operador do teste dispõe de `git`, PowerShell 7 ou Windows PowerShell, espaço em disco e permissões **locais**. Se cifrado, decriptar apenas por ferramenta aprovada, com chave buscada do cofre autorizado (nunca do PR/chat).
4. Confirmar que a amostra inclui refs completas, não apenas commits objetos desconectados, e o hash SHA-256 entregue em caminho de confiança diferente do arquivo testado.
5. Registrar: data, identidade operacional (sem informações sensíveis), caminho anonimizado, versão de `git --version`, identificação de mídia, SHA-256 esperado/obtido, comandos, código de saída e conclusão.

**Gatilho de bloqueio:** sem artefato real, hash confiável, acesso ou chave: **PENDENTE DE DRILL / NÃO DEMONSTRADO**. Não improvisar reconstrução remota.

## 2. Procedimento material, alternativa A — bundle Git (PowerShell)

Execute somente quando W1 declarar que o arquivo fornecido é um `git bundle` completo e contiver as refs esperadas. Configure localmente as variáveis **antes** de executar. Use caminho temporário fora de clone existente. Os comandos abaixo são **exemplo proposto; não executados pelo W2 nesta entrega**.

```powershell
$ErrorActionPreference = 'Stop'
$bundle = 'C:\CAMINHO-LOCAL-SEGURO\governance.bundle'    # substituir
$expectedSha256 = 'COLE_AQUI_SHA256_CONFIAVEL_DE_FONTE_INDEPENDENTE'
$actual = (Get-FileHash -LiteralPath $bundle -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expectedSha256.ToLowerInvariant()) {
  throw "STOP: HASH MISMATCH; não extrair, clonar nem executar."
}
$work = Join-Path ([System.IO.Path]::GetTempPath()) ("emprovex-drill-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null
$mirror = Join-Path $work 'restored.git'
git --version
git clone --mirror -- "$bundle" "$mirror"
if ($LASTEXITCODE -ne 0) { throw "STOP: clone bundle falhou." }
git -C "$mirror" fsck --full --no-reflogs
if ($LASTEXITCODE -ne 0) { throw "STOP: objetos Git inválidos." }
git -C "$mirror" for-each-ref --format='%(refname) %(objectname)' refs/heads refs/tags
if ($LASTEXITCODE -ne 0) { throw "STOP: não foi possível ler refs." }
git -C "$mirror" rev-parse 'refs/heads/main^{commit}'
git -C "$mirror" rev-parse 'refs/heads/main:docs/EMPROVEX_PROGRAM_CONTROL.md'
git -C "$mirror" rev-parse 'refs/heads/main:docs/EMPROVEX_MEMORIAL_OFICIAL.md'
```

Comparar **cada** saída de refs/commits/blobs relevantes ao **manifesto W1**. O SHA de `main` observado em 14/10/2026 (`97556bb8eb04af070016f9e58ddc2d9cca36bb35`) é uma referência histórica de observação, **não** uma exigência eterna nem instrução para reverter `main`. Se o bundle trouxer refs de data posterior, confrontar datas e fonte de verdade do manifesto, não rejeitar automaticamente atualização legítima.

Após comparação, manter pasta temporária apenas pelo período de auditoria (sob política de segurança) e registrar descarte local; **não** promover nem publicar o mirror. Se o bundle for incremental, indicar pré-requisitos e declarar `BLOCKED` até receber cadeia verificável completa.

## 3. Procedimento material, alternativa B — arquivo compactado de snapshot

1. Comparar SHA-256 do arquivo cifrado/compactado com hash externo; interromper se diferente.
2. Verificar assinatura/proveniência quando disponível e decriptar em local controlado sem logar chaves.
3. **Inspecionar entradas antes de extrair**; rejeitar caminhos absolutos, `../`, symlinks fora da área temporária, scripts de execução automática, permissões inseguros e conteúdo confidencial não previsto. Nunca executar `install`, `npm`, arquivos batch ou hooks encontrados no pacote.
4. Extrair somente no diretório temporário; conferir hash por arquivo contra manifesto. Se houver repositório Git completo, `git fsck --full` e `git for-each-ref`; se houver apenas snapshot de fontes, **não** declarar recuperação de histórico/ref Git.
5. Cruzar documentos essenciais e versões de contratos com baseline guardado; registrar quais faltam.

## 4. Planilha de evidências obrigatória

| Prova | Comando/método | Evidência exigida | Estado nesta entrega |
| --- | --- | --- | --- |
| Arquivo realmente acessível | listagem de mídia segura, tipo/tamanho | path anonimizado + hash | PENDENTE |
| Integridade antes de ler | `Get-FileHash SHA256` | esperado vs obtido de origem independente | PENDENTE |
| Bundle Git completo | `git clone --mirror` / `git bundle verify` aplicável | exit code e refs | PENDENTE |
| Objetos íntegros | `git fsck --full --no-reflogs` | exit code = 0 | PENDENTE |
| SHAs de refs | `git for-each-ref` / `git rev-parse` | mapa comparado ao manifesto | PENDENTE |
| Blobs do Program Control e Memorial | `git rev-parse REF:PATH` | SHAs iguais ao manifesto | PENDENTE |
| Conteúdo dos documentos | comparação de hashes/texto | arquivos essenciais presentes | PENDENTE |
| PR DRAFT e comentários | exportação JSON da API | inventário de PRs e lacunas | PENDENTE |
| Rulesets/proteções | leitura administrativa autorizada | estado documentado; restore de config distinto | PARCIAL (observação pública) |
| Segurança / não mutação | comandos completos, scope do ambiente | declaração e evidência de zero `push` | PENDENTE |

## 5. Configurações GitHub: restauração NÃO é cópia de git

Backup de commits e workflow YAML **não** preserva necessariamente PRs abertos e DRAFT, comentários/reviews, branch protections, rulesets, Actions run history, environments, GitHub Apps, webhooks, deploy keys, variáveis, secrets e políticas/permissões. Exportar metadados read-only e inventário **sem secrets** em artefatos separados e criptografados; recuperar por ações administrativas individuais **somente após autorização própria**, nunca nesse drill. Não utilizar um arquivo Git como prova de restore das configurações.

A proteção da branch consultada na data apresentou `protected=false`; `GET /rulesets=[]`. Tentativa de GET detalhado de branch protection retornou 403 por limitação de permissão. A consulta não substitui revisão por administrador.

## 6. Reversibilidade isolada da adoção Agent Skills (hipótese)

- Toda adoção permanece em branch(es) experimentais separadas com arquivos próprios; a saída é **não promover essas alterações**.
- Em caso de rejeição, manter `main`, RC e VISUAL-R1 no SHAs correntes; interromper apenas integração do Agent Engineering e encerrar PR(s) experimentais após deliberação do Coordenador. Não excluir branches como etapa automática.
- Se existirem commits já integrados futuramente, preparar análise de diff e revert **seletivo, em PR separado**, com testes apropriados; nunca `git reset --hard`/force-push em branches compartilhadas nem revert de merge amplo que capture mudanças independentes.
- Validar retorno aos fluxos existentes por políticas `docs/DEVELOPMENT_CI_WORKFLOW.md`, `docs/TESTING_POLICY.md` e `docs/EMPROVEX_CORE_PROTECTION.md`.
- **Não executado.** Este é um procedimento hipotético.

## 7. Saída e autorização

- `CERTIFICADO`: só com prova real material e lacunas explícitas; não significa restore remoto nem proteção do runtime.
- `PARCIAL`: objetos/ref/documentos restaurados, mas outras superfícies importantes não demonstradas.
- `NÃO DEMONSTRADO`: sem backup material ou sem drill.
- Se faltar chave ou acesso: `BLOCKED` do ensaio e `NÃO DEMONSTRADO` da recuperabilidade.
- Relatório final: `RELATORIO_DRILL.md`, com hashes e comandos efetivos. Sem artefato W1, registrar **PENDENTE DE DRILL**, nunca fabricar PASS.
