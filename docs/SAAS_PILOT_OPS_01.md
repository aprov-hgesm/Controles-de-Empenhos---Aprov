# SAAS-PILOT-OPS-01 — Runbook operacional do piloto controlado SaaS R1

Data de preparação: **2026-10-05/06**
Branch: `saas-pilot-ops-01`
HEAD inicial obrigatório: `4cc5b3797747d4d49591f4a68196e723700daa74`
Base do PR: `saas-final-audit-01`
Escopo: **documental / operacional somente**

> Este documento prepara a operação futura do primeiro piloto controlado. Ele **não autoriza** Production, piloto real, cobrança real, suspensão/reativação real, publicação de Rules, escrita em dados produtivos, alteração de Warehouse ou qualquer mudança de runtime.

## Estado técnico de referência

Evidência aprovada usada como insumo, sem merge: `saas-pilot-journey-01@f3f699a796566fe03dcc137f22791d2ed8259940`, PR #259, classificação **PASS COM PENDÊNCIAS EXTERNAS**.

Runtime funcional validado na Journey: `75f302e4554336f3646b38e068c4530f6625c7d1`.

Gates registrados pela Journey:

- Application CI `37395922059` — **SUCCESS**;
- SAAS Pilot Journey 01 `37395922126` — **SUCCESS**;
- EMPROVEX Core Protection `37395922283` — **SUCCESS**;
- Browser E2E — **8/8 PASS**;
- TypeScript — **PASS**;
- Production build — **PASS**;
- diff hygiene — **PASS**.

Contrato comercial congelado:

- plano: **Plano Completo**;
- preço: **R$ 70/mês por workspace**;
- trial: **30 dias**;
- vencimento: **5º dia útil**;
- tolerância: **10 dias corridos**;
- founder: **exempt**;
- VIP: **exempt / R$ 0 / acesso completo**;
- pagamento: **externo**;
- confirmação: **manual/admin**;
- suspensão: **manual**;
- reativação: **manual**.

Não fazem parte do contrato do piloto: checkout automático, webhook, auto-suspensão, auto-reativação, signup público, novos tiers ou cobrança por módulo.

---

## 1. Pré-condições do piloto

O piloto só pode ser iniciado quando **todas** as pré-condições abaixo estiverem em PASS.

| ID | Pré-condição | Evidência mínima | Resultado para entrada |
| --- | --- | --- | --- |
| P01 | Production publicada e explicitamente autorizada | deployment/URL e autorização do Coordenador | PASS obrigatório |
| P02 | RC final aprovado por SHA único | SHA congelado e decisão final registrada | PASS obrigatório |
| P03 | Participante identificado | organização/setor, responsável e contato | PASS obrigatório |
| P04 | Workspace definido | workspaceId confirmado sem ambiguidade | PASS obrigatório |
| P05 | UG definida | UG esperada conferida contra participante | PASS obrigatório |
| P06 | Usuário responsável definido | nome operacional + e-mail válido | PASS obrigatório |
| P07 | Conta elegível | identidade/UID/provider/e-mail verificado coerentes | PASS obrigatório |
| P08 | Legal Gate pronto | bundle aplicável e fluxo de aceite operacional | PASS obrigatório |
| P09 | Billing/trial coerentes | status, datas e isenção quando aplicável conferidos | PASS obrigatório |
| P10 | Canal de suporte definido | canal + owner operacional conhecidos pelo participante | PASS obrigatório |
| P11 | Observabilidade mínima disponível | health, deploy, erros e consumo consultáveis | PASS obrigatório |
| P12 | Nenhuma stop condition aberta | revisão do Coordenador | PASS obrigatório |

**Regra:** qualquer FAIL em P01–P12 impede o início e resulta em **PILOT BLOCKED** até correção/revisão.

---

## 2. Critérios de entrada do participante

### PASS

O participante entra no piloto somente se:

1. houver exatamente um workspace-alvo confirmado para o piloto;
2. a UG esperada estiver registrada e conferida;
3. houver usuário responsável com e-mail válido;
4. UID, provider e verificação de e-mail forem coerentes com a conta provisionada;
5. o estado de billing for conhecido e compatível com `trial`, `active` ou `exempt`;
6. não existir inconsistência conhecida de acesso cross-workspace;
7. Legal Gate estiver disponível para o primeiro acesso;
8. o owner de suporte estiver definido;
9. não houver incidente SEV-1/SEV-2 aberto relacionado ao mesmo workspace/RC;
10. o Coordenador tiver autorizado explicitamente o início do piloto.

