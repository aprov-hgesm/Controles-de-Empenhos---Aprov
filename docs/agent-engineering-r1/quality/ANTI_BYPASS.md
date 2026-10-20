# AGENT-QUALITY-01 — Guardrails anti-bypass (PROPOSTA)

**Estado:** inspeção humana/documental; nenhum verificador global instalado no CI. Os padrões abaixo são **sinais a investigar**, não equivalem automaticamente a defeito comprovado.

## Antes de qualquer aprovação

Fixar `BASE_SHA` e `HEAD_SHA` do PR e inspecionar a mudança inteira, inclusive arquivos deletados:

`git diff --name-status BASE_SHA...HEAD_SHA`  
`git diff --check BASE_SHA...HEAD_SHA`  
`git diff --unified=0 BASE_SHA...HEAD_SHA`

Em PowerShell, pode-se usar os mesmos comandos com Git instalado. Não usar `--force`, `reset --hard` ou comandos de escrita para “verificar” qualidade.

| Sinal no diff | Exemplo/padrão | Ação do revisor |
| --- | --- | --- |
| Teste desligado | adição de `.skip(`, `describe.skip`, `test.skip`, `it.skip`, `xit(` ou `xdescribe(` | Exigir justificativa, prova de cobertura alternativa, decisão registrada; não permitir bypass |
| Assertion reduzida | remoção de `assert`, `expect`, `toEqual`, `toBe`, checagens de erro | Comparar comportamento do teste antes/depois; identificar falso PASS |
| Silenciamento de diagnóstico | novo `@ts-ignore`, `@ts-nocheck`, `eslint-disable`, `istanbul ignore`, `nosemgrep` ou `gitleaks:allow` | Bloquear supressão crítica sem decisão formal e alternativa de teste |
| Desligamento de gate | mudanças em `.github/workflows/**`, testes não invocados, `continue-on-error`, `if: false` | Fora do ownership do W4: não editar; notificar coordenador |
| Threshold relaxado | alterações em `ops/typescript-error-budget.json`, budgets de cobertura/tempo, severidade, security thresholds | Registrar delta; exigir aprovação para relaxamento |
| Bypass operacional | `--force`, `force: true`, bypass de confirmação, `delete`/rollback silencioso | Explicar contexto; proibir operações destrutivas não autorizadas |
| Contrato crítico mudado | `firestore*.rules`, auth, billing, recovery, secrets | Classe D, revisão adversarial e autorização competente |
| “PASS” sem evidência | texto “PASS” sem SHA, comando, saída, URL de run, ou em docs-only sem trigger | Reclassificar como `NÃO EXECUTADO`/`NÃO APLICÁVEL` |

## Método de inspeção

1. Gerar diff com SHA fixado; considerar contexto suficiente para distinguir strings/fixtures reais de código ativo.
2. Marcar todo candidato como `FLAGGED` e documentar o trecho, evitando registrar conteúdo sensível.
3. Determinar `CONFIRMED`, `FALSE_POSITIVE` ou `NEEDS_REVIEW`; padrões textuais não decidem sozinhos.
4. Se confirmar degradação, **não** suavizar a validação; retornar ao autor com teste de reprodução e critério de aceite.
5. Se flag envolver ownership externo, workflows canônicos, Rules ou política, parar escrita e pedir arbitragem.

## Limites e próximo passo de automação

**PROPOSTA NÃO IMPLEMENTADA:** futuro utilitário read-only em `scripts/agent-engineering-r1/` pode examinar `git diff` e devolver relatório JSON/Markdown com `path`, `line`, `category`, `evidence` e `disposition`. Deve evitar subprocessos de escrita, credenciais, chamadas de rede, testes caros e varredura do sistema fora do checkout.

**Critérios antes de conectá-lo ao CI:** testes positivos e falsos positivos em fixtures sintéticas; saída determinística, códigos de saída documentados, detecção de exclusão de testes e orçamento, compatibilidade Windows/Node 20; métricas de ruído por piloto; aprovação do Coordenador/Fundador para mexer nos workflows. Relatório automático não constitui aprovação automática.

**NÃO EXECUTADO:** nenhum scanner, build, workflow ou edição em configuração foi efetuado nesta entrega.
