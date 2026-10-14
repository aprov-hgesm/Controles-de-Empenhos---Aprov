# MATRIZ_RECUPERACAO — GOVERNANCE-RECOVERY-01

Data da inspeção: **2026-10-14**. Executor: Worker 2 (auditoria independente). Estado: **PREPARAÇÃO / DRILL MATERIAL PENDENTE**.

## 1. Fontes e observações verificadas

- Repositório: `aprov-hgesm/Controles-de-Empenhos---Aprov` (público), branch `main` em `97556bb8eb04af070016f9e58ddc2d9cca36bb35`, via GitHub `GET /branches/main`.
- `main.protected=false` e `protection.enabled=false` na consulta de branch; `GET /rulesets` retornou `[]`. `GET /branches/main/protection` retornou HTTP 403 (`Resource not accessible by integration`). **Não** afirmar leitura completa das políticas administrativas.
- PR VISUAL-R1 #295: DRAFT, `visual-r1-integration-01@433dad77dcc91ce15a4b2f3a674acb14b91743ae`, base `main`; não integra o escopo da recuperação.
- Nesta inspeção, a busca por branch `agent-eng-r1-w1*`/governance e PRs Agent Engineering não localizou manifesto e backup do Worker 1. Isso **não comprova inexistência** de artefato externo, apenas ausência de evidência acessível.
- Documentos canônicos observados na `main`: `docs/EMPROVEX_MEMORIAL_OFICIAL.md` (blob `6f620d842e6f0009ed819064fb18083f11d9be6c`); `docs/EMPROVEX_PROGRAM_CONTROL.md` (`28540cbfd407e5ccafbfb162651110beb764d12a`); `docs/DEVELOPMENT_CI_WORKFLOW.md` (`a75bae2827d78a2d805e942477f52d6f7acfa593`); `docs/TESTING_POLICY.md` (`6853820cd001011a62693104ce3aba07134d4e73`); `docs/EMPROVEX_CORE_PROTECTION.md` (`073475a05863163e3d05bf9b887330d6871b5f09`).
- **Atenção:** o topo do Memorial na `main` descreve snapshot histórico de 04/10 e SHA produtivo antigo. A integridade de blob não certifica atualidade sem confronto com branches/PRs e estado operacional. Não editar o Memorial nesta frente.

## 2. Matriz de ameaças e controles

| ID | Ameaça | Consequência | Severidade | Controle de prevenção | Evidência/critério da recuperação |
| --- | --- | --- | --- | --- | --- |
| T01 | Exclusão acidental de branch/tag/arquivo | Perda de refs ou texto de governança | Alta | Backup offline/externo de objetos, refs e documentos; retenção imutável e 2 responsáveis | Refs restauradas em clone temporário, SHAs coincidentes, `git fsck --full` |
| T02 | Corrupção/troca de refs | Branch aponta para commit errado | Alta | Manifesto de refs assinado ou com hash autenticado, cópia independente | `rev-parse` versus manifesto; `cat-file -t` para commits |
| T03 | Exclusão de PR DRAFT | Perda de texto/reviews/comentários e contexto de base | Alta | Export independente de metadados PR/issue/reviews/comentários, JSON com timestamp, fora do bundle Git | Comparar contagens/IDs/status na exportação; **não** declarar restauração fiel do PR remoto sem ensaio autorizado |
| T04 | Comprometimento da conta GitHub ou credenciais | Reescrita ou remoção e impossibilidade de acesso | Crítica | MFA/passkeys, recovery codes com guarda segura, contas de contingência autorizadas; cópia fora do mesmo tenant | Restore Git offline possível; operação no GitHub exige credenciais/IAM legítimas |
| T05 | Corrupção do arquivo de backup | Falha de extração/objetos ilegíveis | Crítica | SHA-256 por artefato, duas cópias independentes, teste periódico | Checagem SHA-256 **antes** da extração; `git bundle verify`/`git fsck` |
| T06 | Perda da chave da criptografia | Backup criptografado inacessível | Crítica | Custódia da chave separada, redundância testada e política de rotação | Ensaio offline de decriptação com operador autorizado sem expor chave |
| T07 | Ausência de credenciais/permissão na crise | Sem recriação de repo/configs | Alta | Runbook offline e mapeamento de responsáveis; break-glass auditável | Verificação de acesso por responsável, **sem** restaurar remotamente nesta missão |
| T08 | Backup só do Git (sem estado SaaS) | Secrets, settings, branch protections, Actions, deploys, permissões não recuperáveis | Crítica | Inventário/exportação controlada de configurações; cofre separado para secrets | Declarar matriz de lacunas; recreação administrativa somente sob autorização |
| T09 | Backup armazenado no próprio GitHub sob o mesmo login | Ataque único compromete original e backup | Crítica | Cópia externa isolada, criptografada, com retenção/immutability e hash | Comprovante de segunda localização e leitura independente |
| T10 | Backup contendo tokens/dumps/PII | Exposição operacional | Crítica | Mineração de segredos antes de exportar, acesso mínimo, política de exclusão/redação | Inventário de classificação; nenhum segredo em PR, commit, log, hash list ou screenshot |
| T11 | Recuperação de snapshot obsoleto | Desfaz trabalho do VISUAL-R1/RC | Alta | Isolamento de branches; integração seletiva por decisão humana | Plano apenas hipotético, sem `push`/`reset` no remoto |
| T12 | Manifesto alterado junto do artefato | Hash não comprova autenticidade | Alta | Proveniência independente, assinatura/digest publicado em canal sob outro controle | Conferir assinatura/proveniência e conteúdo canônico; SHA isolado verifica integridade, não autoria |