### FAIL

É FAIL objetivo se ocorrer qualquer um:

- workspace ou UG ambíguos;
- conta sem UID/provider coerente;
- e-mail exigido ainda não verificado;
- billing sem estado determinável;
- dúvida sobre pagamento/tolerância que possa levar a suspensão indevida;
- acesso cross-workspace observado;
- Rule incompatível com o RC;
- Production/RC ainda não autorizados;
- stop condition ativa;
- dependência de repair não planejado para começar.

Não substituir FAIL por decisão informal do operador.

---

## 3. Checklist de provisionamento

Preencher uma cópia por participante. Nenhum item abaixo está marcado como concluído neste documento-base.

| ID | Ação | Responsável | Evidência | Resultado esperado | Status |
| --- | --- | --- | --- | --- | --- |
| PV01 | Confirmar participante e responsável | Coordenador | registro do piloto | participante inequívoco | ☐ PENDENTE |
| PV02 | Confirmar workspaceId | Admin/Coordenador | tela/registro administrativo | workspace correto | ☐ PENDENTE |
| PV03 | Confirmar UG | Admin/Coordenador | registro da UG | UG correta e única | ☐ PENDENTE |
| PV04 | Confirmar UID | Admin | identidade autenticada | UID corresponde ao usuário | ☐ PENDENTE |
| PV05 | Confirmar e-mail | Admin | cadastro | e-mail esperado | ☐ PENDENTE |
| PV06 | Confirmar provider | Admin | Auth/identidade | provider permitido | ☐ PENDENTE |
| PV07 | Confirmar e-mail verificado | Admin | Auth/identidade | verificado quando exigido | ☐ PENDENTE |
| PV08 | Conferir billing | Admin/Financeiro | registro administrativo | status coerente | ☐ PENDENTE |
| PV09 | Conferir trial | Admin/Financeiro | datas do ciclo | 30 dias quando aplicável | ☐ PENDENTE |
| PV10 | Conferir Legal Gate | Admin | estado legal | gate disponível/aceite rastreável | ☐ PENDENTE |
| PV11 | Conferir `warehouseAccess` quando aplicável | Admin/Coordenador | estado Warehouse | compatível com lifecycle | ☐ PENDENTE |
| PV12 | Executar primeiro login acompanhado | Usuário + Suporte | evidência de smoke | autenticação válida | ☐ PENDENTE |
| PV13 | Confirmar workspace/UG vistos pelo usuário | Usuário + Suporte | tela/smoke | contexto correto | ☐ PENDENTE |
| PV14 | Confirmar acesso aos módulos previstos | Usuário + Suporte | checklist Day 0 | somente superfícies autorizadas | ☐ PENDENTE |
| PV15 | Registrar canal de suporte | Suporte | contato confirmado | usuário sabe onde reportar | ☐ PENDENTE |

Se `warehouseAccess` não for aplicável ao perfil/fluxo do participante, registrar **N/A com justificativa**, nunca PASS automático.

---

## 4. Day 0 / Day 1

### Day 0 — ativação controlada

1. confirmar P01–P12;
2. registrar participante, workspace, UG e usuário;
3. conferir billing/trial/exempt sem executar cobrança;
4. abrir o sistema no deployment autorizado;
5. realizar primeiro login acompanhado;
6. completar o Legal Gate quando exigido;
7. conferir visualmente workspace e UG;
8. acessar os módulos previstos para o participante;
9. abrir a Central quando aplicável;
10. confirmar criação/renovação normal da sessão;
11. executar um smoke funcional mínimo **sem improvisar operações destrutivas**;
12. informar canal de suporte e como reportar incidente;
13. registrar as evidências correspondentes em J01–J24.

### Day 1 — estabilização

1. confirmar que o usuário consegue novo login normal;
2. confirmar que não houve permission denied inesperado;
3. revisar erros críticos de browser e saúde da aplicação;
4. conferir incidentes reportados desde o Day 0;
5. confirmar que workspace/UG permanecem corretos;
6. conferir sessão/heartbeat/relogin em comportamento normal;
7. revisar consumo Firestore e sinais de regressão operacional;
8. reclassificar feedback em BUG/TRAINING/PROCESS/FEATURE REQUEST;
9. aplicar stop condition se qualquer risco crítico tiver surgido.

