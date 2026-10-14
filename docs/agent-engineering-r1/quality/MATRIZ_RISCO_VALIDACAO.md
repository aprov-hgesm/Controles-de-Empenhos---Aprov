# AGENT-QUALITY-01 — Matriz de risco × validação

## Regra de decisão

Classifique pelo **comportamento e superfície mais arriscados efetivamente tocados**, não pelo nome do PR. Se misturar classes, prevalece a maior. Pré-validação não autoriza ignorar checks automáticos que sejam acionados pelo CI; caminhos documentais puros seguem a exceção existente.

| Classe | Exemplos | Antes do PR (proporcional) | Antes de aceitar o PR | Browser e operação real |
| --- | --- | --- | --- | --- |
| **A — docs/estética sem interação** | Markdown, copy, CSS apenas cosmético sem mudança de hitbox, foco, DOM funcional ou fluxo | Revisar diff, ownership, links, preview visual quando pertinente; `git diff --check` | Evidência do conteúdo e ausência de alteração funcional; se só `docs/**`, Application CI não dispara por desenho | Browser E2E **dispensado**; checagem visual contextual se estética; não acessar dados reais |
| **B — UI com interação** | botão, navegação, estado, foco, modal, hitbox, teclado, mobile/scanner visível | TypeScript e testes/guards diretamente atingidos, análise acessibilidade, estados erro/vazio e screenshots quando possível | CI normalmente aplicável + teste de interação relevante + avaliação humana quando ergonomia for importante | Smoke/browser **direcionado** conforme impacto; E2E completo apenas se a jornada exigir |
| **C — domínio/persistência** | NF, ledger, alocação, saída, saldo, transações, hooks de escrita | RED/GREEN de teste de domínio/regressão, invariantes, concorrência/idempotência, isolamento e Core Protection | CI obrigatório conforme triggers; asserts sobre saldo, movimentos e falhas, evidência de testes com emuladores quando necessário | E2E do fluxo integrado se houver dependência de jornada; sem produção/dados reais |
| **D — alto risco/irreversível** | auth, sessão, Rules, billing, permissões, restauração, migration, operações destrutivas | Modelo de ameaça, plano/rollback, testes negativos de autorização, tenant isolation, TDD e revisão adversarial de contexto novo | Nunca substituir gates existentes; resultados de security/Firestore/contrato + revisão independente e autorização prévia nas superfícies protegidas | E2E direcionado quando envolver UI, ambiente segregado, validação humana de segurança; ação real somente após autorização expressa |

## Checklist transversal

- [ ] Escopo real identificado pelo `git diff --name-status BASE...HEAD`.
- [ ] Sem conflito de ownership com outro worker, RC ou release.
- [ ] Mudanças fora de `docs/**` não recebem exceção documental.
- [ ] Testes relevantes verificam **falhas e invariantes**, não apenas happy path.
- [ ] Evidências distinguem `PASS`, `FAIL`, `NÃO EXECUTADO`, `NÃO APLICÁVEL` e `BLOQUEADO`.
- [ ] Nenhum teste conhecido com regressão real está diferido por conveniência.
- [ ] Sem novas supressões críticas, `.skip`, assertions removidas, configurações suavizadas.
- [ ] Verificação de contrato e visual, quando a mudança puder afetar contraste, foco ou interação.
- [ ] Nenhuma credencial/dado real/Rules/merge/deploy em nome de “teste”.

## Regras especiais

**A misturada com B:** alterar animações pode afetar `prefers-reduced-motion`, foco, clique, loading ou performance; quando afetar comportamento, eleve a classe. Screenshots sem interação não provam navegação.

**C com persistência:** preferir Firebase Emulator e fixtures sintéticas. Casos positivos/negativos devem provar não duplicação, limites, autorização e isolamento. Restaurar saldos reais é proibido sem aprovação.

**D com Rules:** mudança apenas documental não autoriza manipular arquivo `firestore*.rules`. Solicitar árbitro/coordenador se ocorrer impacto fora do ownership.

**Browser E2E:** `docs/TESTING_POLICY.md` declara o E2E como workflow **sob demanda**, não gate geral; uma falha exclusivamente de infraestrutura só pode ser dispensada com evidência positiva de que não houve regressão, registro e julgamento explícito.

## Fluxo de aceitação

`identificar diff → classificar risco → decidir testes → realizar pré-validação direcionada → executar/observar CI aplicável → revisão independente e anti-bypass → evidência de execução → decisão`.

Classes são política experimental deste Worker 4, **não** alteração automática de nenhuma workflow. O Coordenador e o Fundador decidem oficialização.