## 3. Cobertura por superfície

| Superfície | Pode ser coberta por bundle Git? | Requer salvamento independente? | Situação nesta auditoria |
| --- | --- | --- | --- |
| Objetos de commits/trees/blobs selecionados | Sim, se todas as refs necessárias forem incluídas | Manifesto e hashes | **NÃO DEMONSTRADO** (W1 não entregue) |
| Branches/tags e seus HEADs | Sim, se refs exportadas e verificadas | Mapa de refs externo | **NÃO DEMONSTRADO** |
| Arquivos de governança versionados | Sim no commit incluído | Lista de caminhos/blobs críticos | **NÃO DEMONSTRADO** |
| PRs DRAFT (título, estado, review e comentários) | Não; Git contém apenas commits e algumas refs | Exportação GitHub API | **NÃO DEMONSTRADO** |
| Branch protections/rulesets, settings/review policy | Não | Inventário administrativo versionado sem segredos | **NÃO DEMONSTRADO**; risco atual observado |
| Workflow YAML versionado | Sim, quando incluído no Git | Histórico de execuções/artifacts/variáveis separadamente | **PARCIAL CONCEITUAL** |
| Secrets, tokens, variáveis privadas, IAM | Não; nunca colocar no bundle documental | Cofre e procedimento privilegiado separados | **FORA DO ESCOPO** |
| Firebase/Vercel/runtime/Firestore dados | Não | Backups operacionais próprios | **FORA DO ESCOPO** |

## 4. Critérios auditáveis (sem autoaprovação)

**CERTIFICADO** somente após receber artefato W1 com manifesto verificável, conferir SHA de ambos por origem confiável, restaurar de fato em clone/diretório descartável, obter `git fsck --full` íntegro, provar refs/SHAs dos documentos e delimitar lacunas. O termo certificado refere-se estritamente às superfícies efetivamente provadas; **não** certifica PRs, cloud, secrets ou reconstituição produtiva.

**PARCIAL** se o drill Git material passar, mas faltarem superfícies essenciais explicitamente inventariadas ou verificações independentes. **NÃO DEMONSTRADO** se não houver artefato/manifesto ou se não ocorrer drill real. Status da data: **NÃO DEMONSTRADO**.

## 5. Dependências

- W1: manifesto, artefato com localização acessível e autorização para leitura/restore **local**; nenhuma chave/credencial enviada ao chat/PR.
- Coordenador: arbitrar escopo mínimo das refs, versões do Memorial e tratamento de PRs DRAFT, antes de integrar qualquer procedimento.
- Fundador: autorização explícita futura para mudanças remotas, proteções, credenciais, secrets, infraestrutura ou recuperação produtiva. Nenhuma destas ações foi solicitada/executada neste worker.