O objetivo de Day 0/Day 1 é provar operação controlada, não maximizar uso do sistema.

---

## 5. Billing manual

### Princípios

- pagamento ocorre fora do EMPROVEX;
- confirmação é administrativa/manual;
- billing não concede bypass de autorização operacional;
- nenhuma mudança real de billing é executada por esta frente documental.

### `trial`

Procedimento futuro:

1. confirmar que o participante é elegível ao trial;
2. registrar a data de início autorizada;
3. conferir que a duração contratual é **30 dias**;
4. registrar data prevista de término;
5. antes do término, conferir decisão comercial: continuar, converter, encerrar ou classificar como exempt quando autorizado;
6. nunca suspender por cálculo informal sem revisar workspace, conta, pagamento e tolerância.

Resultado esperado: período de avaliação conhecido, rastreável e sem cobrança automática.

### `active`

1. confirmar workspace e conta;
2. confirmar existência de pagamento externo válido para o ciclo;
3. registrar confirmação administrativa;
4. conferir vencimento no **5º dia útil**;
5. manter acesso conforme lifecycle e autorização existentes.

Resultado esperado: conta paga/regular identificada sem automação financeira nova.

### `past_due`

1. confirmar vencimento e ausência de confirmação de pagamento;
2. calcular/revisar a tolerância de **10 dias corridos**;
3. manter registro do contato/checagem administrativa;
4. não suspender antes da dupla conferência da seção 6;
5. ao chegar a uma decisão de suspensão, exigir operador identificado e revisão final.

Resultado esperado: inadimplência tratada manualmente sem auto-suspensão.

### `exempt`

Aplicável a founder e VIP autorizado.

1. confirmar que a isenção foi deliberadamente concedida;
2. confirmar valor efetivo **R$ 0**;
3. preservar acesso completo conforme autorização;
4. não gerar cobrança;
5. revisar a isenção somente por decisão administrativa explícita.

Resultado esperado: isentos não entram por engano em `past_due` nem em suspensão financeira.

---

## 6. Suspensão / reativação

### Dupla conferência obrigatória antes de suspensão futura

**Conferência A — operador**

- workspaceId;
- UG;
- conta/UID;
- status de billing;
- vencimento;
- pagamento externo;
- tolerância de 10 dias corridos;
- motivo;
- identidade do operador.

**Conferência B — segundo responsável/Coordenador**

- confirmar que o workspace é exatamente o pretendido;
- confirmar que não é founder/VIP exempt;
- confirmar que a tolerância terminou quando o motivo for financeiro;
- confirmar que não existe pagamento já identificado;
- confirmar que a ação não atinge workspace vizinho;
- autorizar a execução.

Sem A + B: **não suspender**.

### Após suspensão futura

Conferir:

- lifecycle em `disabled`;
- bloqueio operacional esperado;
- sincronização de `warehouseAccess` quando aplicável;
- revogação de sessão;
- tentativa de novo acesso falha de modo esperado;
- ausência de efeito em outro workspace.

### Reativação futura

Antes:

- confirmar workspace/conta;
- confirmar causa resolvida;
- obter autorização administrativa.

Depois:

- lifecycle em `active`;
- `warehouseAccess` coerente quando aplicável;
- sessões antigas não são tratadas como autorização implícita;
- executar novo login;
- confirmar workspace/UG;
- executar smoke mínimo;
- registrar evidência.

A Journey validou tecnicamente `active -> disabled` e `disabled -> active`, incluindo compensação de falha Warehouse. Isso **não substitui** a conferência operacional acima.

---

## 7. Suporte

As severidades abaixo são operacionais do piloto e não constituem SLA comercial.

