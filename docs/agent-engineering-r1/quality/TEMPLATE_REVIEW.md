# AGENT-QUALITY-01 — Template de revisão independente

> Preencher em contexto novo, por revisor distinto do autor sempre que possível. Objetivo: tentar **refutar** alegações não triviais, não apenas concordar. Para CSS trivial, não exigir segunda análise arquitetural extensa.

## Identidade verificável

- PR / link:
- Repositório:
- Base branch + SHA exato:
- HEAD branch + SHA exato:
- Revisão realizada em:
- Autor e revisor (independentes?):
- Caminhos modificados (`git diff --name-status BASE...HEAD`):
- Ownership e conflitos:
- Classe de risco (A/B/C/D) e justificativa:
- Comportamento prometido / escopo proibido:

## 1. Primeiro revisar os testes

- Que comportamento ou falha **cada teste** demonstra?
- Há asserts de resultado observável? Cobrem erro, borda, isolamento, idempotência/concor­rência quando aplicável?
- O teste pode passar com a implementação errada, mock excessivo, falha suprimida ou assertion retirada?
- Quais testes anteriormente existentes ficaram mais fracos/foram removidos?
- Qual foi o comando, SHA, data e saída (não apenas “testado”)?
- O que **não** foi executado? Por quê?

## 2. Revisar implementação nas cinco dimensões

| Eixo | Pergunta adversarial | Evidência/caminho/linha |
| --- | --- | --- |
| Correção | Regressão, borda, ordem de commit, duplicação, contrato, persistência? | |
| Clareza | Fluxo compreensível, sem duplicação ou abstrações gratuitas? | |
| Arquitetura | Core/ADM separados? Alguma mutação operacional atravessou a fronteira proibida? | |
| Segurança | Autorização por workspace, tratamento de dados externos, segredos/logs, Rules? | |
| Performance | Queries repetidas, listeners, renderizações, carga/bundle e latência relevante? | |

## 3. Prova positiva e sinais negativos

- [ ] `git diff --check` examinado / saída:
- [ ] CI aplicável concluído com `success`, com link (ou `NOT_TRIGGERED_BY_DESIGN`):
- [ ] Resultado do Core Protection pertinente, com link:
- [ ] Testes de domínio/Firestore relevantes + casos negativos:
- [ ] Build + TypeScript final quando CI os executa:
- [ ] Browser E2E apenas quando o risco exige; protocolo/resultado:
- [ ] Verificação visual/manual para interação ou estética com impacto:
- [ ] Busca por bypass (`ANTI_BYPASS.md`), com explicação de falsos positivos:
- [ ] Não houve alterações fora do ownership:
- [ ] Declaração de que `main`/RC/Rules/produção/dados reais ficaram intocados:

**Prova positiva** = artefato/saída capaz de demonstrar a propriedade; ausência de falha ou um selo “verde” desacompanhado não basta. Não declare PASS em passo que não executou.

## 4. Doubt-driven quando necessário

Acione revisão adversarial adicional quando houver: nova lógica de ramificação material, cruzamento de fronteira, garantia não provada pelo compilador (idempotência, ordem, isolamento), migração, auth/Rules/billing ou impacto irreversível.

Formato:
1. **CLAIM:** afirmação exata, sem adjetivos de confiança.
2. **ARTIFACT:** menor diff/teste/contrato que permite julgar.
3. **DOUBT:** hipótese concreta de falha, teste que a distinguiria e condição que invalidaria a claim.
4. **RECONCILE:** reproduzir/refutar com evidência, corrigir e revalidar; limitar rodadas e escalar impasse.
5. **STOP:** encerrar quando os riscos materiais receberam prova ou bloqueio explícito.

Não usar “doubt-driven” de alto custo em toda linha CSS sem mudança comportamental.

## 5. Findings e decisão

| Severidade | Arquivo/linha | Fato observável | Como reproduzir | Impacto | Correção exigida? |
| --- | --- | --- | --- | --- | --- |
| Crítico/Alto/Médio/Baixo | | | | | |

- **BLOCK**: vulnerabilidade, mutação proibida, perda de dados, regressão demonstrada, bypass, owner indevido ou ausência de evidência crítica.
- **PASS COM PENDÊNCIAS**: controles aplicáveis satisfatórios, mas dependência externa/validação opcional claramente registrada; não autoriza merge automaticamente.
- **PASS**: requisitos da classe de risco comprovados com SHA e saída; **aprovação formal de merge é separada**.
- **NÃO EXECUTADO**: quando somente a análise documental foi possível.

**Veredito proposto:**  
**Evidências:**  
**Pontos não verificados:**  
**Pendências para o Coordenador/Fundador:**  
**Recomendação ao Worker 5:**  

Referências: [política EMPROVEX](../../TESTING_POLICY.md) e [code-review-and-quality](https://github.com/addyosmani/agent-skills/blob/aeac41d4d005999432bb7312f7ff06383a91d59d/skills/code-review-and-quality/SKILL.md).
