# RISCOS_RESIDUAIS — GOVERNANCE-RECOVERY-01

Data: **2026-10-14**. Decisão de recoverability: **NÃO DEMONSTRADO**. Documento de recomendações; **nenhuma alteração administrativa foi executada**.

## 1. Painel de riscos e decisões necessárias

| Prioridade | Risco residual factual ou provável | Evidência/limite | Ação proposta (não executada) | Autoridade / gate |
| --- | --- | --- | --- | --- |
| **CRÍTICA** | Sem recuperação material validada | Backup W1/manifesto não disponibilizados nesta inspeção; `git fsck` não executado | Receber backup; validar SHA externamente; realizar drill isolado independente | W1 entrega; W2 certifica; W5 apenas integra após resultado |
| **CRÍTICA** | Cópia só no GitHub não protege contra perda/comprometimento de conta | Não se demonstrou cópia offsite nem retenção isolada | Cópia externa cifrada, controle de acesso mínimo, retenção imutável e ensaios periódicos | Fundador define provedor, custos e custódia |
| **CRÍTICA** | Perda de chave ou única pessoa com acesso | Custódia de chave não demonstrada | Dupla custódia, recovery documentado, ensaio de decriptação offline sem exposição | Fundador/administrador de segurança |
| **ALTA** | `main` sem proteção aparente | GitHub `GET /branches/main`: `protected=false`; GET de rulesets `[]`; detalhamento HTTP 403 | Propor branch protection/ruleset com PR review, checks obrigatórios, restrição de force-push e deleção, proteção a admins conforme política | **Somente proposta**; fundador/administrador decide |
| **ALTA** | PRs DRAFT e reviews podem não voltar com Git | Git não armazena metadados GitHub de PRs | Export periódico de PRs abertos/fechados e comments/reviews/estado/head/base; retenção independente | W1/owner da automação + governança |
| **ALTA** | Rulesets/Actions/environments/permissions não cobertos por bundle Git | YAML versionado não contém settings nem secrets | Inventário sanitizado com snapshots de settings e playbook de reprovisionamento; validação por administrador | Administrador autorizado; W2 verifica inventário |
| **ALTA** | Descompasso entre Memorial histórico e HEAD real | Topo do Memorial `main` indica estado de 04/10 e SHA R3 anterior, enquanto HEAD observado é 06/10; PRs atuais carregam governança posterior | Fixar cada snapshot com origem, SHA, data e precedência; não sobrescrever documento canônico | Coordenador Geral, fora do ownership W2 |
| **ALTA** | Rollback de Agent Skills comprometer RC/VISUAL-R1 | PR #295 DRAFT em branch independente | Rejeitar apenas as branches Agent Engineering ou preparar revert seletivo auditado em PR próprio se já integrado | Coordenador Geral; nenhuma ação de rollback atual |
| **MÉDIA** | Sucesso aparente de hash sem autenticidade | Hash e backup podem ser adulterados juntos | Assinar manifesto ou custodiar digest em canal independente; auditor W2 fora da superfície W1 | W1/W2 e custodiante |
| **MÉDIA** | Snapshot incompleto (tags, refs órfãs, hidden refs) | Não existe lista W1 para verificar | Export e diff de refs e hashes de objeto; inventário de limitações explícitas | W1 + W2 |
| **MÉDIA** | Confidencialidade do backup | Repositório público; conteúdo do backup desconhecido | Redação, classificação, armazenamento privado cifrado e auditoria de segredo; nunca publicar bundle/dumps em PR | Fundador/segurança |

## 2. Política preventiva recomendada para main (não aplicar nesta missão)

1. Definir proteção de branch/ruleset: PR obrigatório para `main`; revisões independentes; checks exigidos consistentes com `docs/TESTING_POLICY.md` e `docs/DEVELOPMENT_CI_WORKFLOW.md`; restrição de force-push, deleções e bypass; cobertura de administradores com exceções rastreáveis.
2. Mapear gates sem afrouxar Application CI, Core Protection, guards ou testes de isolamento; mudanças no branch protection exigem proposta, leitura de estado administrativo real e plano de recuperação.
3. Registrar quem tem direito de operar configuração e onde ficam evidências offline; implementar mínimo privilégio e verificação periódica.
4. Preparar restauração de PR metadata, GitHub Actions configs e Vercel/Firebase separadamente do código — a segunda camada de configuração **não** é certificada pelo bundle.
5. Usar proteção de branches como prevenção, mas **não** tratá-la como substituta de backup externo testado.

## 3. Critérios para liberação futura ao integrador W5

- W1 entrega artefato real e manifesto de refs/hash com cadeia de custódia apropriada.
- W2 executa ensaio no isolado, registra comandos, `git fsck`, SHA por ref/blob e lista de exceções.
- Relatório identifica explicitamente o que NÃO pode ser restaurado só com Git.
- Nenhum segredo em PR/artefatos públicos; nenhum override de proteção; alterações a `main`, RC e demais programas permanecem fora de escopo.
- Somente o Coordenador decide integração; **nunca** inferir merge automático do fato de o runbook existir.

## 4. Status executivo

- **FATO OBSERVADO:** `main` não protegida conforme metadados públicos; PR VISUAL-R1 #295 DRAFT e em branch separada; W1 sem artefato verificável nesta sessão; documentação oficial legível em `main`.
- **PROPOSTA:** defesa em profundidade, backup cifrado fora de GitHub, export dos metadados GitHub, proteções de branch e drills independentes.
- **PENDÊNCIA:** manifesto/artefato W1, critérios materiais de checksum/fsck, acesso administrativo para configuração e decisão de custódia.
- **NÃO EXECUTADO:** restore real ou local de backup W1, rollback, configuração, force-push, merge, deploy, Rules, operações em dados.
- **Condição final:** `PASS COM PENDÊNCIAS` apenas para a fase preparatória documental; `NÃO DEMONSTRADO` para recuperabilidade.


## 5. Reinspeção da entrega W1

A branch `agent-eng-r1-w1-governance-backup@25c02d2316c9984b9534c50f53857c91aabf6485` existe e seu manifesto declara inventário e procedimento, mas **nenhum artefato de backup Git, SHA-256 de bundle ou cópia externa**. O risco crítico prioritário deixa de ser ausência de documentação W1 e passa a ser ausência **material** de backup testável. A classificação de recuperabilidade mantém-se **NÃO DEMONSTRADO**. Os arquivos W1 não foram modificados pelo W2.