| Severidade | Impacto | Triagem | Owner | Stop condition |
| --- | --- | --- | --- | --- |
| SEV-1 | segurança, cross-workspace, perda/corrupção de dados, escrita crítica incorreta ou indisponibilidade total com risco de dados | interromper ação do participante, preservar evidência e escalar imediatamente | Coordenador + owner técnico | **SIM — PILOT STOP** |
| SEV-2 | fluxo essencial indisponível sem workaround seguro, autenticação sistêmica quebrada, Rules incompatíveis ou Warehouse crítico incorreto | reproduzir de forma segura, delimitar escopo, bloquear fluxo afetado e escalar | Coordenador + owner técnico | **SIM**, salvo se formalmente provado que o piloto pode continuar sem tocar o fluxo afetado |
| SEV-3 | defeito limitado com workaround seguro e sem risco a dados/segurança | registrar passos, impacto e workaround; priorizar correção/revisão | Suporte + owner funcional/técnico | não por padrão |
| SEV-4 | dúvida de uso, treinamento, melhoria cosmética ou solicitação sem falha funcional | orientar, registrar feedback e classificar | Suporte/Produto | não |

Meta interna do piloto:

- SEV-1: triagem no mesmo momento em que for observado;
- SEV-2: triagem na mesma janela operacional do piloto;
- SEV-3/SEV-4: registrar antes do fechamento da rodada de feedback.

---

## 8. Template de incidente

```text
incidentId:
timestamp:
workspace:
UG:
usuario:
modulo:
operacao:
esperado:
observado:
browser/device:
rede:
severidade:
dados_afetados?: SIM/NAO/DESCONHECIDO
seguranca_afetada?: SIM/NAO/DESCONHECIDO
workaround:
owner:
status:
resolucao:
evidencias:
```

Nunca registrar:

- senha;
- token;
- segredo;
- cookie de sessão;
- chave privada;
- credencial de pagamento.

Quando houver dado pessoal desnecessário para diagnóstico, reduzir ao mínimo operacional.

---

## 9. Stop conditions

Interromper imediatamente o piloto real se houver:

- acesso ou dado **cross-workspace**;
- perda ou corrupção de dados;
- Rule de segurança incompatível;
- autenticação sistêmica quebrada;
- saldo Warehouse escrito incorretamente;
- operação crítica produzindo resultado incorreto;
- incidente de segurança;
- necessidade de repair não planejado;
- suspensão/reativação atingindo workspace errado;
- qualquer condição cujo diagnóstico exija continuar escrevendo dados potencialmente incorretos.

Classificação obrigatória:

**PILOT STOP — COORDENADOR REVIEW**

Ao acionar:

1. parar o fluxo afetado;
2. evitar novas mutações;
3. preservar evidências;
4. registrar incidente;
5. identificar escopo/workspaces potencialmente afetados;
6. decidir separadamente se haverá rollback de app, Rules, dados ou apenas suspensão do piloto;
7. não retomar sem decisão explícita do Coordenador.

---

## 10. Observabilidade

Acompanhar durante o piloto, usando infraestrutura já existente:

| Sinal | O que observar | Ação quando anormal |
| --- | --- | --- |
| Login/Auth | falhas sistêmicas, provider/UID inesperados | classificar incidente e validar identidade |
| Legal | gate ausente, loop de aceite, aceite não persistido | bloquear progressão se legal obrigatório |
| Permission denied | frequência, módulo e workspace | distinguir proteção esperada de regressão |
| Sessions | falha de lease, heartbeat, revogação, tombstone/relogin | revisar sessão e identidade |
| Warehouse | `warehouseAccess`, erros críticos, divergência de saldo | stop se escrita crítica incorreta |
| API | erros de rota/serviço | correlacionar com fluxo e severidade |
| `/api/health` | saúde geral da aplicação | escalar indisponibilidade |
| Firestore consumption | leituras/escritas anormais ou crescimento inesperado | investigar regressão/custo |
| Deploy | SHA/deployment realmente em uso | impedir teste em build errado |
| Browser | erros críticos de console/runtime | registrar operação e impacto |

Não criar nesta frente:

- novo monitor;
- novo workflow;
- nova telemetria;
- nova infraestrutura de alertas.

---

## 11. Feedback

Ao fim de cada rodada, perguntar objetivamente:

- economizou tempo em relação ao processo anterior?
- qual fluxo foi realmente usado?
- qual foi a principal dificuldade?
- ocorreu algum erro?
- houve confiança nos dados exibidos/gravados?
- como o fluxo se compara ao processo anterior?
- qual é a melhoria prioritária?

Classificar cada retorno como:

- **BUG**;
- **TRAINING**;
- **PROCESS**;
- **FEATURE REQUEST**.

Para FEATURE REQUEST:

