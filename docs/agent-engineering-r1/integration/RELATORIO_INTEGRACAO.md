# INTEGRATION-QA-01 — Relatório de integração controlada

**Data:** 2026-10-14. **Natureza:** integração documental em branch isolada; nenhuma homologação produtiva.
**Branch W5:** agent-eng-r1-w5-integration-qa
**Base efetiva:** main@d23c7aaa3e57de8f9679be48c636a698e5ad8f3d
**Base histórica W1–W4:** main@97556bb8eb04af070016f9e58ddc2d9cca36bb35
**RC observado:** rc-r1-global-frozen-2026-10-09@61e372225834ed6060cd2b36dbdd55d1e1979c2c

## 1. Fontes e proveniência verificadas

| Frente | PR DRAFT | SHA de origem | Mudanças aprovadas apenas para composição documental |
| --- | --- | --- | --- |
| W1 — backup | [#297](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/297) | 25c02d2316c9984b9534c50f53857c91aabf6485 | 4 arquivos / backup/ |
| W2 — recovery | [#296](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/296) | 2f3f3b675447aca6eb3aae2ae8bfc0acf8b9fe62 | 4 arquivos / recovery/ |
| W3 — arquitetura | [#298](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/298) | ed8951f93e8ceb81d35eb6d0518b60bb0661e615 | 9 arquivos / architecture/ |
| W4 — qualidade | [#299](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/299) | e81983402bbe29cd2edc042665556af2fab31a6a | 6 arquivos / quality/ |

**Composição:** 23 blobs documentais copiados por seus próprios Git object IDs, sem alterar seu conteúdo, e quatro novos relatórios no diretório integration/. Não há cherry-pick ou merge dos históricos dos trabalhadores na main. Os PRs originais permanecem independentes para auditoria e correções de autoria. Conferir a igualdade de SHA de blob por arquivo na verificação final da branch.

A árvore da main anterior à composição não continha docs/agent-engineering-r1/. Os 23 caminhos são disjuntos entre si. O arquivo JSON do W1 foi parseado com êxito: arrays com 307 branches e 60 PRs, coincidindo com os totais do inventário **na ocasião da captura não atômica**; não são contagens atuais garantidas.

## 2. Estado concorrente e isolamento

Durante a auditoria a main avançou um commit em relação à base dos workers. O commit d23c7aaa é uma composição VISUAL-R1, com 70 caminhos modificados e novo workflow visual-r1-w4-qa.yml. O PR VISUAL-R1 #295 apareceu fechado e não mesclado como PR (merged=false); conteúdo visual foi incorporado na main por commit consolidado independente, conforme a mensagem do commit. Não confundir encerramento do PR com ausência de integração visual.

Nenhum caminho de W1–W4 colide com os 70 caminhos da composição visual. O mapeamento W4 de **seis** workflows retrata a base histórica 97556bb8; na base atual há também o workflow visual. Não modificar o relatório original por esta atualização: este documento registra a diferença.

O RC lógico 61e37222 permaneceu no SHA consultado. Branch protection para main retornou protected=false; rulesets consultados anteriormente retornaram lista vazia e a leitura administrativa de proteção detalhada por workers foi 403. Logo proteção efetiva requer auditoria administrativa; não existe autorização implícita para mudar settings.

## 3. Parecer de compatibilidade

**W1:** o inventário identifica branches, PRs e documentos, mas não preserva objetos Git offline. Não há bundle, cópia cifrada externa, hashes do backup material ou restauração comprovada. A coleta de refs é não atômica. Não confundir SHA de commit com SHA-256 de backup.

**W2:** matriz e runbook são coerentes para um drill isolado; o relatório registra NÃO DEMONSTRADO. Backup Git e metadados administrativos/PRs são superfícies distintas. O ensaio de recuperação e a validação da chave permanecem bloqueados por dependência externa.

**W3:** quatro wrappers documentais e AGENTS_PROPOSTO.md preservam hierarquia Fundador → Program Control → coordenadores → workers, sem ativar ferramentas externas ou criar AGENTS.md na raiz. Versão upstream fixada: addyosmani/agent-skills@aeac41d4d005999432bb7312f7ff06383a91d59d (MIT). Os wrappers não são skills instaladas.

**W4:** matriz de risco A/B/C/D, checklist, anti-bypass manual e desenho A/B são complementares à política atual. Não foram adicionados guard, script, threshold, workflow ou obrigação universal de browser E2E. Os ganhos são hipóteses, não medições.

**Interseção W3 × W4:** W3 descreve hierarquia/contexto/seleção; W4 descreve comprovação e revisão. Não há conflito de ownership. Classificação de risco do W4 não altera critérios canônicos. Contrato TESTING_POLICY.md (Browser E2E sob demanda) prevalece; eventual ambiguidade com DEVELOPMENT_CI_WORKFLOW.md deve ser arbitrada separadamente.

## 4. Inspeções e limites

**Observado:** metadados dos quatro PRs e compare da base histórica; 23 arquivos lidos por consulta GitHub; inventário JSON W1 parseado; triagem textual limitada a marcadores comuns de chave privada, tokens GitHub e bytes nulos, sem alerta nos 23 arquivos. **A triagem por padrões não é auditoria de segredos completa.** Git blob SHAs das fontes foram fixados para composição sem reescrita.

**Não executado:** backup externo, restore, decriptação, teste de aplicação, typecheck, build, E2E, piloto A/B, instalação de skills, mudança de proteções, merge ou deploy. Nenhum PASS de CI deve ser inferido da ausência de execução em um PR docs-only.

**Propostas:** validar pacote W1 externo e drill W2; auditar proteção de main com credencial administrativa apropriada; reconciliar Memorial (snapshot histórico), gatilhos de E2E e numeração de workflows; submeter uma tarefa documental a teste A/B comparável após autorização.

## 5. Conclusão

**PASS COM PENDÊNCIAS para composição documental em PR DRAFT.**
**NO-GO para incorporação canônica, instalação de AGENTS.md/skills ou relaxamento/alteração de CI.**
Referências complementares: MATRIZ_GATES.md, PLANO_PILOTO_E_ROLLBACK.md e DECISAO_GO_NO_GO.md.

Assinatura de coordenação exigida antes de qualquer promoção; este parecer técnico não a substitui.