- **BLOCKER** — impede continuação segura/útil do piloto;
- **IMPORTANT** — gera ganho relevante, mas existe continuação segura;
- **NICE-TO-HAVE** — melhoria sem impacto necessário no piloto;
- **OUT-OF-SCOPE** — não pertence ao objetivo atual.

Pedido de feature não deve virar mudança no RC durante o piloto sem retornar ao fluxo formal de engenharia/governança.

---

## 12. Critério de sucesso

### PILOT SUCCESS

Somente quando:

- todas as pré-condições aplicáveis estiverem PASS;
- J01–J24 aplicáveis estiverem concluídas sem FAIL crítico;
- primeiro login, Legal, contexto workspace/UG e smoke funcional tiverem passado;
- não houver stop condition;
- não houver SEV-1/SEV-2 aberto;
- não houver dúvida sobre integridade/isolamento dos dados;
- saída do piloto estiver registrada.

### PILOT SUCCESS WITH RESIDUALS

Quando:

- não houver stop condition;
- nenhum SEV-1 estiver aberto;
- os fluxos obrigatórios do piloto tiverem passado;
- dados, segurança, isolamento e lifecycle estiverem íntegros;
- restarem apenas SEV-3/SEV-4, treinamento, processo, observabilidade externa ou features não bloqueantes claramente registradas.

### PILOT BLOCKED

Quando ocorrer qualquer um:

- stop condition;
- SEV-1 aberto;
- SEV-2 que atinja fluxo obrigatório sem workaround seguro;
- impossibilidade de completar login/Legal/contexto workspace/UG/smoke obrigatório;
- RC/Production não autorizados;
- inconsistência de billing que possa produzir suspensão indevida;
- necessidade de repair não planejado.

---

## 13. Saída do piloto

### Sucesso

Registrar:

- classificação final;
- estado dos dados;
- acessos ativos;
- billing;
- sessions;
- incidentes abertos/fechados;
- feedback;
- próximos passos.

### Interrupção

1. aplicar **PILOT STOP — COORDENADOR REVIEW**;
2. registrar último estado conhecido seguro;
3. bloquear novas operações afetadas;
4. decidir rollback/suspensão conforme seção 14;
5. registrar critérios para eventual retomada.

### Abandono pelo participante

Registrar:

- motivo informado;
- último acesso conhecido;
- estado de dados;
- estado de billing;
- sessions;
- acesso que deve permanecer/revogar;
- incidentes/feedback pendentes;
- decisão administrativa de encerramento.

### Encerramento controlado

Confirmar explicitamente:

- dados preservados e estado conhecido;
- acesso conforme decisão final;
- billing coerente com encerramento;
- sessions tratadas;
- incidentes classificados;
- feedback consolidado;
- próximo passo definido.

---

## 14. Rollback operacional

### Rollback do app

Objetivo: voltar o deployment/aplicação a uma versão previamente aprovada.

Não implica:

- alterar Rules automaticamente;
- restaurar dados automaticamente;
- desfazer lifecycle automaticamente;
- desfazer repair Warehouse já validado.

**Regra crítica:** rollback do app **NÃO** implica desfazer o repair Warehouse previamente validado.

### Rollback de Rules

É uma decisão de segurança separada.

Exige:

- identificar exatamente a Ruleset alvo;
- confirmar compatibilidade com o app em uso;
- autorização própria;
- validação de segurança após publicação.

Nunca tratar rollback de app como autorização implícita para publicar Rules antigas.

### Rollback de dados

Usar somente quando houver decisão específica baseada em evidência e procedimento de recovery.

Antes:

- delimitar dados afetados;
- preservar evidência;
- identificar fonte/backup/repair adequado;
- avaliar impactos em Warehouse e demais módulos.

Não improvisar alteração manual de dados para “voltar ao normal”.

### Suspensão do piloto

É a opção operacional de parar o uso sem necessariamente alterar app, Rules ou dados.

Preferir suspensão do piloto quando:

- o diagnóstico ainda está em andamento;
- não existe evidência suficiente para rollback técnico;
- continuar operando aumentaria risco.

---

## 15. Matriz de risco

| Risco | Probabilidade | Impacto | Mitigação | Owner | Stop condition? |
| --- | --- | --- | --- | --- | --- |
| `warehouseAccess` inicial ausente/incompatível | MÉDIA | MÉDIO | conferir quando aplicável; preservar fallback histórico; validar lifecycle | Coordenador/Admin | SIM se impedir acesso seguro ou divergir lifecycle |
| Firebase/gRPC A2 residual | BAIXA | MÉDIO | manter risco aceito documentado; observar Auth/Firestore/CI e erros reais do RC | Owner técnico | SIM se virar falha sistêmica/segurança |
| Uptime externo | MÉDIA | MÉDIO | acompanhar health e disponibilidade durante janela do piloto | Operação | SIM se indisponibilidade inviabilizar fluxo obrigatório |
| Vercel quota | MÉDIA | MÉDIO | confirmar deployment pronto antes do piloto; evitar depender de novo deploy durante sessão | Coordenador/Operação | SIM se impedir RC autorizado |
| Erro humano em billing | MÉDIA | ALTO | checklist, evidência externa e dupla conferência | Admin/Financeiro | SIM se gerar risco de suspensão indevida |
| Suspensão de workspace errado | BAIXA | ALTO | Conferência A + B e workspace/UG/UID explícitos | Admin + Coordenador | **SIM** |
| UG incorreta | BAIXA | ALTO | validar UG antes do primeiro login e no smoke | Admin/Coordenador | **SIM** se alterar isolamento/contexto operacional |
| Session revocation inesperada/ineficaz | BAIXA | MÉDIO | usar procedimento de sessão; revogar e exigir novo login quando necessário | Suporte/Admin | SIM se sessão indevida permanecer ativa |
| Rules incompatíveis | BAIXA | ALTO | manter Rules ownership separado; validar Ruleset do RC | Owner técnico/Coordenador | **SIM** |
| Warehouse — escrita/saldo incorreto | BAIXA | ALTO | não improvisar repair; parar mutações e preservar evidência | Owner Warehouse/Coordenador | **SIM** |
| Legado/reconciliações | MÉDIA | MÉDIO | distinguir dado histórico de erro novo; usar reconciliação formal | Owner funcional/técnico | SIM se exigir repair não planejado |
| Cross-workspace | BAIXA | ALTO | smoke de isolamento, permission denied esperado e stop imediato | Coordenador/Owner técnico | **SIM** |
| Legal Gate inconsistente | BAIXA | ALTO | conferir gate/aceite antes de operação | Admin/Coordenador | SIM se acesso puder ocorrer sem requisito aplicável |
| RC/deployment errado | BAIXA | ALTO | conferir SHA/deployment antes de iniciar | Coordenador | **SIM** |
| Falha de suporte/registro | MÉDIA | MÉDIO | canal e owner definidos antes da entrada | Suporte | não por padrão |

### Nota — `warehouseAccess`

Estado conhecido: **PASS COM RISCO RESIDUAL DE COMPATIBILIDADE**; não é blocker por si só.

Contrato validado:

- lifecycle sincroniza `active -> disabled`;
- lifecycle sincroniza `disabled -> active`;
- há compensação para falha Warehouse;
- o fallback histórico das Rules permanece;
- o onboarding não materializa obrigatoriamente `warehouseAccess`.

Nenhuma correção de código é proposta neste runbook.

---

## 16. Evidências do piloto — J01 a J24

Estas linhas são um **template operacional**. Nenhuma evidência futura é declarada como concluída.

| ID | Fase | Ação | Evidência | Responsável | Status |
| --- | --- | --- | --- | --- | --- |
| J01 | PRÉ-PILOTO | Confirmar RC final por SHA | SHA + decisão | Coordenador | PENDENTE |
| J02 | PRÉ-PILOTO | Confirmar Production autorizada | deployment + autorização | Coordenador | PENDENTE |
| J03 | PRÉ-PILOTO | Identificar participante/responsável | registro | Coordenador | PENDENTE |
| J04 | PRÉ-PILOTO | Confirmar workspace e UG | registro/tela | Admin | PENDENTE |
| J05 | PRÉ-PILOTO | Confirmar UID/provider/e-mail verificado | Auth/identidade | Admin | PENDENTE |
| J06 | PRÉ-PILOTO | Conferir billing/trial/exempt | registro administrativo | Admin/Financeiro | PENDENTE |
| J07 | PRÉ-PILOTO | Conferir Legal Gate | estado legal | Admin | PENDENTE |
| J08 | PRÉ-PILOTO | Conferir `warehouseAccess` se aplicável | estado Warehouse | Admin/Coordenador | PENDENTE |
| J09 | PRÉ-PILOTO | Definir suporte e owner | canal registrado | Suporte | PENDENTE |
| J10 | PRÉ-PILOTO | Conferir observabilidade/health | health + acesso aos sinais | Operação | PENDENTE |
| J11 | DURANTE | Primeiro login acompanhado | evidência de acesso | Usuário/Suporte | PENDENTE |
| J12 | DURANTE | Completar/verificar Legal | evidência do gate/aceite | Usuário/Suporte | PENDENTE |
| J13 | DURANTE | Confirmar workspace/UG na sessão | tela/smoke | Usuário/Suporte | PENDENTE |
| J14 | DURANTE | Abrir módulos autorizados | checklist | Usuário/Suporte | PENDENTE |
| J15 | DURANTE | Abrir Central quando aplicável | checklist | Usuário/Suporte | PENDENTE |
| J16 | DURANTE | Confirmar sessão normal | lease/heartbeat/relogin observado | Suporte | PENDENTE |
| J17 | DURANTE | Executar smoke funcional mínimo | registro do fluxo | Usuário/Suporte | PENDENTE |
| J18 | DURANTE | Revisar permission denied/erros críticos | logs/registro | Suporte/Owner técnico | PENDENTE |
| J19 | DURANTE | Registrar incidentes e severidade | incident template | Suporte | PENDENTE |
| J20 | DURANTE | Coletar feedback estruturado | formulário/registro | Suporte/Produto | PENDENTE |
| J21 | PÓS-PILOTO | Revisar dados/acessos/sessions | checklist de saída | Coordenador/Admin | PENDENTE |
| J22 | PÓS-PILOTO | Revisar billing e lifecycle | registro administrativo | Admin/Financeiro | PENDENTE |
| J23 | PÓS-PILOTO | Consolidar incidentes/feedback/residuais | relatório | Coordenador | PENDENTE |
| J24 | PÓS-PILOTO | Declarar classificação e próximo passo | decisão final | Coordenador | PENDENTE |

---

## Procedimento operacional de sessões

Contrato técnico validado:

- sem teto fixo;
- lease de **30 min**;
- heartbeat de **15 min**;
- `browserInstanceId` dinâmico;
- revogação suportada;
- tombstone suportado.

### Sessão suspeita

1. registrar workspace, UG, usuário e contexto;
2. não coletar token/senha;
3. verificar se a sessão é reconhecida pelo usuário;
4. se suspeita persistir, revogar a sessão lógica;
5. exigir logout quando possível;
6. realizar novo login;
7. conferir criação de nova identidade/sessão;
8. confirmar que a sessão/tombstone anterior não recupera acesso.

### Revogação administrativa

- confirmar usuário/workspace;
- registrar motivo;
- revogar;
- confirmar queda das abas/sessão lógica quando aplicável;
- exigir novo login para retomada legítima;
- registrar evidência.

---

## Pendências externas antes da ativação futura

Permanecem fora desta frente e devem ser resolvidas no fluxo próprio:

1. composição/re-freeze do RC final por SHA único;
2. deployment Preview/RC/Production autorizado conforme governança;
3. smoke humano no deployment candidato;
4. fechamento de uptime/publicação conforme frente responsável;
5. início real do piloto mediante autorização explícita;
6. qualquer evidência comercial real de pagamento/suspensão/reativação somente quando autorizada.

Nenhuma dessas pendências deve ser “simulada como concluída” neste runbook.

---

## NÃO EXECUTADO

- piloto real;
- criação de usuário real;
- cobrança real;
- suspensão real;
- reativação real;
- Production;
- publicação de Rules;
- escrita em dados produtivos;
- alteração runtime;
- alteração Warehouse;
- repair Warehouse;
- alteração de RC-COMPOSITION;
- merge deste PR.

---

## Classificação desta frente

**PASS COM PENDÊNCIAS EXTERNAS**

Justificativa: o runbook deixa a operação do piloto objetivamente preparada, com critérios de entrada, provisionamento, billing manual, suspensão/reativação, suporte, incidentes, observabilidade, stop conditions, rollback, feedback, matriz de risco e evidências J01–J24. Porém a ativação depende do RC/deployment autorizado e dos smokes externos ainda não executados.

Objetivo final preservado: **deixar o piloto pronto para ser iniciado mais tarde, sem atrasar o RC-COMPOSITION**.
